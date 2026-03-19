import React, { useState } from 'react';
import { Campaign, MediaType, Bid } from '../types';

interface MediaDetailDocumentProps {
  campaign: Campaign;
  mediaType: MediaType;
  allocation: number;
  bid?: Bid;
  onClose: () => void;
  onAllocationChange: (v: number) => void;
  onBidChange: (patch: { currentBid?: number; suggestedBid?: number }) => void;
}

const formatBr = (v: number, decimals = 2): string => {
  const fixed = v.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decPart ? `${withDots},${decPart}` : withDots;
};

const parseBr = (s: string): number => {
  const t = s.replace(/\s/g, '').trim();
  if (!t) return 0;
  const noDots = t.replace(/\./g, '');
  const withPoint = noDots.replace(',', '.');
  const n = parseFloat(withPoint);
  return isNaN(n) ? 0 : n;
};

const MAX_CENTS = 999999999;

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

/** Slots do Figma: Banner = Super wide, Square, Super vertical. Outros tipos mapeados. */
const UPLOAD_SLOTS: Record<string, { label: string; dimensions: string }[]> = {
  'Produto patrocinado': [
    { label: 'Imagem principal', dimensions: '800 x 800' },
    { label: 'Imagem secundária', dimensions: '800 x 800' },
  ],
  'Banner patrocinado': [
    { label: 'Super wide', dimensions: '1920 x 120' },
    { label: 'Square', dimensions: '400 x 400' },
    { label: 'Super vertical', dimensions: '200 x 768' },
  ],
  'Marca patrocinada': [
    { label: 'Vídeo', dimensions: '1920 x 1080' },
    { label: 'Imagem', dimensions: '1200 x 628' },
  ],
  'Video': [
    { label: 'Vídeo', dimensions: '1920 x 1080' },
  ],
  'Banner Patrocinado Offsite': [
    { label: 'Super wide', dimensions: '1920 x 120' },
    { label: 'Square', dimensions: '400 x 400' },
  ],
  'Instore display': [
    { label: 'Tela', dimensions: '1080 x 1920' },
  ],
};

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
  const [cents, setCents] = useState(0);

  const commit = () => {
    onChange(cents / 100);
    setEditing(false);
  };

  const startEditing = () => {
    setCents(Math.round(value * 100));
    setEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { commit(); return; }
    if (e.key === 'Escape') { setCents(Math.round(value * 100)); setEditing(false); return; }
    if (e.key === 'Backspace') {
      e.preventDefault();
      setCents((c) => Math.floor(c / 10));
      return;
    }
    const digit = e.key.replace(/\D/g, '');
    if (digit.length === 1) {
      e.preventDefault();
      setCents((c) => Math.min(MAX_CENTS, c * 10 + parseInt(digit, 10)));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const parsed = parseBr(e.clipboardData.getData('text'));
    setCents(Math.min(MAX_CENTS, Math.max(0, Math.round(parsed * 100))));
  };

  return (
    <div className={className}>
      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          value={formatBr(cents / 100)}
          readOnly
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={commit}
          className="font-medium text-[14px] leading-5 text-[color:var(--sl-fg-base)] tracking-[-0.14px] bg-blue-50/60 border border-blue-200 rounded-lg px-2 py-1 outline-none w-full max-w-[160px]"
          autoFocus
        />
      ) : (
        <button
          type="button"
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
  const sectionTitle = mediaType === 'Banner patrocinado' || mediaType === 'Banner Patrocinado Offsite' ? 'Banner' : mediaType === 'Produto patrocinado' ? 'Imagens' : 'Mídia';

  const [uploads, setUploads] = useState<Record<number, { url: string; name: string }>>({});

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
          <div className="w-6 h-6 rounded-full bg-gray-300 shrink-0" />
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
            {slots.map((slot, i) => {
              const uploaded = uploads[i];
              return (
                <div
                  key={`${slot.label}-${i}`}
                  className="border border-black/[0.06] rounded-xl p-4 flex flex-col gap-2.5"
                >
                  <div className="flex font-medium text-[12px] leading-normal tracking-[-0.36px] justify-between w-full items-center">
                    <p className="text-[color:var(--sl-fg-base)]">{slot.label}</p>
                    <div className="flex items-center gap-2">
                      {uploaded && (
                        <button
                          type="button"
                          onClick={() => removeUpload(i)}
                          className="text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base-soft)] transition-colors flex items-center gap-0.5"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          <span className="text-[11px]">Remover</span>
                        </button>
                      )}
                      <p className="text-[color:var(--sl-fg-base-soft)] text-right">{slot.dimensions}</p>
                    </div>
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
                      <span className="material-symbols-outlined text-[24px] text-[color:var(--sl-fg-base-muted)]">cloud_upload</span>
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
          </div>
        </div>
      </div>
    </div>
  );
};
