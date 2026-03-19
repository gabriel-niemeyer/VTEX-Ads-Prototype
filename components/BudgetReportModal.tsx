import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip as CJSTooltip,
  type ChartOptions,
  type Plugin,
  type ScriptableContext,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Chart, Line as ChartLine, Bar as ChartBar } from 'react-chartjs-2';
import { Campaign } from '../types';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Filler, CJSTooltip, annotationPlugin,
);

/** Gradiente azul claro sob a linha de gasto realizado (topo forte → some no eixo). */
function scriptableBlueSpendAreaFill(context: ScriptableContext<'line'>) {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  if (!chartArea) return 'rgba(3, 102, 221, 0.14)';
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, 'rgba(3, 102, 221, 0.22)');
  g.addColorStop(0.4, 'rgba(3, 102, 221, 0.08)');
  g.addColorStop(1, 'rgba(3, 102, 221, 0)');
  return g;
}

/** Mesma ideia, opacidades ~metade — previsão (linha tracejada) fica visualmente secundária. */
function scriptableBlueForecastAreaFill(context: ScriptableContext<'line'>) {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  if (!chartArea) return 'rgba(3, 102, 221, 0.06)';
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, 'rgba(3, 102, 221, 0.1)');
  g.addColorStop(0.45, 'rgba(3, 102, 221, 0.035)');
  g.addColorStop(1, 'rgba(3, 102, 221, 0)');
  return g;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);

const formatCurrencyFull = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val);

/** Ease-out-expo: deceleração suave no fim (animação de entrada elegante) */
function easeOutExpo(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Retorna progresso 0..1 para animação de count-up. Respeita prefers-reduced-motion.
 * @param durationMs duração da animação em ms (ex.: 700)
 * @param delayMs atraso antes de iniciar em ms (stagger entre cards)
 */
function useCountUpProgress(durationMs: number, delayMs: number): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setProgress(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < delayMs) {
        setProgress(0);
        raf = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (elapsed - delayMs) / durationMs);
      setProgress(easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, delayMs]);

  return progress;
}

const DAILY_SPEND_MIN_RATIO = 0.35;
const DAILY_SPEND_MAX_RATIO = 1.65;

function getDailySpendDistribution(totalSpend: number, numDays: number, seed: string): number[] {
  if (numDays <= 0 || totalSpend <= 0) return [];
  const mean = totalSpend / numDays;
  const weights: number[] = [];
  for (let d = 0; d < numDays; d++) {
    const h = (seed + d).split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
    const t = Math.abs(h % 1000) / 1000;
    const w = 0.5 + 0.8 * t;
    weights.push(w);
  }
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (sumW <= 0) return weights.map(() => mean);
  let out = weights.map((w) => (totalSpend * w) / sumW);
  const low = mean * DAILY_SPEND_MIN_RATIO;
  const high = mean * DAILY_SPEND_MAX_RATIO;
  out = out.map((v) => Math.max(low, Math.min(high, v)));
  const sumOut = out.reduce((a, b) => a + b, 0);
  if (sumOut <= 0) return out.map(() => mean);
  return out.map((v) => (totalSpend * v) / sumOut);
}

/** Pesos por hora (0–23): mais gasto em horário comercial, menos à noite. */
function getHourlyWeights(seed: string): number[] {
  const w: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (h >= 6 && h <= 7) w.push(0.5);
    else if (h >= 8 && h <= 18) w.push(1);
    else if (h >= 19 && h <= 22) w.push(0.6);
    else w.push(0.2);
  }
  const h = (seed + 'hourly').split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0);
  const rng = () => { const x = Math.sin(h + 1) * 10000; return x - Math.floor(x); };
  return w.map((v, i) => Math.max(0.1, v * (0.7 + 0.6 * rng())));
}

/** Distribui o gasto do dia nas horas 0..currentHour (inclusive). Retorna 24 valores. */
function getHourlySpendDistribution(dayTotalSpend: number, seed: string, currentHour: number): number[] {
  const out = new Array<number>(24).fill(0);
  if (dayTotalSpend <= 0 || currentHour < 0) return out;
  const weights = getHourlyWeights(seed);
  const end = Math.min(23, currentHour);
  let sumPast = 0;
  for (let h = 0; h <= end; h++) sumPast += weights[h];
  if (sumPast <= 0) return out;
  for (let h = 0; h <= end; h++) out[h] = (dayTotalSpend * weights[h]) / sumPast;
  return out;
}

/* ── Chart.js custom plugin: crosshair vertical line on hover ── */
const crosshairPlugin: Plugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const tt = chart.tooltip;
    if (!tt || tt.opacity === 0 || !tt.dataPoints?.length) return;
    const x = tt.dataPoints[0].element?.x;
    if (x == null) return;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
};
ChartJS.register(crosshairPlugin);

/* ── Chart.js custom plugin: "Hoje" pill on x‑axis ── */
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ── Tooltip content components (rendered as HTML overlays) ── */
interface TotalDataPoint {
  day: number; date: string; dateTooltip: string;
  cumulative?: number; forecast?: number; forecastLow?: number; forecastHigh?: number;
  goal: number; isToday?: boolean;
}
interface DailyDataPoint {
  day: number; date: string; dateTooltip: string;
  dailySpend: number; dailyBudget: number; isToday?: boolean;
  isFuture?: boolean;
  impressionShare?: number; // 0-100, sintético por dia para gráfico
}
interface HourlyDataPoint {
  hour: number;
  hourLabel: string;
  hourlySpend: number;
  hourlyBudget: number;
  isPast: boolean;
  isCurrentHour?: boolean;
  impressionShare?: number; // 0-100, sintético por hora para gráfico
}
interface HourlyCumulativeDataPoint {
  hour: number;
  hourLabel: string;
  cumulative?: number;
  forecast?: number;
  forecastLow?: number;
  forecastHigh?: number;
  goal: number;
  isCurrentHour?: boolean;
  isPast: boolean;
}

function TotalTooltipContent({ data }: { data: TotalDataPoint }) {
  const { dateTooltip, cumulative, forecast, forecastLow, forecastHigh, goal, isToday } = data;
  const hasForecast = !isToday && typeof forecast === 'number';
  const hasDeviation = hasForecast && typeof forecastLow === 'number' && typeof forecastHigh === 'number';
  return (
    <div className="rounded-xl border border-gray-200/90 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] min-w-[200px]">
      <p className="text-[12px] font-normal tracking-[-0.02em] text-[color:var(--sl-fg-base-soft)] mb-3">{dateTooltip}</p>
      <div className="space-y-3">
        {typeof goal === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#1f1f1f] shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Meta de consumo total</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(goal)}</p>
            </div>
          </div>
        )}
        {typeof cumulative === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#0366dd] shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Realizado</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(cumulative)}</p>
            </div>
          </div>
        )}
        {hasForecast && (
          <>
            <div className="flex items-start gap-2">
              <svg width="12" height="4" className="shrink-0 mt-2" aria-hidden><line x1="0" y1="2" x2="12" y2="2" stroke="#0366dd" strokeWidth={1.5} strokeDasharray="3 2" /></svg>
              <div>
                <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Previsão</p>
                <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(forecast!)}</p>
              </div>
            </div>
            {hasDeviation && (
              <div className="rounded-lg bg-gray-50/80 border border-gray-100 px-3 py-2 mt-2">
                <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] mb-1.5">Faixa de desvio</p>
                <div className="flex items-baseline justify-between gap-4 text-[12px] tabular-nums text-[color:var(--sl-fg-base)]">
                  <span>{formatCurrencyFull(forecastLow!)}</span>
                  <span className="text-[color:var(--sl-fg-base-muted)] font-light">→</span>
                  <span>{formatCurrencyFull(forecastHigh!)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DailyTooltipContent({ data, showImpressionShare }: { data: DailyDataPoint; showImpressionShare?: boolean }) {
  const { dateTooltip, dailySpend, dailyBudget, impressionShare } = data;
  return (
    <div className="rounded-xl border border-gray-200/90 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] min-w-[200px]">
      <p className="text-[12px] font-normal tracking-[-0.02em] text-[color:var(--sl-fg-base-soft)] mb-3">{dateTooltip}</p>
      <div className="space-y-3">
        {typeof dailySpend === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#0366dd] shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Gasto diário</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(dailySpend)}</p>
            </div>
          </div>
        )}
        {typeof dailyBudget === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#eaeaea] border border-gray-200 shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Orçamento médio diário</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(dailyBudget)}</p>
            </div>
          </div>
        )}
        {showImpressionShare && typeof impressionShare === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#059669] shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">{data.isFuture ? 'Impression Share (previsão)' : 'Impression Share'}</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{impressionShare.toFixed(1)}%</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HourlyTooltipContent({ data, showImpressionShare }: { data: HourlyDataPoint; showImpressionShare?: boolean }) {
  const { hourLabel, hourlySpend, hourlyBudget, impressionShare, isPast, isCurrentHour } = data;
  return (
    <div className="rounded-xl border border-gray-200/90 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] min-w-[200px]">
      <p className="text-[12px] font-normal tracking-[-0.02em] text-[color:var(--sl-fg-base-soft)] mb-3">
        {hourLabel}{isCurrentHour ? ' (agora)' : ''}
      </p>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-sm bg-[#0366dd] shrink-0 mt-1.5" />
          <div>
            <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Gasto na hora</p>
            <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(hourlySpend)}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-2 h-2 rounded-sm bg-[#eaeaea] border border-gray-200 shrink-0 mt-1.5" />
          <div>
            <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Meta por hora</p>
            <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(hourlyBudget)}</p>
          </div>
        </div>
        {showImpressionShare && typeof impressionShare === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#059669] shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">{isPast || isCurrentHour ? 'Impression Share' : 'Impression Share (previsão)'}</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{impressionShare.toFixed(1)}%</p>
            </div>
          </div>
        )}
        {!isPast && (
          <p className="text-[11px] text-[color:var(--sl-fg-base-soft)] italic">Próxima hora</p>
        )}
      </div>
    </div>
  );
}

function HourlyCumulativeTooltipContent({ data }: { data: HourlyCumulativeDataPoint }) {
  const { hourLabel, cumulative, forecast, forecastLow, forecastHigh, goal, isCurrentHour, isPast } = data;
  const hasForecast = !isPast && typeof forecast === 'number';
  const hasDeviation = hasForecast && typeof forecastLow === 'number' && typeof forecastHigh === 'number';
  return (
    <div className="rounded-xl border border-gray-200/90 bg-white px-5 py-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)] min-w-[200px]">
      <p className="text-[12px] font-normal tracking-[-0.02em] text-[color:var(--sl-fg-base-soft)] mb-3">
        {hourLabel}{isCurrentHour ? ' (agora)' : ''}
      </p>
      <div className="space-y-3">
        {typeof goal === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#1f1f1f] shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Meta do dia</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(goal)}</p>
            </div>
          </div>
        )}
        {typeof cumulative === 'number' && (
          <div className="flex items-start gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#0366dd] shrink-0 mt-1.5" />
            <div>
              <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Acumulado até esta hora</p>
              <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(cumulative)}</p>
            </div>
          </div>
        )}
        {hasForecast && (
          <>
            <div className="flex items-start gap-2">
              <svg width="12" height="4" className="shrink-0 mt-2" aria-hidden><line x1="0" y1="2" x2="12" y2="2" stroke="#0366dd" strokeWidth={1.5} strokeDasharray="3 2" /></svg>
              <div>
                <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight">Previsão</p>
                <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(forecast!)}</p>
              </div>
            </div>
            {hasDeviation && (
              <div className="rounded-lg bg-gray-50/80 border border-gray-100 px-3 py-2 mt-2">
                <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] mb-1.5">Faixa de desvio</p>
                <div className="flex items-baseline justify-between gap-4 text-[12px] tabular-nums text-[color:var(--sl-fg-base)]">
                  <span>{formatCurrencyFull(forecastLow!)}</span>
                  <span className="text-[color:var(--sl-fg-base-muted)] font-light">→</span>
                  <span>{formatCurrencyFull(forecastHigh!)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Tooltip com posicionamento inteligente que nunca sai do viewport.
 * - Vertical: acima do cursor por padrão; abaixo se não couber acima.
 * - Horizontal: centralizada; se perto da borda esquerda, alinha à direita do cursor;
 *   se perto da borda direita, alinha à esquerda do cursor.
 * - Se containerRef for passado (ex.: gráfico diário), prioriza manter a tooltip dentro do
 *   container e perto do cursor, podendo sobrepor o gráfico.
 */
function SmartTooltip({
  x,
  y,
  children,
  containerRef,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  containerRef?: React.RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: 'hidden', position: 'fixed' });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width: w, height: h } = el.getBoundingClientRect();
    const pad = 12;
    const cursorGap = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const container = containerRef?.current;
    const bounds = container ? container.getBoundingClientRect() : null;

    let top: number;
    if (bounds) {
      // Dentro do gráfico: posicionar perto do cursor, permitindo sobrepor o conteúdo
      const idealAbove = y - h - cursorGap;
      const idealBelow = y + cursorGap;
      const minTop = bounds.top + 4;
      const maxTop = bounds.bottom - h - 4;
      if (idealAbove >= minTop && idealAbove <= maxTop) {
        top = idealAbove;
      } else if (idealBelow >= minTop && idealBelow <= maxTop) {
        top = idealBelow;
      } else {
        top = Math.max(minTop, Math.min(maxTop, idealAbove >= minTop ? idealAbove : idealBelow));
      }
    } else {
      top = y - h - cursorGap;
      if (top < pad) top = y + cursorGap;
      if (top + h > vh - pad) {
        const aboveTop = y - h - cursorGap;
        if (aboveTop >= pad) top = aboveTop;
        else top = Math.max(pad, vh - h - pad);
      }
      if (top < pad) top = pad;
    }

    let left: number;
    const spaceRight = vw - x;
    const spaceLeft = x;

    if (spaceLeft < w / 2 + pad) {
      left = x + cursorGap;
    } else if (spaceRight < w / 2 + pad) {
      left = x - w - cursorGap;
    } else {
      left = x - w / 2;
    }
    if (bounds) {
      left = Math.max(bounds.left + 4, Math.min(bounds.right - w - 4, left));
    } else {
      left = Math.max(pad, Math.min(vw - w - pad, left));
    }

    setStyle({ left, top, visibility: 'visible', position: 'fixed' });
  }, [x, y, containerRef]);

  return createPortal(
    <div ref={ref} className="pointer-events-none" style={{ ...style, zIndex: 2147483647 }}>
      {children}
    </div>,
    document.body
  );
}

function LegendItem({
  children,
  visible,
  onClick,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode;
  visible: boolean;
  onClick: () => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`
        flex items-center gap-2 text-[12px] font-medium tracking-[-0.01em] rounded-md px-1.5 py-0.5 -mx-1.5 -my-0.5
        transition-all duration-200 ease-out cursor-pointer select-none
        focus:outline-none focus:ring-2 focus:ring-[#0366dd]/30 focus:ring-offset-1
        hover:bg-black/5
        ${visible
          ? 'text-[color:var(--sl-fg-base-soft)] opacity-100 hover:opacity-80'
          : 'text-[color:var(--sl-fg-base-muted)] opacity-50 line-through hover:opacity-70'
        }
      `}
    >
      {children}
    </button>
  );
}

