import React from 'react';
import { UserAvatar } from './UserAvatar';

interface AgentSidebarProps {
  onOpenClassicView?: () => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ onOpenClassicView }) => {
  return (
    <aside className="w-[68px] shrink-0 border-r border-gray-200 bg-[#f5f5f5] flex flex-col items-center justify-between py-3.5 pb-5">
      {/* Top: Logo + Agents */}
      <div className="flex flex-col items-center w-full gap-2">
        <div
          className="w-10 h-10 rounded-xl border border-[#d8e4f8] bg-white flex items-center justify-center shrink-0 overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
          aria-label="Nestlé"
        >
          <svg viewBox="0 0 54 28" className="w-8 h-4" aria-hidden="true">
            <rect x="1.25" y="1.25" width="51.5" height="25.5" rx="8" fill="#0057B8" />
            <rect x="1.25" y="1.25" width="51.5" height="25.5" rx="8" stroke="#0057B8" strokeWidth="1.5" />
            <text
              x="27"
              y="18"
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill="#ffffff"
              style={{ fontFamily: '"Trebuchet MS", "Arial Narrow", Arial, sans-serif', letterSpacing: '0.3px' }}
            >
              Nestlé
            </text>
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
        <div className="shrink-0" aria-label="Conta">
          <UserAvatar size="md" />
        </div>
      </div>
    </aside>
  );
};
