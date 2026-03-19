import React, { useRef, useEffect } from 'react';

export interface GlobalTopbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  rightSlot?: React.ReactNode;
  /** Nome da conta / app (ex. "Apple Brasil", "VTEX Ads") */
  accountName?: string;
}

/**
 * Topbar global do Figma: esquerda (menu + logo + conta), centro (busca), direita (slot + avatar).
 * Usado em todo o conteúdo não agêntico; o conteúdo da aplicação fica na área cinza abaixo.
 */
export const GlobalTopbar: React.FC<GlobalTopbarProps> = ({
  searchTerm,
  onSearchChange,
  rightSlot,
  accountName = 'Apple Brasil',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (!isInput && e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header
      className="shrink-0 flex gap-4 items-center justify-center px-3 py-3 border-b border-[#e0e0e0] bg-white z-[120] safe-top"
      style={{ height: 60, minHeight: 56 }}
      role="banner"
    >
      {/* Left: menu + logo + account */}
      <div className="flex flex-1 min-w-0 gap-2 items-center">
        <button
          type="button"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-600 hover:bg-black/5 hover:text-gray-900 transition-colors"
          aria-label="Abrir menu"
        >
          <span className="material-symbols-outlined text-[20px]">menu</span>
        </button>
        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden" aria-hidden>
          <img src="/LogoVTEX.svg" alt="VTEX" className="w-9 h-9 object-contain" width={36} height={36} />
        </div>
        <span className="text-sm font-medium text-[#1f1f1f] tracking-[-0.14px] truncate">
          {accountName}
        </span>
      </div>

      {/* Center: search */}
      <div className="flex items-center gap-2 bg-[rgba(29,29,29,0.05)] rounded-lg px-3 py-2 w-full max-w-[400px] min-w-0">
        <span className="material-symbols-outlined text-[16px] text-[#3d3d3d] shrink-0" aria-hidden>
          search
        </span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar no Apple Brasil"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm font-medium text-[#1f1f1f] placeholder:text-[#3d3d3d] tracking-[-0.14px]"
        />
      </div>

      <div className="flex flex-1 min-w-0 flex-row items-center justify-end gap-1">
        {rightSlot}
        <div className="shrink-0 w-9 h-9 flex items-center justify-center rounded-lg" aria-hidden>
          <div className="w-6 h-6 rounded-full bg-[#cbe9ff] flex items-center justify-center">
            <span className="text-sm font-semibold text-[#0366dd]">N</span>
          </div>
        </div>
      </div>
    </header>
  );
};
