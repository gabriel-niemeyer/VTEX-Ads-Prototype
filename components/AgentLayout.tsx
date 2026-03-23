import React, { useState, useCallback, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { Campaign, CampaignStatus, Product } from '../types';
import { AgentSidebar } from './AgentSidebar';
import { AgentWelcome } from './AgentWelcome';
import { AgentChatPanel, ChatMessage } from './AgentChatPanel';
import { ChatSendPayload } from './AgentChatComposer';
import { AgentCanvas } from './AgentCanvas';
import { CampaignDocument } from './CampaignDocument';

interface AgentLayoutProps {
  campaigns: Campaign[];
  suggestedCampaignIds: string[];
  onSuggestedIdsChange: (ids: string[]) => void;
  onCampaignUpdate: (id: string, startDate: Date, endDate: Date) => void;
  onCampaignClick: (campaign: Campaign) => void;
  onEmptySpaceClick: (date: Date) => void;
  editingCampaign: Campaign | null;
  onEditingCampaignClose: () => void;
  onSaveCampaign?: (updated: Campaign) => void;
  allProducts?: Product[];
  conversationTitle: string;
  onOpenClassicView?: () => void;
}

function mockAgentResponse(
  userText: string,
  allCampaigns: Campaign[],
  hasPdfAttachment: boolean
): { reply: string; ids: string[] } {
  const lower = userText.toLowerCase();
  if (hasPdfAttachment) {
    const subset = allCampaigns.filter((_, i) => i < 7);
    const docHint = userText.trim()
      ? ' Li o que você pediu no texto e usei o PDF como referência.'
      : ' Usei o PDF anexado como referência para montar as campanhas.';
    return {
      reply: `Recebi seu PDF.${docHint} Criei ${subset.length} campanhas na timeline à direita — revise datas e detalhes ou peça ajustes.`,
      ids: subset.map((c) => c.id),
    };
  }
  if (lower.includes('campanha') || lower.includes('campanhas') || lower.includes('7') || lower.includes('casas bahia') || lower.includes('jbp') || lower.includes('desdobrar')) {
    const subset = allCampaigns.filter((_, i) => i < 7);
    return {
      reply: `Criei ${subset.length} campanhas com base na sua solicitação. Você pode visualizá-las na timeline à direita, editar datas e detalhes clicando em cada uma, ou adicionar novas clicando em um espaço vazio.`,
      ids: subset.map((c) => c.id),
    };
  }
  if (lower.includes('ativas') || lower.includes('ativo')) {
    const active = allCampaigns.filter((c) => c.status === 'Ativo');
    return {
      reply: `Encontrei ${active.length} campanhas ativas. Elas estão na timeline à direita.`,
      ids: active.map((c) => c.id),
    };
  }
  const fallback = allCampaigns.slice(0, 3);
  return {
    reply: 'Entendi sua solicitação. Coloquei algumas campanhas na timeline para você revisar. Se quiser, peça algo mais específico, como "desdobrar JBP de 2026 com as Casas Bahia" ou "mostrar campanhas ativas".',
    ids: fallback.map((c) => c.id),
  };
}

const MIN_CHAT = 320;
const MIN_CANVAS = 360;
const DEFAULT_CHAT = 480;
const REVEAL_DURATION = 1000; // mesma duração para chat e canvas = movimento único, “manteiga”
const REVEAL_EASING = 'cubic-bezier(0.25, 1, 0.5, 1)'; // ease-out-quart, bem suave

export const AgentLayout: React.FC<AgentLayoutProps> = ({
  campaigns,
  suggestedCampaignIds,
  onSuggestedIdsChange,
  onCampaignUpdate,
  onCampaignClick,
  onEmptySpaceClick,
  editingCampaign,
  onEditingCampaignClose,
  onSaveCampaign,
  allProducts,
  conversationTitle,
  onOpenClassicView,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT);
  const [isDragging, setIsDragging] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [revealStarted, setRevealStarted] = useState(false); // chat e canvas começam a animar no mesmo frame
  const [docClosing, setDocClosing] = useState(false);
  const [visibleDoc, setVisibleDoc] = useState<Campaign | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRevealedRef = useRef(false);

  useEffect(() => {
    if (editingCampaign) {
      setVisibleDoc(editingCampaign);
      setDocClosing(false);
    } else if (visibleDoc) {
      setDocClosing(true);
      const timer = setTimeout(() => {
        setVisibleDoc(null);
        setDocClosing(false);
      }, 620);
      return () => clearTimeout(timer);
    }
  }, [editingCampaign]);

  const suggestedCampaigns = useMemo(
    () =>
      campaigns
        .filter((c) => suggestedCampaignIds.includes(c.id))
        .map((c) => ({ ...c, status: CampaignStatus.DRAFT })),
    [campaigns, suggestedCampaignIds]
  );

  const handleSend = useCallback(
    (payload: ChatSendPayload) => {
      const { text, file } = payload;
      const trimmed = text.trim();
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        attachmentName: file?.name,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsThinking(true);

      setTimeout(() => {
        const { reply, ids } = mockAgentResponse(trimmed, campaigns, !!file);
        onSuggestedIdsChange(ids);
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setIsThinking(false);
      }, 1200);
    },
    [campaigns, onSuggestedIdsChange]
  );

  const hasConversation = messages.length > 0;
  const showCanvas = messages.some((m) => m.role === 'assistant');

  // Phase 1: synchronously set full width before browser paints (no flicker)
  useLayoutEffect(() => {
    if (showCanvas && !hasRevealedRef.current && containerRef.current) {
      hasRevealedRef.current = true;
      const fullW = containerRef.current.getBoundingClientRect().width;
      setChatWidth(fullW);
      setIsRevealing(true);
    }
  }, [showCanvas]);

  // Phase 2: um frame depois, disparar chat → 480 e canvas → 0 no mesmo setState para as duas animações começarem juntas (fluido)
  useEffect(() => {
    if (!isRevealing) return;
    const raf = requestAnimationFrame(() => {
      setChatWidth(DEFAULT_CHAT);
      setRevealStarted(true);
    });
    const timer = setTimeout(() => {
      setIsRevealing(false);
      setRevealStarted(false);
    }, REVEAL_DURATION + 80);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRevealing]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsRevealing(false);
    setRevealStarted(false);
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const maxChat = rect.width - MIN_CANVAS;
      const newWidth = Math.max(MIN_CHAT, Math.min(e.clientX - rect.left, maxChat));
      setChatWidth(newWidth);
    };

    const handleUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

  const getTransition = () => {
    if (isDragging) return 'none';
    if (isRevealing) return `width ${REVEAL_DURATION}ms ${REVEAL_EASING}`;
    return 'width 0.3s ease';
  };

  const chatStyle: React.CSSProperties = showCanvas
    ? {
        width: chatWidth,
        minWidth: MIN_CHAT,
        flexShrink: 0,
        transition: getTransition(),
      }
    : { flex: 1 };

  return (
    <div className="flex h-full bg-white text-[color:var(--sl-fg-base)]">
      <AgentSidebar onOpenClassicView={onOpenClassicView} />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="shrink-0 flex items-center justify-between gap-2 px-4 pr-5 py-2.5 border-b border-[#e1e1e1] h-[52px]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#ecf0f5] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[color:var(--sl-fg-base-soft)] text-[18px]">campaign</span>
            </div>
            <span className="material-symbols-outlined text-[color:var(--sl-fg-base-soft)] text-[20px] shrink-0">chevron_right</span>
            <span className="font-semibold text-[15px] text-[color:var(--sl-fg-base)] truncate">{conversationTitle}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" className="w-8 h-8 flex items-center justify-center text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]" aria-label="Opções">
              <span className="material-symbols-outlined text-[20px]">bookmark_border</span>
            </button>
            <button type="button" className="w-8 h-8 flex items-center justify-center text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]" aria-label="Mais">
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </button>
          </div>
        </header>

        <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
          {!hasConversation ? (
            <div className="flex-1 flex items-center justify-center overflow-auto py-12">
              <AgentWelcome onSend={handleSend} />
            </div>
          ) : (
            <>
              <div
                style={chatStyle}
                className={`h-full ${isRevealing ? 'agent-chat-reveal' : ''}`}
              >
                <AgentChatPanel messages={messages} isThinking={isThinking} onSend={handleSend} />
              </div>

              {showCanvas && (
                <>
                  <div
                    onMouseDown={handleDragStart}
                    className={`agent-divider shrink-0 relative z-10 ${isRevealing ? 'agent-divider-reveal' : ''}`}
                  >
                    <div className="agent-divider-line" />
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden relative">
                    <div
                      className={`h-full w-full relative ${
                        isRevealing ? 'agent-canvas-slide-layer' : ''
                      } ${isRevealing && !revealStarted ? 'agent-canvas-off-right' : ''} ${
                        revealStarted ? 'agent-canvas-slide-in' : ''
                      }`}
                    >
                      <AgentCanvas
                        campaigns={suggestedCampaigns}
                        onCampaignUpdate={onCampaignUpdate}
                        onCampaignClick={onCampaignClick}
                        onEmptySpaceClick={onEmptySpaceClick}
                      />
                      {visibleDoc && (
                        <div className={`absolute inset-0 ${docClosing ? 'doc-overlay-exit' : 'doc-overlay-enter'}`} style={{ zIndex: 9999 }}>
                          <CampaignDocument
                            campaign={visibleDoc}
                            onClose={onEditingCampaignClose}
                            onSave={onSaveCampaign}
                            allProducts={allProducts}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}

      <style>{`
        .agent-chat-reveal {
          will-change: width;
          contain: layout;
        }
        .agent-divider {
          width: 1px;
          cursor: col-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          margin: 0 -4px;
          box-sizing: content-box;
        }
        .agent-divider-line {
          width: 1px;
          height: 100%;
          background: #e5e7eb;
          transition: width 0.15s, background 0.15s;
          border-radius: 1px;
        }
        .agent-divider:hover .agent-divider-line,
        .agent-divider:active .agent-divider-line {
          width: 3px;
          background: #93b4e0;
        }
        .agent-divider-reveal {
          opacity: 0;
          animation: dividerReveal 450ms ${REVEAL_EASING} 200ms forwards;
        }
        @keyframes dividerReveal {
          to { opacity: 1; }
        }
        .agent-canvas-slide-layer {
          will-change: transform;
        }
        .agent-canvas-off-right {
          transform: translateX(100%);
        }
        .agent-canvas-slide-in {
          transform: translateX(0);
          transition: transform ${REVEAL_DURATION}ms ${REVEAL_EASING};
        }
        @media (prefers-reduced-motion: reduce) {
          .agent-divider-reveal {
            animation-duration: 0.01ms !important;
            animation-delay: 0ms !important;
          }
          .agent-canvas-slide-in {
            transition-duration: 0.01ms !important;
          }
        }
        .doc-overlay-enter {
          animation: docSlideIn 600ms ease-in-out forwards;
        }
        .doc-overlay-exit {
          animation: docSlideOut 600ms ease-in-out forwards;
        }
        @keyframes docSlideIn {
          0% {
            opacity: 0;
            transform: translateY(100%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes docSlideOut {
          0% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 0;
            transform: translateY(100%);
          }
        }
      `}</style>
    </div>
  );
};
