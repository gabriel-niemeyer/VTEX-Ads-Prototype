import React, { useMemo } from 'react';
import { Campaign } from '../types';
import { LazyImage } from './LazyImage';

interface CampaignListViewProps {
  campaigns: Campaign[];
  onCampaignClick: (campaign: Campaign) => void;
}

const currencyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

function formatPeriod(start: Date, end: Date): string {
  const s = start instanceof Date ? start : new Date(start);
  const e = end instanceof Date ? end : new Date(end);
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
  return `${s.toLocaleDateString('pt-BR', opts)} a ${e.toLocaleDateString('pt-BR', opts)}`;
}

export const CampaignListView: React.FC<CampaignListViewProps> = ({
  campaigns,
  onCampaignClick,
}) => {
  const rows = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const aT = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
      const bT = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
      return aT - bT;
    });
  }, [campaigns]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto px-5 pb-5 pt-0.5">
      <table className="w-full min-w-[520px] border-collapse text-left text-[14px] leading-[1.45] text-neutral-800">
        <thead>
          <tr className="border-b border-neutral-200/70">
            <th className="pb-3 pr-4 pt-1 text-[12px] font-normal tracking-[-0.01em] text-neutral-500">
              Campanha
            </th>
            <th className="px-3 pb-3 pt-1 text-[12px] font-normal tracking-[-0.01em] text-neutral-500">
              Publisher
            </th>
            <th className="px-3 pb-3 pt-1 text-[12px] font-normal tracking-[-0.01em] text-neutral-500">
              Status
            </th>
            <th className="px-3 pb-3 pt-1 text-right text-[12px] font-normal tracking-[-0.01em] text-neutral-500">
              Orçamento total
            </th>
            <th className="pb-3 pl-4 pt-1 text-[12px] font-normal tracking-[-0.01em] text-neutral-500">
              Período
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const start = c.startDate instanceof Date ? c.startDate : new Date(c.startDate);
            const end = c.endDate instanceof Date ? c.endDate : new Date(c.endDate);
            return (
              <tr
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onCampaignClick(c)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onCampaignClick(c);
                  }
                }}
                className="cursor-pointer border-b border-neutral-100 transition-[background-color] duration-150 hover:bg-neutral-50/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-200/90"
              >
                <td className="py-[14px] pr-4 align-middle">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[6px] bg-neutral-100/90 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]">
                      <LazyImage src={c.imageUrl} alt="" className="h-full w-full" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium tracking-[-0.02em] text-neutral-900">{c.title}</p>
                      <p className="mt-0.5 text-[12px] font-normal leading-tight tracking-[-0.01em] text-neutral-400">
                        ID: {c.id}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 align-middle tracking-[-0.015em] text-neutral-800">{c.publisher}</td>
                <td className="px-3 align-middle text-[13px] font-normal tracking-[-0.01em] text-neutral-500">
                  {c.status}
                </td>
                <td className="px-3 text-right align-middle tabular-nums tracking-[-0.02em] text-neutral-900">
                  {currencyFmt.format(c.budget)}
                </td>
                <td className="pl-4 align-middle whitespace-nowrap text-[13px] font-normal tracking-[-0.01em] text-neutral-500">
                  {formatPeriod(start, end)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
