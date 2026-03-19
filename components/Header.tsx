import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Tooltip } from './Tooltip';

interface HeaderProps {
  viewMode: 'list' | 'timeline' | 'performance';
  onViewModeChange: (mode: 'list' | 'timeline' | 'performance') => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onNewCampaign: () => void;
  resultCount?: number;
  totalCount?: number;
  columnSelector?: React.ReactNode;
  filterButton?: React.ReactNode;
  exportButton?: React.ReactNode;
  openAgentViewButton?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({ 
  viewMode,
  onViewModeChange,
  searchTerm, 
  onSearchChange,
  onNewCampaign,
  resultCount,
  totalCount,
  columnSelector,
  filterButton,
  exportButton,
  openAgentViewButton,
}) => {
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSearching && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isSearching]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        !searchTerm
      ) {
        setIsSearching(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (e.key === 'Escape') {
        if (searchTerm) {
          onSearchChange('');
        } else {
          setIsSearching(false);
          if (inputRef.current) inputRef.current.blur();
        }
      }
      
      if (!isInput && e.key === '/') {
        e.preventDefault();
        setIsSearching(true);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [searchTerm, onSearchChange]);

  const toggleSearch = () => {
    setIsSearching(true);
  };

  const clearSearch = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSearchChange('');
    inputRef.current?.focus();
  }, [onSearchChange]);

  const closeSearch = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSearchChange('');
    setIsSearching(false);
  }, [onSearchChange]);

  const springTransition = "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";
  const hasResults = searchTerm.length > 0 && resultCount !== undefined;

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 md:px-8 h-14 sm:h-[72px] md:h-[80px] shrink-0 bg-white relative z-[120] safe-top border-b border-gray-100 md:border-0">
      
      {/* 1. Title */}
      <div className="flex items-center gap-2 sm:gap-4 relative z-10 min-w-0">
        <h1 className="text-lg sm:text-xl md:text-[1.5rem] leading-tight font-semibold tracking-tight truncate text-gray-900">
          Campanhas
        </h1>
      </div>

      {/* 2. View Switcher */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 flex items-center z-0 pointer-events-none w-full justify-center max-w-[280px] sm:max-w-none">
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
                viewMode === 'list' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600 active:bg-gray-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[20px]">format_list_bulleted</span>
            </button>
          </Tooltip>
          <Tooltip text="Timeline (T)" position="bottom">
            <button
              onClick={() => onViewModeChange('timeline')}
              className={`relative z-10 w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg sm:rounded-[10px] flex items-center justify-center transition-colors duration-200 touch-manipulation ${
                viewMode === 'timeline' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600 active:bg-gray-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[20px]">view_timeline</span>
            </button>
          </Tooltip>
          <Tooltip text="Performance (D)" position="bottom">
            <button
              onClick={() => onViewModeChange('performance')}
              className={`relative z-10 w-10 h-10 min-w-[40px] min-h-[40px] rounded-lg sm:rounded-[10px] flex items-center justify-center transition-colors duration-200 touch-manipulation ${
                viewMode === 'performance' ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600 active:bg-gray-200/70'
              }`}
            >
              <span className="material-symbols-outlined text-[22px] sm:text-[20px]">analytics</span>
            </button>
          </Tooltip>
        </div>
      </div>

      {/* 3. Right Actions */}
      <div className="flex items-center gap-0 ml-auto relative z-10 shrink-0">
        <div 
          ref={containerRef}
          onClick={toggleSearch}
          className={`group relative flex items-center rounded-xl overflow-hidden ${springTransition} touch-manipulation ${
            isSearching 
              ? 'h-11 min-w-[120px] w-[calc(100vw-7rem)] max-w-[320px] sm:w-[320px] bg-white ring-1 ring-gray-200 shadow-lg cursor-text' 
              : 'min-w-[44px] min-h-[44px] w-11 h-11 bg-transparent hover:bg-gray-100 active:scale-95 cursor-pointer'
          }`}
        >
          <div className={`absolute left-0 top-0 h-full flex items-center justify-center shrink-0 z-10 pointer-events-none transition-all duration-300 ${isSearching ? 'w-11 text-blue-600' : 'w-11 text-gray-500 group-hover:text-gray-900'}`}>
             <span className="material-symbols-outlined text-[22px] sm:text-[24px]">search</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar campanhas..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className={`w-full h-full bg-transparent border-none outline-none text-base sm:text-[14px] text-gray-900 placeholder-gray-400 pl-11 pr-12 ${springTransition} ${
              isSearching ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none'
            }`}
          />

          {/* Result count badge */}
          {isSearching && hasResults && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex items-center">
              <span className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                resultCount === 0 ? 'text-red-500 bg-red-50' : 'text-[#707070] bg-gray-100'
              }`}>
                {resultCount === 0 ? 'Sem resultados' : `${resultCount} de ${totalCount}`}
              </span>
            </div>
          )}

          {/* Keyboard hint */}
          {isSearching && !searchTerm && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none transition-opacity duration-300 hidden sm:block opacity-100">
               <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold text-gray-400 bg-gray-50 border border-gray-200 rounded-[4px]">/</span>
            </div>
          )}

          {/* Clear / Close button */}
          {isSearching && searchTerm && (
            <button 
              onClick={clearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 min-w-8 min-h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 z-20 touch-manipulation"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
          {isSearching && !searchTerm && (
            <button 
              onClick={closeSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 min-w-8 min-h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 z-20 touch-manipulation"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}

          {/* Active search dot indicator */}
          {!isSearching && searchTerm.length > 0 && (
              <span className="absolute top-2 right-2 flex h-2.5 w-2.5 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500 border border-white"></span>
              </span>
          )}
        </div>

        {openAgentViewButton}
        {exportButton}
        <div className="hidden md:block">{columnSelector}</div>
        {filterButton}
        
        <Tooltip text="Nova Campanha (N)" position="bottom">
          <button 
            onClick={onNewCampaign}
            className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center bg-gray-100 text-gray-900 rounded-xl hover:bg-gray-200 active:scale-95 transition-all touch-manipulation ml-0.5 sm:ml-2"
          >
            <span className="material-symbols-outlined font-normal text-[22px] sm:text-[24px]">add</span>
          </button>
        </Tooltip>
      </div>
    </header>
  );
};
