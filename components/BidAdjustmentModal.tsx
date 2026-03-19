
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Campaign, Bid, MediaType, BidStrength } from '../types';
import { getIndividualBidStrength, calculateOverallStrength } from '../constants';

interface BidAdjustmentModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSave: (campaignId: string, newBids: Bid[]) => void;
}

export const BidAdjustmentModal: React.FC<BidAdjustmentModalProps> = ({ campaign, onClose, onSave }) => {
  const [bids, setBids] = useState<Bid[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Initialize local state with campaign bids, ensuring all media types have an entry
    const initializedBids = campaign.mediaTypes.map(type => {
      const existingBid = campaign.bids?.find(b => b.mediaType === type);
      return existingBid || {
        mediaType: type,
        currentBid: 0,
        suggestedBid: Number((Math.random() * 5 + 1).toFixed(2)) // Mock suggestion if missing
      };
    });
    setBids(initializedBids);

    const timer = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(timer);
  }, [campaign]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose]);

  const handleSave = () => {
    onSave(campaign.id, bids);
    handleClose();
  };

  const updateBid = (mediaType: MediaType, value: number) => {
    setBids(prev => prev.map(b => 
      b.mediaType === mediaType ? { ...b, currentBid: value } : b
    ));
  };

  const applySuggestion = (mediaType: MediaType) => {
    setBids(prev => prev.map(b => 
      b.mediaType === mediaType ? { ...b, currentBid: b.suggestedBid } : b
    ));
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

  const getPricingModel = (type: MediaType) => {
    switch (type) {
      case 'Produto patrocinado':
      case 'Marca patrocinada':
        return 'CPC';
      case 'Video':
        return 'CPV';
      case 'Banner patrocinado':
      case 'Instore display':
      default:
        return 'CPM';
    }
  };

  const getStrengthColor = (strength: BidStrength) => {
    switch (strength) {
      case 'Forte': return 'text-green-700 bg-green-50 border-green-100';
      case 'Intermediário': return 'text-yellow-700 bg-yellow-50 border-yellow-100';
      case 'Fraco': return 'text-red-700 bg-red-50 border-red-100';
    }
  };

  const overallScore = useMemo(() => {
    return calculateOverallStrength(bids);
  }, [bids]);

  const backdropClasses = `absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity duration-300 ${
    isVisible && !isClosing ? 'opacity-100' : 'opacity-0'
  }`;

  const modalClasses = `relative w-full max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden transition-all duration-300 transform z-10 modal-max-height-mobile sm:max-h-[90vh] flex flex-col ${
    isVisible && !isClosing ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
  }`;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 safe-top safe-bottom">
      <div className={backdropClasses} onClick={handleClose} />
      
      <div className={modalClasses}>
        <div className="px-4 py-4 sm:px-8 sm:pt-6 sm:pb-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900 truncate">Ajustar lances</h3>
              <p className="text-sm text-gray-500 mt-0.5 sm:mt-1 font-normal truncate">{campaign.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6 shrink-0">
             <div className="flex flex-col items-end hidden sm:flex gap-1">
                <span className="text-[11px] text-gray-400 font-normal">Score Geral</span>
                <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border mt-1 ${getStrengthColor(overallScore as BidStrength)}`}>
                  {overallScore}
                </span>
             </div>
            <button type="button" onClick={handleClose} className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-xl hover:bg-gray-100 text-gray-400 transition-colors touch-manipulation" aria-label="Fechar">
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Table Header - scroll horizontal em mobile */}
        <div className="px-4 sm:px-8 pb-1 pt-4 sm:pt-6 grid grid-cols-12 gap-4 sm:gap-8 items-center min-w-[480px] sm:min-w-0">
            <div className="col-span-5 text-[12px] font-normal text-gray-400">Mídia</div>
            <div className="col-span-3 text-[12px] font-normal text-gray-400">Lance atual</div>
            <div className="col-span-2 text-[12px] font-normal text-gray-400">Sugerido</div>
            <div className="col-span-2 text-[12px] font-normal text-gray-400 text-right"></div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-white custom-scrollbar scroll-touch">
          <div className="flex flex-col px-4 sm:px-8 min-w-[480px] sm:min-w-0">
            {bids.map((bid) => {
                const isDiff = bid.currentBid !== bid.suggestedBid;
                const strength = getIndividualBidStrength(bid.currentBid, bid.suggestedBid);
                const pricingModel = getPricingModel(bid.mediaType);
                
                return (
                  <div key={bid.mediaType} className="py-4 grid grid-cols-12 gap-4 sm:gap-8 items-center group border-b border-gray-100 last:border-0">
                    
                    {/* COL 1: Media Info (5 cols) */}
                    <div className="col-span-5 flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gray-50 text-gray-500 flex flex-shrink-0 items-center justify-center border border-gray-100 group-hover:border-gray-200 group-hover:bg-white transition-colors">
                        <span className="material-symbols-outlined text-[20px]">{getMediaIcon(bid.mediaType)}</span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium text-gray-900 truncate" title={bid.mediaType}>{bid.mediaType}</span>
                        <div className="mt-1">
                           <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${getStrengthColor(strength)}`}>
                             {strength}
                           </span>
                        </div>
                      </div>
                    </div>

                    {/* COL 2: Current Bid (3 cols) */}
                    <div className="col-span-3">
                        <div className="relative w-full">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none font-normal">R$</span>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={bid.currentBid}
                                onChange={(e) => updateBid(bid.mediaType, parseFloat(e.target.value) || 0)}
                                className="w-full pl-9 pr-12 min-h-[44px] h-11 bg-white border border-gray-200 rounded-lg text-base sm:text-sm font-normal text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all placeholder-gray-400 tabular-nums"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-normal text-gray-400 pointer-events-none tracking-wide">
                              {pricingModel}
                            </span>
                        </div>
                    </div>

                    {/* COL 3: Suggested (2 cols) */}
                    <div className="col-span-2">
                        <span className="text-sm font-medium text-gray-500 tabular-nums tracking-tight">
                            R$ {bid.suggestedBid.toFixed(2)}
                        </span>
                    </div>

                    {/* COL 4: Action (2 cols) */}
                    <div className="col-span-2 flex justify-end">
                        {isDiff ? (
                            <button
                                onClick={() => applySuggestion(bid.mediaType)}
                                className="h-11 px-4 rounded-lg text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:bg-blue-100 transition-all flex items-center justify-center"
                            >
                                Aplicar
                            </button>
                        ) : (
                           <div className="inline-flex items-center gap-1.5 px-2.5 py-1 h-8 rounded-full bg-green-50 border border-green-100">
                              <span className="material-symbols-outlined text-[14px] text-green-600 font-bold">check</span>
                              <span className="text-[11px] font-medium text-green-700">Aceito</span>
                           </div>
                        )}
                    </div>

                  </div>
                );
            })}
            
            {bids.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">
                    Nenhuma mídia selecionada para esta campanha.
                </div>
            )}
          </div>
        </div>

        <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row justify-end gap-3 safe-bottom">
          <button
            type="button"
            onClick={handleClose}
            className="min-h-[48px] px-5 py-3 text-sm font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors touch-manipulation"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[48px] px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm active:scale-[0.98] transition-all touch-manipulation"
          >
            Salvar ajustes
          </button>
        </div>
      </div>
    </div>
  );
};
