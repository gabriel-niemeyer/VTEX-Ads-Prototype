import React, { useRef, useState, useEffect } from 'react';
import { UserAvatar } from './UserAvatar';

export interface ChatSendPayload {
  text: string;
  file?: File;
}

interface AgentChatComposerProps {
  variant: 'welcome' | 'panel';
  placeholder: string;
  onSend: (payload: ChatSendPayload) => void;
  autoFocus?: boolean;
}

function PdfPreviewChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0 max-w-full rounded-lg border border-[#e0e0e0] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e5252a] text-[10px] font-bold tracking-wide text-white"
        aria-hidden
      >
        PDF
      </div>
      <span className="min-w-0 flex-1 truncate text-left text-[14px] font-medium leading-5 text-[color:var(--sl-fg-base)]">
        {name}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--sl-fg-base-soft)] hover:bg-gray-100"
        aria-label="Remover arquivo"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

export const AgentChatComposer: React.FC<AgentChatComposerProps> = ({
  variant,
  placeholder,
  onSend,
  autoFocus,
}) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWelcome = variant === 'welcome';

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = () => {
    const t = input.trim();
    if (!t && !file) return;
    onSend({ text: t, file: file ?? undefined });
    setInput('');
    setFile(null);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === 'application/pdf') {
      setFile(f);
    }
    e.target.value = '';
  };

  const canSend = input.trim().length > 0 || !!file;

  const shellClass = isWelcome
    ? 'w-full flex flex-col gap-5 bg-white border border-gray-200 rounded-[28px] p-4 pl-6 pr-3 pt-4 pb-3 shadow-sm'
    : 'w-full max-w-[620px] mx-auto flex flex-col gap-3 bg-white border border-gray-200 rounded-[24px] px-4 py-3 shadow-sm';

  return (
    <div className={shellClass}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        onChange={onFileChange}
        aria-hidden
      />

      <div className={`flex w-full min-w-0 ${isWelcome ? 'items-end gap-3' : 'flex-col gap-2'}`}>
        {isWelcome && <UserAvatar size="md" className="mb-0.5 shrink-0 self-end" />}
        <div className={`flex min-w-0 flex-1 flex-col gap-2 ${!isWelcome ? 'w-full' : ''}`}>
          {file && <PdfPreviewChip name={file.name} onRemove={() => setFile(null)} />}
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
            placeholder={placeholder}
            rows={isWelcome ? 1 : 2}
            className={`w-full min-h-[24px] resize-none bg-transparent text-base text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)] outline-none leading-6 ${
              !isWelcome ? 'min-h-[44px] text-[15px]' : ''
            }`}
          />
        </div>
      </div>

      <div className="flex w-full items-center justify-between">
        <button
          type="button"
          onClick={openFilePicker}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] transition-colors hover:bg-gray-100"
          aria-label="Anexar PDF"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] transition-colors hover:bg-gray-100"
            aria-label="Microfone"
          >
            <span className="material-symbols-outlined text-[20px]">mic</span>
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0366dd] text-white transition-colors hover:bg-[#0256c7] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
