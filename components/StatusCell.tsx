import React, { useState, useRef, useEffect } from 'react';
import { CampaignStatus } from '../types';

interface StatusCellProps {
  campaignId: string;
  status: CampaignStatus;
  onStatusChange?: (campaignId: string, newStatus: CampaignStatus) => void;
}

const STATUS_OPTIONS: CampaignStatus[] = [
  CampaignStatus.DRAFT,
  CampaignStatus.ACTIVE,
  CampaignStatus.COMPLETED
];

export const StatusCell: React.FC<StatusCellProps> = ({ campaignId, status, onStatusChange }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const isClickable = Boolean(onStatusChange);

  const badge = (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-700 whitespace-nowrap ${
        isClickable ? 'cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-colors' : ''
      }`}
      onClick={(e) => {
        if (isClickable) {
          e.stopPropagation();
          setMenuOpen((prev) => !prev);
        }
      }}
      role={isClickable ? 'button' : undefined}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full mr-2 ${
          status === CampaignStatus.ACTIVE ? 'bg-green-500' :
          status === CampaignStatus.COMPLETED ? 'bg-blue-500' : 'bg-gray-400'
        }`}
      />
      {status}
      {isClickable && (
        <span className="material-symbols-outlined text-[14px] ml-1 opacity-60">arrow_drop_down</span>
      )}
    </span>
  );

  if (!onStatusChange) {
    return badge;
  }

  return (
    <div className="relative inline-block" ref={wrapperRef}>
      {badge}
      {menuOpen && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-[140px] bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[12px] font-medium text-gray-400 tracking-[-0.1px]">
            Alterar status
          </div>
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(campaignId, option);
                setMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 transition-colors ${
                option === status
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  option === CampaignStatus.ACTIVE ? 'bg-green-500' :
                  option === CampaignStatus.COMPLETED ? 'bg-blue-500' : 'bg-gray-400'
                }`}
              />
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
