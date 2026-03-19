
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Campaign, TimelineDay, CampaignStatus } from '../types';
import { LazyImage } from './LazyImage';
import { 
  TIMELINE_START_DATE, 
  TOTAL_DAYS, 
  MONTH_NAMES_PT,
  ROW_HEIGHT 
} from '../constants';

interface TimelineProps {
  campaigns: Campaign[];
  onCampaignUpdate: (id: string, startDate: Date, endDate: Date) => void;
  onCampaignClick: (campaign: Campaign) => void;
  onEmptySpaceClick: (date: Date) => void;
  columnWidth: number;
  onZoomChange: (zoom: number) => void;
  /** Quando alterado, dispara scroll para o dia de hoje (ex.: atalho T na timeline). */
  scrollToTodayTrigger?: number;
  /** Quando alterado, dispara scroll para o card à esquerda (atalho seta esquerda). */
  scrollLeftTrigger?: number;
  /** Quando alterado, dispara scroll para o card à direita (atalho seta direita). */
  scrollRightTrigger?: number;
}

type InteractionType = 'move' | 'resize-start' | 'resize-end';

interface InteractionState {
  id: string;
  type: InteractionType;
  startX: number;
  initialLeft: number;
  initialWidth: number;
  currentDelta: number;
  hasMoved: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({ 
  campaigns, 
  onCampaignUpdate, 
  onCampaignClick, 
  onEmptySpaceClick,
  columnWidth, 
  onZoomChange,
  scrollToTodayTrigger,
  scrollLeftTrigger,
  scrollRightTrigger
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{ idx: number, y: number, x: number } | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollTick, setScrollTick] = useState(0); // força reavaliação da seta a cada scroll
  const [showBackToToday, setShowBackToToday] = useState(false);

  const zoomLevels = [12, 24, 48, 96, 144, 192];
  const GHOST_DURATION_DAYS = 5;

  const todayIdx = useMemo(() => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = Math.floor((startOfToday.getTime() - TIMELINE_START_DATE.getTime()) / (1000 * 60 * 60 * 24));
    return (diff >= 0 && diff < TOTAL_DAYS) ? diff : -1;
  }, []);

