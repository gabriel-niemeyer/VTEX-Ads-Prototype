import React from 'react';
import { Campaign } from '../types';
import { LazyImage } from './LazyImage';

interface SuggestedCampaignsListProps {
  campaigns: Campaign[];
  onCampaignClick: (campaign: Campaign) => void;
}

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

export const SuggestedCampaignsList: React.FC<SuggestedCampaignsListProps> = ({
  campaigns,
  onCampaignClick,
}) => {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <div className="shrink-0 grid gap-3 px-5 py-3 border-b border-[#e5e7eb] bg-[var(--tw-ring-offset-color)] text-[12px] font-medium text-[#6b7280] tracking-[-0.12px] min-w-[640px] grid-cols-[1fr_140px_100px_140px_160px]">
        <span>Campanha</span>
        <span>Publisher</span>
        <span>Status</span>
        <span className="text-right">Orçamento total</span>
        <span className="text-right">Período</span>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        <ul className="divide-y divide-[#f3f4f6] min-w-[640px]">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <button
                type="button"
                onClick={() => onCampaignClick(campaign)}
                className="w-full grid gap-3 px-5 py-3 text-left items-center hover:bg-[#f9fafb] active:bg-[#f3f4f6] transition-colors grid-cols-[1fr_140px_100px_140px_160px]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] shrink-0 flex items-center justify-center overflow-hidden">
                    <LazyImage
                      src={campaign.products?.[0]?.imageUrl || campaign.imageUrl}
                      className="w-full h-full object-contain"
                      alt=""
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.13px] truncate">
                      {campaign.title}
                    </p>
                    <p className="text-[11px] text-[#6b7280] font-mono mt-0.5">{campaign.id}</p>
                  </div>
                </div>
                <span className="text-[13px] text-[#374151] truncate">{campaign.publisher}</span>
                <span className="text-[12px] text-[#6b7280]">{campaign.status}</span>
                <span className="text-[13px] text-[#374151] tabular-nums text-right">
                  {formatCurrency(campaign.budget)}
                </span>
                <div className="flex flex-col items-end text-right text-[12px] text-[#6b7280]">
                  <span>{formatDate(campaign.startDate)}</span>
                  <span>{formatDate(campaign.endDate)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
