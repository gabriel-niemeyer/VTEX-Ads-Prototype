import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Campaign, CampaignStatus, MediaType, Product, Bid } from '../types';
import { LazyImage } from './LazyImage';
import { MediaDetailDocument } from './MediaDetailDocument';

interface CampaignDocumentProps {
  campaign: Campaign;
  onClose: () => void;
  onSave?: (updated: Campaign) => void;
  allProducts?: Product[];
}

const toInputDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDatePt = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BRL';

/** Formata número no padrão pt-BR: 1.234,56 */
const formatBr = (v: number, decimals = 2): string => {
  const fixed = v.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${withDots},${decPart}` : withDots;
};

/** Parse string pt-BR (1.234,56 ou 1234,56) para número */
const parseBr = (s: string): number => {
  const t = s.replace(/\s/g, '').trim();
  if (!t) return 0;
  const noDots = t.replace(/\./g, '');
  const withPoint = noDots.replace(',', '.');
  const n = parseFloat(withPoint);
  return isNaN(n) ? 0 : n;
};

/** Valor máximo em centavos (99.999.999,99) */
const MAX_CENTS = 999999999;

const MAX_MONEY = MAX_CENTS / 100;

function clampMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_MONEY, Math.max(0, n));
}

function roundMoneyDecimals(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Só dígitos, ponto e vírgula (formato pt-BR). */
function normalizeMoneyDraft(s: string): string {
  return s.replace(/[^\d.,]/g, '');
}

/** Quantidade de dígitos estritamente antes do índice `caret` em `raw`. */
function countDigitsBefore(raw: string, caret: number): number {
  let c = 0;
  const stop = Math.max(0, Math.min(caret, raw.length));
  for (let i = 0; i < stop; i++) {
    if (/\d/.test(raw[i])) c++;
  }
  return c;
}

/** Posição no texto formatado após os primeiros `digitIndex` dígitos (0 = início). */
function caretFromDigitIndex(formatted: string, digitIndex: number): number {
  const digits = (formatted.match(/\d/g) || []).length;
  const k = Math.max(0, Math.min(digitIndex, digits));
  if (k === 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === k) return i + 1;
    }
  }
  return formatted.length;
}

/** Parte inteira com separador de milhar (pt-BR), sem decimais. */
function formatBrIntegerPart(intN: number): string {
  const n = Math.max(0, Math.min(Math.floor(intN), Math.floor(MAX_MONEY)));
  const fixed = n.toFixed(0);
  const [intPart] = fixed.split('.');
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Interpreta texto mascarado: se termina em `,` essa vírgula é só cursor; a decimal é a última dentro do núcleo.
 * Sem vírgula: só parte inteira (pontos = milhar).
 */
function parseMaskedMoneyFull(cleaned: string, decimals: number): number {
  const t = cleaned.trim();
  if (!t) return 0;
  const core = t.endsWith(',') ? t.slice(0, -1) : t;
  const lastComma = core.lastIndexOf(',');
  if (lastComma === -1) {
    const intPart = core.replace(/\D/g, '');
    return intPart ? parseInt(intPart, 10) : 0;
  }
  const intPart = core.slice(0, lastComma).replace(/\D/g, '');
  const fracPart = core.slice(lastComma + 1).replace(/\D/g, '');
  const intN = intPart ? parseInt(intPart, 10) : 0;
  const fd = fracPart.slice(0, decimals);
  const fracPadded = (fd + '0'.repeat(decimals)).slice(0, decimals);
  const fracVal = fd.length > 0 ? parseInt(fracPadded, 10) / 10 ** decimals : 0;
  return intN + fracVal;
}

/** Aplica máscara pt-BR (milhar e decimal) e devolve texto + seleção estável pelo índice de dígitos. */
function applyMoneyMask(
  raw: string,
  selStart: number,
  selEnd: number,
  decimals: number
): { text: string; selStart: number; selEnd: number } {
  const cleaned = normalizeMoneyDraft(raw);
  const d0 = countDigitsBefore(raw, selStart);
  const d1 = countDigitsBefore(raw, selEnd);

  const trailComma = cleaned.endsWith(',');

  let text: string;
  if (trailComma) {
    const inner = cleaned.slice(0, -1);
    const lc = inner.lastIndexOf(',');
    let intN: number;
    let fracRaw: string;
    if (lc === -1) {
      const id = inner.replace(/\D/g, '');
      intN = id ? parseInt(id, 10) : 0;
      fracRaw = '';
    } else {
      const id = inner.slice(0, lc).replace(/\D/g, '');
      intN = id ? parseInt(id, 10) : 0;
      fracRaw = inner.slice(lc + 1).replace(/\D/g, '').slice(0, decimals);
    }
    const intClamped = Math.max(0, Math.min(Math.floor(intN), Math.floor(MAX_MONEY)));
    text =
      fracRaw === ''
        ? `${formatBrIntegerPart(intClamped)},`
        : `${formatBrIntegerPart(intClamped)},${fracRaw}`;
  } else {
    text = formatBr(clampMoney(parseMaskedMoneyFull(cleaned, decimals)), decimals);
  }

  return {
    text,
    selStart: caretFromDigitIndex(text, d0),
    selEnd: caretFromDigitIndex(text, d1),
  };
}

const STATUS_MAP: Record<string, { label: string }> = {
  [CampaignStatus.DRAFT]:     { label: 'Rascunho' },
  [CampaignStatus.ACTIVE]:    { label: 'Ativo' },
  [CampaignStatus.COMPLETED]: { label: 'Concluído' },
};

const OBJECTIVES = ['Alcance', 'Conversão', 'Tráfego', 'Awareness', 'Consideração'];
const FUNNEL_POSITIONS = ['Topo de funil', 'Meio de funil', 'Fundo de funil'];

const PUBLISHERS = [
  'Casas Bahia', 'Magalu', 'Mercado Livre', 'Amazon Brasil',
  'Americanas', 'Fast Shop', 'Kabum', 'Shoptime', 'Submarino',
  'Carrefour', 'Extra',
];

const SPENDING_RHYTHMS = ['Conforme a demanda', 'Uniforme', 'Acelerado', 'Personalizado'];

const SEGMENTS: { label: string; base: number; icon: string; desc: string }[] = [
  { label: 'New-to-brand customers', base: 1_240_000, icon: 'person_add', desc: 'Clientes que nunca compraram da marca' },
  { label: 'Clientes recorrentes', base: 386_000, icon: 'loyalty', desc: 'Compraram 2+ vezes nos últimos 6 meses' },
  { label: 'Compradores de alto valor', base: 52_300, icon: 'diamond', desc: 'Top 5% em ticket médio' },
  { label: 'Público semelhante', base: 2_870_000, icon: 'groups', desc: 'Lookalike dos melhores compradores' },
  { label: 'Todos os clientes', base: 4_920_000, icon: 'public', desc: 'Toda a base elegível' },
];

const MEDIA_STYLES: Record<string, { icon: string; bg: string }> = {
  'Produto patrocinado':        { icon: 'search_check', bg: '#ffc8dc' },
  'Banner patrocinado':         { icon: 'ad_units',     bg: '#ffd6b0' },
  'Marca patrocinada':          { icon: 'verified',     bg: '#e0d4f7' },
  'Video':                      { icon: 'play_circle',  bg: '#ffcaca' },
  'Banner Patrocinado Offsite': { icon: 'public',       bg: '#b8e8f0' },
  'Instore display':            { icon: 'storefront',   bg: '#ffeab0' },
};

const MEDIA_LABELS: Record<string, { name: string; bidLabel: string; desc: string }> = {
  'Produto patrocinado':        { name: 'Busca Patrocinada',       bidLabel: 'CPC',  desc: '{n} SKUs' },
  'Banner patrocinado':         { name: 'Banner Patrocinado',      bidLabel: 'CPM',  desc: '{n} banners' },
  'Marca patrocinada':          { name: 'Marca Patrocinada',       bidLabel: 'CPC',  desc: '1 vídeo e {n} produtos' },
  'Video':                      { name: 'Vídeo',                   bidLabel: 'CPM',  desc: '{n} vídeos' },
  'Banner Patrocinado Offsite': { name: 'Banner Patrocinado Offsite', bidLabel: 'CPC', desc: '{n} banners' },
  'Instore display':            { name: 'Tela em loja',            bidLabel: '',     desc: '{n} lojas' },
};

const ALL_MEDIA_TYPES: MediaType[] = [
  'Produto patrocinado',
  'Banner patrocinado',
  'Marca patrocinada',
  'Video',
  'Banner Patrocinado Offsite',
  'Instore display',
];

const SIDEBAR_SECTIONS = [
  { id: 'produtos', label: 'Produtos' },
  { id: 'investimento', label: 'Investimento' },
  { id: 'segmentacao', label: 'Segmentação' },
  { id: 'plano-midia', label: 'Plano de mídia' },
];

export const CampaignDocument: React.FC<CampaignDocumentProps> = ({
  campaign,
  onClose,
  onSave,
  allProducts = [],
}) => {
  const [title, setTitle] = useState(campaign.title);
  const [startDate, setStartDate] = useState(campaign.startDate);
  const [endDate, setEndDate] = useState(campaign.endDate);
  const [objective, setObjective] = useState('Alcance');
  const [funnelPosition, setFunnelPosition] = useState('Topo de funil');
  const [publishers, setPublishers] = useState<string[]>([campaign.publisher]);
  const [products, setProducts] = useState<Product[]>(campaign.products);
  const [budget, setBudget] = useState(campaign.budget);
  const [dailyLimit, setDailyLimit] = useState(Math.round(campaign.budget / 30));
  const [spendingRhythm, setSpendingRhythm] = useState('Conforme a demanda');
  const [segment, setSegment] = useState('New-to-brand customers');
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(campaign.mediaTypes);
  const [bids, setBids] = useState<Bid[]>(campaign.bids);
  const [allocationOverrides, setAllocationOverrides] = useState<Partial<Record<MediaType, number>>>({});
  const [productPage, setProductPage] = useState(0);
  const PAGE_SIZE = 6;

  const [showObjectiveMenu, setShowObjectiveMenu] = useState(false);
  const [showFunnelMenu, setShowFunnelMenu] = useState(false);
  const [showPublisherMenu, setShowPublisherMenu] = useState(false);
  const [showRhythmMenu, setShowRhythmMenu] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerProductSearch, setPickerProductSearch] = useState('');
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [openMediaDetail, setOpenMediaDetail] = useState<MediaType | null>(null);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [showSegmentDrawer, setShowSegmentDrawer] = useState(false);
  const [segDrawerEntered, setSegDrawerEntered] = useState(false);
  const [segDrawerClosing, setSegDrawerClosing] = useState(false);
  const closingMediaRef = useRef<MediaType | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const [drawerWidth, setDrawerWidth] = useState(60);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const status = STATUS_MAP[campaign.status] ?? STATUS_MAP[CampaignStatus.DRAFT];

  // Animação de entrada da drawer
  useEffect(() => {
    if (openMediaDetail && !drawerClosing) {
      requestAnimationFrame(() => requestAnimationFrame(() => setDrawerEntered(true)));
    }
  }, [openMediaDetail, drawerClosing]);

  useEffect(() => {
    if (showSegmentDrawer && !segDrawerClosing) {
      requestAnimationFrame(() => requestAnimationFrame(() => setSegDrawerEntered(true)));
    }
  }, [showSegmentDrawer, segDrawerClosing]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((rect.right - e.clientX) / rect.width) * 100;
      setDrawerWidth(Math.max(30, Math.min(85, pct)));
    };
    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleCloseDrawer = useCallback(() => {
    closingMediaRef.current = openMediaDetail;
    setDrawerEntered(false);
    setDrawerClosing(true);
    setTimeout(() => {
      setOpenMediaDetail(null);
      setDrawerClosing(false);
      closingMediaRef.current = null;
    }, 400);
  }, [openMediaDetail]);

  const handleOpenSegmentDrawer = useCallback(() => {
    setSegDrawerEntered(false);
    setSegDrawerClosing(false);
    setShowSegmentDrawer(true);
  }, []);

  const handleCloseSegmentDrawer = useCallback(() => {
    setSegDrawerEntered(false);
    setSegDrawerClosing(true);
    setTimeout(() => {
      setShowSegmentDrawer(false);
      setSegDrawerClosing(false);
    }, 400);
  }, []);

  const handleOpenDrawer = useCallback((mt: MediaType) => {
    setDrawerEntered(false);
    setDrawerClosing(false);
    setOpenMediaDetail(mt);
  }, []);

  const persistChanges = useCallback(() => {
    if (!onSave) return;
    onSave({
      ...campaign,
      title,
      startDate,
      endDate,
      budget,
      products,
      publisher: publishers[0] || campaign.publisher,
      mediaTypes,
      bids,
    });
  }, [onSave, campaign, title, startDate, endDate, budget, products, publishers, mediaTypes, bids]);

  useEffect(() => {
    persistChanges();
  }, [persistChanges]);

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const addProduct = (p: Product) => {
    if (!products.find((e) => e.id === p.id)) {
      setProducts((prev) => [...prev, p]);
    }
  };

  const addMediaType = (type: MediaType) => {
    if (mediaTypes.includes(type)) return;
    setMediaTypes((prev) => [...prev, type]);
    setBids((prev) => [...prev, { mediaType: type, currentBid: 1.5, suggestedBid: 1.5 }]);
    setShowMediaMenu(false);
  };

  const removeMediaType = useCallback((type: MediaType) => {
    setMediaTypes((prev) => prev.filter((t) => t !== type));
    setBids((prev) => prev.filter((b) => b.mediaType !== type));
    setAllocationOverrides((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }, []);

  const filteredAvailableProducts = allProducts.filter(
    (p) => !products.find((e) => e.id === p.id)
  );

  const pickerFilteredProducts = useMemo(() => {
    if (!pickerProductSearch.trim()) return filteredAvailableProducts;
    const q = pickerProductSearch.toLowerCase().trim();
    return filteredAvailableProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [filteredAvailableProducts, pickerProductSearch]);

  const defaultAllocation = budget / Math.max(mediaTypes.length, 1);
  const getAllocation = (mt: MediaType) => allocationOverrides[mt] ?? defaultAllocation;

  const handleAllocationChange = useCallback((mt: MediaType, value: number) => {
    setAllocationOverrides((prev) => ({ ...prev, [mt]: value }));
  }, []);

  const handleBidChange = useCallback((mt: MediaType, patch: { currentBid?: number; suggestedBid?: number }) => {
    setBids((prev) =>
      prev.map((b) =>
        b.mediaType === mt ? { ...b, ...patch } : b
      )
    );
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showSegmentDrawer) {
        handleCloseSegmentDrawer();
      } else if (openMediaDetail) {
        handleCloseDrawer();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openMediaDetail, handleCloseDrawer, showSegmentDrawer, handleCloseSegmentDrawer, onClose]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`doc-section-${id}`);
    if (el && scrollRef.current) {
      const top = el.offsetTop - scrollRef.current.offsetTop;
      scrollRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const monthName = startDate.toLocaleDateString('pt-BR', { month: 'long' });
  const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const piLabel = `Pedido de Inserção - ${capMonth} ${startDate.getFullYear()} - ${publishers.join(', ') || '—'}`;

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-white relative">
      {/* ─── Header ─── */}
      <div className="shrink-0 flex items-center justify-between px-5 h-[64px] border-b-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <span className="font-semibold text-[20px] tracking-[-0.45px] text-[color:var(--sl-fg-base)] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center justify-center px-2">
            <span className="text-[11px] tracking-[-0.33px] text-[color:var(--sl-fg-base-soft)] whitespace-nowrap">Salvo agora há pouco</span>
          </div>
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-300 to-blue-500 shrink-0" />
          <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors">
            <span className="material-symbols-outlined text-[16px]">history</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 h-7 min-w-[56px] px-2 rounded-lg text-[11px] font-semibold tracking-[-0.22px] text-[color:var(--sl-fg-base)] border border-[#e5e5e5] bg-[#f5f5f5] hover:bg-[#ebebeb] transition-colors shadow-[0_1px_1px_rgba(0,0,0,0.11)]"
          >
            {status.label}
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
          </button>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">more_horiz</span>
          </button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className="flex-1 flex min-h-0 relative">
        <div ref={scrollRef} className={`flex-1 overflow-y-auto${openMediaDetail || drawerClosing ? ' overflow-hidden' : ''}`}>
          {/* ── Título + Propriedades ── */}
          <div className="flex flex-col gap-[30px] px-10 py-10">
            <div className="w-full max-w-[800px] mx-auto pl-[106px]">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full font-semibold text-[32px] leading-8 tracking-[-1.28px] text-[color:var(--sl-fg-base)] bg-transparent border-none outline-none placeholder:text-[color:var(--sl-fg-base-muted)] cursor-text rounded-lg px-3 -mx-3 py-1 -my-1 transition-colors hover:bg-gray-100"
                placeholder="Nome da campanha"
              />
            </div>
            <div className="w-full max-w-[800px] mx-auto pl-[106px] flex flex-col gap-[8px]">
              {/* PI */}
              <PropertyRow label="PI">
                <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">↗ {piLabel}</span>
              </PropertyRow>

              {/* Alocação (funil) */}
              <PropertyRow label="Alocação">
                <DropdownPill
                  value={funnelPosition}
                  open={showFunnelMenu}
                  onToggle={() => setShowFunnelMenu(!showFunnelMenu)}
                  onClose={() => setShowFunnelMenu(false)}
                  options={FUNNEL_POSITIONS}
                  onSelect={(v) => { setFunnelPosition(v); setShowFunnelMenu(false); }}
                />
              </PropertyRow>

              {/* Anunciante */}
              <PropertyRow label="Anunciante">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-black flex items-center justify-center shrink-0">
                    <span className="text-white text-[10px] font-bold"></span>
                  </div>
                  <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">Apple</span>
                </div>
              </PropertyRow>

              {/* Publishers */}
              <PropertyRow label="Publishers">
                <div className="flex items-center gap-1.5 flex-wrap relative">
                  {publishers.map((pub) => (
                    <button
                      key={pub}
                      type="button"
                      onClick={() => setPublishers((prev) => prev.filter((p) => p !== pub))}
                      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg bg-[#f8f8f8] hover:bg-[#efefef] transition-colors"
                    >
                      <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] whitespace-nowrap">{pub}</span>
                      <span className="material-symbols-outlined text-[12px] text-[color:var(--sl-fg-base-muted)]">close</span>
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPublisherMenu(!showPublisherMenu)}
                      className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors border border-dashed border-gray-300"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                    </button>
                    {showPublisherMenu && (
                      <DropdownMenu onClose={() => setShowPublisherMenu(false)} width={220}>
                        {PUBLISHERS.filter((p) => !publishers.includes(p)).map((pub) => (
                          <button
                            key={pub}
                            type="button"
                            onClick={() => { setPublishers((prev) => [...prev, pub]); setShowPublisherMenu(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-[color:var(--sl-fg-base)] hover:bg-black/[0.04] transition-colors"
                          >
                            {pub}
                          </button>
                        ))}
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </PropertyRow>

              {/* Objetivo */}
              <PropertyRow label="Objetivo">
                <DropdownPill
                  value={objective}
                  open={showObjectiveMenu}
                  onToggle={() => setShowObjectiveMenu(!showObjectiveMenu)}
                  onClose={() => setShowObjectiveMenu(false)}
                  options={OBJECTIVES}
                  onSelect={(v) => { setObjective(v); setShowObjectiveMenu(false); }}
                />
              </PropertyRow>

              {/* Período */}
              <PropertyRow label="Período">
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onStartChange={setStartDate}
                  onEndChange={setEndDate}
                />
              </PropertyRow>
            </div>
          </div>

          {/* ── Produtos ── */}
          <div id="doc-section-produtos" className="flex flex-col px-10 py-10">
            <div className="w-full max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] pb-2">Produtos</h2>
              <div className="flex items-center justify-between h-10 mb-1 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {showProductSearch ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-muted)] shrink-0">search</span>
                      <input
                        ref={productSearchRef}
                        type="text"
                        value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setProductPage(0); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setProductSearch('');
                            setShowProductSearch(false);
                            setProductPage(0);
                          }
                        }}
                        placeholder="Buscar por nome ou SKU..."
                        className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)]"
                      />
                    </div>
                  ) : (
                    <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)] font-normal">{products.length} SKU{products.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (showProductSearch) {
                        setProductSearch('');
                        setShowProductSearch(false);
                        setProductPage(0);
                      } else {
                        setShowProductSearch(true);
                        setTimeout(() => productSearchRef.current?.focus(), 50);
                      }
                    }}
                    className="min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0] transition-colors"
                    aria-label={showProductSearch ? 'Fechar busca' : 'Buscar'}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {showProductSearch ? 'close' : 'search'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(!showProductPicker)}
                    className="min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0] transition-colors"
                    aria-label="Adicionar produto"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                  </button>
                  {showProductPicker && (
                    <DropdownMenu onClose={() => { setShowProductPicker(false); setPickerProductSearch(''); }} width={360} alignRight>
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                          <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)]">search</span>
                          <input
                            type="text"
                            value={pickerProductSearch}
                            onChange={(e) => setPickerProductSearch(e.target.value)}
                            placeholder="Buscar produto..."
                            className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)]"
                            autoFocus
                          />
                          {pickerProductSearch && (
                            <button
                              type="button"
                              onClick={() => setPickerProductSearch('')}
                              className="w-5 h-5 flex items-center justify-center rounded text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base)] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[240px] overflow-y-auto py-1">
                        {pickerFilteredProducts.length === 0 && (
                          <p className="px-3 py-3 text-sm text-[color:var(--sl-fg-base-soft)]">
                            {pickerProductSearch ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                          </p>
                        )}
                        {pickerFilteredProducts.slice(0, 20).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProduct(p)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/[0.04] transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded border shrink-0 overflow-hidden bg-white flex items-center justify-center" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                              {p.imageUrl ? (
                                <LazyImage src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-[color:var(--sl-fg-base-muted)] text-[16px]">inventory_2</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-[color:var(--sl-fg-base)] truncate block">{p.name}</span>
                              <span className="text-xs text-[color:var(--sl-fg-base-muted)] truncate block">{p.id}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              {(() => {
                const searchLower = productSearch.toLowerCase();
                const filtered = productSearch
                  ? products.filter((p) => p.name.toLowerCase().includes(searchLower) || p.id.toLowerCase().includes(searchLower))
                  : products;
                const paginated = filtered.slice(productPage * PAGE_SIZE, (productPage + 1) * PAGE_SIZE);
                const filteredTotalPages = Math.ceil(filtered.length / PAGE_SIZE);

                const highlightMatch = (text: string) => {
                  if (!productSearch) return text;
                  const idx = text.toLowerCase().indexOf(searchLower);
                  if (idx === -1) return text;
                  return (
                    <>
                      {text.slice(0, idx)}
                      <mark className="bg-yellow-200/60 text-inherit rounded-sm px-[1px]">{text.slice(idx, idx + productSearch.length)}</mark>
                      {text.slice(idx + productSearch.length)}
                    </>
                  );
                };

                return (
                  <>
                    {/* Result count when searching */}
                    {productSearch && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-md ${
                          filtered.length === 0 ? 'text-[color:var(--sl-fg-base-soft)] bg-red-50' : 'text-[color:var(--sl-fg-base-soft)] bg-[#f5f5f5]'
                        }`}>
                          {filtered.length === 0 ? 'Sem resultados' : `${filtered.length} encontrado${filtered.length !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-[4px]">
                      {paginated.map((p) => (
                        <div key={p.id} className="flex items-center justify-center p-2 rounded-xl border group transition-colors" style={{ borderColor: '#e0e0e0' }}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-[7px] border shrink-0 overflow-hidden bg-white flex items-center justify-center" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                              {p.imageUrl ? (
                                <LazyImage src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-[color:var(--sl-fg-base-muted)] text-[20px]">inventory_2</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <p className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] truncate">{highlightMatch(p.name)}</p>
                              <p className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">{highlightMatch(p.id)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProduct(p.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-muted)] hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {filtered.length > 0 && (
                      <div className="flex items-center justify-between h-12 px-2">
                        <div className="flex items-center gap-1 text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">
                          <span>{productPage * PAGE_SIZE + 1}</span>
                          <span>—</span>
                          <span>{Math.min((productPage + 1) * PAGE_SIZE, filtered.length)}</span>
                          <span>de</span>
                          <span>{filtered.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setProductPage((p) => Math.max(0, p - 1))}
                            disabled={productPage === 0}
                            className="w-4 h-4 flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] disabled:opacity-30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductPage((p) => Math.min(filteredTotalPages - 1, p + 1))}
                            disabled={productPage >= filteredTotalPages - 1}
                            className="w-4 h-4 flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] disabled:opacity-30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {filtered.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <span className="material-symbols-outlined text-[32px] text-[#d0d0d0]">search_off</span>
                        <p className="text-sm text-[color:var(--sl-fg-base-muted)]">
                          {productSearch ? `Nenhum produto com "${productSearch}"` : 'Nenhum produto adicionado'}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* ── Investimento ── */}
          <div id="doc-section-investimento" className="flex flex-col px-10 py-10">
            <div className="w-full max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] pb-2">Investimento</h2>
              <div className="flex flex-col">
                <EditableMoneyRow
                  label="Alocação total"
                  value={budget}
                  onChange={(v) => { setBudget(v); setDailyLimit(Math.round(v / 30)); }}
                />
                <EditableMoneyRow
                  label="Limite diário"
                  value={dailyLimit}
                  onChange={setDailyLimit}
                />
                <div className="flex items-center gap-5 py-3 border-b" style={{ borderColor: '#e0e0e0' }}>
                  <div className="w-[240px] shrink-0">
                    <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">Ritmo de gasto</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <DropdownPill
                      value={spendingRhythm}
                      open={showRhythmMenu}
                      onToggle={() => setShowRhythmMenu(!showRhythmMenu)}
                      onClose={() => setShowRhythmMenu(false)}
                      options={SPENDING_RHYTHMS}
                      onSelect={(v) => { setSpendingRhythm(v); setShowRhythmMenu(false); }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Segmentação ── */}
          <div id="doc-section-segmentacao" className="flex flex-col px-10 py-10">
            <div className="w-full max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] pb-4">Segmentação</h2>
              <div className="flex items-center gap-5 py-3 border-b" style={{ borderColor: '#e0e0e0' }}>
                <div className="w-[240px] shrink-0">
                  <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">Segmentar por</span>
                </div>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const seg = SEGMENTS.find((s) => s.label === segment);
                    const fmtBase = seg
                      ? seg.base >= 1_000_000
                        ? `${(seg.base / 1_000_000).toFixed(1).replace('.', ',')}M`
                        : seg.base >= 1_000
                        ? `${(seg.base / 1_000).toFixed(1).replace('.', ',')}K`
                        : String(seg.base)
                      : '';
                    return (
                      <button
                        type="button"
                        onClick={handleOpenSegmentDrawer}
                        className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f8f8f8] hover:bg-[#ebebeb] transition-colors cursor-pointer"
                      >
                        {seg && (
                          <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)]">{seg.icon}</span>
                        )}
                        <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{segment}</span>
                        {seg && (
                          <span className="text-xs text-[color:var(--sl-fg-base-muted)] tabular-nums">{fmtBase}</span>
                        )}
                        <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-soft)]">chevron_right</span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* ── Plano de mídia ── */}
          <div id="doc-section-plano-midia" className="flex flex-col px-10 py-10 min-w-0">
            <div className="w-full min-w-0 max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] mb-[24px]">Plano de mídia</h2>
              <div className="flex items-center justify-between h-12 mb-1">
                <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)] font-normal">Mídias</span>
                <div className="relative">
                  <SmallIconBtn icon="add" size={15} onClick={() => setShowMediaMenu(!showMediaMenu)} />
                  {showMediaMenu && (
                    <DropdownMenu onClose={() => setShowMediaMenu(false)} width={320} alignRight>
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs text-[color:var(--sl-fg-base-soft)]">Adicionar tipo de mídia</p>
                      </div>
                      <div className="py-1">
                        {ALL_MEDIA_TYPES.map((type) => {
                          const style = MEDIA_STYLES[type] ?? { icon: 'campaign', bg: '#e0e0e0' };
                          const labels = MEDIA_LABELS[type] ?? { name: type, bidLabel: '', desc: '' };
                          const isAdded = mediaTypes.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => addMediaType(type)}
                              disabled={isAdded}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                isAdded ? 'opacity-60 cursor-default' : 'hover:bg-black/[0.04]'
                              }`}
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: style.bg }}>
                                <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base)]/70">{style.icon}</span>
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-[color:var(--sl-fg-base)]">{labels.name}</span>
                                {labels.bidLabel && (
                                  <span className="text-xs text-[color:var(--sl-fg-base-soft)]">{labels.bidLabel}</span>
                                )}
                              </div>
                              {isAdded && (
                                <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-soft)] shrink-0">check_circle</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-0 w-full min-w-0">
                {mediaTypes.map((mt) => (
                  <MediaRow
                    key={mt}
                    mediaType={mt}
                    allocation={getAllocation(mt)}
                    bid={bids.find((b) => b.mediaType === mt)}
                    productCount={products.length}
                    onAllocationChange={(v) => handleAllocationChange(mt, v)}
                    onBidChange={(patch) => handleBidChange(mt, patch)}
                    onOpenDetail={() => handleOpenDrawer(mt)}
                    onRemove={() => removeMediaType(mt)}
                  />
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Drawer de detalhe da mídia */}
      {(openMediaDetail || drawerClosing) && (
        <div
          className="absolute right-0 top-0 bottom-0 z-50"
          style={{
            width: `${drawerWidth}%`,
            transform: drawerEntered ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group/handle"
          >
            <div className="absolute inset-y-0 left-0 w-[2px] bg-transparent group-hover/handle:bg-blue-400 transition-colors" />
          </div>
          <MediaDetailDocument
            campaign={campaign}
            mediaType={(openMediaDetail ?? closingMediaRef.current)!}
            allocation={getAllocation((openMediaDetail ?? closingMediaRef.current)!)}
            bid={bids.find((b) => b.mediaType === (openMediaDetail ?? closingMediaRef.current))}
            onClose={handleCloseDrawer}
            onAllocationChange={(v) => handleAllocationChange((openMediaDetail ?? closingMediaRef.current)!, v)}
            onBidChange={(patch) => handleBidChange((openMediaDetail ?? closingMediaRef.current)!, patch)}
          />
        </div>
      )}

      {/* Drawer de segmentação */}
      {(showSegmentDrawer || segDrawerClosing) && (
        <div
          className="absolute right-0 top-0 bottom-0 z-50"
          style={{
            width: `${drawerWidth}%`,
            transform: segDrawerEntered ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="h-full flex flex-col bg-white border-l shadow-[0px_24px_48px_rgba(0,0,0,0.16)]" style={{ borderColor: '#e1e1e1' }}>
            <div className="shrink-0 flex items-center justify-between px-5 h-[64px] border-b-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseSegmentDrawer}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <span className="font-semibold text-[20px] tracking-[-0.45px] text-[color:var(--sl-fg-base)]">Segmentação</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-xs uppercase tracking-[0.5px] text-[color:var(--sl-fg-base-muted)] font-medium mb-3">Selecione um segmento</p>
              <div className="flex flex-col gap-2">
                {SEGMENTS.map((seg) => {
                  const isSelected = segment === seg.label;
                  const maxBase = Math.max(...SEGMENTS.map((s) => s.base));
                  const pct = (seg.base / maxBase) * 100;
                  const fmtBase = seg.base >= 1_000_000
                    ? `${(seg.base / 1_000_000).toFixed(1).replace('.', ',')}M`
                    : seg.base >= 1_000
                    ? `${(seg.base / 1_000).toFixed(1).replace('.', ',')}K`
                    : String(seg.base);

                  return (
                    <button
                      key={seg.label}
                      type="button"
                      onClick={() => { setSegment(seg.label); handleCloseSegmentDrawer(); }}
                      className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left overflow-hidden ${
                        isSelected
                          ? 'border-[#1f1f1f] bg-[#fafafa]'
                          : 'border-[#e5e5e5] hover:border-[#ccc] bg-white'
                      }`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 transition-all ${isSelected ? 'bg-[#1f1f1f]/[0.05]' : 'bg-[#f5f5f5]'}`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center gap-3 flex-1 min-w-0 z-[1]">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-[#1f1f1f] text-white' : 'bg-[#f0f0f0] text-[color:var(--sl-fg-base-soft)]'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">{seg.icon}</span>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-sm font-medium tracking-[-0.14px] ${isSelected ? 'text-[color:var(--sl-fg-base)]' : 'text-[#444]'}`}>{seg.label}</span>
                          <span className="text-xs text-[color:var(--sl-fg-base-muted)] truncate">{seg.desc}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className={`text-sm font-semibold tabular-nums tracking-[-0.14px] ${isSelected ? 'text-[color:var(--sl-fg-base)]' : 'text-[#555]'}`}>{fmtBase}</span>
                          <span className="text-[11px] text-[color:var(--sl-fg-base-muted)]">pessoas</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Subcomponentes ─── */

const PropertyRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-1 py-1.5">
    <div className="w-[160px] shrink-0">
      <span className="text-sm font-semibold leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{label}</span>
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const SmallIconBtn: React.FC<{ icon: string; size?: number; onClick?: () => void }> = ({ icon, size = 24, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0] transition-colors"
  >
    <span className="material-symbols-outlined" style={{ fontSize: size }}>{icon}</span>
  </button>
);

/* ─── DateRangePicker ─── */

const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isBetween = (d: Date, start: Date, end: Date) => {
  const t = d.getTime();
  return t > start.getTime() && t < end.getTime();
};

const fmtShortDate = (d: Date) =>
  `${d.getDate()} ${MONTHS_PT[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()}`;

const DateRangePicker: React.FC<{
  startDate: Date;
  endDate: Date;
  onStartChange: (d: Date) => void;
  onEndChange: (d: Date) => void;
}> = ({ startDate, endDate, onStartChange, onEndChange }) => {
  const [open, setOpen] = useState(false);
  const [noEndDate, setNoEndDate] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(startDate.getFullYear(), startDate.getMonth(), 1));
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [hovered, setHovered] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setViewDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
      setSelecting('start');
      setHovered(null);
    }
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleDayClick = (day: Date) => {
    if (selecting === 'start') {
      onStartChange(day);
      if (!noEndDate) {
        setSelecting('end');
        if (day.getTime() > endDate.getTime()) {
          const newEnd = new Date(day);
          newEnd.setDate(newEnd.getDate() + 7);
          onEndChange(newEnd);
        }
      }
    } else {
      if (day.getTime() < startDate.getTime()) {
        onStartChange(day);
      } else {
        onEndChange(day);
        setOpen(false);
      }
    }
  };

  const effectiveEnd = noEndDate ? null : endDate;
  const pillLabel = noEndDate
    ? `${fmtShortDate(startDate)} → Sem fim`
    : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`;

  const cells: { day: number; date: Date; current: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + 1 + i;
    cells.push({ day: d, date: new Date(year, month - 1, d), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(year, month, d), current: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, date: new Date(year, month + 1, d), current: false });
    }
  }

  const getClass = (date: Date, current: boolean) => {
    const isStart = isSameDay(date, startDate);
    const isEnd = effectiveEnd && isSameDay(date, effectiveEnd);
    const inRange = effectiveEnd && isBetween(date, startDate, effectiveEnd);
    const isHoverEnd = selecting === 'end' && hovered && !noEndDate && isSameDay(date, hovered);
    const inHoverRange = selecting === 'end' && hovered && !noEndDate && date.getTime() > startDate.getTime() && date.getTime() < hovered.getTime();

    if (isStart || isEnd) return 'bg-[#1f1f1f] text-white font-medium';
    if (isHoverEnd) return 'bg-[#1f1f1f]/80 text-white font-medium';
    if (inRange) return 'bg-[#f0f0f0] text-[color:var(--sl-fg-base)]';
    if (inHoverRange) return 'bg-[#f5f5f5] text-[color:var(--sl-fg-base)]';
    if (!current) return 'text-[color:var(--sl-fg-base-muted)]';
    return 'text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0]';
  };

  const getRound = (date: Date) => {
    const isStart = isSameDay(date, startDate);
    const isEnd = effectiveEnd && isSameDay(date, effectiveEnd);
    if (isStart && isEnd) return 'rounded-full';
    if (isStart) return 'rounded-l-full';
    if (isEnd) return 'rounded-r-full';
    return '';
  };

  const getBgStrip = (date: Date) => {
    const isStart = isSameDay(date, startDate);
    const isEnd = effectiveEnd && isSameDay(date, effectiveEnd);
    if (isStart || isEnd) return '';
    const inRange = effectiveEnd && isBetween(date, startDate, effectiveEnd);
    if (inRange) return 'bg-[#f0f0f0]';
    return '';
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#f8f8f8] hover:bg-[#ebebeb] transition-colors cursor-pointer"
      >
        <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{pillLabel}</span>
        <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-soft)]">expand_more</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white rounded-2xl border shadow-xl z-50 w-[320px] overflow-hidden" style={{ borderColor: '#e0e0e0' }}>
          {/* Selection tabs */}
          <div className="flex border-b border-[#f0f0f0]">
            <button
              type="button"
              onClick={() => setSelecting('start')}
              className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                selecting === 'start' ? 'text-[color:var(--sl-fg-base)] border-b-2 border-[#1f1f1f]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]'
              }`}
            >
              <span className="block text-[10px] uppercase tracking-[0.5px] text-[color:var(--sl-fg-base-muted)] mb-0.5">Início</span>
              {fmtShortDate(startDate)}
            </button>
            <button
              type="button"
              onClick={() => { if (!noEndDate) setSelecting('end'); }}
              className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                noEndDate ? 'opacity-40 cursor-not-allowed' : selecting === 'end' ? 'text-[color:var(--sl-fg-base)] border-b-2 border-[#1f1f1f]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]'
              }`}
            >
              <span className="block text-[10px] uppercase tracking-[0.5px] text-[color:var(--sl-fg-base-muted)] mb-0.5">Fim</span>
              {noEndDate ? 'Sem fim' : fmtShortDate(endDate)}
            </button>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] text-[color:var(--sl-fg-base-soft)] transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-sm font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.14px]">
              {MONTHS_PT[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] text-[color:var(--sl-fg-base-soft)] transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3">
            {WEEKDAYS_PT.map((d, i) => (
              <div key={i} className="h-8 flex items-center justify-center text-[11px] font-medium text-[color:var(--sl-fg-base-muted)]">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-3 pb-2">
            {cells.map(({ day, date, current }, i) => (
              <div key={i} className={`flex items-center justify-center h-[38px] ${getBgStrip(date)}`}>
                <button
                  type="button"
                  onClick={() => handleDayClick(date)}
                  onMouseEnter={() => setHovered(date)}
                  onMouseLeave={() => setHovered(null)}
                  className={`w-[38px] h-[38px] flex items-center justify-center text-[13px] transition-colors ${getClass(date, current)} ${getRound(date)}`}
                >
                  {day}
                </button>
              </div>
            ))}
          </div>

          {/* No end date toggle */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-t border-[#f0f0f0]">
            <button
              type="button"
              onClick={() => {
                setNoEndDate(!noEndDate);
                if (!noEndDate) setSelecting('start');
              }}
              className={`relative w-9 h-5 rounded-full transition-colors ${noEndDate ? 'bg-[#1f1f1f]' : 'bg-[#d9d9d9]'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${noEndDate ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-[13px] text-[#555]">Sem data fim</span>
          </div>
        </div>
      )}
    </div>
  );
};

const DropdownPill: React.FC<{
  value: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  options: string[];
  onSelect: (v: string) => void;
}> = ({ value, open, onToggle, onClose, options, onSelect }) => (
  <div className="relative inline-block">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f8f8f8] hover:bg-[#ebebeb] transition-colors cursor-pointer"
    >
      <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{value}</span>
      <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-soft)]">expand_more</span>
    </button>
    {open && (
      <DropdownMenu onClose={onClose}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              opt === value ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)] font-medium' : 'text-[color:var(--sl-fg-base)] hover:bg-black/[0.04]'
            }`}
          >
            {opt}
          </button>
        ))}
      </DropdownMenu>
    )}
  </div>
);

const DropdownMenu: React.FC<{ onClose: () => void; children: React.ReactNode; width?: number; alignRight?: boolean }> = ({ onClose, children, width = 200, alignRight = false }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute top-full mt-1 bg-white rounded-xl border shadow-lg z-50 py-1 overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}
      style={{ borderColor: '#e0e0e0', width, maxHeight: 320 }}
    >
      {children}
    </div>
  );
};

/** Linha editável (Investimento): máscara pt-BR (. milhar, , decimal), valida no blur. */
const EditableMoneyRow: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const decimals = 2;

  const commit = () => {
    const t = draft.trim();
    if (t === '') {
      setDraft(formatBr(value, decimals));
      setEditing(false);
      return;
    }
    onChange(roundMoneyDecimals(clampMoney(parseMaskedMoneyFull(t, decimals)), decimals));
    setEditing(false);
  };

  const revert = () => {
    setDraft(formatBr(value, decimals));
    setEditing(false);
  };

  const startEditing = () => {
    setDraft(formatBr(value, decimals));
    setEditing(true);
  };

  const handleDraftChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const raw = ev.target.value;
    const selStart = ev.target.selectionStart ?? 0;
    const selEnd = ev.target.selectionEnd ?? 0;
    const { text, selStart: nextStart, selEnd: nextEnd } = applyMoneyMask(raw, selStart, selEnd, decimals);
    setDraft(text);
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el) return;
      try {
        el.setSelectionRange(nextStart, nextEnd);
      } catch {
        /* ignore */
      }
    });
  };

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      skipBlurCommitRef.current = true;
      commit();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      revert();
    }
  };

  const handleBlur = () => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    commit();
  };

  return (
    <div className="flex items-center gap-5 py-3 border-b" style={{ borderColor: '#e0e0e0' }}>
      <div className="w-[240px] shrink-0">
        <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            spellCheck={false}
            aria-label={label}
            value={draft}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className="box-border min-w-[180px] w-max max-w-full rounded-lg border border-solid px-2 py-1 outline-none focus:outline-none text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-blue-50/60 border-blue-200 caret-[color:var(--sl-fg-base)] whitespace-nowrap tabular-nums [field-sizing:content]"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="box-border min-w-[180px] w-max max-w-full rounded-lg border border-solid px-2 py-1 outline-none text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-transparent border-transparent hover:bg-black/[0.03] text-left transition-colors cursor-text whitespace-nowrap tabular-nums"
          >
            {fmtMoney(value)}
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Valor monetário editável (pt-BR): máscara com milhar (.) e decimal (,),
 * caret estável por índice de dígitos; Enter confirma, Escape cancela, blur normaliza.
 */
const EditableMoneyCell: React.FC<{
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  decimals?: number;
  size?: 'sm' | 'md' | 'compact' | 'compactAllocation';
  ariaLabel?: string;
}> = ({ value, onChange, suffix = '', decimals = 2, size = 'sm', ariaLabel = 'Valor monetário' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const cellShape =
    size === 'md'
      ? 'min-w-[12rem] rounded-md px-1.5 py-0.5 whitespace-nowrap tabular-nums w-max max-w-full [field-sizing:content]'
      : size === 'compactAllocation'
      ? 'min-w-0 w-full max-w-[5.25rem] rounded-md px-1 py-0.5 whitespace-nowrap tabular-nums text-xs leading-4 [field-sizing:content]'
      : size === 'compact'
      ? 'min-w-0 w-full max-w-[4.75rem] rounded-md px-1 py-0.5 whitespace-nowrap tabular-nums text-xs leading-4 [field-sizing:content]'
      : 'min-w-[6.5rem] rounded-md px-1.5 py-0.5 whitespace-nowrap tabular-nums w-max max-w-full [field-sizing:content]';

  const commit = () => {
    const t = draft.trim();
    if (t === '') {
      setDraft(formatBr(value, decimals));
      setEditing(false);
      return;
    }
    onChange(roundMoneyDecimals(clampMoney(parseMaskedMoneyFull(t, decimals)), decimals));
    setEditing(false);
  };

  const revert = () => {
    setDraft(formatBr(value, decimals));
    setEditing(false);
  };

  const startEditing = () => {
    setDraft(formatBr(value, decimals));
    setEditing(true);
  };

  const handleDraftChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const raw = ev.target.value;
    const selStart = ev.target.selectionStart ?? 0;
    const selEnd = ev.target.selectionEnd ?? 0;
    const { text, selStart: nextStart, selEnd: nextEnd } = applyMoneyMask(raw, selStart, selEnd, decimals);
    setDraft(text);
    queueMicrotask(() => {
      const el = inputRef.current;
      if (!el) return;
      try {
        el.setSelectionRange(nextStart, nextEnd);
      } catch {
        /* ignore */
      }
    });
  };

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      skipBlurCommitRef.current = true;
      commit();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      revert();
    }
  };

  const handleBlur = () => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    commit();
  };

  return (
    <div
      className={`flex flex-col justify-center shrink-0 ${
        size === 'compact' || size === 'compactAllocation'
          ? `w-full min-w-0 ${size === 'compactAllocation' ? 'max-w-[5.25rem]' : 'max-w-[4.75rem]'}`
          : 'w-max max-w-full'
      }`}
    >
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          aria-label={ariaLabel}
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`box-border border border-solid outline-none focus:outline-none text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-blue-50/60 border-blue-200 caret-[color:var(--sl-fg-base)] ${cellShape}`}
          autoFocus
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className={`box-border border border-solid outline-none text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-transparent border-transparent hover:bg-black/[0.04] text-left transition-colors cursor-text ${cellShape}`}
        >
          {formatBr(value, decimals)}
          {suffix ? ` ${suffix}` : ''}
        </button>
      )}
    </div>
  );
};

