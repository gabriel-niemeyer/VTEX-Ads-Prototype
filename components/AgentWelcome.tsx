import React, { useState, useRef, useEffect } from 'react';

const STARTERS = [
  'Desdobrar JBP de 2026 com as Casas Bahia',
  'Gerar ideias de campanhas para este mês',
  'Mostrar campanhas ativas por publisher',
];

interface AgentWelcomeProps {
  onSend: (text: string) => void;
}

export const AgentWelcome: React.FC<AgentWelcomeProps> = ({ onSend }) => {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    const t = input.trim();
    if (!t) return;
    onSend(t);
    setInput('');
  };

  const handleStarter = (text: string) => {
    onSend(text);
  };

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-[640px] mx-auto px-4">
      {/* Branding */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0">
          <img src="/megaphone.png" alt="Campaign Manager" className="w-20 h-20 object-contain" />
        </div>
        <div className="flex flex-col items-center gap-4">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight">Campaign Manager</h2>
          <p className="text-sm text-gray-500">Criado por VTEX Ads</p>
        </div>
      </div>

      {/* Prompt card */}
      <div className="w-full flex flex-col gap-5 bg-white border border-gray-200 rounded-[28px] p-4 pl-6 pr-3 pt-4 pb-3 shadow-sm">
        <div className="min-h-[24px] flex items-end w-full">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Peça algo ao Campaign Manager"
            className="w-full resize-none bg-transparent text-base text-gray-900 placeholder:text-gray-400 outline-none leading-6 min-h-[24px]"
            rows={1}
          />
        </div>
        <div className="flex items-center justify-between w-full">
          <button type="button" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Anexar">
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <div className="flex items-center gap-1">
            <button type="button" className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Microfone">
              <span className="material-symbols-outlined text-[20px]">mic</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="w-10 h-10 rounded-full bg-[#0366dd] flex items-center justify-center text-white hover:bg-[#0256c7] transition-colors disabled:opacity-50"
              aria-label="Enviar"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
            </button>
          </div>
        </div>
      </div>

      {/* Starters */}
      <div className="flex flex-wrap gap-2 justify-center items-center min-h-9">
        {STARTERS.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => handleStarter(text)}
            className="h-9 px-3 py-2 rounded-xl bg-[#f2f2f2] shadow-sm text-[15px] font-medium text-gray-700 hover:bg-gray-100 transition-colors text-left max-w-[280px] truncate"
          >
            {text}
          </button>
        ))}
        <button type="button" className="w-9 h-9 rounded-xl bg-[#f5f5f5] shadow-sm flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Mais sugestões">
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>
    </div>
  );
};