  const scrollRafRef = useRef<number | null>(null);
  const handleTimelineScroll = () => {
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = containerRef.current;
      if (el) {
        setScrollLeft(el.scrollLeft);
        setContainerWidth(el.clientWidth);
        setScrollTick((t) => t + 1);
      }
    });
  };

  const isTodayInViewport = useMemo(() => {
    if (todayIdx < 0 || containerWidth <= 0) return true;
    const todayCenter = todayIdx * columnWidth + columnWidth / 2;
    return todayCenter >= scrollLeft && todayCenter <= scrollLeft + containerWidth;
  }, [todayIdx, columnWidth, scrollLeft, containerWidth]);

  const hasScrolledToTodayRef = useRef(false);
  useEffect(() => {
    if (todayIdx < 0 || hasScrolledToTodayRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    hasScrolledToTodayRef.current = true;
    const targetScroll = Math.max(0, todayIdx * columnWidth - el.clientWidth / 2 + columnWidth / 2);
    const t = setTimeout(() => {
      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(t);
  }, [todayIdx, columnWidth]);

  useEffect(() => {
    setShowBackToToday(todayIdx >= 0 && !isTodayInViewport);
  }, [todayIdx, isTodayInViewport]);

  const scrollToToday = () => {
    const el = containerRef.current;
    if (!el || todayIdx < 0) return;
    const targetLeft = Math.max(0, todayIdx * columnWidth - el.clientWidth / 2 + columnWidth / 2);
    // Vertical: garantir que a primeira campanha que contém hoje fique no viewport
    let targetTop: number | null = null;
    const campaignsContainingToday = positionedCampaigns.filter((c) => {
      const startDay = Math.round(c.left / columnWidth);
      const spanDays = c.width / columnWidth;
      return todayIdx >= startDay && todayIdx < startDay + spanDays;
    });
    const firstCampaignToday = campaignsContainingToday.length
      ? campaignsContainingToday.reduce((a, b) => (a.top < b.top ? a : b))
      : null;
    if (firstCampaignToday) {
      const h = el.clientHeight;
      const CARD_H = 72;
      targetTop = Math.max(0, Math.min(el.scrollHeight - h, firstCampaignToday.top - h / 2 + CARD_H / 2));
    }
    el.scrollTo({
      left: targetLeft,
      ...(targetTop != null && { top: targetTop }),
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    if (scrollToTodayTrigger == null || scrollToTodayTrigger === 0) return;
    scrollToToday();
  }, [scrollToTodayTrigger]);

  useEffect(() => {
    if (scrollLeftTrigger == null || scrollLeftTrigger === 0) return;
    scrollToCard('left');
  }, [scrollLeftTrigger]);

  useEffect(() => {
    if (scrollRightTrigger == null || scrollRightTrigger === 0) return;
    scrollToCard('right');
  }, [scrollRightTrigger]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const syncScroll = () => {
      setScrollLeft(el.scrollLeft);
      setContainerWidth(el.clientWidth);
      setScrollTick((t) => t + 1);
    };
    syncScroll();
    const raf = requestAnimationFrame(syncScroll);
    const ro = new ResizeObserver(syncScroll);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const handleZoomOut = () => {
    const currentIndex = zoomLevels.indexOf(zoomLevels.reduce((prev, curr) => 
      Math.abs(curr - columnWidth) < Math.abs(prev - columnWidth) ? curr : prev
    ));
    if (currentIndex > 0) onZoomChange(zoomLevels[currentIndex - 1]);
  };

  const handleZoomIn = () => {
    const currentIndex = zoomLevels.indexOf(zoomLevels.reduce((prev, curr) => 
      Math.abs(curr - columnWidth) < Math.abs(prev - columnWidth) ? curr : prev
    ));
    if (currentIndex < zoomLevels.length - 1) onZoomChange(zoomLevels[currentIndex + 1]);
  };

  const zoomPercentage = Math.round((columnWidth / 48) * 100);

  const timelineDays = useMemo(() => {
    const days: TimelineDay[] = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const date = new Date(TIMELINE_START_DATE);
      date.setDate(date.getDate() + i);
      days.push({
        date,
        dayNumber: date.getDate().toString().padStart(2, '0'),
        isFirstOfMonth: date.getDate() === 1,
        monthName: MONTH_NAMES_PT[date.getMonth()],
        year: date.getFullYear()
      });
    }
    return days;
  }, []);

  // Agrupamento de dias por mês para o Header Sticky
  const timelineMonths = useMemo(() => {
    const months: { name: string; year: number; daysCount: number; key: string }[] = [];
    let currentMonth = -1;
    let daysCount = 0;
    
    timelineDays.forEach((day) => {
      const monthIndex = day.date.getMonth();
      
      if (monthIndex !== currentMonth) {
        // Finaliza o mês anterior
        if (currentMonth !== -1) {
          months[months.length - 1].daysCount = daysCount;
        }
        
        // Inicia novo mês
        months.push({
          name: day.monthName,
          year: day.year,
          daysCount: 0, // Será atualizado
          key: `${day.year}-${monthIndex}`
        });
        
        currentMonth = monthIndex;
        daysCount = 0;
      }
      daysCount++;
    });

    // Finaliza o último mês do loop
    if (months.length > 0) {
      months[months.length - 1].daysCount = daysCount;
    }
    
    return months;
  }, [timelineDays]);

  // Mês vigente = mês que contém o dia de hoje (para sticky à esquerda)
  const currentMonthKey = useMemo(() => {
    if (todayIdx < 0 || todayIdx >= timelineDays.length) return null;
    const d = timelineDays[todayIdx].date;
    return `${d.getFullYear()}-${d.getMonth()}`;
  }, [todayIdx, timelineDays]);

  const previewPosition = useMemo(() => {
    if (!interaction) return null;
    const dayDelta = Math.round(interaction.currentDelta / columnWidth);
    const snappedDelta = dayDelta * columnWidth;
    let left = interaction.initialLeft;
    let width = interaction.initialWidth;
    if (interaction.type === 'move') {
      left += snappedDelta;
    } else if (interaction.type === 'resize-start') {
      const actualSnappedDelta = Math.min(snappedDelta, interaction.initialWidth - columnWidth);
      left += actualSnappedDelta;
      width -= actualSnappedDelta;
    } else if (interaction.type === 'resize-end') {
      const actualSnappedDelta = Math.max(snappedDelta, -interaction.initialWidth + columnWidth);
      width += actualSnappedDelta;
    }
    return { left, width };
  }, [interaction, columnWidth]);

  const positionedCampaigns = useMemo(() => {
    const sortedCampaigns = [...campaigns].sort((a, b) => {
      const aStart = a.startDate instanceof Date ? a.startDate.getTime() : new Date(a.startDate).getTime();
      const bStart = b.startDate instanceof Date ? b.startDate.getTime() : new Date(b.startDate).getTime();
      return aStart - bStart;
    });
    return sortedCampaigns.map((campaign, rowIndex) => {
      const start = campaign.startDate instanceof Date ? campaign.startDate : new Date(campaign.startDate);
      const end = campaign.endDate instanceof Date ? campaign.endDate : new Date(campaign.endDate);
      const diffStart = Math.floor((start.getTime() - TIMELINE_START_DATE.getTime()) / (1000 * 60 * 60 * 24));
      const diffEnd = Math.floor((end.getTime() - TIMELINE_START_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const isInteracting = interaction?.id === campaign.id;
      let left = Math.max(0, diffStart) * columnWidth;
      let width = Math.max(columnWidth, (Math.min(TOTAL_DAYS, diffEnd) - Math.max(0, diffStart)) * columnWidth);
      if (isInteracting && interaction) {
        if (interaction.type === 'move') {
          left += interaction.currentDelta;
        } else if (interaction.type === 'resize-start') {
          const delta = interaction.currentDelta;
          const maxDelta = width - columnWidth;
          const actualDelta = Math.min(delta, maxDelta);
          left += actualDelta;
          width -= actualDelta;
        } else if (interaction.type === 'resize-end') {
          const delta = interaction.currentDelta;
          const minDelta = -width + columnWidth;
          width += Math.max(delta, minDelta);
        }
      }
      return { ...campaign, left, width, top: rowIndex * ROW_HEIGHT + 24, isInteracting };
    });
  }, [campaigns, interaction, columnWidth]);

  const CARD_HEIGHT = 72;

  // Sempre ler scroll/dimensões do DOM (horizontal + vertical); scrollTick força reavaliação
  const scrollState = useMemo(() => {
    const el = containerRef.current;
    const left = el ? el.scrollLeft : 0;
    const top = el ? el.scrollTop : 0;
    const width = el ? el.clientWidth : 0;
    const height = el ? el.clientHeight : 0;
    return { scrollLeft: left, scrollTop: top, containerWidth: width, containerHeight: height };
  }, [scrollTick, positionedCampaigns]);

  const viewRect = useMemo(() => ({
    left: scrollState.scrollLeft,
    top: scrollState.scrollTop,
    right: scrollState.scrollLeft + scrollState.containerWidth,
    bottom: scrollState.scrollTop + scrollState.containerHeight,
  }), [scrollState]);

  // Card está no viewport só se aparecer na tela (sobreposição horizontal E vertical)
  const hasAnyCardInViewport = useMemo(() => {
    if (positionedCampaigns.length === 0) return true;
    if (scrollState.containerWidth <= 0 || scrollState.containerHeight <= 0) return true;
    const { left: vL, right: vR, top: vT, bottom: vB } = viewRect;
    return positionedCampaigns.some(
      (c) =>
        c.left + c.width > vL && c.left < vR &&
        c.top + CARD_HEIGHT > vT && c.top < vB
    );
  }, [positionedCampaigns, scrollState, viewRect]);

  type CardTarget = { left: number; width: number; top: number };
  // Cards mais próximos fora do viewport à esquerda e à direita
  const arrows = useMemo(() => {
    if (positionedCampaigns.length === 0 || scrollState.containerWidth <= 0 || scrollState.containerHeight <= 0) {
      return { left: null as CardTarget | null, right: null };
    }
    const left = positionedCampaigns
      .filter((c) => c.left + c.width <= viewRect.left)
      .sort((a, b) => b.left + b.width - (a.left + a.width))[0] ?? null;
    const right = positionedCampaigns
      .filter((c) => c.left >= viewRect.right)
      .sort((a, b) => a.left - b.left)[0] ?? null;
    return {
      left: left ? { left: left.left, width: left.width, top: left.top } : null,
      right: right ? { left: right.left, width: right.width, top: right.top } : null,
    };
  }, [positionedCampaigns, scrollState, viewRect]);

  const scrollToCard = (dir: 'left' | 'right') => {
    const el = containerRef.current;
    const card = arrows[dir];
    if (!el || !card) return;
    const padding = 24;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const targetLeft = dir === 'right'
      ? Math.max(0, card.left - padding)
      : Math.max(0, card.left + card.width - w + padding);
    const targetTop = Math.max(0, Math.min(el.scrollHeight - h, card.top - h / 2 + CARD_HEIGHT / 2));
    el.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
  };

  const handlePointerDown = (e: React.PointerEvent, campaignId: string, type: InteractionType, currentLeft: number, currentWidth: number) => {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setInteraction({ 
      id: campaignId, 
      type, 
      startX: e.clientX, 
      initialLeft: currentLeft, 
      initialWidth: currentWidth, 
      currentDelta: 0,
      hasMoved: false
    });
    setHoveredDay(null); // Clear hover when interaction starts
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!interaction) return;
    const deltaX = e.clientX - interaction.startX;
    if (Math.abs(deltaX) > 5 && !interaction.hasMoved) {
      setInteraction(prev => prev ? ({ ...prev, currentDelta: deltaX, hasMoved: true }) : null);
    } else if (interaction.hasMoved) {
      setInteraction(prev => prev ? ({ ...prev, currentDelta: deltaX }) : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!interaction) return;
    
    const campaign = campaigns.find(c => c.id === interaction.id);
    
    if (!interaction.hasMoved) {
      if (campaign) {
        onCampaignClick(campaign);
      }
      setInteraction(null);
      return;
    }

    if (campaign) {
      const dayDelta = Math.round(interaction.currentDelta / columnWidth);
      if (dayDelta !== 0) {
        const start = campaign.startDate instanceof Date ? campaign.startDate : new Date(campaign.startDate);
        const end = campaign.endDate instanceof Date ? campaign.endDate : new Date(campaign.endDate);
        let newStartDate = new Date(start);
        let newEndDate = new Date(end);
        if (interaction.type === 'move') {
          newStartDate.setDate(start.getDate() + dayDelta);
          newEndDate.setDate(end.getDate() + dayDelta);
        } else if (interaction.type === 'resize-start') {
          const currentDurationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const actualDayDelta = Math.min(dayDelta, currentDurationDays - 1);
          newStartDate.setDate(start.getDate() + actualDayDelta);
        } else if (interaction.type === 'resize-end') {
          const currentDurationDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const actualDayDelta = Math.max(dayDelta, -(currentDurationDays - 1));
          newEndDate.setDate(end.getDate() + actualDayDelta);
        }
        onCampaignUpdate(campaign.id, newStartDate, newEndDate);
      }
    }
    setInteraction(null);
  };

  // Grid Interaction Handlers
  const handleGridPointerMove = (e: React.PointerEvent) => {
    if (interaction) return;
    // Use nativeEvent.offsetX to get position relative to the large scrollable container
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;
    const dayIdx = Math.floor(x / columnWidth);

    if (dayIdx >= 0 && dayIdx < TOTAL_DAYS) {
      setHoveredDay({ idx: dayIdx, y, x });
    } else {
      setHoveredDay(null);
    }
  };

  const handleGridPointerLeave = () => {
    setHoveredDay(null);
  };

  const handleGridClick = () => {
    if (interaction || !hoveredDay) return;
    const date = new Date(TIMELINE_START_DATE);
    date.setDate(date.getDate() + hoveredDay.idx);
    onEmptySpaceClick(date);
    setHoveredDay(null);
  };

  const StatusIconWithTooltip = ({ status }: { status: CampaignStatus }) => {
    const [isHovered, setIsHovered] = useState(false);
    
    const content = useMemo(() => {
      switch (status) {
        case CampaignStatus.ACTIVE:
          return {
            icon: <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" />,
            label: 'Ativo'
          };
        case CampaignStatus.DRAFT:
          return {
            icon: <div className="w-2.5 h-2.5 bg-gray-400 rounded-full" />,
            label: 'Rascunho'
          };
        case CampaignStatus.COMPLETED:
          return {
            icon: <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />,
            label: 'Concluído'
          };
        default: return { icon: null, label: '' };
      }
    }, [status]);

    return (
      <div 
        className="relative flex items-center justify-center w-6 h-full mr-1 group/status"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {content.icon}
        {isHovered && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs font-medium rounded shadow-sm whitespace-nowrap z-[200]">
            {content.label}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div ref={containerRef} className="flex-1 overflow-x-auto overflow-y-auto scroll-smooth scroll-touch touch-pan-x touch-pan-y" style={{ touchAction: 'pan-x pan-y' }} onScroll={handleTimelineScroll}>
        <div 
          className="relative min-h-full cursor-crosshair pb-24" 
          style={{ width: `${TOTAL_DAYS * columnWidth}px` }}
          onPointerMove={handleGridPointerMove}
          onPointerLeave={handleGridPointerLeave}
          onClick={handleGridClick}
        >
          {/* Header Meses: mês vigente com sticky à esquerda até sair de cena */}
          <div className="sticky top-0 z-30 bg-white flex h-10 pointer-events-none">
            {timelineMonths.map((month) => {
              const width = month.daysCount * columnWidth;
              const isCurrentMonth = currentMonthKey !== null && month.key === currentMonthKey;
              return (
                <div 
                  key={month.key}
                  className="relative h-full flex-shrink-0"
                  style={{ width: `${width}px` }}
                >
                  <div
                    className={`sticky left-0 top-0 h-full flex items-center px-4 bg-white gap-1 ${isCurrentMonth ? 'z-20' : 'z-10'}`}
                  >
                     <span className={`text-[13px] font-normal whitespace-nowrap ${isCurrentMonth ? 'text-gray-900 font-medium' : 'text-gray-700'}`}>
                        {columnWidth < 24 ? month.name.substring(0, 3) : month.name}
                     </span>
                     <span className="text-[13px] font-normal text-gray-400 whitespace-nowrap">
                        {month.year}
                     </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Header Dias */}
          <div className="sticky top-10 z-30 bg-white flex h-8 border-b border-gray-200 pointer-events-none">
            {columnWidth >= 28 && timelineDays.map((day, idx) => {
              const isToday = idx === todayIdx;
              return (
                <div 
                  key={`day-${idx}`} 
                  className={`flex items-center justify-center text-[10px] font-medium relative ${isToday ? 'text-blue-700 bg-blue-50/50' : 'text-gray-500'}`} 
                  style={{ width: `${columnWidth}px` }}
                >
                  {day.dayNumber}
                </div>
              );
            })}
          </div>

          {/* Área da Grade - minHeight para a área não colapsar (filhos são absolute) */}
          <div 
            className="relative" 
            style={{ minHeight: `${Math.max(500, campaigns.length * ROW_HEIGHT + 120)}px` }}
          >
            {/* Grid Background Lines */}
            <div className="absolute inset-0 flex pointer-events-none">
              {timelineDays.map((day, idx) => {
                const dayOfWeek = day.date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                const isToday = idx === todayIdx;

                return (
                  <div 
                    key={`grid-${idx}`} 
                    className="border-r border-gray-100 min-h-[2000px] relative" 
                    style={{ 
                      width: `${columnWidth}px`, 
                      backgroundColor: isWeekend ? '#FAFAFA' : 'transparent' 
                    }}
                  >
                    {isToday && (
                      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-600 z-10" style={{ transform: 'translateX(-50%)' }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ghost Card - abaixo do cursor (+) ao passar sobre espaço vazio */}
            {!interaction && hoveredDay && (
              <div 
                className="absolute z-20 pointer-events-none"
                style={{ 
                  left: `${hoveredDay.x - 16}px`, 
                  top: `${hoveredDay.y + 8}px`, 
                  width: `${GHOST_DURATION_DAYS * columnWidth}px`,
                  height: '72px'
                }}
              >
                <div className="w-full h-full rounded-xl bg-black/5" />
              </div>
            )}

            <div className="relative z-10 px-0">
              {campaigns.length > 0 ? positionedCampaigns.map((c) => {
                const showFullContent = columnWidth > 40;
                const showTitle = c.width > 80;
                return (
                  <React.Fragment key={c.id}>
                    {c.isInteracting && previewPosition && (
                      <div className="absolute z-0 transition-all duration-75 pointer-events-none" style={{ left: `${previewPosition.left}px`, width: `${previewPosition.width}px`, top: `${c.top}px`, height: '72px' }}>
                        <div className="mx-1 h-full rounded-xl border-2 border-blue-600 bg-blue-50/50" />
                      </div>
                    )}
                    <div 
                      className={`absolute group select-none ${c.isInteracting ? 'z-50' : 'transition-all duration-300'} cursor-default`} 
                      style={{ left: `${c.left}px`, width: `${c.width}px`, top: `${c.top}px` }}
                      onClick={(e) => e.stopPropagation()} // Stop propagation so click doesn't create new campaign
                      onPointerEnter={() => setHoveredDay(null)}
                      onPointerMove={(e) => e.stopPropagation()}
                    >
                      <div className="relative w-full h-full">
                        <div className="absolute left-0 top-0 bottom-0 w-3 -ml-1 cursor-ew-resize z-20 hover:bg-blue-600/10 rounded-l-xl transition-colors" onPointerDown={(e) => handlePointerDown(e, c.id, 'resize-start', c.left, c.width)} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
                        <div className="absolute right-0 top-0 bottom-0 w-3 -mr-1 cursor-ew-resize z-20 hover:bg-blue-600/10 rounded-r-xl transition-colors" onPointerDown={(e) => handlePointerDown(e, c.id, 'resize-end', c.left, c.width)} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} />
                        <div 
                          className={`mx-1 bg-white rounded-xl border shadow-sm overflow-hidden flex items-center h-[72px] transition-all ${c.isInteracting ? 'border-blue-600 ring-1 ring-blue-600 shadow-md cursor-grabbing' : 'border-gray-200 hover:border-gray-300 hover:shadow cursor-pointer'} ${!showTitle ? 'justify-center p-1' : 'pl-2 pr-4'}`} 
                          onPointerDown={(e) => handlePointerDown(e, c.id, 'move', c.left, c.width)} 
                          onPointerMove={handlePointerMove} 
                          onPointerUp={handlePointerUp}
                        >
                          {showFullContent && <StatusIconWithTooltip status={c.status} />}
                          <div className="w-10 h-10 rounded overflow-hidden flex-shrink-0 bg-gray-100 border border-gray-200 pointer-events-none">
                            <LazyImage src={c.products?.[0]?.imageUrl || c.imageUrl} className="w-full h-full object-contain" alt={c.title} />
                          </div>
                          {showTitle && <div className="ml-3 flex-1 min-w-0 pointer-events-none">
                            <h3 className="text-sm font-medium text-gray-900 truncate leading-tight">{c.title || 'Nova Campanha'}</h3>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{c.publisher || 'Sem publisher'}</p>
                          </div>}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              }) : <div className="absolute top-20 left-10 text-gray-400 italic text-sm">Nenhuma campanha encontrada com esse nome.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Barra inferior única: evita sobreposição em mobile; "Voltar para hoje" à esquerda, zoom à direita */}
      <div 
        className="absolute bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 py-3 safe-bottom bg-gradient-to-t from-white/95 via-white/90 to-transparent pointer-events-none"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="pointer-events-auto flex items-center min-w-0">
          {todayIdx >= 0 && showBackToToday ? (
            <button
              type="button"
              onClick={scrollToToday}
              className="flex items-center gap-2 min-h-[44px] px-3 py-2.5 sm:px-4 bg-gray-900 text-white text-sm font-medium rounded-xl shadow-lg hover:bg-gray-800 active:scale-[0.98] transition-colors touch-manipulation"
            >
              <span className="material-symbols-outlined text-[20px] shrink-0">today</span>
              <span className="hidden sm:inline truncate">Voltar para hoje</span>
            </button>
          ) : (
            <div className="min-h-[44px]" />
          )}
        </div>
        <div className="pointer-events-auto shrink-0">
          <div className="bg-white px-1 py-1 rounded-xl shadow-lg border border-gray-200 flex items-center gap-0.5">
            <button
              onClick={handleZoomOut}
              disabled={columnWidth <= zoomLevels[0]}
              className="min-w-[40px] min-h-[40px] sm:w-8 sm:h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-30 touch-manipulation"
              title="Diminuir Zoom"
            >
              <span className="material-symbols-outlined text-[20px]">remove</span>
            </button>
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
            <button 
              onClick={() => onZoomChange(48)}
              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 sm:h-8 px-2 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-all touch-manipulation"
              title="Resetar"
            >
              <span className="text-xs font-medium text-gray-700 tabular-nums">{zoomPercentage}%</span>
            </button>
            <div className="w-px h-4 bg-gray-200 mx-0.5" />
            <button
              onClick={handleZoomIn}
              disabled={columnWidth >= zoomLevels[zoomLevels.length - 1]}
              className="min-w-[40px] min-h-[40px] sm:w-8 sm:h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-30 touch-manipulation"
              title="Aumentar Zoom"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Setas: posição vertical central, não colidem com a barra inferior */}
      {campaigns.length > 0 && (
        <>
          {arrows.left && (
            <button
              type="button"
              onClick={() => scrollToCard('left')}
              className="absolute top-1/2 -translate-y-1/2 left-2 sm:left-5 z-[60] min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-gray-200/80 text-gray-500 shadow-md hover:bg-white hover:text-gray-700 active:scale-95 transition-colors touch-manipulation"
              title="Ir para o card à esquerda"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            </button>
          )}
          {arrows.right && (
            <button
              type="button"
              onClick={() => scrollToCard('right')}
              className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-5 z-[60] min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm border border-gray-200/80 text-gray-500 shadow-md hover:bg-white hover:text-gray-700 active:scale-95 transition-colors touch-manipulation"
              title="Ir para o card à direita"
            >
              <span className="material-symbols-outlined text-[22px]">arrow_forward</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
