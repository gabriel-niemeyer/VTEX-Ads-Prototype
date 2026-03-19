import React, { useRef, useEffect } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AgentChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (text: string) => void;
}

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({ messages, isThinking, onSend }) => {
  const [input, setInput] = React.useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSubmit = () => {
    const t = input.trim();
    if (!t) return;
    onSend(t);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full min-w-0 w-full bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-6 px-6 py-7">
        <div className="flex flex-col gap-10 w-full max-w-[620px] mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[520px] px-4 py-2 rounded-2xl text-sm text-gray-900 leading-[1.56] ${
                  msg.role === 'user' ? 'bg-[#ecf0f5]' : 'bg-gray-100'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isThinking && (
            <div className="flex items-center gap-3">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-base text-gray-500">Pensando...</span>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 px-6 pb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-full pl-3 pr-2 py-2 shadow-sm max-w-[620px] mx-auto">
          <button type="button" className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors" aria-label="Anexar">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Fale com o agente"
            className="flex-1 min-w-0 bg-transparent text-[15px] text-gray-900 placeholder:text-gray-500 outline-none px-2 py-2.5"
          />
          <button
            type="button"
            onClick={handleSubmit}
            className="w-9 h-9 rounded-full bg-[#0366dd] flex items-center justify-center text-white hover:bg-[#0256c7] transition-colors shrink-0"
            aria-label="Enviar"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
};
