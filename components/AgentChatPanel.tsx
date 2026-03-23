import React, { useRef, useEffect } from 'react';
import { AgentChatComposer, ChatSendPayload } from './AgentChatComposer';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachmentName?: string;
}

interface AgentChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  onSend: (payload: ChatSendPayload) => void;
}

function MessagePdfChip({ name }: { name: string }) {
  return (
    <div className="mb-2 flex w-full max-w-[min(100%,320px)] items-center gap-2 rounded-lg border border-[#d8dee6] bg-white/80 px-2 py-1.5">
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#e5252a] text-[9px] font-bold text-white"
        aria-hidden
      >
        PDF
      </div>
      <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-[color:var(--sl-fg-base)]">{name}</span>
    </div>
  );
}

export const AgentChatPanel: React.FC<AgentChatPanelProps> = ({ messages, isThinking, onSend }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col h-full min-w-0 w-full bg-white">
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-6 px-6 py-7">
        <div className="flex flex-col gap-10 w-full max-w-[620px] mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[520px] px-4 py-2 rounded-2xl text-sm text-[color:var(--sl-fg-base)] leading-[1.56] ${
                  msg.role === 'user' ? 'bg-[#ecf0f5]' : 'bg-gray-100'
                }`}
              >
                {msg.role === 'user' && msg.attachmentName && <MessagePdfChip name={msg.attachmentName} />}
                {msg.content ? <p className="whitespace-pre-wrap">{msg.content}</p> : null}
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
              <span className="text-base text-[color:var(--sl-fg-base-soft)]">Pensando...</span>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 px-6 pb-4">
        <AgentChatComposer variant="panel" placeholder="Fale com o agente" onSend={onSend} autoFocus />
      </div>
    </div>
  );
};
