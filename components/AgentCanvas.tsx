import React, { useState } from 'react';
import { Campaign } from '../types';
import { Timeline } from './Timeline';
import { CampaignListView } from './CampaignListView';

type CanvasViewMode = 'timeline' | 'list';

interface AgentCanvasProps {
  campaigns: Campaign[];
  onCampaignUpdate: (id: string, startDate: Date, endDate: Date) => void;
  onCampaignClick: (campaign: Campaign) => void;
  onEmptySpaceClick: (date: Date) => void;
}

export const AgentCanvas: React.FC<AgentCanvasProps> = ({
  campaigns,
  onCampaignUpdate,
  onCampaignClick,
  onEmptySpaceClick,
}) => {
  const [zoomLevel, setZoomLevel] = useState(48);
  const [viewMode, setViewMode] = useState<CanvasViewMode>('timeline');

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex shrink-0 items-center justify-between gap-3 bg-white px-5 pt-3.5 pb-2">
        <p className="text-[18px] font-semibold tracking-[-0.3px] text-[color:var(--sl-fg-base)]">
          Campanhas sugeridas
        </p>
        {campaigns.length > 0 ? (
          <div
            className="inline-flex shrink-0 rounded-[10px] bg-neutral-50/80 p-[3px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
            role="group"
            aria-label="Modo de visualização"
          >
            <button
              type="button"
              aria-pressed={viewMode === 'list'}
              aria-label="Lista de campanhas"
              onClick={() => setViewMode('list')}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-[7px] transition-colors duration-150 ${
                viewMode === 'list'
                  ? 'bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">view_list</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'timeline'}
              aria-label="Timeline"
              onClick={() => setViewMode('timeline')}
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-[7px] transition-colors duration-150 ${
                viewMode === 'timeline'
                  ? 'bg-white text-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                  : 'text-neutral-400 hover:text-neutral-600'
              }`}
            >
              <span className="material-symbols-outlined text-[19px]">view_timeline</span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 bg-white">
        {campaigns.length === 0 ? (
          <div className="flex h-full items-center justify-center px-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[color:var(--sl-fg-base-soft)] shadow-sm">
                <span className="material-symbols-outlined text-[22px]">calendar_view_month</span>
              </div>
              <p className="mt-4 text-[18px] font-semibold tracking-[-0.36px] text-[color:var(--sl-fg-base)]">
                Nenhuma campanha destacada ainda
              </p>
              <p className="mt-2 text-[14px] leading-6 text-[#5f5f5f]">
                Peça algo no chat para montar a seleção aqui, ou clique em um espaço vazio na timeline para criar uma nova campanha.
              </p>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <CampaignListView campaigns={campaigns} onCampaignClick={onCampaignClick} />
        ) : (
          <Timeline
            campaigns={campaigns}
            onCampaignUpdate={onCampaignUpdate}
            onCampaignClick={onCampaignClick}
            onEmptySpaceClick={onEmptySpaceClick}
            columnWidth={zoomLevel}
            onZoomChange={setZoomLevel}
          />
        )}
      </div>
    </div>
  );
};
