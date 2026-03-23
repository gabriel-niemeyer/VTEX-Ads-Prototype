import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { Campaign, MediaType, Bid } from '../types';
import { UserAvatar } from './UserAvatar';
import { NestleBannerCreative } from './NestleBannerCreative';
import {
  getPrefilledNestleBannerAsset,
  hasPrefilledNestleBannerCampaign,
} from '../data/prefilledNestleBanners';
import {
  formatBr,
  clampMoney,
  roundMoneyDecimals,
  parseMaskedMoneyFull,
  applyMoneyMask,
  normalizeMoneyDraft,
} from '../utils/moneyFormat';

type ImageSlot = {
  id: string;
  label: string;
  dimensions: string;
};

const formatSlotId = (label: string, dimensions: string) =>
  `slot-${`${label}-${dimensions}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

/** Slots iniciais — Banner patrocinado */
const BANNER_INITIAL_SLOTS: ImageSlot[] = [
  { id: 'banner-sw', label: 'Super wide', dimensions: '1920 x 120' },
  { id: 'banner-sq', label: 'Square', dimensions: '400 x 400' },
  { id: 'banner-sv', label: 'Super vertical', dimensions: '200 x 768' },
];

/** Formatos extras — Banner patrocinado (+) */
const BANNER_EXTRA_FORMATS: { label: string; dimensions: string }[] = [
  { label: 'Banner horizontal', dimensions: '1200 x 300' },
  { label: 'Leaderboard', dimensions: '728 x 90' },
  { label: 'Medium rectangle', dimensions: '300 x 250' },
  { label: 'Wide skyscraper', dimensions: '160 x 600' },
  { label: 'Half page', dimensions: '300 x 600' },
  { label: 'Quadrado HD', dimensions: '1200 x 1200' },
  { label: 'Retângulo feed', dimensions: '1200 x 628' },
];

const ALL_BANNER_SLOTS: ImageSlot[] = [
  ...BANNER_INITIAL_SLOTS,
  ...BANNER_EXTRA_FORMATS.map((format) => ({
    id: formatSlotId(format.label, format.dimensions),
    ...format,
  })),
];

/** Slots iniciais — Vídeo */
const VIDEO_INITIAL_SLOTS: ImageSlot[] = [
  { id: 'video-main', label: 'Vídeo', dimensions: '1920 x 1080' },
];

/** Formatos extras — Vídeo (+) */
const VIDEO_EXTRA_FORMATS: { label: string; dimensions: string }[] = [
  { label: 'Story vertical', dimensions: '1080 x 1920' },
  { label: 'Quadrado', dimensions: '1080 x 1080' },
  { label: '4K UHD', dimensions: '3840 x 2160' },
  { label: 'Vertical curto', dimensions: '720 x 1280' },
  { label: 'Horizontal wide', dimensions: '2560 x 1440' },
];

function initialDynamicSlots(mt: MediaType): ImageSlot[] {
  switch (mt) {
    case 'Banner patrocinado':
      return [...BANNER_INITIAL_SLOTS];
    case 'Video':
      return [...VIDEO_INITIAL_SLOTS];
    default:
      return [];
  }
}

function extraFormatsForMediaType(mt: MediaType): { label: string; dimensions: string }[] {
  switch (mt) {
    case 'Banner patrocinado':
      return BANNER_EXTRA_FORMATS;
    case 'Video':
      return VIDEO_EXTRA_FORMATS;
    default:
      return [];
  }
}

function fileAcceptForMediaType(mt: MediaType): string {
  if (mt === 'Video') return 'video/*';
  return 'image/*,video/*';
}

