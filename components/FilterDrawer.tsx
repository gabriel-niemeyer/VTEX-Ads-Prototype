
import React, { useState, useMemo, useEffect } from 'react';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  publishers: string[];
  selectedPublisher: string;
  onPublisherChange: (publisher: string) => void;
  statuses: string[];
  selectedStatus: string;
  onStatusChange: (status: string) => void;
  mediaTypes: string[];
  selectedMediaType: string;
  onMediaTypeChange: (mediaType: string) => void;
  bidStrengths: string[];
  selectedBidStrength: string;
  onBidStrengthChange: (strength: string) => void;
  spendingPaces: string[];
  selectedSpendingPace: string;
  onSpendingPaceChange: (pace: string) => void;
  onReset: () => void;
}

type SectionId = 'status' | 'media' | 'publisher' | 'strength' | 'pace';

// Reusable Section Component extracted to avoid re-definition and typing issues
interface FilterSectionProps {
  title: string;
  selectedValue: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ 
  title, 
  selectedValue, 
  isExpanded, 
  onToggle, 
  children 
}) => {
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button 
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 sm:px-8 py-4 min-h-[48px] hover:bg-gray-50 active:bg-gray-100 transition-colors group select-none outline-none touch-manipulation"
      >
        <h3 className="text-base font-medium text-[color:var(--sl-fg-base)] transition-colors">
          {title}
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm font-normal text-[color:var(--sl-fg-base-soft)] max-w-[120px] truncate">
            {selectedValue}
          </span>
          <span className={`material-symbols-outlined text-[color:var(--sl-fg-base-muted)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${isExpanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </div>
      </button>
      
      <div 
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          {/* px-3 aligns content wrapper. Items inside have p-3, creating 24px visual alignment with header */}
          <div className={`px-5 pb-6 pt-2 transition-opacity duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  publishers,
  selectedPublisher,
  onPublisherChange,
  statuses,
  selectedStatus,
  onStatusChange,
  mediaTypes,
  selectedMediaType,
  onMediaTypeChange,
  bidStrengths,
  selectedBidStrength,
  onBidStrengthChange,
  spendingPaces,
  selectedSpendingPace,
  onSpendingPaceChange,
  onReset
}) => {
  const [publisherSearch, setPublisherSearch] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  
  // State to track expanded sections. Default all to true for better discovery.
  const [expandedSections, setExpandedSections] = useState<Record<SectionId, boolean>>({
    status: true,
    media: true,
    publisher: true,
    strength: true,
    pace: true
  });

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSection = (section: SectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const filteredPublishers = useMemo(() => {
    const allOption = 'Todos';
    const otherPublishers = publishers.filter(p => p !== allOption);
    
    // Sort alphabetically
    const sortedOthers = [...otherPublishers].sort((a, b) => a.localeCompare(b));
    
    if (!publisherSearch) {
      return publishers.includes(allOption) ? [allOption, ...sortedOthers] : sortedOthers;
    }

    const searchLower = publisherSearch.toLowerCase();
    const filtered = sortedOthers.filter(p => p.toLowerCase().includes(searchLower));
    
    // Include 'Todos' if it matches the search term
    if (publishers.includes(allOption) && allOption.toLowerCase().includes(searchLower)) {
      return [allOption, ...filtered];
    }

    return filtered;
  }, [publishers, publisherSearch]);

  const getMediaIcon = (type: string) => {
    switch (type) {
      case 'Produto patrocinado': return 'shopping_bag';
      case 'Banner patrocinado': return 'view_carousel';
      case 'Marca patrocinada': return 'verified';
      case 'Video': return 'smart_display';
      case 'Instore display': return 'storefront';
      case 'Todas': return 'apps';
      default: return 'circle';
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Ativo':
        return {
          icon: 'play_circle',
          selectedClasses: 'bg-green-50 border-green-200 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base-soft)]'
        };
      case 'Concluído':
        return {
          icon: 'check_circle',
          selectedClasses: 'bg-blue-50 border-blue-200 text-[color:var(--sl-fg-base-soft)]',
          iconColor: 'text-[color:var(--sl-fg-base-soft)]'
        };
      case 'Rascunho':
        return {
          icon: 'edit_document',
          selectedClasses: 'bg-gray-100 border-gray-300 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base-soft)]'
        };
      case 'Todos':
      default:
        return {
          icon: 'apps',
          selectedClasses: 'bg-gray-100 border-gray-300 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base)]'
        };
    }
  };

  const getSpendingPaceConfig = (pace: string) => {
    switch (pace) {
      case 'Abaixo':
        return {
          icon: 'trending_down',
          selectedClasses: 'bg-amber-50 border-amber-200 text-amber-700',
          iconColor: 'text-amber-600'
        };
      case 'No Ritmo':
        return {
          icon: 'trending_flat',
          selectedClasses: 'bg-emerald-50 border-emerald-200 text-emerald-700',
          iconColor: 'text-emerald-600'
        };
      case 'Acima':
        return {
          icon: 'trending_up',
          selectedClasses: 'bg-rose-50 border-rose-200 text-rose-700',
          iconColor: 'text-rose-600'
        };
      case 'Todos':
      default:
        return {
          icon: 'tune',
          selectedClasses: 'bg-gray-100 border-gray-300 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base)]'
        };
    }
  };

  const getBidStrengthConfig = (strength: string) => {
    switch (strength) {
      case 'Forte':
        return {
          icon: 'trending_up',
          selectedClasses: 'bg-green-50 border-green-200 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base-soft)]'
        };
      case 'Intermediário':
        return {
          icon: 'remove',
          selectedClasses: 'bg-yellow-50 border-yellow-200 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base-soft)]'
        };
      case 'Fraco':
        return {
          icon: 'trending_down',
          selectedClasses: 'bg-red-50 border-red-200 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base-soft)]'
        };
      case 'Todas':
      default:
        return {
          icon: 'apps',
          selectedClasses: 'bg-gray-100 border-gray-300 text-[color:var(--sl-fg-base)]',
          iconColor: 'text-[color:var(--sl-fg-base)]'
        };
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-gray-900/20 backdrop-blur-sm z-[140] transition-opacity duration-500 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer - full width em mobile, 480px em desktop */}
      <div 
        className={`fixed inset-y-0 right-0 w-full max-w-[100vw] sm:w-[480px] bg-white shadow-2xl z-[150] transform transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col safe-top safe-bottom ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className={`flex items-center justify-between px-4 sm:pl-8 sm:pr-5 py-4 h-14 sm:h-16 border-b shrink-0 bg-white transition-colors duration-200 ${
          isScrolled ? 'border-gray-100' : 'border-transparent'
        }`}>
          <h2 className="text-[24px] leading-tight font-semibold tracking-[-0.875px] text-[color:var(--sl-fg-base)]" style={{ fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif' }}>Filtros</h2>
          <button 
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-gray-100 text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] transition-colors touch-manipulation -mr-1"
            aria-label="Fechar filtros"
          >
            <span className="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>

        {/* Content - Added onScroll handler */}
        <div 
          className="flex-1 overflow-y-auto scroll-touch"
          style={{ scrollbarGutter: 'stable' }}
          onScroll={(e) => setIsScrolled(e.currentTarget.scrollTop > 0)}
        >
          
          {/* Status Section */}
          <FilterSection 
            title="Status" 
            selectedValue={selectedStatus}
            isExpanded={expandedSections.status}
            onToggle={() => toggleSection('status')}
          >
            <div className="flex flex-wrap gap-2 px-3">
              {statuses.map((status) => {
                const isSelected = selectedStatus === status;
                const config = getStatusConfig(status);
                
                return (
                  <button
                    key={status}
                    onClick={() => onStatusChange(status)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 outline-none select-none
                      ${isSelected 
                        ? config.selectedClasses 
                        : 'bg-white border-gray-200 text-[color:var(--sl-fg-base-soft)] hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isSelected ? config.iconColor : 'text-[color:var(--sl-fg-base-muted)]'}`}>
                      {config.icon}
                    </span>
                    <span>{status}</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>

           {/* Bid Strength Section */}
           <FilterSection 
            title="Força do Lance" 
            selectedValue={selectedBidStrength}
            isExpanded={expandedSections.strength}
            onToggle={() => toggleSection('strength')}
          >
            <div className="flex flex-wrap gap-2 px-3">
              {bidStrengths.map((strength) => {
                const isSelected = selectedBidStrength === strength;
                const config = getBidStrengthConfig(strength);
                
                return (
                  <button
                    key={strength}
                    onClick={() => onBidStrengthChange(strength)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 outline-none select-none
                      ${isSelected 
                        ? config.selectedClasses 
                        : 'bg-white border-gray-200 text-[color:var(--sl-fg-base-soft)] hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isSelected ? config.iconColor : 'text-[color:var(--sl-fg-base-muted)]'}`}>
                      {config.icon}
                    </span>
                    <span>{strength}</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* Ritmo de Gasto Section */}
          <FilterSection
            title="Ritmo de Gasto"
            selectedValue={selectedSpendingPace}
            isExpanded={expandedSections.pace}
            onToggle={() => toggleSection('pace')}
          >
            <div className="flex flex-wrap gap-2 px-3">
              {spendingPaces.map((pace) => {
                const isSelected = selectedSpendingPace === pace;
                const config = getSpendingPaceConfig(pace);
                return (
                  <button
                    key={pace}
                    onClick={() => onSpendingPaceChange(pace)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 outline-none select-none
                      ${isSelected
                        ? config.selectedClasses
                        : 'bg-white border-gray-200 text-[color:var(--sl-fg-base-soft)] hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isSelected ? config.iconColor : 'text-[color:var(--sl-fg-base-muted)]'}`}>
                      {config.icon}
                    </span>
                    <span>{pace}</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>

          {/* Publisher Section */}
          <FilterSection 
            title="Publisher" 
            selectedValue={selectedPublisher}
            isExpanded={expandedSections.publisher}
            onToggle={() => toggleSection('publisher')}
          >
            {/* Publisher Search - Added mx-3 to align edges with title text and radio circle */}
            <div className="relative mb-3 mx-3">
              {/* Changed left-3 to left-2.5 to optically align icon center with radio button center */}
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--sl-fg-base-muted)] text-[20px]">search</span>
              <input 
                type="text" 
                placeholder="Buscar publisher..." 
                value={publisherSearch}
                onChange={(e) => setPublisherSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-[color:var(--sl-fg-base-muted)]"
              />
            </div>

            <div className="space-y-0 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {filteredPublishers.length > 0 ? (
                filteredPublishers.map((pub) => (
                  <label 
                    key={pub}
                    className="flex items-center p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <input 
                      type="radio" 
                      name="publisher"
                      className="sr-only"
                      checked={selectedPublisher === pub}
                      onChange={() => onPublisherChange(pub)}
                    />
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 flex-shrink-0 ${
                      selectedPublisher === pub ? 'border-blue-600' : 'border-gray-300'
                    }`}>
                      {selectedPublisher === pub && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                    </div>
                    <span className="text-[14px] text-[color:var(--sl-fg-base)]">
                      {pub}
                    </span>
                  </label>
                ))
              ) : (
                <div className="text-center py-4 text-[color:var(--sl-fg-base-muted)] text-sm">
                  Nenhum publisher encontrado
                </div>
              )}
            </div>
          </FilterSection>

          {/* Media Types Section - Selectable Chips */}
          <FilterSection 
            title="Tipo de Mídia" 
            selectedValue={selectedMediaType}
            isExpanded={expandedSections.media}
            onToggle={() => toggleSection('media')}
          >
            {/* px-3 combined with wrapper px-3 gives ~24px padding */}
            <div className="flex flex-wrap gap-2 px-3">
              {mediaTypes.map((type) => {
                const isSelected = selectedMediaType === type;
                return (
                  <button
                    key={type}
                    onClick={() => onMediaTypeChange(type)}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all duration-200 outline-none select-none
                      ${isSelected 
                        ? 'bg-blue-50 border-blue-200 text-[color:var(--sl-fg-base-soft)]' 
                        : 'bg-white border-gray-200 text-[color:var(--sl-fg-base-soft)] hover:border-gray-300 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-[color:var(--sl-fg-base-soft)]' : 'text-[color:var(--sl-fg-base-muted)]'}`}>
                      {getMediaIcon(type)}
                    </span>
                    <span>{type}</span>
                  </button>
                );
              })}
            </div>
          </FilterSection>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-white flex items-center justify-between gap-4 shrink-0">
          <button 
            onClick={() => {
              onReset();
              setPublisherSearch('');
            }}
            className="px-4 py-2 text-sm font-medium text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Limpar filtros
          </button>
          
          <button 
            onClick={onClose}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl active:scale-95 transition-all"
          >
            Ver resultados
          </button>
        </div>
      </div>
    </>
  );
};
