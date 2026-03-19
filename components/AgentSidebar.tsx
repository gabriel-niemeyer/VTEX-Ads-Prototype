import React from 'react';

interface AgentSidebarProps {
  onOpenClassicView?: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ onOpenClassicView }) => {
  return (
    <aside className="w-[68px] shrink-0 border-r border-gray-200 bg-[#f5f5f5] flex flex-col items-center justify-between py-3.5 pb-5">
      {/* Top: Logo + Agents */}
      <div className="flex flex-col items-center w-full gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center shrink-0 overflow-hidden p-1.5 text-white">
          <svg viewBox="0 0 24 24" className="w-full h-full" fill="currentColor" aria-hidden="true">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
        </div>
        <button type="button" className="w-11 h-11 rounded-full flex items-center justify-center text-[color:var(--sl-fg-base-muted)] hover:bg-gray-200/60 transition-colors shrink-0" aria-label="Insights">
          <img src="/insights-lightbulb.png" alt="Insights" className="w-8 h-8 object-contain" />
        </button>
        <button type="button" className="w-11 h-11 rounded-full bg-[#ecf0f5] flex items-center justify-center text-[color:var(--sl-fg-base)] shrink-0" aria-label="Campaign Manager">
          <img src="/megaphone.png" alt="Campaign Manager" className="w-8 h-8 object-contain" />
        </button>
        <button type="button" className="w-7 h-7 flex items-center justify-center text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] transition-colors" aria-label="Menu">
          <span className="material-symbols-outlined text-[18px]">more_vert</span>
        </button>
      </div>
      {/* Bottom: Folder, Search, Activity, Classic View, User */}
      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2">
          <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:bg-gray-200/60 transition-colors" aria-label="Pastas">
            <span className="material-symbols-outlined text-[20px]">folder</span>
          </button>
          <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:bg-gray-200/60 transition-colors" aria-label="Pesquisar">
            <span className="material-symbols-outlined text-[20px]">search</span>
          </button>
          <button type="button" className="w-8 h-8 rounded-full flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:bg-gray-200/60 transition-colors" aria-label="Atividade">
            <span className="material-symbols-outlined text-[20px]">notifications</span>
          </button>
          {onOpenClassicView && (
            <button
              type="button"
              onClick={onOpenClassicView}
              className="w-8 h-8 rounded-full flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:bg-gray-200/60 transition-colors"
              aria-label="Abrir visão clássica (Lista, Timeline, Performance)"
              title="Visão clássica"
            >
              <span className="material-symbols-outlined text-[20px]">view_module</span>
            </button>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
          <span className="material-symbols-outlined text-[color:var(--sl-fg-base-soft)] text-[20px]">person</span>
        </div>
      </div>
    </aside>
  );
};
