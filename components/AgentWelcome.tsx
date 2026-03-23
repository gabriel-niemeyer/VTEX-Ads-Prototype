import React from 'react';
import { AgentChatComposer, ChatSendPayload } from './AgentChatComposer';

const STARTERS = [
  'Desdobrar JBP de 2026 com as Casas Bahia',
  'Gerar ideias de campanhas para este mês',
  'Mostrar campanhas ativas por publisher',
];

interface AgentWelcomeProps {
  onSend: (payload: ChatSendPayload) => void;
}

export const AgentWelcome: React.FC<AgentWelcomeProps> = ({ onSend }) => {
  const handleStarter = (text: string) => {
    onSend({ text });
  };

  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-[640px] mx-auto px-4">
      {/* Branding */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0">
          <img src="/megaphone.png" alt="Campaign Manager" className="w-20 h-20 object-contain" />
        </div>
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold text-[color:var(--sl-fg-base)] tracking-tight">Campaign Manager</h2>
          <p className="text-sm text-[color:var(--sl-fg-base-soft)]">Criado por VTEX Ads</p>
        </div>
      </div>

      <AgentChatComposer
        variant="welcome"
        placeholder="Peça algo ao Campaign Manager"
        onSend={onSend}
        autoFocus
      />

      {/* Starters */}
      <div className="flex flex-wrap gap-2 justify-center items-center min-h-9">
        {STARTERS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => handleStarter(text)}
            className="h-9 px-3 py-2 rounded-xl bg-[#f2f2f2] shadow-sm text-[15px] font-medium text-[color:var(--sl-fg-base)] hover:bg-gray-100 transition-colors text-left max-w-[280px] truncate"
          >
            {text}
          </button>
        ))}
        <button type="button" className="w-9 h-9 rounded-xl bg-[#f5f5f5] shadow-sm flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:bg-gray-100 transition-colors" aria-label="Mais sugestões">
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>
    </div>
  );
};