const MediaRow: React.FC<{
  mediaType: MediaType;
  allocation: number;
  bid?: { currentBid: number; suggestedBid: number };
  productCount: number;
  onAllocationChange?: (v: number) => void;
  onBidChange?: (patch: { currentBid?: number; suggestedBid?: number }) => void;
  onOpenDetail?: () => void;
  onRemove?: () => void;
}> = ({ mediaType, allocation, bid, productCount, onAllocationChange, onBidChange, onOpenDetail, onRemove }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const style = MEDIA_STYLES[mediaType] ?? { icon: 'campaign', bg: '#e0e0e0' };
  const labels = MEDIA_LABELS[mediaType] ?? { name: mediaType, bidLabel: 'CPC', desc: '{n} itens' };

  const stableCount = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < mediaType.length; i++) hash = ((hash << 5) - hash + mediaType.charCodeAt(i)) | 0;
    return (Math.abs(hash) % 4) + 2;
  }, [mediaType]);

  const descText = mediaType === 'Produto patrocinado'
    ? labels.desc.replace('{n}', String(productCount))
    : mediaType === 'Instore display'
    ? labels.desc.replace('{n}', '32')
    : labels.desc.replace('{n}', String(stableCount));

  const showSecondBid = mediaType === 'Marca patrocinada' || mediaType === 'Banner Patrocinado Offsite';
  const canEdit = Boolean(onAllocationChange || onBidChange);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="flex items-center justify-center py-1 w-full min-w-0">
      <div
        onClick={onOpenDetail}
        className={`flex items-center gap-3 flex-1 min-w-0 max-w-full rounded-xl border pl-4 pr-2.5 py-4 group transition-colors box-border ${onOpenDetail ? 'cursor-pointer hover:bg-black/[0.02]' : ''}`}
        style={{ borderColor: 'rgba(0,0,0,0.1)', boxShadow: '0 1px 1px rgba(0,0,0,0.08)' }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 max-w-full">
          <div className="flex items-center gap-3 w-[240px] shrink-0 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: style.bg }}>
              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]/60">{style.icon}</span>
            </div>
            <div className="flex flex-col justify-center whitespace-nowrap">
              <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{labels.name}</span>
              <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">{descText}</span>
            </div>
          </div>
          {/* Grid fixo: alocação alinhada à esquerda em todas as linhas; CPC/CPM com mesma largura */}
          <div
            className="grid flex-1 min-w-0 grid-cols-[minmax(0,1fr)_4.75rem_4.75rem] gap-x-2 sm:gap-x-3 items-start"
            onClick={stop}
          >
            <div className="flex flex-col justify-center min-w-0 items-start text-left">
              <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">Alocação total</span>
              {canEdit && onAllocationChange ? (
                <EditableMoneyCell
                  value={allocation}
                  onChange={onAllocationChange}
                  suffix="BRL"
                  size="compactAllocation"
                  ariaLabel={`Alocação total em reais, ${labels.name}`}
                />
              ) : (
                <span className="text-xs leading-4 tracking-[-0.14px] text-[color:var(--sl-fg-base)] tabular-nums max-w-[5.25rem] truncate">
                  {fmtMoney(allocation)}
                </span>
              )}
            </div>
            <div className="w-[4.75rem] min-w-[4.75rem] max-w-[4.75rem] flex flex-col justify-center items-start">
              {bid && labels.bidLabel ? (
                <>
                  <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)] truncate w-full">{labels.bidLabel}</span>
                  {canEdit && onBidChange ? (
                    <EditableMoneyCell
                      value={bid.currentBid}
                      onChange={(v) => onBidChange({ currentBid: v })}
                      suffix="BRL"
                      size="compact"
                      ariaLabel={`${labels.bidLabel} em reais, ${labels.name}`}
                    />
                  ) : (
                    <span className="text-xs leading-4 tracking-[-0.14px] text-[color:var(--sl-fg-base)] tabular-nums max-w-[4.75rem] truncate">
                      {formatBr(bid.currentBid)} BRL
                    </span>
                  )}
                </>
              ) : (
                <div className="min-h-[2.75rem] w-full flex flex-col justify-end" aria-hidden>
                  <span className="invisible text-xs leading-4 select-none">CPM</span>
                  <span className="invisible text-xs tabular-nums">0</span>
                </div>
              )}
            </div>
            <div className="w-[4.75rem] min-w-[4.75rem] max-w-[4.75rem] flex flex-col justify-center items-start">
              {bid && showSecondBid ? (
                <>
                  <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">CPM</span>
                  {canEdit && onBidChange ? (
                    <EditableMoneyCell
                      value={bid.suggestedBid}
                      onChange={(v) => onBidChange({ suggestedBid: v })}
                      suffix="BRL"
                      size="compact"
                      ariaLabel={`CPM em reais, ${labels.name}`}
                    />
                  ) : (
                    <span className="text-xs leading-4 tracking-[-0.14px] text-[color:var(--sl-fg-base)] tabular-nums max-w-[4.75rem] truncate">
                      {formatBr(bid.suggestedBid)} BRL
                    </span>
                  )}
                </>
              ) : (
                <div className="min-h-[2.75rem] w-full flex flex-col justify-end" aria-hidden>
                  <span className="invisible text-xs leading-4 select-none">CPM</span>
                  <span className="invisible text-xs tabular-nums">0</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="relative shrink-0" onClick={stop} ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-black/[0.06] opacity-0 group-hover:opacity-100 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 bg-white rounded-xl border shadow-lg z-50 py-1 overflow-hidden w-[160px]"
              style={{ borderColor: '#e0e0e0' }}
            >
              {onOpenDetail && (
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onOpenDetail(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--sl-fg-base)] hover:bg-black/[0.04] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)]">edit</span>
                  Editar
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onRemove(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--sl-fg-base-soft)] hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Apagar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
