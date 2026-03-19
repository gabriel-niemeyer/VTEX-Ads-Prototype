import React from 'react';
import { Tooltip } from './Tooltip';
import { CampaignListSearch } from './CampaignListSearch';

export interface ClassicToolbarProps {
  viewMode: 'list' | 'timeline' | 'performance';
  onViewModeChange: (mode: 'list' | 'timeline' | 'performance') => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  resultCount?: number;
  totalCount?: number;
  columnSelector?: React.ReactNode;
  filterButton?: React.ReactNode;
  exportButton?: React.ReactNode;
  onNewCampaign: () => void;
}

/**
 * Barra de ferramentas na área cinza: view switcher + filtros, export, colunas, nova campanha.
 * Fica abaixo do GlobalTopbar, dentro da área cinza do layout Figma.
 */
export const ClassicToolbar: React.FC<ClassicToolbarProps> = ({
  viewMode,
  onViewModeChange,
  searchTerm,
  onSearchChange,
  resultCount,
  totalCount,
  columnSelector,
  filterButton,
  exportButton,
  onNewCampaign,
}) => {
  return (
    <div className="shrink-0 flex items-center justify-end gap-0 py-4 px-4 sm:px-6 md:px-8 h-fit bg-white relative">
      {/* 1. Título — mesmo tamanho e posicionamento do Header antigo */}
      <div className="flex items-center gap-2 sm:gap-4 relative z-10 min-w-0">
        <h1 className="text-lg sm:text-xl md:text-[1.5rem] leading-tight font-semibold tracking-tight truncate text-[color:var(--sl-fg-base)]">
          Campanhas
        </h1>
      </div>

      {/* 2. View switcher — sempre centralizado (absolute), não troca de lugar */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center justify-center w-full max-w-[280px] sm:max-w-none z-0 pointer-events-none">
        <div className="relative flex items-center bg-gray-50 p-1 rounded-xl sm:rounded-[14px] border border-gray-200 shadow-sm pointer-events-auto">
          <div
            aria-hidden
            className="absolute top-1 w-10 h-10 rounded-lg sm:rounded-[10px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-[left] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]"
            style={{
              left: 4 + (viewMode === 'list' ? 0 : viewMode === 'timeline' ? 1 : 2) * 40,
            }}
          />
          <Tooltip text="Lista (L)" position="bottom">
            <button
              onClick={() => onViewModeChange('list')}
              className={`relative z-10 w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg sm:rounded-[10px] flex items-center justify-center transition-colors duration-200 touch-manipulation ${
                viewMode === 'list' ? 'text-[color:var(--sl-fg-base)]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] active:bg-gray-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[20px]">format_list_bulleted</span>
            </button>
          </Tooltip>
          <Tooltip text="Timeline (T)" position="bottom">
            <button
              onClick={() => onViewModeChange('timeline')}
              className={`relative z-10 w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg sm:rounded-[10px] flex items-center justify-center transition-colors duration-200 touch-manipulation ${
                viewMode === 'timeline' ? 'text-[color:var(--sl-fg-base)]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] active:bg-gray-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[20px]">view_timeline</span>
            </button>
          </Tooltip>
          <Tooltip text="Performance (D)" position="bottom">
            <button
              onClick={() => onViewModeChange('performance')}
              className={`relative z-10 w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg sm:rounded-[10px] flex items-center justify-center transition-colors duration-200 touch-manipulation ${
                viewMode === 'performance' ? 'text-[color:var(--sl-fg-base)]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] active:bg-gray-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[20px]">analytics</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 3. Ações à direita */}
      <div className="flex items-center gap-0 ml-auto relative z-10 shrink-0">
        <CampaignListSearch
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          resultCount={resultCount}
          totalCount={totalCount}
        />
        {exportButton}
        <div className="hidden md:block">{columnSelector}</div>
        {filterButton}
        <Tooltip text="Nova Campanha (N)" position="bottom">
          <button
            onClick={onNewCampaign}
            className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 text-[color:var(--sl-fg-base)] rounded-xl hover:bg-gray-200 active:scale-95 transition-all touch-manipulation ml-0.5 sm:ml-2"
          >
            <span className="material-symbols-outlined font-normal text-[22px] sm:text-[24px]">add</span>
          </button>
        </Tooltip>
      </div>
    </div>
  );
};
