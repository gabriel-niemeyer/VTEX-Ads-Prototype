/** Formatação e máscara pt-BR para valores monetários reais (inputs editáveis). */

export function formatBr(v: number, decimals = 2): string {
  const fixed = v.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${withDots},${decPart}` : withDots;
}

/** Parse livre (1.234,56 ou 1234,56) — colar valores, importações. */
export function parseMoneyStringPtBr(s: string): number {
  const t = s.replace(/\s/g, '').trim();
  if (!t) return 0;
  const noDots = t.replace(/\./g, '');
  const withPoint = noDots.replace(',', '.');
  const n = parseFloat(withPoint);
  return Number.isFinite(n) ? n : 0;
}

export function clampMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export function roundMoneyDecimals(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function normalizeMoneyDraft(s: string): string {
  return s.replace(/[^\d.,]/g, '');
}

export function countDigitsBefore(raw: string, caret: number): number {
  let c = 0;
  const stop = Math.max(0, Math.min(caret, raw.length));
  for (let i = 0; i < stop; i++) {
    if (/\d/.test(raw[i])) c++;
  }
  return c;
}

export function caretFromDigitIndex(formatted: string, digitIndex: number): number {
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

export function formatBrIntegerPart(intN: number): string {
  const n = Math.max(0, Math.floor(intN));
  const fixed = n.toFixed(0);
  const [intPart] = fixed.split('.');
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function parseMaskedMoneyFull(cleaned: string, decimals: number): number {
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

export function applyMoneyMask(
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
    const intClamped = Math.max(0, Math.floor(intN));
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
