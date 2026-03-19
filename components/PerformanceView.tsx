
import React, { useMemo, useState, useRef } from 'react';
import { Campaign, CampaignStatus, SortKey, ColumnConfig, MediaType } from '../types';
import { LazyImage } from './LazyImage';
import { Tooltip } from './Tooltip';
import { StatusCell } from './StatusCell';

interface PerformanceViewProps {
  campaigns: Campaign[];
  columns: ColumnConfig[];
  visibleColumns: Set<SortKey>;
  onCampaignClick: (campaign: Campaign) => void;
  onCampaignStatusChange?: (campaignId: string, newStatus: CampaignStatus) => void;
}

type SortDirection = 'asc' | 'desc';

export const PerformanceView: React.FC<PerformanceViewProps> = ({ campaigns, columns, visibleColumns, onCampaignClick, onCampaignStatusChange }) => {
  const [sortKey, setSortKey] = useState<SortKey>('roas');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isScrolled, setIsScrolled] = useState(false);
  const [hoveredColumn, setHoveredColumn] = useState<SortKey | null>(null);
  
  // Tooltip State
  const [tooltipColumn, setTooltipColumn] = useState<SortKey | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrolled = e.currentTarget.scrollLeft > 0;
    if (scrolled !== isScrolled) {
      setIsScrolled(scrolled);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc'); // Default to desc for performance metrics
    }
  };

  // Tooltip Handlers
  const handleLabelEnter = (colId: SortKey) => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      setTooltipColumn(colId);
    }, 1500);
  };

  const handleLabelLeave = () => {
    if (tooltipTimer.current) {
      clearTimeout(tooltipTimer.current);
      tooltipTimer.current = null;
    }
    setTooltipColumn(null);
  };

  const calculateDerivedMetrics = (campaign: Campaign) => {
    const ctr = campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0;
    const cpc = campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0;
    const roas = campaign.spend > 0 ? campaign.revenue / campaign.spend : 0;
    
    // New Metrics
    const cpm = campaign.impressions > 0 ? (campaign.spend / campaign.impressions) * 1000 : 0;
    const acos = campaign.revenue > 0 ? (campaign.spend / campaign.revenue) * 100 : 0;
    const cvr = campaign.clicks > 0 ? (campaign.conversions / campaign.clicks) * 100 : 0;
    const aov = campaign.conversions > 0 ? campaign.revenue / campaign.conversions : 0;
    const ntbPercent = campaign.conversions > 0 ? (campaign.ntbConversions / campaign.conversions) * 100 : 0;
    const ntbRevenuePercent = campaign.revenue > 0 ? (campaign.ntbRevenue / campaign.revenue) * 100 : 0;
    const ntbUnitsPercent = campaign.units > 0 ? (campaign.ntbUnits / campaign.units) * 100 : 0;

    return { ctr, cpc, roas, cpm, acos, cvr, aov, ntbPercent, ntbRevenuePercent, ntbUnitsPercent };
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

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      // Handle string sorts first
      if (sortKey === 'title') {
        return sortDirection === 'asc' 
          ? a.title.localeCompare(b.title) 
          : b.title.localeCompare(a.title);
      }
      if (sortKey === 'status') {
        return sortDirection === 'asc' 
          ? a.status.localeCompare(b.status) 
          : b.status.localeCompare(a.status);
      }

      const metricsA = calculateDerivedMetrics(a);
      const metricsB = calculateDerivedMetrics(b);
      let valA: number = 0;
      let valB: number = 0;

      switch (sortKey) {
        case 'impressions': valA = a.impressions; valB = b.impressions; break;
        case 'clicks': valA = a.clicks; valB = b.clicks; break;
        case 'conversions': valA = a.conversions; valB = b.conversions; break;
        case 'revenue': valA = a.revenue; valB = b.revenue; break;
        case 'ctr': valA = metricsA.ctr; valB = metricsB.ctr; break;
        case 'cpc': valA = metricsA.cpc; valB = metricsB.cpc; break;
        case 'roas': valA = metricsA.roas; valB = metricsB.roas; break;
        case 'mediaTypes': valA = a.mediaTypes.length; valB = b.mediaTypes.length; break;
        // New Metrics
        case 'cpm': valA = metricsA.cpm; valB = metricsB.cpm; break;
        case 'acos': valA = metricsA.acos; valB = metricsB.acos; break;
        case 'cvr': valA = metricsA.cvr; valB = metricsB.cvr; break;
        case 'aov': valA = metricsA.aov; valB = metricsB.aov; break;
        case 'ntbConversions': valA = a.ntbConversions; valB = b.ntbConversions; break;
        case 'ntbRevenue': valA = a.ntbRevenue; valB = b.ntbRevenue; break;
        case 'ntbPercent': valA = metricsA.ntbPercent; valB = metricsB.ntbPercent; break;
        case 'ntbRevenuePercent': valA = metricsA.ntbRevenuePercent; valB = metricsB.ntbRevenuePercent; break;
        case 'ntbUnits': valA = a.ntbUnits; valB = b.ntbUnits; break;
        case 'ntbUnitsPercent': valA = metricsA.ntbUnitsPercent; valB = metricsB.ntbUnitsPercent; break;
        case 'impressionShare': valA = a.impressionShare; valB = b.impressionShare; break;
        default: return 0;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [campaigns, sortKey, sortDirection]);

  // Formatters
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatNumber = (val: number) => new Intl.NumberFormat('pt-BR').format(val);
  const formatPercent = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format(val / 100);

  // Totals Calculation
  const totals = useMemo(() => {
    const t = campaigns.reduce((acc, curr) => ({
      impressions: acc.impressions + curr.impressions,
      clicks: acc.clicks + curr.clicks,
      spend: acc.spend + curr.spend,
      conversions: acc.conversions + curr.conversions,
      revenue: acc.revenue + curr.revenue,
      ntbConversions: acc.ntbConversions + curr.ntbConversions,
      ntbRevenue: acc.ntbRevenue + curr.ntbRevenue,
      units: acc.units + curr.units,
      ntbUnits: acc.ntbUnits + curr.ntbUnits,
      // Accumulate weighted IS
      weightedIS: acc.weightedIS + (curr.impressionShare * curr.impressions),
    }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0, ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, weightedIS: 0 });

    // Weighted averages for derived metrics
    const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
    const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
    const roas = t.spend > 0 ? t.revenue / t.spend : 0;
    
    // New Totals
    const cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0;
    const acos = t.revenue > 0 ? (t.spend / t.revenue) * 100 : 0;
    const cvr = t.clicks > 0 ? (t.conversions / t.clicks) * 100 : 0;
    const aov = t.conversions > 0 ? t.revenue / t.conversions : 0;
    const ntbPercent = t.conversions > 0 ? (t.ntbConversions / t.conversions) * 100 : 0;
    const ntbRevenuePercent = t.revenue > 0 ? (t.ntbRevenue / t.revenue) * 100 : 0;
    const ntbUnitsPercent = t.units > 0 ? (t.ntbUnits / t.units) * 100 : 0;
    const impressionShare = t.impressions > 0 ? t.weightedIS / t.impressions : 0;

    return { ...t, ctr, cpc, roas, cpm, acos, cvr, aov, ntbPercent, ntbRevenuePercent, ntbUnitsPercent, impressionShare };
  }, [campaigns]);

  const RoasBadge = ({ value }: { value: number }) => {
    let colorClass = 'text-[color:var(--sl-fg-base)] bg-gray-50';
    if (value >= 10) colorClass = 'text-[color:var(--sl-fg-base)] bg-green-50 font-normal';
    else if (value >= 5) colorClass = 'text-[color:var(--sl-fg-base-soft)] bg-blue-50';
    else if (value < 2 && value > 0) colorClass = 'text-[color:var(--sl-fg-base)] bg-red-50';

    return (
      <div className={`inline-flex justify-end px-2 py-1 rounded-md min-w-[3.5rem] ${colorClass}`}>
        {value.toFixed(2)}x
      </div>
    );
  };

  const renderCell = (colId: SortKey, campaign: Campaign, metrics: any) => {
    // Style definition to match "Pedidos" (Conversions)
    // Added tracking-[-0.0125em] for tighter letter spacing
    const standardCellStyle = "text-[color:var(--sl-fg-base-soft)] font-variant-numeric tabular-nums tracking-[-0.0125em]";

    switch (colId) {
      case 'title':
        return (
          <div 
            className="flex items-center gap-3 cursor-pointer group/title"
            onClick={() => onCampaignClick(campaign)}
          >
              <div className="w-8 h-8 rounded border border-gray-100 bg-white p-0.5 flex-shrink-0">
                  <LazyImage src={campaign.products?.[0]?.imageUrl || campaign.imageUrl} className="w-full h-full rounded" alt="" />
              </div>
              <div>
                  <div className="font-medium text-[color:var(--sl-fg-base)] tracking-[-0.0125em] group-hover/title:underline decoration-gray-900 underline-offset-2">{campaign.title}</div>
                  <div className="text-xs text-[color:var(--sl-fg-base-muted)]">{campaign.publisher}</div>
              </div>
          </div>
        );
      case 'status':
        return (
          <StatusCell
            campaignId={campaign.id}
            status={campaign.status}
            onStatusChange={onCampaignStatusChange}
          />
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
      
      // Standardized Metrics
      case 'impressions': return <span className={standardCellStyle}>{formatNumber(campaign.impressions)}</span>;
      case 'clicks': return <span className={standardCellStyle}>{formatNumber(campaign.clicks)}</span>;
      case 'ctr': return <span className={standardCellStyle}>{formatPercent(metrics.ctr)}</span>;
      case 'cpc': return <span className={standardCellStyle}>{formatCurrency(metrics.cpc)}</span>;
      case 'conversions': return <span className={standardCellStyle}>{formatNumber(campaign.conversions)}</span>;
      case 'revenue': return <span className={standardCellStyle}>{formatCurrency(campaign.revenue)}</span>;
      case 'cpm': return <span className={standardCellStyle}>{formatCurrency(metrics.cpm)}</span>;
      case 'acos': return <span className={standardCellStyle}>{formatPercent(metrics.acos)}</span>;
      case 'cvr': return <span className={standardCellStyle}>{formatPercent(metrics.cvr)}</span>;
      case 'aov': return <span className={standardCellStyle}>{formatCurrency(metrics.aov)}</span>;
      case 'ntbConversions': return <span className={standardCellStyle}>{formatNumber(campaign.ntbConversions)}</span>;
      case 'ntbPercent': return <span className={standardCellStyle}>{formatPercent(metrics.ntbPercent)}</span>;
      case 'ntbRevenue': return <span className={standardCellStyle}>{formatCurrency(campaign.ntbRevenue)}</span>;
      case 'ntbRevenuePercent': return <span className={standardCellStyle}>{formatPercent(metrics.ntbRevenuePercent)}</span>;
      case 'ntbUnits': return <span className={standardCellStyle}>{formatNumber(campaign.ntbUnits)}</span>;
      case 'ntbUnitsPercent': return <span className={standardCellStyle}>{formatPercent(metrics.ntbUnitsPercent)}</span>;
      case 'impressionShare': return <span className={standardCellStyle}>{campaign.impressionShare.toFixed(1)}%</span>;

      // Exception: ROAS keeps its badge
      case 'roas': return <RoasBadge value={metrics.roas} />;
      
      default: return null;
    }
  };

  const renderFooterCell = (colId: SortKey) => {
    switch (colId) {
      case 'impressions': return formatNumber(totals.impressions);
      case 'clicks': return formatNumber(totals.clicks);
      case 'ctr': return formatPercent(totals.ctr);
      case 'cpc': return formatCurrency(totals.cpc);
      case 'conversions': return formatNumber(totals.conversions);
      case 'revenue': return formatCurrency(totals.revenue);
      case 'roas': return totals.roas.toFixed(2) + 'x';
      
      // New Footer Totals
      case 'cpm': return formatCurrency(totals.cpm);
      case 'acos': return formatPercent(totals.acos);
      case 'cvr': return formatPercent(totals.cvr);
      case 'aov': return formatCurrency(totals.aov);
      case 'ntbConversions': return formatNumber(totals.ntbConversions);
      case 'ntbPercent': return formatPercent(totals.ntbPercent);
      case 'ntbRevenue': return formatCurrency(totals.ntbRevenue);
      case 'ntbRevenuePercent': return formatPercent(totals.ntbRevenuePercent);
      case 'ntbUnits': return formatNumber(totals.ntbUnits);
      case 'ntbUnitsPercent': return formatPercent(totals.ntbUnitsPercent);
      case 'impressionShare': return totals.impressionShare.toFixed(1) + '%';
      
      default: return null;
    }
  };

  // Only render columns that are visible
  const visibleColumnsList = columns.filter(col => visibleColumns.has(col.id));

  return (
    <div className="flex flex-col flex-1 bg-white overflow-hidden">
      {/* Mobile: cards com métricas essenciais (ROAS, Receita, Status) */}
      <div className="flex-1 overflow-auto scroll-touch md:hidden pb-4">
        {sortedCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-[color:var(--sl-fg-base-muted)] min-h-[300px] px-4">
            <span className="material-symbols-outlined text-[48px] mb-4 text-[color:var(--sl-fg-base-muted)]">analytics</span>
            <p className="text-sm font-medium text-center">Nenhuma campanha para exibir</p>
          </div>
        ) : (
        <ul className="p-3 space-y-2">
          {sortedCampaigns.map((campaign) => {
            const metrics = calculateDerivedMetrics(campaign);
            const roas = metrics.roas;
            return (
              <li key={campaign.id}>
                <button
                  type="button"
                  onClick={() => onCampaignClick(campaign)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation min-h-[72px] text-left"
                >
                  <div className="w-12 h-12 rounded-lg border border-gray-100 bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    <LazyImage src={campaign.products?.[0]?.imageUrl || campaign.imageUrl} className="w-full h-full object-contain" alt="" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate">{campaign.title || 'Sem título'}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        campaign.status === 'Ativo' ? 'bg-green-50 text-[color:var(--sl-fg-base)]' :
                        campaign.status === 'Concluído' ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)]' : 'bg-gray-100 text-[color:var(--sl-fg-base-soft)]'
                      }`}>
                        {campaign.status}
                      </span>
                      <span className="text-xs font-medium text-[color:var(--sl-fg-base)] tabular-nums">
                        ROAS {roas.toFixed(2)}x
                      </span>
                      <span className="text-xs text-[color:var(--sl-fg-base-soft)]">
                        {formatCurrency(campaign.revenue)}
                      </span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-[color:var(--sl-fg-base-muted)] shrink-0">chevron_right</span>
                </button>
              </li>
            );
          })}
        </ul>
        )}
      </div>

      {/* Desktop: tabela */}
      <div 
        className="flex-1 overflow-auto relative scroll-touch hidden md:block"
        onScroll={handleScroll}
      >
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
            <tr>
              {visibleColumnsList.map((col, index) => {
                const isActive = sortKey === col.id;
                const isHovered = hoveredColumn === col.id;
                const isSticky = index === 0;
                
                // Use box-shadow to simulate border and drop shadow.
                const stickyStyles = isSticky 
                    ? `sticky left-0 z-50 transition-all duration-300 ${isScrolled ? 'shadow-[1px_0_0_0_#e2e8f0,8px_0_20px_-4px_rgba(0,0,0,0.1)]' : ''} ${isHovered ? 'bg-gray-50' : 'bg-white'}`
                    : `${isHovered ? 'bg-gray-50' : ''}`;

                // Helper to render icon
                const renderSortIcon = () => (
                   <div className={`flex flex-col w-4 items-center justify-center transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                      <span className="material-symbols-outlined text-[16px]">
                         {isActive ? (sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'}
                      </span>
                   </div>
                );

                return (
                  <th 
                    key={col.id}
                    onMouseEnter={() => setHoveredColumn(col.id)}
                    onMouseLeave={() => setHoveredColumn(null)}
                    style={isSticky ? { paddingLeft: 24, paddingRight: 24 } : undefined}
                    className={`
                      group relative
                      py-4 px-6 text-[12px] font-normal select-none cursor-pointer transition-colors 
                      ${col.defaultWidth} 
                      ${col.align === 'right' ? 'text-right' : 'text-left'} 
                      ${isActive || isHovered ? 'text-[color:var(--sl-fg-base)]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]'}
                      ${stickyStyles}
                      whitespace-nowrap
                    `}
                    onClick={() => handleSort(col.id)}
                  >
                    <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : 'justify-start'}`}>
                      {col.align === 'right' && renderSortIcon()}

                      <span
                        onMouseEnter={() => handleLabelEnter(col.id)}
                        onMouseLeave={handleLabelLeave}
                        className="transition-colors"
                      >
                        {col.label}
                      </span>
                      
                      {col.align !== 'right' && renderSortIcon()}
                    </div>

                    {/* Tooltip */}
                    {col.description && tooltipColumn === col.id && (
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 max-w-[420px] min-w-[120px] p-3 bg-gray-900 text-white text-[12px] leading-relaxed rounded-lg shadow-xl z-[200] pointer-events-none font-normal text-left whitespace-normal animate-in fade-in zoom-in-95 duration-200">
                        {col.description}
                        {/* Triangle */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 pb-16">
            {sortedCampaigns.map((campaign, rowIndex) => {
              const metrics = calculateDerivedMetrics(campaign);
              const rowBaseColor = 'bg-white';

              return (
                <tr 
                    key={campaign.id} 
                    className={`${rowBaseColor} hover:bg-gray-100 group text-sm transition-colors`}
                >
                   {visibleColumnsList.map((col, index) => {
                      const isSticky = index === 0;
                      const isHovered = hoveredColumn === col.id;

                      // Sticky Cell Logic:
                      // 1. If Column 0 is Hovered: bg-gray-50
                      // 2. If Row is Hovered (group-hover): bg-gray-100
                      // 3. Default: rowBaseColor
                      // Since we can't easily conditionally apply classes based on group-hover inside JS logic for the sticky background *override*,
                      // we rely on CSS specificity. Tailwind 'group-hover:' handles the row hover.
                      // For the sticky cell to match the row's stripe when NOT hovered, we set rowBaseColor.
                      // For the sticky cell to match the column hover, we conditionally set bg-gray-50.
                      
                      const stickyClasses = isSticky 
                        ? `sticky left-0 z-30 ${isScrolled ? 'shadow-[1px_0_0_0_#e2e8f0,8px_0_20px_-4px_rgba(0,0,0,0.1)]' : ''} ${isHovered ? 'bg-gray-50' : rowBaseColor} group-hover:bg-gray-100` 
                        : `${isHovered ? 'bg-gray-50' : ''} group-hover:bg-gray-100`;

                      return (
                        <td 
                            key={col.id} 
                            onMouseEnter={() => setHoveredColumn(col.id)}
                            onMouseLeave={() => setHoveredColumn(null)}
                            className={`py-5 px-6 ${col.align === 'right' ? 'text-right' : 'text-left'} ${stickyClasses} whitespace-nowrap`}
                        >
                          {renderCell(col.id, campaign, metrics)}
                        </td>
                      );
                   })}
                </tr>
              );
            })}
          </tbody>
          
          {/* Footer */}
          <tfoot className="sticky bottom-0 bg-gray-50 border-t border-gray-200 font-normal text-sm z-30 shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.05)]">
            <tr>
              {visibleColumnsList.map((col, index) => {
                  const isFirstVisible = index === 0;
                  const content = isFirstVisible ? "Total Geral" : renderFooterCell(col.id);
                  const isSticky = index === 0;
                  const isHovered = hoveredColumn === col.id;
                  
                  const stickyClasses = isSticky 
                    ? `sticky left-0 z-40 transition-all duration-300 ${isScrolled ? 'shadow-[1px_0_0_0_#e2e8f0,8px_0_20px_-4px_rgba(0,0,0,0.1)]' : ''}`
                    : "";

                  return (
                    <td 
                        key={col.id} 
                        onMouseEnter={() => setHoveredColumn(col.id)}
                        onMouseLeave={() => setHoveredColumn(null)}
                        className={`py-6 px-6 ${col.align === 'right' ? 'text-right' : 'text-left'} text-[color:var(--sl-fg-base)] tracking-[-0.0125em] ${isHovered ? 'bg-gray-100' : 'bg-gray-50'} ${isFirstVisible ? 'font-normal' : ''} ${stickyClasses} whitespace-nowrap`}
                    >
                      {content}
                    </td>
                  );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
