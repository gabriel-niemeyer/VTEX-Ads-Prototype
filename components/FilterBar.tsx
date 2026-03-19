
import React, { useState, useRef, useEffect } from 'react';

interface FilterBarProps {
  publishers: string[];
  selectedPublisher: string;
  onPublisherChange: (publisher: string) => void;
  statuses: string[];
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  mediaTypes: string[];
  selectedMediaType: string;
  onMediaTypeChange: (mediaType: string) => void;
  rightAction?: React.ReactNode;
}

export const FilterBar: React.FC<FilterBarProps> = ({ 
  publishers, 
  selectedPublisher, 
  onPublisherChange,
  statuses,
  selectedStatus,
  onStatusChange,
  mediaTypes,
  selectedMediaType,
  onMediaTypeChange,
  rightAction
}) => {
  const [openDropdown, setOpenDropdown] = useState<'publisher' | 'status' | 'media' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: 'publisher' | 'status' | 'media') => {
    setOpenDropdown(prev => prev === name ? null : name);
  };

  return (
    <div className="flex items-center gap-2 py-2 relative" ref={containerRef}>
      {/* Publisher Filter */}
      <div className="relative">
        <div 
          onClick={() => toggleDropdown('publisher')}
          className={`flex items-center px-2 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all border-none shadow-none ${
            openDropdown === 'publisher' ? 'bg-[#ebebeb]' : 'bg-[#f2f2f2] hover:bg-[#ebebeb]'
          }`}
        >
          <span className="text-[color:var(--sl-fg-base-soft)] font-normal">Publisher:</span>
          <span className="ml-1 text-[color:var(--sl-fg-base)] font-medium">{selectedPublisher}</span>
          <span className={`material-symbols-outlined text-[18px] ml-1 transition-transform duration-200 text-[color:var(--sl-fg-base)] ${openDropdown === 'publisher' ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>

        {openDropdown === 'publisher' && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden py-1 animate-in fade-in zoom-in duration-200">
            <div className="px-3 py-2 text-[12px] font-normal text-[color:var(--sl-fg-base-soft)] tracking-[-0.002em]">
              Filtrar por Publisher
            </div>
            <div className="max-h-64 overflow-y-auto">
              {publishers.map((pub) => (
                <div
                  key={pub}
                  onClick={() => {
                    onPublisherChange(pub);
                    setOpenDropdown(null);
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                    selectedPublisher === pub 
                      ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)] font-semibold' 
                      : 'text-[color:var(--sl-fg-base)] hover:bg-gray-50'
                  }`}
                >
                  {pub}
                  {selectedPublisher === pub && (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Status Filter */}
      <div className="relative">
        <div 
          onClick={() => toggleDropdown('status')}
          className={`flex items-center px-2 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all border-none shadow-none ${
            openDropdown === 'status' ? 'bg-[#ebebeb]' : 'bg-[#f2f2f2] hover:bg-[#ebebeb]'
          }`}
        >
          <span className="text-[color:var(--sl-fg-base-soft)] font-normal">Status:</span>
          <span className="ml-1 text-[color:var(--sl-fg-base)] font-medium">{selectedStatus}</span>
          <span className={`material-symbols-outlined text-[18px] ml-1 transition-transform duration-200 text-[color:var(--sl-fg-base)] ${openDropdown === 'status' ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>

        {openDropdown === 'status' && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden py-1 animate-in fade-in zoom-in duration-200">
            <div className="px-3 py-2 text-[12px] font-normal text-[color:var(--sl-fg-base-soft)] tracking-[-0.002em]">
              Filtrar por Status
            </div>
            <div className="max-h-64 overflow-y-auto">
              {statuses.map((status) => (
                <div
                  key={status}
                  onClick={() => {
                    onStatusChange(status);
                    setOpenDropdown(null);
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                    selectedStatus === status 
                      ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)] font-semibold' 
                      : 'text-[color:var(--sl-fg-base)] hover:bg-gray-50'
                  }`}
                >
                  {status}
                  {selectedStatus === status && (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

       {/* Media Type Filter */}
       <div className="relative">
        <div 
          onClick={() => toggleDropdown('media')}
          className={`flex items-center px-2 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all border-none shadow-none ${
            openDropdown === 'media' ? 'bg-[#ebebeb]' : 'bg-[#f2f2f2] hover:bg-[#ebebeb]'
          }`}
        >
          <span className="text-[color:var(--sl-fg-base-soft)] font-normal">Mídia:</span>
          <span className="ml-1 text-[color:var(--sl-fg-base)] font-medium">{selectedMediaType}</span>
          <span className={`material-symbols-outlined text-[18px] ml-1 transition-transform duration-200 text-[color:var(--sl-fg-base)] ${openDropdown === 'media' ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>

        {openDropdown === 'media' && (
          <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-100 rounded-xl shadow-2xl z-[100] overflow-hidden py-1 animate-in fade-in zoom-in duration-200">
            <div className="px-3 py-2 text-[12px] font-normal text-[color:var(--sl-fg-base-soft)] tracking-[-0.002em]">
              Filtrar por Mídia
            </div>
            <div className="max-h-64 overflow-y-auto">
              {mediaTypes.map((type) => (
                <div
                  key={type}
                  onClick={() => {
                    onMediaTypeChange(type);
                    setOpenDropdown(null);
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                    selectedMediaType === type 
                      ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)] font-semibold' 
                      : 'text-[color:var(--sl-fg-base)] hover:bg-gray-50'
                  }`}
                >
                  {type}
                  {selectedMediaType === type && (
                    <span className="material-symbols-outlined text-[18px]">check</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {rightAction && (
        <div className="ml-auto">
          {rightAction}
        </div>
      )}
    </div>
  );
};