function TotalChartLegend({
  visible,
  onToggle,
}: {
  visible: [boolean, boolean, boolean];
  onToggle: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-start gap-6 text-[12px] flex-wrap">
      <LegendItem visible={visible[0]} onClick={() => onToggle(0)} aria-label="Alternar Meta de consumo total">
        <svg width="24" height="4" className="shrink-0" aria-hidden>
          <line x1="0" y1="2" x2="24" y2="2" stroke="#1f1f1f" strokeWidth={2} />
        </svg>
        <span>Meta de consumo total</span>
      </LegendItem>
      <LegendItem visible={visible[1]} onClick={() => onToggle(1)} aria-label="Alternar Realizado">
        <svg width="24" height="4" className="shrink-0" aria-hidden>
          <line x1="0" y1="2" x2="24" y2="2" stroke="#0366dd" strokeWidth={2} />
        </svg>
        <span>Realizado</span>
      </LegendItem>
      <LegendItem visible={visible[2]} onClick={() => onToggle(2)} aria-label="Alternar Previsão">
        <svg width="24" height="4" className="shrink-0" aria-hidden>
          <line x1="0" y1="2" x2="24" y2="2" stroke="#0366dd" strokeWidth={2} strokeDasharray="6 4" />
        </svg>
        <span>Previsão</span>
      </LegendItem>
    </div>
  );
}

function DailyChartLegend({
  visible,
  onToggle,
}: {
  visible: boolean[];
  onToggle: (index: number) => void;
}) {
  const toggleImpressionShare = () => onToggle(3);
  return (
    <div className="flex items-center justify-start gap-6 text-[12px] flex-wrap">
      <LegendItem visible={visible[0]} onClick={() => onToggle(0)} aria-label="Alternar Gasto diário">
        <span className="w-3 h-3 rounded-[4px] shrink-0 bg-[#0366dd]" aria-hidden />
        <span>Gasto diário</span>
      </LegendItem>
      <LegendItem visible={visible[1]} onClick={() => onToggle(1)} aria-label="Alternar Orçamento médio diário">
        <span className="w-3 h-3 rounded-[4px] shrink-0 bg-[#eaeaea] border border-gray-200" aria-hidden />
        <span>Orçamento médio diário</span>
      </LegendItem>
      <LegendItem visible={visible[2]} onClick={() => onToggle(2)} aria-label="Alternar Acima da meta">
        <span className="w-3 h-3 rounded-[4px] shrink-0 bg-[#034a9e]" aria-hidden />
        <span>Acima da meta</span>
      </LegendItem>
      <LegendItem visible={visible[3]} onClick={toggleImpressionShare} aria-label="Alternar Impression Share">
        <svg width="20" height="4" className="shrink-0" aria-hidden><line x1="0" y1="2" x2="20" y2="2" stroke="#059669" strokeWidth={2} /></svg>
        <span>Impression Share</span>
      </LegendItem>
      <LegendItem visible={visible[4]} onClick={toggleImpressionShare} aria-label="Alternar Impression Share (previsão)">
        <svg width="20" height="4" className="shrink-0" aria-hidden><line x1="0" y1="2" x2="20" y2="2" stroke="#059669" strokeWidth={2} strokeDasharray="4 3" /></svg>
        <span>Impression Share (previsão)</span>
      </LegendItem>
    </div>
  );
}

