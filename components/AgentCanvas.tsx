import React, { useState } from 'react';
import { Campaign } from '../types';
import { Timeline } from './Timeline';
import { SuggestedCampaignsList } from './SuggestedCampaignsList';
import { Tooltip } from './Tooltip';

export type SuggestedViewMode = 'list' | 'timeline';

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
  const [viewMode, setViewMode] = useState<SuggestedViewMode>('timeline');

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="shrink-0 bg-white px-5 pt-3.5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[18px] font-semibold tracking-[-0.3px] text-[#1f1f1f]">
              Campanhas sugeridas
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="relative flex items-center bg-[#f3f4f6] p-0.5 rounded-[10px] border border-[#e5e7eb]">
              <div
                aria-hidden
                className="absolute top-0.5 w-9 h-9 rounded-lg bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-[left] duration-200 ease-out"
                style={{ left: viewMode === 'list' ? 2 : 2 + 36 }}
              />
              <Tooltip text="Lista" position="bottom">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`relative z-10 w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                    viewMode === 'list' ? 'text-[#1f1f1f]' : 'text-[#6b7280] hover:text-[#374151]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                </button>
              </Tooltip>
              <Tooltip text="Timeline" position="bottom">
                <button
                  type="button"
                  onClick={() => setViewMode('timeline')}
                  className={`relative z-10 w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                    viewMode === 'timeline' ? 'text-[#1f1f1f]' : 'text-[#6b7280] hover:text-[#374151]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">view_timeline</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 bg-white">
        {campaigns.length === 0 ? (
          <div className="flex h-full items-center justify-center px-8">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#707070] shadow-sm">
                <span className="material-symbols-outlined text-[22px]">calendar_view_month</span>
              </div>
              <p className="mt-4 text-[18px] font-semibold tracking-[-0.36px] text-[#1f1f1f]">
                Nenhuma campanha destacada ainda
              </p>
              <p className="mt-2 text-[14px] leading-6 text-[#5f5f5f]">
                Peça algo no chat para montar a seleção aqui, ou clique em um espaço vazio para criar uma nova campanha.
              </p>
            </div>
          </div>
        ) : viewMode === 'list' ? (
          <SuggestedCampaignsList campaigns={campaigns} onCampaignClick={onCampaignClick} />
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