function newSlotId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `slot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface MediaDetailDocumentProps {
  campaign: Campaign;
  mediaType: MediaType;
  allocation: number;
  bid?: Bid;
  onClose: () => void;
  onAllocationChange: (v: number) => void;
  onBidChange: (patch: { currentBid?: number; suggestedBid?: number }) => void;
}

const MEDIA_STYLES: Record<string, { icon: string; bg: string }> = {
  'Produto patrocinado':        { icon: 'search_check', bg: '#ffc8dc' },
  'Banner patrocinado':         { icon: 'ad_units',     bg: '#ffc8dc' },
  'Marca patrocinada':          { icon: 'verified',     bg: '#e0d4f7' },
  'Video':                      { icon: 'play_circle',  bg: '#ffcaca' },
  'Banner Patrocinado Offsite': { icon: 'public',       bg: '#b8e8f0' },
  'Instore display':            { icon: 'storefront',   bg: '#ffeab0' },
};

const MEDIA_LABELS: Record<string, { name: string; bidLabel: string }> = {
  'Produto patrocinado':        { name: 'Busca Patrocinada',       bidLabel: 'CPC' },
  'Banner patrocinado':         { name: 'Banner patrocinado',      bidLabel: 'CPM' },
  'Marca patrocinada':          { name: 'Marca Patrocinada',       bidLabel: 'CPC' },
  'Video':                      { name: 'Vídeo',                   bidLabel: 'CPM' },
  'Banner Patrocinado Offsite': { name: 'Banner Patrocinado Offsite', bidLabel: 'CPC' },
  'Instore display':            { name: 'Tela em loja',            bidLabel: '' },
};

/**
 * Slots fixos por tipo (drawer sem lista dinâmica).
 * Banner patrocinado e Vídeo usam `initialDynamicSlots` + formatos extra.
 * Busca patrocinada usa a secção «Termos de busca» (lista de termos).
 */
const UPLOAD_SLOTS: Record<string, { label: string; dimensions: string }[]> = {
  'Marca patrocinada': [
    { label: 'Vídeo', dimensions: '1920 x 1080' },
    { label: 'Imagem', dimensions: '1200 x 628' },
  ],
  'Banner Patrocinado Offsite': [
    { label: 'Super wide', dimensions: '1920 x 120' },
    { label: 'Square', dimensions: '400 x 400' },
  ],
  'Instore display': [
    { label: 'Tela', dimensions: '1080 x 1920' },
  ],
};

/** Mesmo padrão pt-BR que no documento da campanha: edição direta, colar, caret estável. */
function EditableMoneyField({
  value,
  onChange,
  className = '',
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const pendingCaretRef = useRef<{ s: number; e: number } | null>(null);
  const selectAllOnFocusRef = useRef(false);
  const decimals = 2;

  useLayoutEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus({ preventScroll: true });
    if (selectAllOnFocusRef.current) {
      selectAllOnFocusRef.current = false;
      inputRef.current.select();
      pendingCaretRef.current = null;
      return;
    }
    const p = pendingCaretRef.current;
    if (p) {
      pendingCaretRef.current = null;
      try {
        inputRef.current.setSelectionRange(p.s, p.e);
      } catch {
        /* ignore */
      }
    }
  }, [draft, editing]);

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
    selectAllOnFocusRef.current = true;
    setEditing(true);
  };

  const handleDraftChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    selectAllOnFocusRef.current = false;
    const raw = ev.target.value;
    const selStart = ev.target.selectionStart ?? 0;
    const selEnd = ev.target.selectionEnd ?? 0;
    const { text, selStart: nextStart, selEnd: nextEnd } = applyMoneyMask(raw, selStart, selEnd, decimals);
    pendingCaretRef.current = { s: nextStart, e: nextEnd };
    setDraft(text);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    selectAllOnFocusRef.current = false;
    const pasted = normalizeMoneyDraft(e.clipboardData.getData('text'));
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const merged = draft.slice(0, start) + pasted + draft.slice(end);
    const caret = start + pasted.length;
    const { text, selStart: ns, selEnd: ne } = applyMoneyMask(merged, caret, caret, decimals);
    pendingCaretRef.current = { s: ns, e: ne };
    setDraft(text);
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
    <div className={className}>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          value={draft}
          onChange={handleDraftChange}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="font-medium text-[14px] leading-5 text-[color:var(--sl-fg-base)] tracking-[-0.14px] bg-blue-50/60 border border-blue-200 rounded-lg px-3 py-1.5 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/35 w-full max-w-[180px]"
        />
      ) : (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startEditing}
          className="font-medium text-[14px] leading-5 text-[color:var(--sl-fg-base)] tracking-[-0.14px] hover:bg-black/[0.04] rounded px-1 py-0.5 -ml-1 transition-colors cursor-text text-left"
        >
          <span className="text-[color:var(--sl-fg-base)]">{formatBr(value)}</span>
          <span className="text-[color:var(--sl-fg-base-soft)]"> BRL</span>
        </button>
      )}
    </div>
  );
}

function PrefilledBannerAssetPreview({
  campaign,
  label,
  dimensions,
}: {
  campaign: Campaign;
  label: string;
  dimensions: string;
}) {
  const assetPath = getPrefilledNestleBannerAsset(campaign.id, label, dimensions);
  const [assetFailed, setAssetFailed] = useState(!assetPath);

  useEffect(() => {
    setAssetFailed(!assetPath);
  }, [assetPath]);

  if (!assetPath || assetFailed) {
    return (
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-[#0c3b85] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-white uppercase">
            Fallback local
          </span>
          <span className="text-[11px] text-[color:var(--sl-fg-base-soft)]">
            PNG ainda não gerado
          </span>
        </div>
        <NestleBannerCreative campaign={campaign} label={label} dimensions={dimensions} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-full bg-[#0c3b85] px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-white uppercase">
          PNG por IA
        </span>
        <span className="text-[11px] text-[color:var(--sl-fg-base-soft)]">
          Arquivo pronto em public/generated-banners
        </span>
      </div>
      <div className="rounded-[18px] bg-[#f4f6fa] border border-black/[0.05] p-3 sm:p-4 flex items-center justify-center min-h-[190px]">
        <img
          src={assetPath}
          alt={`${campaign.title} - ${label}`}
          className="max-w-full max-h-[420px] w-auto h-auto rounded-[18px] shadow-[0_22px_44px_rgba(8,31,68,0.18)]"
          onError={() => setAssetFailed(true)}
        />
      </div>
    </div>
  );
}

export const MediaDetailDocument: React.FC<MediaDetailDocumentProps> = ({
  campaign,
  mediaType,
  allocation,
  bid,
  onClose,
  onAllocationChange,
  onBidChange,
}) => {
  const style = MEDIA_STYLES[mediaType] ?? { icon: 'campaign', bg: '#ffc8dc' };
  const labels = MEDIA_LABELS[mediaType] ?? { name: mediaType, bidLabel: 'CPM' };
  const slots = UPLOAD_SLOTS[mediaType] ?? [
    { label: 'Super wide', dimensions: '1920 x 120' },
    { label: 'Square', dimensions: '400 x 400' },
    { label: 'Super vertical', dimensions: '200 x 768' },
  ];
  const showSecondBid = mediaType === 'Marca patrocinada' || mediaType === 'Banner Patrocinado Offsite';
  const sectionTitle =
    mediaType === 'Banner patrocinado' || mediaType === 'Banner Patrocinado Offsite'
      ? 'Banner'
      : mediaType === 'Produto patrocinado'
        ? 'Termos de busca'
        : 'Mídia';

  const isBuscaPatrocinada = mediaType === 'Produto patrocinado';

  const usesDynamicSlotUpload =
    mediaType === 'Banner patrocinado' ||
    mediaType === 'Video';
  const hasPrefilledBannerCreatives =
    mediaType === 'Banner patrocinado' && hasPrefilledNestleBannerCampaign(campaign.id);

  const [uploads, setUploads] = useState<Record<number, { url: string; name: string }>>({});
  const [dynamicSlots, setDynamicSlots] = useState<ImageSlot[]>(() =>
    hasPrefilledBannerCreatives ? [...ALL_BANNER_SLOTS] : initialDynamicSlots(mediaType)
  );
  const [dynamicUploads, setDynamicUploads] = useState<
    Record<string, { url: string; name: string; mime?: string }>
  >({});
  const [formatPickerOpen, setFormatPickerOpen] = useState(false);
  const formatPickerRef = useRef<HTMLDivElement>(null);

  const [searchTerms, setSearchTerms] = useState<{ id: string; text: string }[]>([]);
  const [termDraft, setTermDraft] = useState('');
  const availableFormats = useMemo(() => {
    const sourceFormats =
      mediaType === 'Banner patrocinado'
        ? ALL_BANNER_SLOTS.map(({ label, dimensions }) => ({ label, dimensions }))
        : extraFormatsForMediaType(mediaType);

    return sourceFormats.filter(
      (format) =>
        !dynamicSlots.some(
          (slot) => slot.label === format.label && slot.dimensions === format.dimensions
        )
    );
  }, [dynamicSlots, mediaType]);

  useEffect(() => {
    setDynamicUploads((prev) => {
      (Object.values(prev) as { url: string }[]).forEach((u) => URL.revokeObjectURL(u.url));
      return {};
    });
    setDynamicSlots(
      mediaType === 'Banner patrocinado' && hasPrefilledNestleBannerCampaign(campaign.id)
        ? [...ALL_BANNER_SLOTS]
        : initialDynamicSlots(mediaType)
    );
    setFormatPickerOpen(false);
    setSearchTerms([]);
    setTermDraft('');
  }, [campaign.id, mediaType]);

  useEffect(() => {
    if (!formatPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (formatPickerRef.current && !formatPickerRef.current.contains(e.target as Node)) {
        setFormatPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [formatPickerOpen]);

  const handleFileChange = (slotIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setUploads((prev) => ({ ...prev, [slotIndex]: { url, name: file.name } }));
    e.target.value = '';
  };

  const removeUpload = (slotIndex: number) => {
    setUploads((prev) => {
      const next = { ...prev };
      if (next[slotIndex]) URL.revokeObjectURL(next[slotIndex].url);
      delete next[slotIndex];
      return next;
    });
  };

  const handleDynamicFileChange = useCallback((slotId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setDynamicUploads((prev) => {
      const next = { ...prev };
      if (next[slotId]) URL.revokeObjectURL(next[slotId].url);
      next[slotId] = { url, name: file.name, mime: file.type || undefined };
      return next;
    });
    e.target.value = '';
  }, []);

  const removeDynamicSlot = useCallback((slotId: string) => {
    setDynamicUploads((prev) => {
      if (!prev[slotId]) return prev;
      const next = { ...prev };
      URL.revokeObjectURL(next[slotId].url);
      delete next[slotId];
      return next;
    });
    setDynamicSlots((prev) => prev.filter((s) => s.id !== slotId));
  }, []);

  const addDynamicFormat = useCallback((fmt: { label: string; dimensions: string }) => {
    setDynamicSlots((prev) => [
      ...prev,
      {
        id:
          mediaType === 'Banner patrocinado'
            ? formatSlotId(fmt.label, fmt.dimensions)
            : newSlotId(),
        ...fmt,
      },
    ]);
    setFormatPickerOpen(false);
  }, [mediaType]);

  const fileAccept = fileAcceptForMediaType(mediaType);

  const addSearchTerm = useCallback(() => {
    const t = termDraft.trim();
    if (!t) return;
    setSearchTerms((prev) => [...prev, { id: newSlotId(), text: t }]);
    setTermDraft('');
  }, [termDraft]);

  const removeSearchTerm = useCallback((id: string) => {
    setSearchTerms((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <div
      className="h-full w-full flex flex-col bg-white border-l border-b border-r border-black/10 shadow-[0px_24px_48px_rgba(0,0,0,0.16)]"
    >
      {/* Canvas Title — header 54px, border #ececec */}
      <div className="shrink-0 h-[54px] flex items-center justify-between border-b border-[#ececec] px-3">
        <div className="flex h-full items-center shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
        </div>
        <div className="flex flex-1 gap-2 items-center justify-end min-w-0">
          <p className="text-[11px] text-[color:var(--sl-fg-base-soft)] tracking-[-0.33px] whitespace-nowrap shrink-0 px-2">
            Salvo agora há pouco
          </p>
          <UserAvatar size="sm" />
          <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] shrink-0">
            <span className="material-symbols-outlined text-[18px]">history</span>
          </button>
          <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] shrink-0 -rotate-90">
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        </div>
      </div>

      {/* Content — ocupa o resto do canvas, scroll vertical */}
      <div className="flex-1 min-h-0 overflow-y-auto px-10 flex flex-col justify-start items-center">
        {/* title block — border-b #e0e0e0, gap 32px, padding 40px */}
        <div className="border-b border-[#e0e0e0] flex flex-col gap-8 items-start py-10 w-full">
          <div className="flex flex-col gap-6 items-start w-full">
            <div
              className="w-14 h-14 rounded-xl shrink-0"
              style={{ background: style.bg }}
            />
            <h1 className="font-semibold text-[32px] leading-8 tracking-[-1.28px] text-[color:var(--sl-fg-base)]">
              {labels.name}
            </h1>
          </div>
          <div className="flex flex-col gap-2 w-full">
            {/* Alocação — label 14px #707070, value inline edit + BRL */}
            <div className="flex gap-1 h-8 items-center w-full">
              <div className="flex gap-2 h-full items-center w-40 shrink-0">
                <p className="text-[14px] leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)]">Alocação</p>
              </div>
              <div className="flex flex-1 items-center min-w-0">
                <EditableMoneyField value={allocation} onChange={onAllocationChange} />
              </div>
            </div>
            {/* CPM */}
            {labels.bidLabel === 'CPM' && bid && (
              <div className="flex gap-1 h-8 items-center w-full">
                <div className="flex gap-2 h-full items-center w-40 shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)]">gavel</span>
                  <p className="text-[14px] leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)]">CPM</p>
                </div>
                <div className="flex flex-1 items-center min-w-0">
                  <EditableMoneyField
                    value={bid.currentBid}
                    onChange={(v) => onBidChange({ currentBid: v })}
                  />
                </div>
              </div>
            )}
            {/* CPC (quando não é CPM) */}
            {labels.bidLabel === 'CPC' && bid && (
              <div className="flex gap-1 h-8 items-center w-full">
                <div className="flex gap-2 h-full items-center w-40 shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)]">gavel</span>
                  <p className="text-[14px] leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)]">CPC</p>
                </div>
                <div className="flex flex-1 items-center min-w-0">
                  <EditableMoneyField
                    value={bid.currentBid}
                    onChange={(v) => onBidChange({ currentBid: v })}
                  />
                </div>
              </div>
            )}
            {showSecondBid && bid && (
              <div className="flex gap-1 h-8 items-center w-full">
                <div className="flex gap-2 h-full items-center w-40 shrink-0">
                  <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)]">gavel</span>
                  <p className="text-[14px] leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)]">CPM</p>
                </div>
                <div className="flex flex-1 items-center min-w-0">
                  <EditableMoneyField
                    value={bid.suggestedBid}
                    onChange={(v) => onBidChange({ suggestedBid: v })}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section — pt-7, título "Banner", cards gap 8px */}
        <div className="pt-6 pb-4 max-w-[800px] w-full flex flex-col gap-4">
          <div className="pb-2">
            <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)]">
              {sectionTitle}
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            {isBuscaPatrocinada ? (
              <div className="flex flex-col gap-2.5 w-full">
                <p className="text-[12px] leading-4 tracking-[-0.06px] text-[color:var(--sl-fg-base-soft)]">
                  Palavras ou frases que aproximam o anúncio das pesquisas dos clientes.
                </p>
                <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] min-h-[2.875rem] focus-within:border-black/[0.14] focus-within:shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-[border-color,box-shadow]">
                  {searchTerms.map((term) => (
                    <span
                      key={term.id}
                      className="inline-flex items-center gap-0.5 max-w-[min(100%,20rem)] rounded-full bg-black/[0.06] pl-2.5 pr-0.5 py-0.5 text-[13px] leading-tight tracking-[-0.12px] text-[color:var(--sl-fg-base)] border border-black/[0.04]"
                    >
                      <span className="truncate min-w-0 pl-0.5">{term.text}</span>
                      <button
                        type="button"
                        onClick={() => removeSearchTerm(term.id)}
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-[color:var(--sl-fg-base-muted)] hover:bg-black/[0.08] hover:text-[color:var(--sl-fg-base)] transition-colors"
                        aria-label={`Remover termo: ${term.text}`}
                        title="Remover"
                      >
                        <span className="material-symbols-outlined text-[15px] leading-none">close</span>
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={termDraft}
                    onChange={(e) => setTermDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSearchTerm();
                      }
                      if (e.key === 'Backspace' && !termDraft && searchTerms.length > 0) {
                        removeSearchTerm(searchTerms[searchTerms.length - 1].id);
                      }
                    }}
                    placeholder={searchTerms.length === 0 ? 'Digite um termo…' : ''}
                    className="min-w-[6rem] flex-1 basis-[6rem] bg-transparent py-1 px-1 text-[13px] leading-5 tracking-[-0.12px] text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)] outline-none border-0 focus:ring-0"
                    aria-label="Novo termo de busca"
                  />
                  {termDraft.trim() ? (
                    <button
                      type="button"
                      onClick={addSearchTerm}
                      className="inline-flex h-9 min-w-[6.25rem] shrink-0 items-center justify-center rounded-[var(--sl-radius-2)] border-0 px-3 text-[13px] font-medium tracking-[-0.14px] bg-[var(--sl-bg-muted)] text-[var(--sl-fg-muted)] shadow-none transition-colors hover:bg-[var(--sl-bg-muted-hover)] hover:text-[var(--sl-fg-muted-hover)] active:bg-[var(--sl-bg-muted-pressed)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sl-color-gray-8)] focus-visible:ring-offset-1"
                    >
                      Adicionar
                    </button>
                  ) : null}
                </div>
                <p className="text-[11px] leading-4 tracking-[-0.06px] text-[color:var(--sl-fg-base-muted)]">
                  Enter para criar um chip. Backspace no campo vazio remove o último termo.
                </p>
              </div>
            ) : usesDynamicSlotUpload
              ? dynamicSlots.map((slot) => {
                  const uploaded = dynamicUploads[slot.id];
                  const isVideoPreview = Boolean(uploaded?.mime?.startsWith('video/'));
                  return (
                    <div
                      key={slot.id}
                      className="group border border-black/[0.06] rounded-xl p-4 flex flex-col gap-2.5"
                    >
                      <div className="flex font-medium text-[12px] leading-normal tracking-[-0.36px] justify-between w-full items-start gap-2">
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <p className="text-[color:var(--sl-fg-base)] truncate">{slot.label}</p>
                          <p className="text-[11px] font-normal text-[color:var(--sl-fg-base-soft)] tabular-nums tracking-[-0.22px]">
                            {slot.dimensions}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeDynamicSlot(slot.id)}
                          className="shrink-0 flex items-center gap-0.5 text-[color:var(--sl-fg-base-soft)] opacity-0 pointer-events-none transition-opacity duration-150 hover:text-red-600 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                          aria-label={`Apagar formato: ${slot.label}`}
                          title="Apagar formato"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                          <span className="text-[11px] hidden sm:inline">Apagar</span>
                        </button>
                      </div>
                      {uploaded ? (
                        isVideoPreview ? (
                          <div className="flex flex-col gap-2">
                            <video
                              src={uploaded.url}
                              className="w-full h-[120px] object-contain rounded-lg bg-black"
                              controls
                              playsInline
                            />
                            <label className="inline-flex cursor-pointer items-center gap-1 self-start text-[12px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline">
                              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                              Substituir vídeo
                              <input
                                type="file"
                                accept={fileAccept}
                                className="hidden"
                                onChange={(e) => handleDynamicFileChange(slot.id, e)}
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="relative rounded-lg overflow-hidden cursor-pointer group/uv">
                            <img
                              src={uploaded.url}
                              alt={uploaded.name}
                              className="w-full h-[120px] object-contain rounded-lg"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover/uv:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover/uv:opacity-100">
                              <span className="text-white text-xs font-medium bg-black/50 rounded-lg px-3 py-1.5 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                                Trocar
                              </span>
                            </div>
                            <input
                              type="file"
                              accept={fileAccept}
                              className="hidden"
                              onChange={(e) => handleDynamicFileChange(slot.id, e)}
                            />
                          </label>
                        )
                      ) : hasPrefilledBannerCreatives ? (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-[#2563eb] hover:text-[#1d4ed8] hover:underline">
                              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                              Substituir arte
                              <input
                                type="file"
                                accept={fileAccept}
                                className="hidden"
                                onChange={(e) => handleDynamicFileChange(slot.id, e)}
                              />
                            </label>
                          </div>
                          <PrefilledBannerAssetPreview
                            campaign={campaign}
                            label={slot.label}
                            dimensions={slot.dimensions}
                          />
                        </div>
                      ) : (
                        <label className="bg-[#fafafa] h-[120px] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100/80 transition-colors gap-1.5 border border-dashed border-transparent hover:border-gray-300">
                          <span className="material-symbols-outlined text-[24px] text-[color:var(--sl-fg-base-muted)]">
                            {mediaType === 'Video' ? 'smart_display' : 'cloud_upload'}
                          </span>
                          <span className="text-[12px] text-[color:var(--sl-fg-base-muted)]">Clique para enviar</span>
                          <input
                            type="file"
                            accept={fileAccept}
                            className="hidden"
                            onChange={(e) => handleDynamicFileChange(slot.id, e)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })
              : slots.map((slot, i) => {
                  const uploaded = uploads[i];
                  return (
                    <div
                      key={`${slot.label}-${i}`}
                      className="group border border-black/[0.06] rounded-xl p-4 flex flex-col gap-2.5"
                    >
                      <div className="flex font-medium text-[12px] leading-normal tracking-[-0.36px] justify-between w-full items-start gap-2">
                        <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                          <p className="text-[color:var(--sl-fg-base)]">{slot.label}</p>
                          <p className="text-[11px] font-normal text-[color:var(--sl-fg-base-soft)] tabular-nums tracking-[-0.22px]">
                            {slot.dimensions}
                          </p>
                        </div>
                        {uploaded ? (
                          <button
                            type="button"
                            onClick={() => removeUpload(i)}
                            className="shrink-0 flex items-center gap-0.5 text-[color:var(--sl-fg-base-soft)] opacity-0 pointer-events-none transition-opacity duration-150 hover:text-red-600 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
                            aria-label={`Remover ${slot.label}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            <span className="text-[11px]">Remover</span>
                          </button>
                        ) : null}
                      </div>
                      {uploaded ? (
                        <label className="relative rounded-lg overflow-hidden cursor-pointer group">
                          <img
                            src={uploaded.url}
                            alt={uploaded.name}
                            className="w-full h-[120px] object-contain rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0">
                            <span className="text-white text-xs font-medium bg-black/50 rounded-lg px-3 py-1.5 flex items-center gap-1">
                              <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                              Trocar
                            </span>
                          </div>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(i, e)}
                          />
                        </label>
                      ) : (
                        <label className="bg-[#fafafa] h-[120px] rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100/80 transition-colors gap-1.5 border border-dashed border-transparent hover:border-gray-300">
                          <span className="material-symbols-outlined text-[24px] text-[color:var(--sl-fg-base-muted)]">
                            cloud_upload
                          </span>
                          <span className="text-[12px] text-[color:var(--sl-fg-base-muted)]">Clique para enviar</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => handleFileChange(i, e)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
            {usesDynamicSlotUpload && availableFormats.length > 0 && (
              <div className="relative pt-1" ref={formatPickerRef}>
                <button
                  type="button"
                  onClick={() => setFormatPickerOpen((o) => !o)}
                  className="w-full rounded-xl border border-black/[0.06] bg-[#fafafa] hover:bg-gray-100/90 transition-colors py-3 px-4 flex items-center justify-center gap-2 text-[13px] font-medium text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)]"
                  aria-expanded={formatPickerOpen}
                  aria-haspopup="listbox"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                  {dynamicSlots.length === 0 ? 'Adicionar formato' : 'Adicionar outro formato'}
                </button>
                {formatPickerOpen && (
                  <div
                    className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-black/[0.08] bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-[min(280px,50vh)] overflow-y-auto"
                    role="listbox"
                  >
                    <p className="px-3 py-2 text-[11px] tracking-wide text-[color:var(--sl-fg-base-soft)]">
                      Escolha o formato
                    </p>
                    {availableFormats.map((fmt) => (
                      <button
                        key={`${fmt.label}-${fmt.dimensions}`}
                        type="button"
                        role="option"
                        className="w-full text-left px-3 py-2.5 hover:bg-black/[0.04] transition-colors border-t border-black/[0.04] first:border-t-0"
                        onClick={() => addDynamicFormat(fmt)}
                      >
                        <span className="block text-[13px] font-medium text-[color:var(--sl-fg-base)]">{fmt.label}</span>
                        <span className="block text-[11px] text-[color:var(--sl-fg-base-soft)] tabular-nums">{fmt.dimensions}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
