
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Campaign, CampaignStatus, SortKey, ColumnConfig, MediaType, BidStrength } from '../types';
import { LazyImage } from './LazyImage';
import { Tooltip } from './Tooltip';
import { StatusCell } from './StatusCell';

interface ListViewProps {
  campaigns: Campaign[];
  columns: ColumnConfig[];
  visibleColumns: Set<SortKey>;
  onCampaignClick: (campaign: Campaign) => void;
  onDuplicateCampaign?: (campaign: Campaign) => void;
  onDeleteCampaign?: (id: string) => void;
  onBidClick?: (campaign: Campaign) => void;
  onCampaignStatusChange?: (campaignId: string, newStatus: CampaignStatus) => void;
  onBudgetReportClick?: (campaign: Campaign) => void;
}

type SortDirection = 'asc' | 'desc';

interface SortHeaderProps {
  config: ColumnConfig;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  className?: string;
  style?: React.CSSProperties;
}

const SortHeader: React.FC<SortHeaderProps> = ({ config, sortKey, sortDirection, onSort, className, style }) => {
  const isActive = sortKey === config.id;
  const alignClass = config.align === 'right' ? 'text-right justify-end' : 'text-left justify-start';
  const paddingClass = config.align === 'right' ? 'pr-8 pl-4' : config.id === 'title' ? 'pl-8 pr-4' : 'px-4';
  
  const widthClass = config.defaultWidth;

  return (
    <th 
      className={`py-4 ${paddingClass} text-[12px] font-normal cursor-pointer group select-none transition-all duration-300 ${widthClass} ${alignClass} ${isActive ? 'text-[color:var(--sl-fg-base)]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]'} whitespace-nowrap ${className || ''}`}
      style={style}
      onClick={() => onSort(config.id)}
    >
      <div className={`flex items-center gap-1 ${config.align === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
        {config.label}
        <div className={`flex flex-col w-4 items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
            {isActive ? (
              <span className="material-symbols-outlined text-[16px] font-bold">
                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">
                unfold_more
              </span>
            )}
        </div>
      </div>
    </th>
  );
};

export const ListView: React.FC<ListViewProps> = ({ campaigns, columns, visibleColumns, onCampaignClick, onDuplicateCampaign, onDeleteCampaign, onBidClick, onCampaignStatusChange, onBudgetReportClick }) => {
  const [sortKey, setSortKey] = useState<SortKey>('startDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isScrolled, setIsScrolled] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; campaign: Campaign } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    
    if (contextMenu) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent, campaign: Campaign) => {
    e.preventDefault(); // Prevent default browser context menu
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      campaign: campaign
    });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrolled = e.currentTarget.scrollLeft > 0;
    if (scrolled !== isScrolled) {
      setIsScrolled(scrolled);
    }
    if (contextMenu) setContextMenu(null);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      let comparison = 0;

      switch (sortKey) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'publisher':
          comparison = a.publisher.localeCompare(b.publisher);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'startDate':
          comparison = a.startDate.getTime() - b.startDate.getTime();
          break;
        case 'duration':
          const durationA = a.endDate.getTime() - a.startDate.getTime();
          const durationB = b.endDate.getTime() - b.startDate.getTime();
          comparison = durationA - durationB;
          break;
        case 'budget':
          comparison = a.budget - b.budget;
          break;
        case 'mediaTypes':
          comparison = a.mediaTypes.length - b.mediaTypes.length;
          break;
        case 'bidStrength':
          const strengthOrder: Record<BidStrength, number> = { 'Forte': 3, 'Intermediário': 2, 'Fraco': 1 };
          comparison = (strengthOrder[a.bidStrength] || 0) - (strengthOrder[b.bidStrength] || 0);
          break;
        default:
          comparison = 0;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [campaigns, sortKey, sortDirection]);

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    }).format(date);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
  };

  const getDuration = (start: Date, end: Date) => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return `${diffDays} dias`;
  };

  const getMediaIcon = (type: MediaType) => {
    switch (type) {
      case 'Produto patrocinado': return 'shopping_bag';
      case 'Banner patrocinado': return 'view_carousel';
      case 'Marca patrocinada': return 'verified';
      case 'Video': return 'smart_display';
      case 'Instore display': return 'storefront';
      default: return 'circle';
    }
  };

  const BidStrengthBadge = ({ strength, onClick }: { strength: BidStrength, onClick?: () => void }) => {
    let dotColor = 'bg-gray-400';

    switch (strength) {
      case 'Forte':
        dotColor = 'bg-green-500';
        break;
      case 'Intermediário':
        dotColor = 'bg-yellow-500';
        break;
      case 'Fraco':
        dotColor = 'bg-red-500';
        break;
    }

    return (
      <Tooltip text="Ajustar lance" position="top" className="w-fit">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onClick) onClick();
          }}
          className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 bg-white text-[color:var(--sl-fg-base)] whitespace-nowrap hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <span className={`w-1.5 h-1.5 rounded-[1px] mr-2 ${dotColor}`} />
          {strength}
        </button>
      </Tooltip>
    );
  };

  const renderCellContent = (columnId: SortKey, campaign: Campaign) => {
    switch (columnId) {
      case 'title':
        return (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 p-1 flex-shrink-0 flex items-center justify-center">
              <LazyImage 
                src={campaign.products?.[0]?.imageUrl || campaign.imageUrl} 
                className="w-full h-full object-contain mix-blend-multiply rounded"
                alt=""
              />
            </div>
            <div>
              <div className="text-[13px] tracking-[-0.0125em] font-medium text-[color:var(--sl-fg-base)] group-hover:underline">
                {campaign.title}
              </div>
              <div className="text-[11px] text-[color:var(--sl-fg-base-muted)] mt-1 font-mono">
                {campaign.id}
              </div>
            </div>
          </div>
        );
      case 'publisher':
        return (
          <div className="text-sm text-[color:var(--sl-fg-base)] font-normal tracking-[-0.0125em]">{campaign.publisher}</div>
        );
      case 'mediaTypes':
        return (
          <div className="flex items-center -space-x-2">
            {campaign.mediaTypes.map((type, i) => (
              <Tooltip 
                key={i} 
                text={type}
                className="relative hover:z-20 transition-transform"
              >
                <div 
                  className="w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center relative hover:scale-110 transition-transform cursor-default shadow-sm"
                >
                  <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-soft)]">{getMediaIcon(type)}</span>
                </div>
              </Tooltip>
            ))}
            {campaign.mediaTypes.length === 0 && (
               <span className="text-xs text-[color:var(--sl-fg-base-muted)] italic">Nenhuma</span>
            )}
          </div>
        );
      case 'bidStrength':
        return (
            <BidStrengthBadge 
                strength={campaign.bidStrength} 
                onClick={() => onBidClick && onBidClick(campaign)} 
            />
        );
      case 'budget': {
        const available = Math.max(0, campaign.budget - campaign.spend);
        const getBudgetPacing = (c: Campaign): { status: 'on_track' | 'under' | 'over'; label: string; className: string } => {
          const now = Date.now();
          const start = c.startDate.getTime();
          const end = c.endDate.getTime();
          const total = Math.max(1, end - start);
          const elapsed = Math.min(total, Math.max(0, now - start));
          const fraction = elapsed / total;
          const expectedSpend = c.budget * fraction;
          if (expectedSpend <= 0) {
            return { status: 'on_track', label: 'No ritmo', className: 'text-emerald-400' };
          }
          const ratio = c.spend / expectedSpend;
          if (ratio < 0.9) return { status: 'under', label: 'Abaixo', className: 'text-amber-400' };
          if (ratio > 1.1) return { status: 'over', label: 'Acima', className: 'text-rose-400' };
          return { status: 'on_track', label: 'No ritmo', className: 'text-emerald-400' };
        };
        const pacing = getBudgetPacing(campaign);
        const cellContent = (
          <div className="flex flex-col w-32">
            <div className="flex items-center justify-start gap-2 mb-1">
              <span className="text-xs text-[color:var(--sl-fg-base)] font-normal tracking-[-0.0125em] w-full">
                {formatCurrency(campaign.spend)}
              </span>
              {pacing.status === 'on_track' && (
                <span className="w-1.5 h-1.5 shrink-0 bg-emerald-500 rounded-sm" />
              )}
              {pacing.status === 'over' && (
                <span
                  className="shrink-0 border-l-[3px] border-r-[3px] border-b-[5px] border-l-transparent border-r-transparent border-b-rose-500"
                  style={{ width: 0, height: 0 }}
                />
              )}
              {pacing.status === 'under' && (
                <span
                  className="shrink-0 border-l-[3px] border-r-[3px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-500"
                  style={{ width: 0, height: 0 }}
                />
              )}
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
              {(() => {
                const spendPercentage = Math.min(100, (campaign.spend / Math.max(campaign.budget, 1)) * 100);
                return (
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${spendPercentage}%` }}
                  />
                );
              })()}
            </div>
          </div>
        );
        const wrapped = onBudgetReportClick ? (
          <Tooltip position="top" className="justify-start" text="Ver relatório completo">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBudgetReportClick(campaign); }}
              className="flex flex-col w-32 text-left cursor-pointer rounded-md hover:bg-gray-50 active:bg-gray-100 -m-1 p-1 transition-colors"
            >
              {cellContent}
            </button>
          </Tooltip>
        ) : (
          <Tooltip
            position="top"
            className="justify-start"
            content={
              <div className="flex flex-col gap-1.5 text-left py-0.5 px-0.5">
                <div className="flex items-center justify-between gap-6 text-[12px]">
                  <span className="text-[color:var(--sl-fg-base-muted)] font-normal">Total Gasto:</span>
                  <span className="font-normal tabular-nums text-white">{formatCurrency(campaign.spend)}</span>
                </div>
                <div className="flex items-center justify-between gap-6 text-[12px]">
                  <span className="text-[color:var(--sl-fg-base-muted)] font-normal">Disponível:</span>
                  <span className={`font-normal tabular-nums ${available === 0 ? 'text-[color:var(--sl-fg-base-soft)]' : 'text-[color:var(--sl-fg-base-muted)]'}`}>
                    {formatCurrency(available)}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-1 mt-0.5">
                  {pacing.status === 'on_track' && <span className="w-2 h-2 shrink-0 bg-emerald-400" />}
                  {pacing.status === 'over' && (
                    <span className="shrink-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-rose-400" style={{ width: 0, height: 0 }} />
                  )}
                  {pacing.status === 'under' && (
                    <span className="shrink-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent border-t-amber-400" style={{ width: 0, height: 0 }} />
                  )}
                  <span className="text-[12px] font-medium text-white">{pacing.label}</span>
                </div>
              </div>
            }
          >
            {cellContent}
          </Tooltip>
        );
        return wrapped;
      }
      case 'status':
        return (
          <StatusCell
            campaignId={campaign.id}
            status={campaign.status}
            onStatusChange={onCampaignStatusChange}
          />
        );
      case 'startDate':
        return (
          <div className="flex flex-col">
            <span className="text-xs text-[color:var(--sl-fg-base)] font-normal tracking-[-0.0125em]">
              {formatDate(campaign.startDate)}
            </span>
            <span className="text-[12px] text-[color:var(--sl-fg-base-muted)] mt-0.5 tracking-[-0.0125em]">
              até {formatDate(campaign.endDate)}
            </span>
          </div>
        );
      case 'duration':
        return (
          <span className="text-sm text-[color:var(--sl-fg-base-soft)] font-normal tracking-[-0.0125em]">
            {getDuration(campaign.startDate, campaign.endDate)}
          </span>
        );
      default:
        return null;
    }
  };

  if (campaigns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-[color:var(--sl-fg-base-muted)] min-h-[400px]">
        <span className="material-symbols-outlined text-[48px] mb-4 text-[color:var(--sl-fg-base-muted)]">search_off</span>
        <p className="text-sm font-medium">Nenhuma campanha encontrada</p>
      </div>
    );
  }

  // Get visible columns array for index checking
  const visibleColumnsList = columns.filter(col => visibleColumns.has(col.id));

  const openMobileContextMenu = (e: React.MouseEvent, campaign: Campaign) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ x: Math.min(rect.left, window.innerWidth - 220), y: rect.bottom + 6, campaign });
  };

  return (
    <div className="flex flex-col flex-1 bg-white overflow-hidden relative">
      {/* Mobile: lista em cards (só o essencial) */}
      <div className="flex-1 overflow-auto scroll-touch md:hidden pb-4">
        <ul className="p-3 space-y-2">
          {sortedCampaigns.map((campaign) => (
            <li key={campaign.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onCampaignClick(campaign)}
                onKeyDown={(e) => e.key === 'Enter' && onCampaignClick(campaign)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-h-[72px]"
              >
                <div className="w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  <LazyImage src={campaign.products?.[0]?.imageUrl || campaign.imageUrl} className="w-full h-full object-contain" alt="" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate">{campaign.title || 'Sem título'}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium ${
                      campaign.status === 'Ativo' ? 'bg-green-50 text-[color:var(--sl-fg-base)]' :
                      campaign.status === 'Concluído' ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)]' : 'bg-gray-100 text-[color:var(--sl-fg-base-soft)]'
                    }`}>
                      {campaign.status}
                    </span>
                    <span className="text-xs text-[color:var(--sl-fg-base-muted)]">
                      {formatDate(campaign.startDate)} – {formatDate(campaign.endDate)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => openMobileContextMenu(e, campaign)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[color:var(--sl-fg-base-muted)] hover:bg-gray-100 hover:text-[color:var(--sl-fg-base-soft)] touch-manipulation shrink-0 -mr-1"
                  aria-label="Abrir opções"
                >
                  <span className="material-symbols-outlined text-[22px]">more_vert</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: tabela */}
      <div 
        className="flex-1 overflow-auto scroll-touch hidden md:block"
        onScroll={handleScroll}
      >
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <tr>
              {visibleColumnsList.map((col, index) => {
                const isSticky = index === 0;
                
                // Use box-shadow to simulate border and drop shadow. 
                // 1px solid part simulates the border, ensuring it sits on top of scrolling content.
                const stickyStyles = isSticky 
                  ? `sticky left-0 z-50 bg-white transition-all duration-300 ${isScrolled ? 'shadow-[1px_0_0_0_#e2e8f0,8px_0_20px_-4px_rgba(0,0,0,0.1)]' : ''}`
                  : "";

                return (
                  <SortHeader 
                    key={col.id} 
                    config={col} 
                    sortKey={sortKey} 
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    className={stickyStyles}
                  />
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedCampaigns.map((campaign) => (
              <tr 
                key={campaign.id}
                onClick={() => onCampaignClick(campaign)}
                onContextMenu={(e) => handleContextMenu(e, campaign)}
                className="group hover:bg-gray-50 cursor-pointer"
              >
                {visibleColumnsList.map((col, index) => {
                  const isSticky = index === 0;
                  
                  const paddingClass = col.align === 'right' ? 'py-4 pl-4 pr-8' : col.id === 'title' ? 'py-4 pl-8 pr-4' : 'py-4 px-4';
                  const alignClass = col.align === 'right' ? 'text-right' : 'text-left';
                  
                  const stickyClasses = isSticky 
                    ? `sticky left-0 z-30 bg-white group-hover:bg-gray-50 ${isScrolled ? 'shadow-[1px_0_0_0_#e2e8f0,8px_0_20px_-4px_rgba(0,0,0,0.1)]' : ''}`
                    : "";

                  return (
                    <td key={col.id} className={`${paddingClass} ${alignClass} ${stickyClasses} whitespace-nowrap`}>
                      {renderCellContent(col.id, campaign)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          ref={contextMenuRef}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 w-48 animate-in fade-in zoom-in-95 duration-100"
          style={{ 
            top: Math.min(contextMenu.y, window.innerHeight - 150), 
            left: Math.min(contextMenu.x, window.innerWidth - 200) 
          }}
        >
          <button 
            onClick={() => {
              onCampaignClick(contextMenu.campaign);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-[color:var(--sl-fg-base)] hover:bg-gray-50 hover:text-[color:var(--sl-fg-base)] flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-soft)]">edit</span>
            Editar
          </button>
          <button 
            onClick={() => {
              if (onDuplicateCampaign) onDuplicateCampaign(contextMenu.campaign);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-[color:var(--sl-fg-base)] hover:bg-gray-50 hover:text-[color:var(--sl-fg-base)] flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-soft)]">content_copy</span>
            Duplicar
          </button>
          <div className="h-px bg-gray-100 my-1" />
          <button 
            onClick={() => {
              if (onDeleteCampaign) onDeleteCampaign(contextMenu.campaign.id);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2.5 text-sm text-[color:var(--sl-fg-base-soft)] hover:bg-red-50 hover:text-[color:var(--sl-fg-base)] flex items-center gap-3 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
            Apagar
          </button>
        </div>
      )}
    </div>
  );
};
