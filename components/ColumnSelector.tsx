import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SortKey, ColumnConfig } from '../types';
import { Tooltip } from './Tooltip';

interface ColumnSelectorProps {
  columns: ColumnConfig[];
  visibleColumns: Set<SortKey>;
  onVisibilityChange: (newVisibleColumns: Set<SortKey>) => void;
  onReorder: (newColumns: ColumnConfig[]) => void;
  onReset: () => void;
}

export const ColumnSelector: React.FC<ColumnSelectorProps> = ({ 
  columns, 
  visibleColumns, 
  onVisibilityChange,
  onReorder,
  onReset
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // State to track the item currently being dragged for visual feedback
  const [draggingId, setDraggingId] = useState<SortKey | null>(null);

  // Position dropdown when opening (portal renders above everything)
  useEffect(() => {
    if (!isMenuOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - 280, window.innerWidth - 288));
    setDropdownPosition({ top: rect.bottom + 4, left });
  }, [isMenuOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && triggerRef.current && !triggerRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
          setIsMenuOpen(false);
      }

      // C -> Toggle Columns Menu
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setIsMenuOpen(prev => !prev);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleColumn = (id: SortKey) => {
    const newSet = new Set(visibleColumns);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onVisibilityChange(newSet);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: SortKey) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Using simple text data; complex drag images handled by browser default for now
    e.dataTransfer.setData('text/plain', id);
    
    // Minimalist feedback: The element left behind becomes ghost-like
    const el = e.currentTarget;
    requestAnimationFrame(() => {
        el.classList.add('opacity-30', 'grayscale'); 
    });
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
    setDraggingId(null);
    e.currentTarget.classList.remove('opacity-30', 'grayscale');
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    if (!draggingId) return;

    const sourceIndex = columns.findIndex(c => c.id === draggingId);
    if (sourceIndex === targetIndex || sourceIndex === -1) return;

    const sourceCol = columns[sourceIndex];
    const targetCol = columns[targetIndex];

    if (sourceCol.locked || targetCol.locked) return;

    const newColumns = [...columns];
    newColumns.splice(sourceIndex, 1);
    newColumns.splice(targetIndex, 0, sourceCol);

    onReorder(newColumns);
  };

  const dropdownContent = isMenuOpen && (
    <div
      ref={menuRef}
      className="fixed w-[280px] bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right flex flex-col"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999,
      }}
    >
          {/* Header aligned with padding of list items */}
          <div className="px-4 py-3 border-b border-gray-50 bg-white">
            <h3 className="text-[13px] font-medium text-gray-700">Organizar colunas</h3>
          </div>
          
          <div className="p-1 space-y-0.5 max-h-[320px] overflow-y-auto flex-1 custom-scrollbar">
            {columns.map((col, index) => {
              const isVisible = visibleColumns.has(col.id);
              const isLocked = col.locked;
              const isDragging = draggingId === col.id;

              return (
                <div
                  key={col.id}
                  draggable={!isLocked}
                  onDragStart={(e) => !isLocked && handleDragStart(e, col.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, index)}
                  onClick={(e) => {
                    if (!isLocked) toggleColumn(col.id);
                  }}
                  className={`
                    group relative flex items-center gap-3 px-4 py-2.5 rounded-lg 
                    transition-all duration-200 ease-out select-none
                    ${isLocked 
                        ? 'cursor-not-allowed opacity-60' 
                        : isDragging 
                            ? 'bg-gray-50 scale-[0.98]' 
                            : 'cursor-pointer hover:bg-gray-50'
                    }
                  `}
                >
                  {/* 1. Checkbox on the LEFT - Increased size to w-5 h-5 */}
                  <div 
                    className={`relative flex items-center justify-center w-5 h-5 rounded-[6px] border transition-colors shrink-0 ${
                      isVisible 
                        ? 'bg-blue-600 border-blue-600' 
                        : 'bg-white border-gray-300 group-hover:border-gray-400'
                    }`}
                  >
                    {isVisible && (
                      <span className="material-symbols-outlined text-white text-[14px] font-bold">check</span>
                    )}
                    <input 
                      type="checkbox" 
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                      checked={isVisible}
                      disabled={isLocked}
                      readOnly
                    />
                  </div>

                  {/* 2. Label - Middle - Font size 13px */}
                  <span className={`text-[13px] flex-1 truncate ${isVisible ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {col.label}
                  </span>

                  {/* 3. Lock or Drag Handle - RIGHT side */}
                  {isLocked ? (
                    <span className="text-gray-300 shrink-0" title="Coluna fixa">
                      <span className="material-symbols-outlined text-[16px]">lock</span>
                    </span>
                  ) : (
                    // Added cursor-grab and darken text color
                    <span className={`text-gray-400 shrink-0 transition-opacity duration-200 cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                      <span className="material-symbols-outlined text-[20px]">drag_indicator</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t border-gray-100 bg-white">
            <button 
              onClick={() => {
                onReset();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              Restaurar padrão
            </button>
          </div>
        </div>
  );

  return (
    <>
      <div className="relative flex items-center justify-center">
        <Tooltip text="Configurar Colunas (C)" position="bottom">
          <button
            ref={triggerRef}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`min-w-[44px] min-h-[44px] w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 touch-manipulation ${isMenuOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <span className="material-symbols-outlined">view_column</span>
          </button>
        </Tooltip>
      </div>
      {dropdownContent && typeof document !== 'undefined' && createPortal(dropdownContent, document.body)}
    </>
  );
};