function daysBetween(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((e.getTime() - s.getTime()) / (24 * 60 * 60 * 1000));
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getGoalForDay(
  dayIndex: number,
  start: Date,
  budget: number,
  budgetHistory: Campaign['budgetHistory']
): number {
  if (!budgetHistory?.length) return budget;
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  date.setDate(date.getDate() + dayIndex);
  const dayISO = toISODate(date);
  const sorted = [...budgetHistory].sort((a, b) => a.date.localeCompare(b.date));
  let last: { date: string; amount: number } | null = null;
  for (const entry of sorted) {
    if (entry.date <= dayISO) last = entry;
    else break;
  }
  return last != null ? last.amount : budget;
}

function todayDate(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

type PacingStatus = 'on_track' | 'under' | 'over';
const PACING_UNDER_RATIO = 0.9;
const PACING_OVER_RATIO = 1.1;

function getPacingStatus(actual: number, expected: number): { status: PacingStatus; label: string } {
  if (expected <= 0) return { status: 'on_track', label: 'No ritmo' };
  const ratio = actual / expected;
  if (ratio < PACING_UNDER_RATIO) return { status: 'under', label: 'Abaixo' };
  if (ratio > PACING_OVER_RATIO) return { status: 'over', label: 'Acima' };
  return { status: 'on_track', label: 'No ritmo' };
}

interface BudgetReportModalProps {
  campaign: Campaign;
  onClose: () => void;
  onOpenCampaign?: (campaign: Campaign) => void;
}

const FADE_MS = 200;
/** Duração da expansão/colapso do painel de insights (grid + painel). */
const INSIGHTS_SIDEBAR_MS = 620;
/** Curva suave, sem “salto” no fim — empurra o conteúdo principal de forma contínua. */
const INSIGHTS_SIDEBAR_EASING = 'cubic-bezier(0.22, 1, 0.28, 1)';
/** Conteúdo entra um pouco antes do fim do layout para a abertura parecer contínua, não em dois passos. */
const INSIGHTS_SIDEBAR_CONTENT_DELAY_MS = Math.round(INSIGHTS_SIDEBAR_MS * 0.34);
const INSIGHTS_SIDEBAR_DEFAULT_W = 400;
const INSIGHTS_SIDEBAR_MIN_W = 280;
const INSIGHTS_SIDEBAR_HANDLE_PX = 6;
const INSIGHTS_MAIN_MIN_W = 320;

type InsightTone = 'neutral' | 'success' | 'warning' | 'danger';

interface InsightCardData {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  recommendation: string;
  tone: InsightTone;
}

function inferCampaignObjective(campaign: Campaign): 'Conversão' | 'Consideração' | 'Alcance' {
  const mediaTypes = campaign.mediaTypes ?? [];
  if (mediaTypes.some((type) => type === 'Produto patrocinado' || type === 'Instore display')) return 'Conversão';
  if (mediaTypes.some((type) => type === 'Marca patrocinada' || type === 'Video')) return 'Consideração';
  return 'Alcance';
}

function formatPercent(value: number, digits = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export const BudgetReportModal: React.FC<BudgetReportModalProps> = ({ campaign, onClose, onOpenCampaign }) => {
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isInsightsContentVisible, setIsInsightsContentVisible] = useState(false);
  const [insightsSidebarWidth, setInsightsSidebarWidth] = useState(INSIGHTS_SIDEBAR_DEFAULT_W);
  const [isInsightsResizeDragging, setIsInsightsResizeDragging] = useState(false);
  const insightsLayoutRef = useRef<HTMLDivElement>(null);
  const insightsResizeDragRef = useRef<{ pointerId: number; startX: number; startW: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dailyChartContainerRef = useRef<HTMLDivElement>(null);
  const hourlyChartContainerRef = useRef<HTMLDivElement>(null);
  const hourlyCumulativeChartContainerRef = useRef<HTMLDivElement>(null);

  // Tooltip state for each chart
  const [totalTip, setTotalTip] = useState<{ screenX: number; screenY: number; idx: number } | null>(null);
  const [dailyTip, setDailyTip] = useState<{ screenX: number; screenY: number; idx: number } | null>(null);
  const [hourlyTip, setHourlyTip] = useState<{ screenX: number; screenY: number; idx: number } | null>(null);
  const [hourlyCumulativeTip, setHourlyCumulativeTip] = useState<{ screenX: number; screenY: number; idx: number } | null>(null);

  // Visibilidade das séries via legenda (índice = ordem na legenda)
  const [totalLegendVisible, setTotalLegendVisible] = useState([true, true, true]); // Meta, Realizado, Previsão
  const [dailyLegendVisible, setDailyLegendVisible] = useState([true, true, true, false, false]); // 3 barras + IS + IS previsão (IS desligado por padrão)
  const [hourlyLegendVisible, setHourlyLegendVisible] = useState([true, true, true, false, false]); // Consumo até meta, Meta 100%, Acima da meta, Impression Share, Impression Share (previsão)
  const [hourlyCumulativeLegendVisible, setHourlyCumulativeLegendVisible] = useState([true, true, true]); // Acumulado, Previsão, Meta

  const handleClose = () => {
    if (isExiting) return;
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      onClose();
      return;
    }
    setIsExiting(true);
  };

  useEffect(() => {
    setHeaderScrolled(false);
    const t = requestAnimationFrame(() => setHasEntered(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    setIsInsightsOpen(false);
    setInsightsSidebarWidth(INSIGHTS_SIDEBAR_DEFAULT_W);
  }, [campaign.id]);

  /** Sempre 3 trilhas (principal | handle | sidebar) para o navegador interpolar `grid-template-columns` sem troca de número de colunas. */
  const insightsGridTemplateColumns = useMemo(() => {
    if (!isInsightsOpen) {
      return `minmax(0, 1fr) 0px 0px`;
    }
    return `minmax(0, 1fr) ${INSIGHTS_SIDEBAR_HANDLE_PX}px ${insightsSidebarWidth}px`;
  }, [isInsightsOpen, insightsSidebarWidth]);

  const clampInsightsSidebarWidth = useCallback((w: number) => {
    const grid = insightsLayoutRef.current;
    if (!grid) return Math.max(INSIGHTS_SIDEBAR_MIN_W, w);
    const gridW = grid.getBoundingClientRect().width;
    const maxSidebar = Math.max(
      INSIGHTS_SIDEBAR_MIN_W,
      gridW - INSIGHTS_MAIN_MIN_W - INSIGHTS_SIDEBAR_HANDLE_PX,
    );
    return Math.min(maxSidebar, Math.max(INSIGHTS_SIDEBAR_MIN_W, Math.round(w)));
  }, []);

  const onInsightsResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isInsightsOpen || e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      insightsResizeDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startW: insightsSidebarWidth,
      };
      setIsInsightsResizeDragging(true);
    },
    [isInsightsOpen, insightsSidebarWidth],
  );

  const onInsightsResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = insightsResizeDragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const delta = e.clientX - d.startX;
      const next = d.startW - delta;
      setInsightsSidebarWidth(clampInsightsSidebarWidth(next));
    },
    [clampInsightsSidebarWidth],
  );

  const endInsightsResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = insightsResizeDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    insightsResizeDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* já liberado */
    }
    setIsInsightsResizeDragging(false);
  }, []);

  const onInsightsResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!isInsightsOpen) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const step = 16;
      setInsightsSidebarWidth((prev) =>
        clampInsightsSidebarWidth(prev + (e.key === 'ArrowLeft' ? step : -step)),
      );
    },
    [isInsightsOpen, clampInsightsSidebarWidth],
  );

  useEffect(() => {
    if (!isInsightsOpen) return;
    const onResize = () => {
      setInsightsSidebarWidth((w) => clampInsightsSidebarWidth(w));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isInsightsOpen, clampInsightsSidebarWidth]);

  useEffect(() => {
    if (!isInsightsOpen) {
      setIsInsightsContentVisible(false);
      return;
    }

    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setIsInsightsContentVisible(true);
      return;
    }

    const t = window.setTimeout(() => setIsInsightsContentVisible(true), INSIGHTS_SIDEBAR_CONTENT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [isInsightsOpen]);

  useEffect(() => {
    if (!isExiting) return;
    const t = setTimeout(() => onClose(), FADE_MS);
    return () => clearTimeout(t);
  }, [isExiting, onClose]);

  // Count-up nos cards da Visão geral: progresso 0..1 com stagger (80ms entre cards), 700ms duração, ease-out-expo
  const COUNT_UP_DURATION = 700;
  const progressCard0 = useCountUpProgress(COUNT_UP_DURATION, 0);
  const progressCard1 = useCountUpProgress(COUNT_UP_DURATION, 80);
  const progressCard2 = useCountUpProgress(COUNT_UP_DURATION, 160);
  const progressCard3 = useCountUpProgress(COUNT_UP_DURATION, 240);

  const {
    totalDays, elapsedDays, remainingDays, dailyBudget, dailyRate,
    consumptionDay, consumptionWeek, consumptionTotal,
    expectedDay, expectedWeek, expectedTotalToDate,
    forecastTotal, forecastLow: fLow, forecastHigh: fHigh,
    totalizerDay, totalizerWeek, totalizerTotal, totalizerForecast,
    chartTotalData, chartDailyData, chartHourlyData, chartHourlyCumulativeData,
    projectedHitHour,
    isLastPointToday, lastPointLabel,
  } = useMemo(() => {
    const start = new Date(campaign.startDate.getFullYear(), campaign.startDate.getMonth(), campaign.startDate.getDate());
    const end = new Date(campaign.endDate.getFullYear(), campaign.endDate.getMonth(), campaign.endDate.getDate());
    const today = todayDate();
    const totalDays = Math.max(1, daysBetween(start, end));
    const elapsedDays = Math.min(totalDays, Math.max(0, daysBetween(start, today)));
    const remainingDays = Math.max(0, totalDays - elapsedDays);
    const budget = campaign.budget;
    const spend = campaign.spend;
    const dailyBudget = budget / totalDays;
    const dailyRate = elapsedDays > 0 ? spend / elapsedDays : 0;
    const numPastDays = elapsedDays + 1;
    const dailySpends = elapsedDays > 0 && spend > 0
      ? getDailySpendDistribution(spend, numPastDays, campaign.id)
      : [];
    const getExpectedDaily = (d: number) => getGoalForDay(d, start, budget, campaign.budgetHistory) / totalDays;
    const consumptionDay = dailySpends.length > 0 && elapsedDays < dailySpends.length ? dailySpends[elapsedDays] : dailyRate;
    const expectedDay = getExpectedDaily(elapsedDays);
    const consumptionWeek = dailySpends.length > 0
      ? dailySpends.slice(Math.max(0, elapsedDays + 1 - 7), elapsedDays + 1).reduce((a, b) => a + b, 0)
      : (elapsedDays >= 7 ? dailyRate * 7 : elapsedDays > 0 ? spend : 0);
    let expectedWeek = 0;
    for (let d = Math.max(0, elapsedDays - 6); d <= elapsedDays; d++) expectedWeek += getExpectedDaily(d);
    const consumptionTotal = spend;
    let expectedTotalToDate = 0;
    for (let d = 0; d <= elapsedDays; d++) expectedTotalToDate += getExpectedDaily(d);
    const forecastTotal = elapsedDays > 0 ? Math.min(budget, spend + dailyRate * remainingDays) : dailyBudget * totalDays;
    const forecastLow = Math.min(budget, forecastTotal * 0.96);
    const forecastHigh = Math.min(budget, forecastTotal * 1.04);
    const totalizerDay = getPacingStatus(consumptionDay, expectedDay);
    const totalizerWeek = getPacingStatus(consumptionWeek, expectedWeek);
    const totalizerTotal = getPacingStatus(spend, expectedTotalToDate);
    const totalizerForecast = getPacingStatus(forecastTotal, budget);
    const lastPointDate = new Date(start);
    lastPointDate.setDate(lastPointDate.getDate() + elapsedDays);
    const isLastPointToday = lastPointDate.getFullYear() === today.getFullYear() && lastPointDate.getMonth() === today.getMonth() && lastPointDate.getDate() === today.getDate();
    const lastPointLabel = isLastPointToday ? 'Hoje' : formatShortDateNoYear(lastPointDate);

    const chartTotalData: TotalDataPoint[] = [];
    for (let d = 0; d <= totalDays; d++) {
      const date = new Date(start); date.setDate(date.getDate() + d);
      const dateLabel = d === 0 ? formatShortDateNoYear(date) : d === elapsedDays ? lastPointLabel : formatShortDateNoYear(date);
      const cumulativePast = d <= elapsedDays ? (dailySpends.length > 0 ? dailySpends.slice(0, d + 1).reduce((a, b) => a + b, 0) : 0) : undefined;
      const forecastValue = d >= elapsedDays ? (elapsedDays > 0 ? spend + dailyRate * (d - elapsedDays) : dailyBudget * d) : undefined;
      const cappedForecast = forecastValue != null ? Math.min(forecastValue, budget) : undefined;
      const forecastLowVal = cappedForecast != null ? Math.min(budget, cappedForecast * 0.96) : undefined;
      const forecastHighVal = cappedForecast != null ? Math.min(budget, cappedForecast * 1.04) : undefined;
      const goal = getGoalForDay(d, start, budget, campaign.budgetHistory);
      chartTotalData.push({
        day: d, date: dateLabel, dateTooltip: formatShortDate(date),
        cumulative: cumulativePast,
        forecast: d >= elapsedDays ? (d === elapsedDays ? spend : cappedForecast) : undefined,
        forecastLow: d >= elapsedDays ? forecastLowVal : undefined,
        forecastHigh: d >= elapsedDays ? forecastHighVal : undefined,
        goal, isToday: d === elapsedDays,
      });
    }

    const chartDailyData: DailyDataPoint[] = [];
    for (let d = 0; d <= totalDays; d++) {
      const date = new Date(start); date.setDate(date.getDate() + d);
      const isPastOrToday = d <= elapsedDays;
      const dailySpend = isPastOrToday && dailySpends.length > 0 && d < dailySpends.length ? dailySpends[d] : (isPastOrToday && elapsedDays > 0 ? spend / elapsedDays : 0);
      const goalForDay = getGoalForDay(d, start, budget, campaign.budgetHistory);
      const dailyBudgetForDay = goalForDay / totalDays;
      let dateLabel = formatShortDateNoYear(date);
      if (d === elapsedDays - 1 && elapsedDays > 0 && isLastPointToday) dateLabel = 'Ontem';
      if (d === elapsedDays) dateLabel = lastPointLabel;
      // Impression Share sintético: variação suave em torno do valor da campanha
      const baseIS = campaign.impressionShare ?? 0;
      const variation = 0.92 + 0.16 * Math.sin(d * 0.6 + (campaign.id.length % 5));
      const impressionShare = Math.min(100, Math.max(0, baseIS * variation));
      chartDailyData.push({ day: d, date: dateLabel, dateTooltip: formatShortDate(date), dailySpend, dailyBudget: dailyBudgetForDay, isToday: d === elapsedDays, isFuture: d > elapsedDays, impressionShare });
    }

    const chartHourlyData: HourlyDataPoint[] = [];
    const chartHourlyCumulativeData: HourlyCumulativeDataPoint[] = [];
    let projectedHitHour: number | null = null;
    if (isLastPointToday) {
      const currentHour = new Date().getHours();
      const hourlySpends = getHourlySpendDistribution(consumptionDay, campaign.id + String(elapsedDays), currentHour);
      const hourlyBudget = dailyBudget / 24;
      const baseIS = campaign.impressionShare ?? 0;
      for (let h = 0; h < 24; h++) {
        const isPast = h < currentHour;
        const variation = 0.94 + 0.12 * Math.sin(h * 0.4 + (campaign.id.length % 7));
        const impressionShare = Math.min(100, Math.max(0, baseIS * variation));
        chartHourlyData.push({
          hour: h,
          hourLabel: `${h}h`,
          hourlySpend: hourlySpends[h] ?? 0,
          hourlyBudget,
          isPast,
          isCurrentHour: h === currentHour,
          impressionShare,
        });
      }
      // Acumulado hora a hora + projeção para bater a meta do dia (previsão inclui hora atual para conectar com acumulado)
      const goalDay = expectedDay;
      let cum = 0;
      const rate = currentHour >= 0 ? consumptionDay / (currentHour + 1) : 0;
      for (let h = 0; h < 24; h++) {
        const isPast = h < currentHour;
        if (h <= currentHour) cum += hourlySpends[h] ?? 0;
        const cumulative = h <= currentHour ? cum : undefined;
        const forecastVal = h >= currentHour && rate >= 0
          ? (h === currentHour ? cum : consumptionDay + rate * (h - currentHour))
          : undefined;
        const cappedForecast = forecastVal != null ? Math.min(forecastVal, goalDay) : undefined;
        const forecastLowVal = cappedForecast != null ? Math.min(goalDay, cappedForecast * 0.96) : undefined;
        const forecastHighVal = cappedForecast != null ? Math.min(goalDay, cappedForecast * 1.04) : undefined;
        chartHourlyCumulativeData.push({
          hour: h,
          hourLabel: `${h}h`,
          cumulative,
          forecast: forecastVal,
          forecastLow: h >= currentHour ? forecastLowVal : undefined,
          forecastHigh: h >= currentHour ? forecastHighVal : undefined,
          goal: goalDay,
          isCurrentHour: h === currentHour,
          isPast,
        });
      }
      if (rate > 0 && goalDay > consumptionDay) {
        const hit = currentHour + (goalDay - consumptionDay) / rate;
        projectedHitHour = hit <= 24 ? hit : null;
      } else if (goalDay <= consumptionDay) {
        projectedHitHour = currentHour;
      }
    }

    return {
      totalDays, elapsedDays, remainingDays, dailyBudget, dailyRate,
      consumptionDay, consumptionWeek, consumptionTotal,
      expectedDay, expectedWeek, expectedTotalToDate,
      forecastTotal, forecastLow, forecastHigh,
      totalizerDay, totalizerWeek, totalizerTotal, totalizerForecast,
      chartTotalData, chartDailyData, chartHourlyData, chartHourlyCumulativeData,
      projectedHitHour,
      isLastPointToday, lastPointLabel,
    };
  }, [campaign]);

  const maxGoal = Math.max(campaign.budget, 0, ...chartTotalData.map((r) => r.goal ?? 0));
  const totalYMax = Math.max(campaign.budget, 0, maxGoal * 1.25, ...chartTotalData.map((r) => r.goal), ...chartTotalData.flatMap((r) => [r.cumulative, r.forecast, r.forecastHigh].filter((v): v is number => typeof v === 'number')));
  const dailyYMax = Math.max(1, ...chartDailyData.flatMap((r) => [r.dailySpend, r.dailyBudget]));
  const hourlyYMax = chartHourlyData.length > 0
    ? Math.max(1, ...chartHourlyData.flatMap((r) => [r.hourlySpend, r.hourlyBudget]))
    : 0;
  const hourlyCumulativeYMax = chartHourlyCumulativeData.length > 0
    ? Math.max(
        expectedDay,
        ...chartHourlyCumulativeData.flatMap((r) => [r.cumulative, r.forecast, r.forecastLow, r.forecastHigh, r.goal].filter((v): v is number => typeof v === 'number'))
      ) * 1.1
    : 0;

  /* ── Chart.js configs ── */
  const totalChartData = useMemo(() => {
    const base = [
      {
        label: '_bandHigh',
        data: chartTotalData.map((d) => d.forecastHigh ?? null),
        fill: '+1',
        backgroundColor: 'rgba(3, 102, 221, 0.14)',
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 0,
        tension: 0.3,
        order: 10,
        spanGaps: false,
      },
      {
        label: '_bandLow',
        data: chartTotalData.map((d) => d.forecastLow ?? null),
        fill: false as const,
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 0,
        tension: 0.3,
        order: 9,
        spanGaps: false,
      },
      {
        label: 'goal',
        data: chartTotalData.map((d) => d.goal),
        borderColor: '#1f1f1f',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 8,
        fill: false as const,
        tension: 0.1,
        order: 5,
      },
      {
        label: 'cumulative',
        data: chartTotalData.map((d) => d.cumulative ?? null),
        borderColor: '#0366dd',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 8,
        fill: true,
        backgroundColor: scriptableBlueSpendAreaFill,
        tension: 0.3,
        order: 1,
        spanGaps: false,
      },
      {
        label: 'forecast',
        data: chartTotalData.map((d) => d.forecast ?? null),
        borderColor: '#0366dd',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHitRadius: 8,
        fill: true,
        backgroundColor: scriptableBlueForecastAreaFill,
        tension: 0.3,
        order: 2,
        spanGaps: false,
      },
    ];
    const visible = totalLegendVisible; // [Meta, Realizado, Previsão] -> datasets 2, 3, (0,1,4)
    return {
      labels: chartTotalData.map((d) => d.date),
      datasets: base.map((ds, i) => ({
        ...ds,
        hidden: i === 0 || i === 1 ? !visible[2] : i === 2 ? !visible[0] : i === 3 ? !visible[1] : !visible[2],
      })),
    };
  }, [chartTotalData, totalLegendVisible]);

  const mousePos = useRef({ x: 0, y: 0 });
  const totalTipPending = useRef<{ screenX: number; screenY: number; idx: number } | null>(null);
  const dailyTipPending = useRef<{ screenX: number; screenY: number; idx: number } | null>(null);
  const hourlyTipPending = useRef<{ screenX: number; screenY: number; idx: number } | null>(null);
  const hourlyCumulativeTipPending = useRef<{ screenX: number; screenY: number; idx: number } | null>(null);
  const tipRafId = useRef<number>(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => { mousePos.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener('mousemove', handler, { passive: true });
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  const flushTipState = useCallback(() => {
    tipRafId.current = 0;
    setTotalTip(totalTipPending.current);
    setDailyTip(dailyTipPending.current);
    setHourlyTip(hourlyTipPending.current);
    setHourlyCumulativeTip(hourlyCumulativeTipPending.current);
  }, []);

  const scheduleTipFlush = useCallback(() => {
    if (tipRafId.current !== 0) return;
    tipRafId.current = requestAnimationFrame(flushTipState);
  }, [flushTipState]);

  const handleTotalTip = useCallback((context: { chart: any; tooltip: any }) => {
    const tt = context.tooltip;
    if (tt.opacity === 0) {
      totalTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    const dp = tt.dataPoints?.[0];
    if (!dp) {
      totalTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    totalTipPending.current = { screenX: mousePos.current.x, screenY: mousePos.current.y, idx: dp.dataIndex };
    dailyTipPending.current = null;
    hourlyTipPending.current = null;
    hourlyCumulativeTipPending.current = null;
    scheduleTipFlush();
  }, [scheduleTipFlush]);

  const hojePillPluginTotal: Plugin = useMemo(() => ({
    id: 'hojePillTotal',
    afterDraw(chart) {
      if (elapsedDays === 0) return;
      const xScale = chart.scales.x;
      if (!xScale) return;
      const rawX = xScale.getPixelForValue(elapsedDays);
      const y = chart.chartArea.bottom + 24;
      const ctx = chart.ctx;
      ctx.save();
      const label = isLastPointToday ? 'Hoje' : lastPointLabel;
      const font = isLastPointToday ? '500 12px system-ui, -apple-system, sans-serif' : '12px system-ui, -apple-system, sans-serif';
      ctx.font = font;
      const tw = ctx.measureText(label).width;
      const pad = 8;
      const canvasW = chart.width;
      const x = Math.max(pad + tw / 2, Math.min(rawX, canvasW - pad - tw / 2));
      if (isLastPointToday) {
        const pillW = tw + 16;
        drawRoundRect(ctx, x - pillW / 2, y - 10, pillW, 20, 10);
        ctx.fillStyle = '#f1f8fd';
        ctx.fill();
        ctx.fillStyle = '#0366dd';
      } else {
        ctx.fillStyle = '#707070';
      }
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
      ctx.restore();
    },
  }), [elapsedDays, isLastPointToday, lastPointLabel]);

  const totalChartOptions = useMemo((): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 20, right: 20 } },
    interaction: { mode: 'index' as const, intersect: false },
    animation: { duration: 300 },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          callback(_, index) {
            if (index === 0) return chartTotalData[0]?.date ?? '';
            return null;
          },
          font: { size: 12 },
          color: '#707070',
          padding: 12,
        },
        grid: { display: false },
        border: { color: '#e0e0e0' },
      },
      y: {
        min: 0,
        max: totalYMax,
        ticks: {
          count: 5,
          callback: (v) => formatCurrency(v as number),
          font: { size: 12 },
          color: '#707070',
          padding: 8,
        },
        grid: { color: '#f2f2f2' },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: handleTotalTip,
      },
      annotation: {
        annotations: {
          ...(elapsedDays > 0 && elapsedDays < totalDays ? {
            todayLine: {
              type: 'line' as const,
              xMin: elapsedDays,
              xMax: elapsedDays,
              borderColor: '#707070',
              borderWidth: 1,
              borderDash: [2, 2],
            },
          } : {}),
        },
      },
    },
  }), [chartTotalData, elapsedDays, totalDays, totalYMax, handleTotalTip]);

  /* Daily chart: stacked progress-to-goal — azul na base, cinza no topo (1º dataset = base da barra). */
  const dailyChartData = useMemo(() => {
    const consumoAteMeta = chartDailyData.map((d) => Math.min(d.dailySpend, d.dailyBudget));
    const metaNaoPreenchido = chartDailyData.map((d) => Math.max(0, d.dailyBudget - d.dailySpend));
    const acimaDaMeta = chartDailyData.map((d) => Math.max(0, d.dailySpend - d.dailyBudget));
    const visible = dailyLegendVisible;
    const base = [
      {
        label: 'consumo até meta',
        data: consumoAteMeta,
        backgroundColor: '#0366dd',
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 2, bottomRight: 2 },
        borderSkipped: false,
        stack: 'dailyProgress',
        order: 1,
        barPercentage: 0.8,
        categoryPercentage: 0.6,
      },
      {
        label: 'meta (não preenchido)',
        data: metaNaoPreenchido,
        backgroundColor: '#eaeaea',
        borderRadius: 0,
        borderSkipped: false,
        stack: 'dailyProgress',
        order: 2,
        barPercentage: 0.8,
        categoryPercentage: 0.6,
      },
      {
        label: 'acima da meta',
        data: acimaDaMeta,
        backgroundColor: '#034a9e',
        borderRadius: { topLeft: 2, topRight: 2, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        stack: 'dailyProgress',
        order: 3,
        barPercentage: 0.8,
        categoryPercentage: 0.6,
      },
      {
        type: 'line' as const,
        label: 'Impression Share',
        data: chartDailyData.map((d) => (d.day <= elapsedDays ? (d.impressionShare ?? null) : null)),
        borderColor: '#059669',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#059669',
        pointBorderWidth: 2,
        yAxisID: 'y1',
        order: 0,
      },
      {
        type: 'line' as const,
        label: 'Impression Share (previsão)',
        data: chartDailyData.map((d) => (d.day >= elapsedDays ? (d.impressionShare ?? null) : null)),
        borderColor: '#059669',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#059669',
        pointBorderWidth: 2,
        yAxisID: 'y1',
        order: 0,
      },
    ];
    return {
      labels: chartDailyData.map((d) => d.date),
      datasets: base.map((ds, i) => ({ ...ds, hidden: !visible[i] })),
    };
  }, [chartDailyData, elapsedDays, dailyLegendVisible]);

  const handleDailyTip = useCallback((context: { chart: any; tooltip: any }) => {
    const tt = context.tooltip;
    if (tt.opacity === 0) {
      dailyTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    const dp = tt.dataPoints?.[0];
    if (!dp) {
      dailyTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    dailyTipPending.current = { screenX: mousePos.current.x, screenY: mousePos.current.y, idx: dp.dataIndex };
    totalTipPending.current = null;
    hourlyTipPending.current = null;
    hourlyCumulativeTipPending.current = null;
    scheduleTipFlush();
  }, [scheduleTipFlush]);

  const handleHourlyCumulativeTip = useCallback((context: { chart: any; tooltip: any }) => {
    const tt = context.tooltip;
    if (tt.opacity === 0) {
      hourlyCumulativeTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    const dp = tt.dataPoints?.[0];
    if (!dp) {
      hourlyCumulativeTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    hourlyCumulativeTipPending.current = { screenX: mousePos.current.x, screenY: mousePos.current.y, idx: dp.dataIndex };
    totalTipPending.current = null;
    dailyTipPending.current = null;
    hourlyTipPending.current = null;
    scheduleTipFlush();
  }, [scheduleTipFlush]);

  const handleHourlyTip = useCallback((context: { chart: any; tooltip: any }) => {
    const tt = context.tooltip;
    if (tt.opacity === 0) {
      hourlyTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    const dp = tt.dataPoints?.[0];
    if (!dp) {
      hourlyTipPending.current = null;
      scheduleTipFlush();
      return;
    }
    hourlyTipPending.current = { screenX: mousePos.current.x, screenY: mousePos.current.y, idx: dp.dataIndex };
    totalTipPending.current = null;
    dailyTipPending.current = null;
    hourlyCumulativeTipPending.current = null;
    scheduleTipFlush();
  }, [scheduleTipFlush]);

  const hojePillPluginDaily: Plugin = useMemo(() => ({
    id: 'hojePillDaily',
    afterDraw(chart) {
      if (elapsedDays === 0) return;
      const xScale = chart.scales.x;
      if (!xScale) return;
      const rawX = xScale.getPixelForValue(elapsedDays);
      const y = chart.chartArea.bottom + 24;
      const ctx = chart.ctx;
      ctx.save();
      const label = isLastPointToday ? 'Hoje' : lastPointLabel;
      const font = isLastPointToday ? '500 12px system-ui, -apple-system, sans-serif' : '12px system-ui, -apple-system, sans-serif';
      ctx.font = font;
      const tw = ctx.measureText(label).width;
      const pad = 8;
      const canvasW = chart.width;
      const x = Math.max(pad + tw / 2, Math.min(rawX, canvasW - pad - tw / 2));
      if (isLastPointToday) {
        const pillW = tw + 16;
        drawRoundRect(ctx, x - pillW / 2, y - 10, pillW, 20, 10);
        ctx.fillStyle = '#f1f8fd';
        ctx.fill();
        ctx.fillStyle = '#0366dd';
      } else {
        ctx.fillStyle = '#707070';
      }
      ctx.font = font;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
      ctx.restore();
    },
  }), [elapsedDays, isLastPointToday, lastPointLabel]);

  const dailyChartOptions = useMemo((): ChartOptions<'bar'> => ({
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 20, right: 20 } },
    interaction: { mode: 'index' as const, intersect: false },
    animation: { duration: 300 },
    scales: {
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 0,
          callback(_, index) {
            if (index === 0) return chartDailyData[0]?.date ?? '';
            return null;
          },
          font: { size: 12 },
          color: '#707070',
          padding: 12,
        },
        grid: { display: false },
        border: { color: '#e0e0e0' },
      },
      y: {
        min: 0,
        max: dailyYMax,
        stacked: true,
        reverse: false,
        beginAtZero: true,
        ticks: {
          count: 5,
          callback: (v) => formatCurrency(v as number),
          font: { size: 12 },
          color: '#707070',
          padding: 8,
        },
        grid: { color: '#f2f2f2' },
        border: { display: false },
      },
      y1: {
        display: dailyLegendVisible[3] || dailyLegendVisible[4],
        type: 'linear' as const,
        position: 'right' as const,
        min: 0,
        max: 100,
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (v) => (v as number) + '%',
          font: { size: 11 },
          color: '#707070',
          padding: 8,
        },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: handleDailyTip,
      },
      annotation: {
        annotations: {
          ...(elapsedDays > 0 && elapsedDays < totalDays ? {
            todayLine: {
              type: 'line' as const,
              xMin: elapsedDays,
              xMax: elapsedDays,
              borderColor: '#707070',
              borderWidth: 1,
              borderDash: [2, 2],
            },
          } : {}),
        },
      },
    },
  }), [chartDailyData, elapsedDays, totalDays, dailyYMax, handleDailyTip, dailyLegendVisible]);

  const currentHourIndex = chartHourlyData.findIndex((p) => p.isCurrentHour);
  const hourlyChartData = useMemo(() => {
    const consumoAteMeta = chartHourlyData.map((p) => Math.min(p.hourlySpend, p.hourlyBudget));
    const metaNaoPreenchido = chartHourlyData.map((p) => Math.max(0, p.hourlyBudget - p.hourlySpend));
    const acimaDaMeta = chartHourlyData.map((p) => Math.max(0, p.hourlySpend - p.hourlyBudget));
    const visible = hourlyLegendVisible;
    const base = [
      {
        label: 'consumo até meta',
        data: consumoAteMeta,
        backgroundColor: '#0366dd',
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 2, bottomRight: 2 },
        borderSkipped: false,
        stack: 'hourlyProgress',
        order: 1,
        barPercentage: 0.8,
        categoryPercentage: 0.6,
      },
      {
        label: 'meta (não preenchido)',
        data: metaNaoPreenchido,
        backgroundColor: '#eaeaea',
        borderRadius: 0,
        borderSkipped: false,
        stack: 'hourlyProgress',
        order: 2,
        barPercentage: 0.8,
        categoryPercentage: 0.6,
      },
      {
        label: 'acima da meta',
        data: acimaDaMeta,
        backgroundColor: '#034a9e',
        borderRadius: { topLeft: 2, topRight: 2, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        stack: 'hourlyProgress',
        order: 3,
        barPercentage: 0.8,
        categoryPercentage: 0.6,
      },
      {
        type: 'line' as const,
        label: 'Impression Share',
        data: chartHourlyData.map((p) => (p.isPast || p.isCurrentHour ? (p.impressionShare ?? null) : null)),
        borderColor: '#059669',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#059669',
        pointBorderWidth: 2,
        yAxisID: 'y1',
        order: 0,
      },
      {
        type: 'line' as const,
        label: 'Impression Share (previsão)',
        data: chartHourlyData.map((p) => (!p.isPast ? (p.impressionShare ?? null) : null)),
        borderColor: '#059669',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#fff',
        pointBorderColor: '#059669',
        pointBorderWidth: 2,
        yAxisID: 'y1',
        order: 0,
      },
    ];
    return {
      labels: chartHourlyData.map((p) => p.hourLabel),
      datasets: base.map((ds, i) => ({ ...ds, hidden: !visible[i] })),
    };
  }, [chartHourlyData, hourlyLegendVisible]);

  const agoraPillPluginHourly: Plugin = useMemo(() => ({
    id: 'agoraPillHourly',
    afterDraw(chart) {
      if (currentHourIndex < 0) return;
      const xScale = chart.scales.x;
      if (!xScale) return;
      const rawX = xScale.getPixelForValue(currentHourIndex);
      const y = chart.chartArea.bottom + 24;
      const ctx = chart.ctx;
      ctx.save();
      const label = 'Agora';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const pad = 8;
      const canvasW = chart.width;
      const x = Math.max(pad + tw / 2, Math.min(rawX, canvasW - pad - tw / 2));
      const pillW = tw + 16;
      drawRoundRect(ctx, x - pillW / 2, y - 10, pillW, 20, 10);
      ctx.fillStyle = '#f1f8fd';
      ctx.fill();
      ctx.fillStyle = '#0366dd';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
      ctx.restore();
    },
  }), [currentHourIndex]);

  const hourlyChartOptions = useMemo((): ChartOptions<'bar'> => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 20, right: 20 } },
    interaction: { mode: 'index' as const, intersect: false },
    animation: { duration: 300 },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxTicksLimit: 12,
          maxRotation: 0,
          font: { size: 11 },
          color: '#707070',
          padding: 8,
        },
        grid: { display: false },
        border: { color: '#e0e0e0' },
      },
      y: {
        min: 0,
        max: hourlyYMax,
        stacked: true,
        ticks: {
          count: 5,
          callback: (v) => formatCurrency(v as number),
          font: { size: 12 },
          color: '#707070',
          padding: 8,
        },
        grid: { color: '#f2f2f2' },
        border: { display: false },
      },
      y1: {
        display: hourlyLegendVisible[3] || hourlyLegendVisible[4],
        type: 'linear' as const,
        position: 'right' as const,
        min: 0,
        max: 100,
        grid: { drawOnChartArea: false },
        ticks: {
          callback: (v) => (v as number) + '%',
          font: { size: 11 },
          color: '#707070',
          padding: 8,
        },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: handleHourlyTip,
      },
      annotation: {
        annotations: {
          ...(currentHourIndex >= 0 ? {
            agoraLine: {
              type: 'line' as const,
              xMin: currentHourIndex,
              xMax: currentHourIndex,
              borderColor: '#707070',
              borderWidth: 1,
              borderDash: [2, 2],
            },
          } : {}),
        },
      },
    },
  }), [chartHourlyData, hourlyYMax, currentHourIndex, handleHourlyTip, hourlyLegendVisible]);

  /* Acumulado do dia hora a hora + projeção de quando bate a meta (estrutura igual ao Gasto total: bandeja, meta, acumulado, previsão) */
  const hourlyCumulativeChartData = useMemo(() => {
    const visible = hourlyCumulativeLegendVisible; // [Acumulado->ds3, Previsão->ds4, Meta do dia->ds2]; bandeja ds0,ds1 junto com Previsão
    const base = [
      {
        label: '_bandHigh',
        data: chartHourlyCumulativeData.map((p) => p.forecastHigh ?? null),
        fill: '+1',
        backgroundColor: 'rgba(3, 102, 221, 0.14)',
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 0,
        tension: 0.3,
        order: 10,
        spanGaps: false,
      },
      {
        label: '_bandLow',
        data: chartHourlyCumulativeData.map((p) => p.forecastLow ?? null),
        fill: false as const,
        borderWidth: 0,
        pointRadius: 0,
        pointHitRadius: 0,
        tension: 0.3,
        order: 9,
        spanGaps: false,
      },
      {
        label: 'goal',
        data: chartHourlyCumulativeData.map((p) => p.goal),
        borderColor: '#1f1f1f',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 8,
        fill: false as const,
        tension: 0.1,
        order: 5,
      },
      {
        label: 'cumulative',
        data: chartHourlyCumulativeData.map((p) => p.cumulative ?? null),
        borderColor: '#0366dd',
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 8,
        fill: true,
        backgroundColor: scriptableBlueSpendAreaFill,
        tension: 0.3,
        order: 1,
        spanGaps: false,
      },
      {
        label: 'forecast',
        data: chartHourlyCumulativeData.map((p) => p.forecast ?? null),
        borderColor: '#0366dd',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHitRadius: 8,
        fill: true,
        backgroundColor: scriptableBlueForecastAreaFill,
        tension: 0.3,
        order: 2,
        spanGaps: false,
      },
    ];
    return {
      labels: chartHourlyCumulativeData.map((p) => p.hourLabel),
      datasets: base.map((ds, i) => ({
        ...ds,
        hidden: i === 0 || i === 1 ? !visible[1] : i === 2 ? !visible[2] : i === 3 ? !visible[0] : !visible[1],
      })),
    };
  }, [chartHourlyCumulativeData, hourlyCumulativeLegendVisible]);

  const currentHourForPlugin = chartHourlyCumulativeData.findIndex((p) => p.isCurrentHour);
  const alreadyHitGoal = expectedDay > 0 && consumptionDay >= expectedDay;

  const agoraPillPluginCumulative: Plugin = useMemo(() => ({
    id: 'agoraPillCumulative',
    afterDraw(chart) {
      if (currentHourForPlugin < 0) return;
      const xScale = chart.scales.x;
      if (!xScale) return;
      const rawX = xScale.getPixelForValue(currentHourForPlugin);
      const y = chart.chartArea.bottom + 24;
      const ctx = chart.ctx;
      ctx.save();
      const label = 'Agora';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const pad = 8;
      const canvasW = chart.width;
      const x = Math.max(pad + tw / 2, Math.min(rawX, canvasW - pad - tw / 2));
      const pillW = tw + 16;
      drawRoundRect(ctx, x - pillW / 2, y - 10, pillW, 20, 10);
      ctx.fillStyle = '#f1f8fd';
      ctx.fill();
      ctx.fillStyle = '#0366dd';
      ctx.font = '500 12px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y);
      ctx.restore();
    },
  }), [currentHourForPlugin]);

  const hourlyCumulativeChartOptions = useMemo((): ChartOptions<'line'> => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { left: 20, right: 20 } },
    interaction: { mode: 'index' as const, intersect: false },
    animation: { duration: 300 },
    scales: {
      x: {
        ticks: {
          autoSkip: true,
          maxTicksLimit: 12,
          maxRotation: 0,
          font: { size: 11 },
          color: '#707070',
          padding: 8,
        },
        grid: { display: false },
        border: { color: '#e0e0e0' },
      },
      y: {
        min: 0,
        max: hourlyCumulativeYMax,
        ticks: {
          count: 5,
          callback: (v) => formatCurrency(v as number),
          font: { size: 12 },
          color: '#707070',
          padding: 8,
        },
        grid: { color: '#f2f2f2' },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: false,
        external: handleHourlyCumulativeTip,
      },
      annotation: {
        annotations: {
          ...(currentHourIndex >= 0 ? {
            agoraLineCumulative: {
              type: 'line' as const,
              xMin: currentHourIndex,
              xMax: currentHourIndex,
              borderColor: '#707070',
              borderWidth: 1,
              borderDash: [2, 2],
            },
          } : {}),
        },
      },
    },
  }), [chartHourlyCumulativeData, hourlyCumulativeYMax, currentHourIndex, handleHourlyCumulativeTip]);

  const statusStyles = {
    on_track: { text: 'text-[color:var(--sl-fg-base)]', badgeBg: 'bg-[#e9fce3]', dot: 'bg-[#4fd051]', triangle: null },
    under: { text: 'text-[color:var(--sl-fg-base)]', badgeBg: 'bg-[#fbf7d4]', dot: null, triangle: 'text-[color:var(--sl-fg-base)]' },
    over: { text: 'text-[color:var(--sl-fg-base)]', badgeBg: 'bg-[#fdf6f5]', dot: null, triangle: 'text-[color:var(--sl-fg-base)]' },
  };

  const objectiveLabel = useMemo(() => inferCampaignObjective(campaign), [campaign]);

  const insightCards = useMemo<InsightCardData[]>(() => {
    const cards: InsightCardData[] = [];
    const safeExpectedTotal = Math.max(expectedTotalToDate, 1);
    const safeExpectedDay = Math.max(expectedDay, 1);
    const totalPaceRatio = consumptionTotal / safeExpectedTotal;
    const dayPaceRatio = consumptionDay / safeExpectedDay;
    const forecastRatio = campaign.budget > 0 ? forecastTotal / campaign.budget : 0;
    const remainingBudget = Math.max(0, campaign.budget - campaign.spend);
    const remainingBudgetRatio = campaign.budget > 0 ? remainingBudget / campaign.budget : 0;
    const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
    const ctr = campaign.impressions > 0 ? campaign.clicks / campaign.impressions : 0;
    const cvr = campaign.clicks > 0 ? campaign.conversions / campaign.clicks : 0;
    const isLowShare = campaign.impressionShare < 55;
    const hasStrongEfficiency = roas >= 4 || cvr >= 0.08;
    const hasWeakEfficiency = campaign.spend > 0 && (roas < 2 || cvr < 0.03);

    cards.push({
      id: 'objective',
      eyebrow: `Objetivo: ${objectiveLabel}`,
      title:
        objectiveLabel === 'Conversão'
          ? 'A verba deve priorizar inventário com maior intenção de compra'
          : objectiveLabel === 'Consideração'
            ? 'O foco ideal é ampliar presença qualificada antes de acelerar demais'
            : 'O melhor ganho vem de ampliar cobertura com ritmo estável até o fim da campanha',
      description:
        objectiveLabel === 'Conversão'
          ? 'Para esta campanha, o principal sinal de qualidade é transformar cobertura em vendas sem perder eficiência de gasto.'
          : objectiveLabel === 'Consideração'
            ? 'Aqui faz mais sentido equilibrar presença, frequência e avanço gradual do consumo para sustentar lembrança de marca.'
            : 'Em campanhas de alcance, vale buscar amplitude de exposição sem concentrar verba cedo demais.',
      recommendation:
        objectiveLabel === 'Conversão'
          ? 'Direcione otimizações para grupos, criativos e placements com maior taxa de conversão e ROAS mais saudável.'
          : objectiveLabel === 'Consideração'
            ? 'Expanda a distribuição nas frentes com melhor atenção e preserve orçamento para manter continuidade de presença.'
            : 'Distribua o investimento para ganhar cobertura ao longo do período e evitar picos que reduzam eficiência marginal.',
      tone: 'neutral',
    });

    if (totalizerTotal.status === 'under') {
      cards.push({
        id: 'pace-under',
        eyebrow: 'Oportunidade de escala',
        title: 'A campanha está consumindo abaixo do ritmo esperado',
        description: `O acumulado está em ${formatPercent(totalPaceRatio, 0)} da meta até hoje e a previsão indica fechamento em ${formatCurrency(forecastTotal)}.`,
        recommendation:
          objectiveLabel === 'Conversão'
            ? 'Aumente cobertura nas frentes com melhor retorno e teste subir lances nas segmentações com maior intenção.'
            : objectiveLabel === 'Consideração'
              ? 'Reforce a distribuição em públicos e formatos com maior visibilidade para recuperar presença sem perder consistência.'
              : 'Amplie a entrega em inventário adicional para capturar alcance que ainda não está sendo comprado.',
        tone: 'warning',
      });
    } else if (totalizerTotal.status === 'over') {
      cards.push({
        id: 'pace-over',
        eyebrow: 'Atenção ao orçamento',
        title: 'O consumo acumulado está acima do ritmo planejado',
        description: `O gasto atual já supera a curva esperada para o período e restam ${formatCurrency(remainingBudget)} para os próximos ${remainingDays} dias.`,
        recommendation:
          objectiveLabel === 'Conversão'
            ? 'Proteja a eficiência: reduza pressão nas frentes com menor retorno antes de ampliar verba nas melhores.'
            : objectiveLabel === 'Consideração'
              ? 'Evite concentrar demais o investimento agora para não comprometer a continuidade de presença até o fim da campanha.'
              : 'Redistribua o investimento ao longo dos dias restantes para preservar alcance consistente até a data final.',
        tone: 'danger',
      });
    } else {
      cards.push({
        id: 'pace-on-track',
        eyebrow: 'Ritmo saudável',
        title: 'O consumo total está alinhado com o planejado',
        description: `A campanha segue no ritmo da meta acumulada e a previsão atual fecha em ${formatCurrency(forecastTotal)} do orçamento total.`,
        recommendation: 'Use os próximos ajustes para capturar eficiência incremental, sem mudar agressivamente a distribuição atual.',
        tone: 'success',
      });
    }

    if (expectedDay > 0) {
      if (dayPaceRatio < 0.9) {
        cards.push({
          id: 'daily-under',
          eyebrow: 'Janela de hoje',
          title: projectedHitHour == null ? 'A meta de hoje corre risco de não ser atingida' : 'O dia começou abaixo do ritmo necessário',
          description:
            projectedHitHour == null
              ? `No ritmo atual, o consumo do dia está em ${formatPercent(dayPaceRatio, 0)} da meta planejada e a projeção ainda não aponta batida da meta hoje.`
              : `O consumo do dia está em ${formatPercent(dayPaceRatio, 0)} da meta e a projeção indica recuperação apenas por volta de ${Math.floor(projectedHitHour)}h.`,
          recommendation: 'Ajuste lances, priorização de inventário ou pacing intradiário para recuperar o dia antes de ampliar mudanças estruturais.',
          tone: 'warning',
        });
      } else if (dayPaceRatio > 1.1) {
        cards.push({
          id: 'daily-over',
          eyebrow: 'Controle diário',
          title: 'O gasto de hoje está acelerado em relação à meta diária',
          description: `O consumo intradiário está em ${formatPercent(dayPaceRatio, 0)} da meta planejada para hoje, o que pode antecipar consumo dos próximos dias.`,
          recommendation: 'Revise caps, distribuição por hora e priorização de mídia para suavizar o gasto sem interromper totalmente a entrega.',
          tone: 'danger',
        });
      }
    }

    if (forecastRatio < 0.95) {
      cards.push({
        id: 'budget-runway',
        eyebrow: 'Verba disponível',
        title: 'Há espaço para capturar mais resultado antes do fim da campanha',
        description: `A previsão atual consome ${formatPercent(forecastRatio, 0)} do orçamento e ainda deixa ${formatCurrency(remainingBudget)} sem uso potencial.`,
        recommendation:
          objectiveLabel === 'Conversão'
            ? 'Escalone as combinações com melhor retorno antes de redistribuir verba para frentes sem validação.'
            : 'Use a folga de orçamento para ampliar cobertura qualificada e sustentar presença até o final.',
        tone: 'warning',
      });
    } else if (remainingBudgetRatio < 0.12 && remainingDays > 2) {
      cards.push({
        id: 'budget-tight',
        eyebrow: 'Margem curta',
        title: 'A reserva de orçamento para os dias restantes está apertada',
        description: `Restam apenas ${formatCurrency(remainingBudget)} para ${remainingDays} dias de campanha, com pouca margem para absorver picos de consumo.`,
        recommendation: 'Reduza desperdício em segmentos menos eficientes e preserve verba para os blocos com maior potencial de resultado.',
        tone: 'danger',
      });
    }

    if (isLowShare) {
      cards.push({
        id: 'impression-share',
        eyebrow: 'Cobertura de mídia',
        title: 'O impression share sugere espaço para ganhar mais presença',
        description: `A campanha está com ${formatPercent(campaign.impressionShare / 100, 0)} de impression share, sinal de cobertura ainda limitada para a verba disponível.`,
        recommendation:
          totalizerTotal.status === 'under'
            ? 'Combine aumento de lances com revisão de segmentação para recuperar entrega e ganhar leilões mais relevantes.'
            : 'Procure inventário adicional ou melhores combinações de mídia para ampliar presença sem degradar o ritmo.',
        tone: 'warning',
      });
    }

    if (campaign.bidStrength === 'Fraco') {
      cards.push({
        id: 'bid-strength',
        eyebrow: 'Força do lance',
        title: 'Os lances atuais parecem pouco competitivos para o objetivo da campanha',
        description: 'A força do lance está classificada como fraca, o que pode limitar entrega, cobertura e recuperação de pacing.',
        recommendation: 'Revisite os bids das mídias prioritárias e concentre incrementos onde já existe sinal de aderência do público.',
        tone: 'warning',
      });
    } else if (campaign.bidStrength === 'Forte' && totalizerTotal.status === 'under') {
      cards.push({
        id: 'bid-strong-under',
        eyebrow: 'Leitura de ajuste',
        title: 'Os lances estão fortes, mas a campanha ainda não converte isso em ritmo',
        description: 'Isso sugere que o gargalo pode estar mais em cobertura, segmentação ou mix de mídia do que apenas no valor do bid.',
        recommendation: 'Teste redistribuição entre grupos, criativos ou placements antes de seguir elevando lances linearmente.',
        tone: 'neutral',
      });
    }

    if (objectiveLabel === 'Conversão') {
      cards.push({
        id: 'conversion-efficiency',
        eyebrow: 'Eficiência de resultado',
        title: hasStrongEfficiency ? 'Existe base para escalar mantendo eficiência' : 'A eficiência de conversão ainda pede refinamento',
        description: hasStrongEfficiency
          ? `A campanha está com ROAS de ${roas.toFixed(2)} e CVR de ${formatPercent(cvr, 1)}, sinais positivos para ampliar investimento com cuidado.`
          : `O ROAS está em ${roas.toFixed(2)} e a taxa de conversão em ${formatPercent(cvr, 1)}, o que indica espaço para melhorar qualidade do tráfego e da oferta.`,
        recommendation: hasStrongEfficiency
          ? 'Priorize escala nas combinações que já convertem e proteja a verba tirando pressão de grupos com retorno inferior.'
          : 'Refine segmentação, página de produto e criativos antes de acelerar o orçamento nas frentes com menor qualidade.',
        tone: hasStrongEfficiency ? 'success' : hasWeakEfficiency ? 'warning' : 'neutral',
      });
    } else if (objectiveLabel === 'Consideração') {
      cards.push({
        id: 'consideration-performance',
        eyebrow: 'Qualidade de atenção',
        title: ctr >= 0.01 ? 'Os sinais de interesse estão consistentes para seguir expandindo presença' : 'A campanha precisa ganhar mais tração de atenção',
        description: `O CTR atual está em ${formatPercent(ctr, 2)}${campaign.impressionShare ? ` com impression share de ${formatPercent(campaign.impressionShare / 100, 0)}` : ''}.`,
        recommendation: ctr >= 0.01
          ? 'Amplie presença nas frentes com melhor resposta para sustentar lembrança e consideração.'
          : 'Revise criativos, frequência e relevância da audiência para elevar o interesse antes de escalar o gasto.',
        tone: ctr >= 0.01 ? 'success' : 'warning',
      });
    } else {
      cards.push({
        id: 'reach-performance',
        eyebrow: 'Escala de cobertura',
        title: campaign.impressionShare >= 65 ? 'A campanha já mostra boa cobertura para ampliar alcance com disciplina' : 'Ainda existe oportunidade clara para ampliar cobertura',
        description: `O impression share está em ${formatPercent(campaign.impressionShare / 100, 0)} e o ritmo acumulado está ${totalizerTotal.label.toLowerCase()}.`,
        recommendation: campaign.impressionShare >= 65
          ? 'Mantenha a curva de gasto estável e aproveite janelas com melhor inventário para expandir sem criar picos.'
          : 'Ajuste mix e lances para capturar mais inventário e aumentar o alcance útil da campanha.',
        tone: campaign.impressionShare >= 65 ? 'success' : 'warning',
      });
    }

    return cards.slice(0, 6);
  }, [
    campaign,
    consumptionDay,
    consumptionTotal,
    expectedDay,
    expectedTotalToDate,
    forecastTotal,
    objectiveLabel,
    projectedHitHour,
    remainingDays,
    totalizerTotal,
  ]);

  /** Amarelo acessível (contraste ≥4.5:1 em fundo claro) para previsão abaixo de 100% */
  const BAR_COLOR_FORECAST_UNDER = '#CA8A04';

  const renderTotalizerCard = (
    title: string,
    value: number,
    status: { status: PacingStatus; label: string },
    barPercent?: number,
    extra?: React.ReactNode,
    totalValue?: number,
    barLabels?: { filled: string; total: string },
    barColor?: string,
    progress: number = 1
  ) => {
    const s = statusStyles[status.status];
    const showBarHover = barPercent != null && totalValue != null && totalValue > 0 && barLabels;
    const fillColor = barColor ?? '#0366dd';
    const animatedValue = progress * value;
    const animatedExtra = extra != null && totalValue != null && totalValue > 0
      ? `${((animatedValue / totalValue) * 100).toFixed(1)}%`
      : extra;
    return (
      <div className="flex min-w-[min(100%,260px)] grow shrink basis-[260px] flex-col gap-5 p-5 rounded-[12px] border border-[#e0e0e0] bg-white h-fit transition-shadow duration-200 hover:shadow-sm hover:border-[#d0d0d0]">
        <div className="flex flex-nowrap items-center justify-between gap-2 min-h-[17px]">
          <span className="text-[16px] font-normal text-[color:var(--sl-fg-base-soft)] tracking-[-0.32px] leading-6 whitespace-nowrap" title={title}>{title}</span>
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-[8px] shrink-0 whitespace-nowrap ${s.badgeBg}`}>
            <span className={`text-[12px] font-medium leading-4 ${s.text}`}>{status.label}</span>
            {s.dot && <span className="w-[8px] h-[8px] rounded-full shrink-0 bg-[#4fd051]" aria-hidden />}
            {s.triangle && status.status === 'over' && (
              <span className="material-symbols-outlined text-[12px] leading-none text-[color:var(--sl-fg-base)]">arrow_drop_up</span>
            )}
            {s.triangle && status.status === 'under' && (
              <span className="material-symbols-outlined text-[12px] leading-none text-[color:var(--sl-fg-base)] rotate-180">arrow_drop_up</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-nowrap items-baseline justify-between gap-x-2">
            <p className="text-[28px] font-medium text-[color:var(--sl-fg-base)] tracking-[-1.12px] tabular-nums leading-normal whitespace-nowrap">
              {formatCurrencyFull(animatedValue)}
            </p>
            {extra != null && (
              <span className="text-[16px] font-normal text-[color:var(--sl-fg-base-soft)] tracking-[-0.32px] leading-6 text-right tabular-nums shrink-0 whitespace-nowrap">
                {animatedExtra}
              </span>
            )}
          </div>
        {barPercent != null && (
          <div className="relative group/bar w-full">
            <div className="h-[6px] w-full bg-[#eaeaea] rounded-[2px] overflow-hidden">
              <div className="h-full rounded-[2px] origin-left" style={{ width: `${Math.min(100, barPercent)}%`, transform: `scaleX(${progress})`, backgroundColor: fillColor }} />
            </div>
            {showBarHover && barLabels && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-5 py-4 rounded-xl border border-gray-200/90 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.08)] opacity-0 pointer-events-none group-hover/bar:opacity-100 transition-opacity duration-150 z-50 min-w-[180px]">
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm shrink-0 mt-0.5" style={{ backgroundColor: fillColor }} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight whitespace-nowrap">{barLabels.filled}</p>
                      <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(value)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start justify-between gap-6 mt-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm bg-[#eaeaea] border border-gray-200 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[color:var(--sl-fg-base-soft)] leading-tight whitespace-nowrap">{barLabels.total}</p>
                      <p className="text-[13px] font-semibold text-[color:var(--sl-fg-base)] tabular-nums mt-0.5">{formatCurrencyFull(totalValue)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-[200] bg-gray-900/40 backdrop-blur-sm transition-opacity ease-out ${hasEntered && !isExiting ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
        onClick={handleClose}
      />
      <div className="fixed inset-0 z-[201] flex items-center justify-center p-5 pointer-events-none">
        <div
          className={`flex-1 min-h-0 w-full max-w-[calc(100vw-40px)] max-h-[calc(100vh-40px)] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col pointer-events-auto transition-opacity ease-out ${hasEntered && !isExiting ? 'opacity-100' : 'opacity-0'}`}
          style={{ transitionDuration: `${FADE_MS}ms` }}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="shrink-0 bg-white px-8 py-6 flex items-center justify-between z-10 border-b border-[#E1E1E1]">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-medium text-[color:var(--sl-fg-base)] tracking-[-0.8px] leading-8">
              Relatório de consumo de orçamento
            </h1>
            {onOpenCampaign ? (
              <button
                type="button"
                onClick={() => onOpenCampaign(campaign)}
                title="Abrir campanha"
                className="text-sm text-[color:var(--sl-fg-base)] mt-0.5 truncate max-w-md block text-left cursor-pointer underline-offset-2 hover:underline hover:text-[color:var(--sl-fg-base-soft)] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0366dd]/30 focus:ring-offset-1 rounded"
              >
                {campaign.title}
              </button>
            ) : (
              <p className="text-sm text-[color:var(--sl-fg-base)] mt-0.5 truncate max-w-md">{campaign.title}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsInsightsOpen((open) => !open)}
              className={`p-2 rounded-lg active:scale-95 transition-all duration-150 ease-out ${isInsightsOpen ? 'bg-[#eaf2ff] text-[color:var(--sl-fg-base-soft)]' : 'text-[color:var(--sl-fg-base-soft)] hover:bg-gray-100 hover:text-[color:var(--sl-fg-base)]'}`}
              aria-label="Gerar insights"
              title="Gerar insights"
            >
              <span className="material-symbols-outlined">lightbulb</span>
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-lg text-[color:var(--sl-fg-base-soft)] hover:bg-gray-100 hover:text-[color:var(--sl-fg-base)] active:scale-95 transition-transform duration-150 ease-out"
              aria-label="Fechar relatório"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div
          ref={insightsLayoutRef}
          className="min-h-0 flex-1 grid overflow-hidden"
          style={{
            gridTemplateColumns: insightsGridTemplateColumns,
            transition: isInsightsResizeDragging
              ? undefined
              : `grid-template-columns ${INSIGHTS_SIDEBAR_MS}ms ${INSIGHTS_SIDEBAR_EASING}`,
          }}
        >
        <div
          ref={scrollRef}
          className="min-w-0 overflow-y-auto"
          onScroll={() => setHeaderScrolled((scrollRef.current?.scrollTop ?? 0) > 0)}
        >
        <div className="p-8 flex flex-col gap-14 budget-report-content max-w-[1440px] mx-auto w-full">
          {/* 1. Visão geral (totalizer) */}
          <div className="space-y-5 budget-report-section">
            <h2 className="text-lg font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.8px]">Visão geral</h2>
            <div className="flex w-full flex-wrap gap-4">
            {renderTotalizerCard('Consumo do dia', consumptionDay, totalizerDay,
              expectedDay > 0 ? (consumptionDay / expectedDay) * 100 : 0,
              expectedDay > 0 ? `${((consumptionDay / expectedDay) * 100).toFixed(1)}%` : undefined,
              expectedDay, { filled: 'Consumo do dia', total: 'Orçamento diário' },
              undefined,
              progressCard0
            )}
            {renderTotalizerCard('Consumo da semana', consumptionWeek, totalizerWeek,
              expectedWeek > 0 ? (consumptionWeek / expectedWeek) * 100 : 0,
              expectedWeek > 0 ? `${((consumptionWeek / expectedWeek) * 100).toFixed(1)}%` : undefined,
              expectedWeek, { filled: 'Consumo da semana', total: 'Orçamento semanal' },
              undefined,
              progressCard1
            )}
            {renderTotalizerCard('Consumo total', consumptionTotal, totalizerTotal,
              expectedTotalToDate > 0 ? (consumptionTotal / expectedTotalToDate) * 100 : 0,
              expectedTotalToDate > 0 ? `${((consumptionTotal / expectedTotalToDate) * 100).toFixed(1)}%` : undefined,
              expectedTotalToDate, { filled: 'Gasto realizado', total: 'Meta até hoje' },
              undefined,
              progressCard2
            )}
            {renderTotalizerCard('Previsão de gasto total', forecastTotal, totalizerForecast,
              campaign.budget > 0 ? (forecastTotal / campaign.budget) * 100 : 0,
              campaign.budget > 0 ? `${((forecastTotal / campaign.budget) * 100).toFixed(1)}%` : undefined,
              campaign.budget, { filled: 'Previsão de gasto', total: 'Orçamento da campanha' },
              campaign.budget > 0 && (forecastTotal / campaign.budget) * 100 < 100 ? BAR_COLOR_FORECAST_UNDER : undefined,
              progressCard3
            )}
            </div>
          </div>

          {/* 2. Gasto total da campanha */}
          <div className="relative space-y-6 budget-report-section">
            <h2 className="text-lg font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.8px]">Gasto total da campanha</h2>
            <div className="isolate flex flex-col w-full h-[360px] border border-[#e0e0e0] rounded-xl bg-white overflow-hidden transition-shadow duration-200 hover:shadow-sm hover:border-[#d0d0d0]">
              <div className="flex-1 min-h-0 h-[400px] overflow-x-auto overflow-y-hidden py-5">
                <div className="h-full" style={{ minWidth: chartTotalData.length * 36 }}>
                  <ChartLine
                    data={totalChartData}
                    options={totalChartOptions}
                    plugins={[hojePillPluginTotal]}
                  />
                </div>
              </div>
              <div className="flex items-center justify-start gap-6 flex-wrap px-4 py-3 border-t border-[#e0e0e0] bg-white rounded-b-xl text-[12px]">
                <TotalChartLegend visible={totalLegendVisible} onToggle={(i) => setTotalLegendVisible((v) => v.map((x, j) => (j === i ? !x : x)))} />
              </div>
            </div>
            {totalTip && chartTotalData[totalTip.idx] && (
              <SmartTooltip x={totalTip.screenX} y={totalTip.screenY}>
                <TotalTooltipContent data={chartTotalData[totalTip.idx]} />
              </SmartTooltip>
            )}
          </div>

          {/* 3. Gasto diário */}
          <div className="relative space-y-6 budget-report-section">
            <h2 className="text-lg font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.8px]">Gasto diário</h2>
            <div
              ref={dailyChartContainerRef}
              className="isolate flex flex-col w-full h-[360px] border border-[#e0e0e0] rounded-xl bg-white overflow-hidden transition-shadow duration-200 hover:shadow-sm hover:border-[#d0d0d0]"
            >
              <div className="flex-1 min-h-0 h-[170px] overflow-x-auto overflow-y-hidden py-5">
                <div className="h-full" style={{ minWidth: chartDailyData.length * 36 }}>
                  <Chart
                    type="bar"
                    data={dailyChartData}
                    options={dailyChartOptions}
                    plugins={[hojePillPluginDaily]}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap px-4 py-3 border-t border-[#e0e0e0] bg-white rounded-b-xl">
                <DailyChartLegend
                  visible={dailyLegendVisible}
                  onToggle={(i) => setDailyLegendVisible((v) => {
                    if (i === 3 || i === 4) {
                      const next = !v[3];
                      return v.map((x, j) => (j === 3 || j === 4 ? next : x));
                    }
                    return v.map((x, j) => (j === i ? !x : x));
                  })}
                />
              </div>
            </div>
            {dailyTip && chartDailyData[dailyTip.idx] && (
              <SmartTooltip x={dailyTip.screenX} y={dailyTip.screenY} containerRef={dailyChartContainerRef}>
                <DailyTooltipContent data={chartDailyData[dailyTip.idx]} showImpressionShare={dailyLegendVisible[3] || dailyLegendVisible[4]} />
              </SmartTooltip>
            )}
          </div>

          {/* 4. Gasto hora a hora (hoje) */}
          {chartHourlyData.length > 0 && (
            <div className="relative space-y-6 budget-report-section">
              <h2 className="text-lg font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.8px]">Gasto hora a hora</h2>
              <div
                ref={hourlyChartContainerRef}
                className="isolate flex flex-col w-full h-[360px] border border-[#e0e0e0] rounded-xl bg-white overflow-hidden transition-shadow duration-200 hover:shadow-sm hover:border-[#d0d0d0]"
              >
                <div className="flex-1 min-h-0 h-[400px] overflow-x-auto overflow-y-hidden py-5">
                  <div className="h-full" style={{ minWidth: Math.max(400, chartHourlyData.length * 28) }}>
                    <ChartBar
                      data={hourlyChartData}
                      options={hourlyChartOptions}
                      plugins={[agoraPillPluginHourly]}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-start gap-4 flex-wrap px-4 py-3 border-t border-[#e0e0e0] bg-white rounded-b-xl text-[12px] text-[color:var(--sl-fg-base-soft)]">
                  <LegendItem
                    visible={hourlyLegendVisible[0]}
                    onClick={() => setHourlyLegendVisible((v) => [!v[0], v[1], v[2], v[3], v[4]])}
                    aria-label="Alternar Gasto na hora"
                  >
                    <span className="w-3 h-3 rounded-[4px] shrink-0 bg-[#0366dd]" aria-hidden />
                    <span>Gasto na hora</span>
                  </LegendItem>
                  <LegendItem
                    visible={hourlyLegendVisible[1]}
                    onClick={() => setHourlyLegendVisible((v) => [v[0], !v[1], v[2], v[3], v[4]])}
                    aria-label="Alternar Meta por hora"
                  >
                    <span className="w-3 h-3 rounded-[4px] shrink-0 bg-[#eaeaea] border border-gray-200" aria-hidden />
                    <span>Meta por hora</span>
                  </LegendItem>
                  <LegendItem
                    visible={hourlyLegendVisible[2]}
                    onClick={() => setHourlyLegendVisible((v) => [v[0], v[1], !v[2], v[3], v[4]])}
                    aria-label="Alternar Acima da meta"
                  >
                    <span className="w-3 h-3 rounded-[4px] shrink-0 bg-[#034a9e]" aria-hidden />
                    <span>Acima da meta</span>
                  </LegendItem>
                  <LegendItem
                    visible={hourlyLegendVisible[3]}
                    onClick={() => setHourlyLegendVisible((v) => { const next = !v[3]; return [v[0], v[1], v[2], next, next]; })}
                    aria-label="Alternar Impression Share"
                  >
                    <svg width="20" height="4" className="shrink-0" aria-hidden><line x1="0" y1="2" x2="20" y2="2" stroke="#059669" strokeWidth={2} /></svg>
                    <span>Impression Share</span>
                  </LegendItem>
                  <LegendItem
                    visible={hourlyLegendVisible[4]}
                    onClick={() => setHourlyLegendVisible((v) => { const next = !v[4]; return [v[0], v[1], v[2], next, next]; })}
                    aria-label="Alternar Impression Share (previsão)"
                  >
                    <svg width="20" height="4" className="shrink-0" aria-hidden><line x1="0" y1="2" x2="20" y2="2" stroke="#059669" strokeWidth={2} strokeDasharray="4 3" /></svg>
                    <span>Impression Share (previsão)</span>
                  </LegendItem>
                </div>
              </div>
              {hourlyTip != null && chartHourlyData[hourlyTip.idx] && (
                <SmartTooltip x={hourlyTip.screenX} y={hourlyTip.screenY} containerRef={hourlyChartContainerRef}>
                  <HourlyTooltipContent data={chartHourlyData[hourlyTip.idx]} showImpressionShare={hourlyLegendVisible[3] || hourlyLegendVisible[4]} />
                </SmartTooltip>
              )}
            </div>
          )}

          {/* 5. Acumulado do dia hora a hora + projeção da meta */}
          {chartHourlyCumulativeData.length > 0 && (
            <div className="relative space-y-6 budget-report-section">
              <h2 className="text-lg font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.8px]">Gasto acumulado do dia</h2>
              <div
                ref={hourlyCumulativeChartContainerRef}
                className="isolate flex flex-col w-full h-[360px] border border-[#e0e0e0] rounded-xl bg-white overflow-hidden transition-shadow duration-200 hover:shadow-sm hover:border-[#d0d0d0]"
              >
                <div className="flex-1 min-h-0 h-[400px] overflow-x-auto overflow-y-hidden py-5">
                  <div className="h-full" style={{ minWidth: Math.max(400, chartHourlyCumulativeData.length * 28) }}>
                    <ChartLine
                      data={hourlyCumulativeChartData}
                      options={hourlyCumulativeChartOptions}
                      plugins={[agoraPillPluginCumulative]}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-start gap-4 flex-wrap px-4 py-3 border-t border-[#e0e0e0] bg-white rounded-b-xl text-[12px] text-[color:var(--sl-fg-base-soft)]">
                  <LegendItem
                    visible={hourlyCumulativeLegendVisible[0]}
                    onClick={() => setHourlyCumulativeLegendVisible((v) => [!v[0], v[1], v[2]])}
                    aria-label="Alternar Acumulado até esta hora"
                  >
                    <span className="w-3 h-3 rounded-sm bg-[#0366dd]" aria-hidden />
                    <span>Acumulado até esta hora</span>
                  </LegendItem>
                  <LegendItem
                    visible={hourlyCumulativeLegendVisible[1]}
                    onClick={() => setHourlyCumulativeLegendVisible((v) => [v[0], !v[1], v[2]])}
                    aria-label="Alternar Previsão"
                  >
                    <svg width="24" height="4" className="shrink-0" aria-hidden><line x1="0" y1="2" x2="24" y2="2" stroke="#0366dd" strokeWidth={1.5} strokeDasharray="4 3" /></svg>
                    <span>Previsão</span>
                  </LegendItem>
                  <LegendItem
                    visible={hourlyCumulativeLegendVisible[2]}
                    onClick={() => setHourlyCumulativeLegendVisible((v) => [v[0], v[1], !v[2]])}
                    aria-label="Alternar Meta do dia"
                  >
                    <span className="w-3 h-3 rounded-sm bg-[#1f1f1f]" aria-hidden />
                    <span>Meta do dia</span>
                  </LegendItem>
                </div>
              </div>
              {expectedDay > 0 && consumptionDay >= expectedDay && (
                <p className="text-sm text-[color:var(--sl-fg-base)] tracking-[-0.14px] font-medium">
                  Meta do dia já atingida.
                </p>
              )}
              {hourlyCumulativeTip != null && chartHourlyCumulativeData[hourlyCumulativeTip.idx] && (
                <SmartTooltip x={hourlyCumulativeTip.screenX} y={hourlyCumulativeTip.screenY} containerRef={hourlyCumulativeChartContainerRef}>
                  <HourlyCumulativeTooltipContent data={chartHourlyCumulativeData[hourlyCumulativeTip.idx]} />
                </SmartTooltip>
              )}
            </div>
          )}

          <div className="h-8" aria-hidden />
        </div>
        </div>
        <div
          role="separator"
          aria-hidden={!isInsightsOpen}
          aria-orientation="vertical"
          aria-label="Redimensionar painel de oportunidades"
          aria-valuemin={INSIGHTS_SIDEBAR_MIN_W}
          aria-valuemax={2000}
          aria-valuenow={Math.round(insightsSidebarWidth)}
          tabIndex={isInsightsOpen ? 0 : -1}
          className={`relative z-[1] shrink-0 bg-white touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0366dd]/35 ${
            isInsightsOpen ? 'border-r border-[#e0e0e0]' : 'border-0 pointer-events-none'
          } ${isInsightsResizeDragging ? 'bg-[#f0f6ff]' : isInsightsOpen ? 'hover:bg-[#f8fafc] cursor-col-resize' : 'cursor-default'}`}
          style={{ width: INSIGHTS_SIDEBAR_HANDLE_PX }}
          onPointerDown={onInsightsResizePointerDown}
          onPointerMove={onInsightsResizePointerMove}
          onPointerUp={endInsightsResize}
          onPointerCancel={endInsightsResize}
          onLostPointerCapture={() => {
            insightsResizeDragRef.current = null;
            setIsInsightsResizeDragging(false);
          }}
          onKeyDown={onInsightsResizeKeyDown}
        />
        <aside
          className={`min-w-0 overflow-hidden bg-white ${isInsightsOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{
            transitionProperty: 'opacity, transform',
            transitionDuration: `${INSIGHTS_SIDEBAR_MS}ms`,
            transitionTimingFunction: INSIGHTS_SIDEBAR_EASING,
            transform: isInsightsOpen ? 'translateX(0)' : 'translateX(10px)',
          }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-white custom-scrollbar">
            <div
              aria-hidden={!isInsightsContentVisible}
              className={isInsightsContentVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}
              style={{
                transition: `opacity ${Math.round(INSIGHTS_SIDEBAR_MS * 0.62)}ms ${INSIGHTS_SIDEBAR_EASING}`,
              }}
            >
              <div className="px-5 pt-6 pb-0 bg-white">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#f1f5f9] text-[color:var(--sl-fg-base)] text-[12px] font-medium tracking-[-0.11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0366dd]" aria-hidden />
                  {insightCards.length} insights
                </div>
                <h2 className="mt-3 text-[18px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.54px] leading-6">Oportunidades da campanha</h2>
                <p className="mt-1 text-[13px] leading-5 tracking-[-0.13px] text-[color:var(--sl-fg-base-soft)]">
                  Recomendações guiadas pelo ritmo de gasto e pelo objetivo de {objectiveLabel.toLowerCase()}.
                </p>
              </div>
              <div className="px-5 py-5">
                <div className="flex flex-col gap-3.5">
                  {insightCards.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-[14px] border border-[#e0e0e0] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-all duration-200 hover:border-[#d4d4d4]"
                      >
                        <p className="text-[12px] font-medium leading-4 tracking-[-0.11px] text-[color:var(--sl-fg-base-soft)]">
                          {card.eyebrow}
                        </p>
                        <h3 className="mt-3 text-[16px] leading-6 tracking-[-0.32px] font-semibold text-[color:var(--sl-fg-base)]">{card.title}</h3>
                        <p className="mt-2 text-[13px] leading-5 tracking-[-0.13px] text-[color:var(--sl-fg-base)]">{card.description}</p>
                        <div className="mt-4 pt-4 border-t border-[#efefef]">
                          <p className="text-[11px] font-medium tracking-[0.02em] text-[color:var(--sl-fg-base-muted)] uppercase">Próxima ação</p>
                          <p className="mt-1.5 text-[13px] leading-5 tracking-[-0.13px] text-[color:var(--sl-fg-base)]">{card.recommendation}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
        </div>
      </div>
      </div>
    </>
  );
};

function formatShortDate(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}
function formatShortDateNoYear(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(d);
}
