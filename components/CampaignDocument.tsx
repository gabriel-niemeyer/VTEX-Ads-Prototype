import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Campaign, CampaignStatus, MediaType, Product, Bid } from '../types';
import { LazyImage } from './LazyImage';
import { MediaDetailDocument } from './MediaDetailDocument';
import { UserAvatar } from './UserAvatar';
import { CommentThreadPanel } from './CommentThreadPanel';
import {
  formatBr,
  clampMoney,
  roundMoneyDecimals,
  parseMaskedMoneyFull,
  applyMoneyMask,
  normalizeMoneyDraft,
} from '../utils/moneyFormat';

/** Mesmo valor que `pl-[106px]` em `.doc-page-column` — eixo de texto para centralizar o popover. */
const DOC_COLUMN_CONTENT_INSET_PX = 106;

interface CampaignDocumentProps {
  campaign: Campaign;
  onClose: () => void;
  onSave?: (updated: Campaign) => void;
  allProducts?: Product[];
}

const toInputDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const fmtDatePt = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

const fmtMoney = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BRL';

/** Dias de calendário do período (início e fim inclusivos), mínimo 1 — base para média diária × alocação total. */
function campaignDurationDays(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

const STATUS_MAP: Record<string, { label: string }> = {
  [CampaignStatus.DRAFT]:     { label: 'Rascunho' },
  [CampaignStatus.ACTIVE]:    { label: 'Ativo' },
  [CampaignStatus.COMPLETED]: { label: 'Concluído' },
};

const OBJECTIVES = ['Alcance', 'Conversão', 'Tráfego', 'Awareness', 'Consideração'];
const FUNNEL_POSITIONS = ['Topo de funil', 'Meio de funil', 'Fundo de funil'];

const PUBLISHERS = [
  'Carrefour', 'Extra', 'Pão de Açúcar', 'Assaí', 'Atacadão',
  'Amazon Brasil', 'Mercado Livre', 'Rappi', 'iFood', 'Magalu',
  'Americanas',
];

const SPENDING_RHYTHMS = ['Conforme a demanda', 'Uniforme', 'Acelerado', 'Personalizado'];

const SEGMENTS: { label: string; base: number; icon: string; desc: string }[] = [
  { label: 'New-to-brand customers', base: 1_240_000, icon: 'person_add', desc: 'Clientes que nunca compraram da marca' },
  { label: 'Clientes recorrentes', base: 386_000, icon: 'loyalty', desc: 'Compraram 2+ vezes nos últimos 6 meses' },
  { label: 'Compradores de alto valor', base: 52_300, icon: 'diamond', desc: 'Top 5% em ticket médio' },
  { label: 'Público semelhante', base: 2_870_000, icon: 'groups', desc: 'Lookalike dos melhores compradores' },
  { label: 'Todos os clientes', base: 4_920_000, icon: 'public', desc: 'Toda a base elegível' },
];

const MEDIA_STYLES: Record<string, { icon: string; bg: string }> = {
  'Produto patrocinado':        { icon: 'search_check', bg: '#ffc8dc' },
  'Banner patrocinado':         { icon: 'ad_units',     bg: '#ffd6b0' },
  'Marca patrocinada':          { icon: 'verified',     bg: '#e0d4f7' },
  'Video':                      { icon: 'play_circle',  bg: '#ffcaca' },
  'Banner Patrocinado Offsite': { icon: 'public',       bg: '#b8e8f0' },
  'Instore display':            { icon: 'storefront',   bg: '#ffeab0' },
};

const MEDIA_LABELS: Record<string, { name: string; bidLabel: string; desc: string }> = {
  'Produto patrocinado':        { name: 'Busca Patrocinada',       bidLabel: 'CPC',  desc: '{n} SKUs' },
  'Banner patrocinado':         { name: 'Banner Patrocinado',      bidLabel: 'CPM',  desc: '{n} banners' },
  'Marca patrocinada':          { name: 'Marca Patrocinada',       bidLabel: 'CPC',  desc: '1 vídeo e {n} produtos' },
  'Video':                      { name: 'Vídeo',                   bidLabel: 'CPM',  desc: '{n} vídeos' },
  'Banner Patrocinado Offsite': { name: 'Banner Patrocinado Offsite', bidLabel: 'CPC', desc: '{n} banners' },
  'Instore display':            { name: 'Tela em loja',            bidLabel: '',     desc: '{n} lojas' },
};

const ALL_MEDIA_TYPES: MediaType[] = [
  'Produto patrocinado',
  'Banner patrocinado',
  'Marca patrocinada',
  'Video',
  'Banner Patrocinado Offsite',
  'Instore display',
];

const SIDEBAR_SECTIONS = [
  { id: 'produtos', label: 'Produtos' },
  { id: 'investimento', label: 'Investimento' },
  { id: 'segmentacao', label: 'Segmentação' },
  { id: 'plano-midia', label: 'Plano de mídia' },
];

type DocComment = {
  id: string;
  message: string;
  author: string;
  createdAt: number;
  reactions?: Record<string, string[]>;
};

/** CPC abaixo disso dispara aviso do Campaign Manager no thread da mídia (apenas tipos com lance CPC). */
const CPC_LOW_THRESHOLD = 1.2;
const RECOMMENDED_CPC_BRL = 1.5;
const AGENT_CPC_OFFER_MARKER = 'Recomendo subir para';
/** Atraso (ms) antes de mensagens automáticas do Campaign Manager (CPC baixo ou após "sim"). */
const CAMPAIGN_MANAGER_AGENT_DELAY_MS = 2000;

/** Alocação total que cai abaixo deste valor dispara aviso no thread "Alocação total". */
const BUDGET_LOW_THRESHOLD = 5000;
const RECOMMENDED_BUDGET_BRL = 5000;
const AGENT_BUDGET_OFFER_MARKER = 'Sugiro planejar pelo menos';

function userMessageAcceptsCpcRecommendation(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const first = t.split(/\s+/)[0]?.replace(/[.!?,:;]+$/g, '') ?? '';
  return /^(sim|sí|si|ok|pode|quero|aplica|aplicar|ajusta|aceito|isso)$/.test(first) || t === 's';
}

const COMMENT_TARGET_LABELS: Record<string, string> = {
  resumo: 'Resumo da campanha',
  produtos: 'Tabela de produtos',
  investimento: 'Seção de investimento',
  segmentacao: 'Seção de segmentação',
  'plano-midia': 'Plano de mídia',
  'input-title': 'Nome da campanha',
  'row-pi': 'PI',
  'row-funnel': 'Alocação',
  'row-anunciante': 'Anunciante',
  'row-publishers': 'Publishers',
  'row-objetivo': 'Objetivo',
  'row-periodo': 'Período',
  'row-budget-total': 'Alocação total',
  'row-daily-limit': 'Média diária',
  'row-spending-rhythm': 'Ritmo de gasto',
  'row-segmentar-por': 'Segmentar por',
};

export const CampaignDocument: React.FC<CampaignDocumentProps> = ({
  campaign,
  onClose,
  onSave,
  allProducts = [],
}) => {
  const [title, setTitle] = useState(campaign.title);
  const [startDate, setStartDate] = useState(campaign.startDate);
  const [endDate, setEndDate] = useState(campaign.endDate);
  const [objective, setObjective] = useState('Alcance');
  const [funnelPosition, setFunnelPosition] = useState('Topo de funil');
  const [publishers, setPublishers] = useState<string[]>([campaign.publisher]);
  const [products, setProducts] = useState<Product[]>(campaign.products);
  const [budget, setBudget] = useState(campaign.budget);
  const [dailyLimit, setDailyLimit] = useState(() =>
    roundMoneyDecimals(
      clampMoney(campaign.budget / campaignDurationDays(campaign.startDate, campaign.endDate)),
      2
    )
  );
  const campaignDays = useMemo(
    () => campaignDurationDays(startDate, endDate),
    [startDate, endDate]
  );
  const dailyFromBudget = useCallback(
    (b: number) => roundMoneyDecimals(clampMoney(b / campaignDays), 2),
    [campaignDays]
  );
  const budgetFromDaily = useCallback(
    (d: number) => roundMoneyDecimals(clampMoney(d * campaignDays), 2),
    [campaignDays]
  );
  const [spendingRhythm, setSpendingRhythm] = useState('Conforme a demanda');
  const [segment, setSegment] = useState('New-to-brand customers');
  const [mediaTypes, setMediaTypes] = useState<MediaType[]>(campaign.mediaTypes);
  const [bids, setBids] = useState<Bid[]>(campaign.bids);
  const [allocationOverrides, setAllocationOverrides] = useState<Partial<Record<MediaType, number>>>({});
  const [productPage, setProductPage] = useState(0);
  const PAGE_SIZE = 6;

  const [showObjectiveMenu, setShowObjectiveMenu] = useState(false);
  const [showFunnelMenu, setShowFunnelMenu] = useState(false);
  const [showPublisherMenu, setShowPublisherMenu] = useState(false);
  const [showRhythmMenu, setShowRhythmMenu] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerProductSearch, setPickerProductSearch] = useState('');
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [openMediaDetail, setOpenMediaDetail] = useState<MediaType | null>(null);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [drawerEntered, setDrawerEntered] = useState(false);
  const [showSegmentDrawer, setShowSegmentDrawer] = useState(false);
  const [segDrawerEntered, setSegDrawerEntered] = useState(false);
  const [segDrawerClosing, setSegDrawerClosing] = useState(false);
  const closingMediaRef = useRef<MediaType | null>(null);
  const [productSearch, setProductSearch] = useState('');
  const [showProductSearch, setShowProductSearch] = useState(false);
  const productSearchRef = useRef<HTMLInputElement>(null);
  const [drawerWidth, setDrawerWidth] = useState(60);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const status = STATUS_MAP[campaign.status] ?? STATUS_MAP[CampaignStatus.DRAFT];
  const [threadsByTarget, setThreadsByTarget] = useState<Record<string, DocComment[]>>({});
  const [activeThreadTargetId, setActiveThreadTargetId] = useState<string | null>(null);
  const [activeThreadLabel, setActiveThreadLabel] = useState('');
  const [threadDrafts, setThreadDrafts] = useState<Record<string, string>>({});
  const [threadPanelPos, setThreadPanelPos] = useState<{
    top: number;
    left: number;
    width: number;
    placement: 'above' | 'below';
  } | null>(null);
  const threadPanelRef = useRef<HTMLDivElement>(null);
  /** Um timer por thread (`media-${tipo}`) antes do comentário automático de CPC baixo. */
  const cpcLowCommentTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Timer por thread após o utilizador aceitar a recomendação de CPC ("sim"). */
  const cpcSimApplyTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Timer antes do comentário automático quando a alocação total cai abaixo do patamar. */
  const budgetLowCommentTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(
    () => () => {
      cpcLowCommentTimeoutsRef.current.forEach((t) => clearTimeout(t));
      cpcLowCommentTimeoutsRef.current.clear();
      cpcSimApplyTimeoutsRef.current.forEach((t) => clearTimeout(t));
      cpcSimApplyTimeoutsRef.current.clear();
      budgetLowCommentTimeoutsRef.current.forEach((t) => clearTimeout(t));
      budgetLowCommentTimeoutsRef.current.clear();
    },
    []
  );

  // Animação de entrada da drawer
  useEffect(() => {
    if (openMediaDetail && !drawerClosing) {
      requestAnimationFrame(() => requestAnimationFrame(() => setDrawerEntered(true)));
    }
  }, [openMediaDetail, drawerClosing]);

  useEffect(() => {
    if (showSegmentDrawer && !segDrawerClosing) {
      requestAnimationFrame(() => requestAnimationFrame(() => setSegDrawerEntered(true)));
    }
  }, [showSegmentDrawer, segDrawerClosing]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((rect.right - e.clientX) / rect.width) * 100;
      setDrawerWidth(Math.max(30, Math.min(85, pct)));
    };
    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const handleCloseDrawer = useCallback(() => {
    closingMediaRef.current = openMediaDetail;
    setDrawerEntered(false);
    setDrawerClosing(true);
    setTimeout(() => {
      setOpenMediaDetail(null);
      setDrawerClosing(false);
      closingMediaRef.current = null;
    }, 400);
  }, [openMediaDetail]);

  const handleOpenSegmentDrawer = useCallback(() => {
    setSegDrawerEntered(false);
    setSegDrawerClosing(false);
    setShowSegmentDrawer(true);
  }, []);

  const handleCloseSegmentDrawer = useCallback(() => {
    setSegDrawerEntered(false);
    setSegDrawerClosing(true);
    setTimeout(() => {
      setShowSegmentDrawer(false);
      setSegDrawerClosing(false);
    }, 400);
  }, []);

  const handleOpenDrawer = useCallback((mt: MediaType) => {
    setDrawerEntered(false);
    setDrawerClosing(false);
    setOpenMediaDetail(mt);
  }, []);

  const persistChanges = useCallback(() => {
    if (!onSave) return;
    onSave({
      ...campaign,
      title,
      startDate,
      endDate,
      budget,
      products,
      publisher: publishers[0] || campaign.publisher,
      mediaTypes,
      bids,
    });
  }, [onSave, campaign, title, startDate, endDate, budget, products, publishers, mediaTypes, bids]);

  useEffect(() => {
    persistChanges();
  }, [persistChanges]);

  const removeProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const addProduct = (p: Product) => {
    if (!products.find((e) => e.id === p.id)) {
      setProducts((prev) => [...prev, p]);
    }
  };

  const addMediaType = (type: MediaType) => {
    if (mediaTypes.includes(type)) return;
    setMediaTypes((prev) => [...prev, type]);
    setBids((prev) => [...prev, { mediaType: type, currentBid: 1.5, suggestedBid: 1.5 }]);
    setShowMediaMenu(false);
  };

  const removeMediaType = useCallback((type: MediaType) => {
    setMediaTypes((prev) => prev.filter((t) => t !== type));
    setBids((prev) => prev.filter((b) => b.mediaType !== type));
    setAllocationOverrides((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  }, []);

  const filteredAvailableProducts = allProducts.filter(
    (p) => !products.find((e) => e.id === p.id)
  );

  const pickerFilteredProducts = useMemo(() => {
    if (!pickerProductSearch.trim()) return filteredAvailableProducts;
    const q = pickerProductSearch.toLowerCase().trim();
    return filteredAvailableProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [filteredAvailableProducts, pickerProductSearch]);

  const defaultAllocation = budget / Math.max(mediaTypes.length, 1);
  const getAllocation = (mt: MediaType) => allocationOverrides[mt] ?? defaultAllocation;

  const handleAllocationChange = useCallback((mt: MediaType, value: number) => {
    setAllocationOverrides((prev) => ({ ...prev, [mt]: value }));
  }, []);

  const maybeScheduleBudgetLowComment = useCallback((prevBudget: number, nextBudget: number) => {
    const crossedBelowThreshold =
      prevBudget >= BUDGET_LOW_THRESHOLD && nextBudget < BUDGET_LOW_THRESHOLD;
    if (!crossedBelowThreshold) return;
    const targetId = 'row-budget-total';
    const pending = budgetLowCommentTimeoutsRef.current.get(targetId);
    if (pending) clearTimeout(pending);
    const timer = setTimeout(() => {
      budgetLowCommentTimeoutsRef.current.delete(targetId);
      setThreadsByTarget((tp) => ({
        ...tp,
        [targetId]: [
          ...(tp[targetId] ?? []),
          {
            id: `agent-budget-low-${Date.now()}`,
            author: 'Campaign Manager',
            message: [
              `A alocação total ficou em R$ ${formatBr(nextBudget)} BRL — abaixo de R$ ${formatBr(BUDGET_LOW_THRESHOLD)} o orçamento costuma ser insuficiente para a campanha performar bem (alcance, testes e otimização ficam limitados).`,
              '',
              `${AGENT_BUDGET_OFFER_MARKER} R$ ${formatBr(RECOMMENDED_BUDGET_BRL)} BRL no total. Quer que eu aplique esse valor?`,
              '',
              'Responda "sim" para aplicar.',
            ].join('\n'),
            createdAt: Date.now(),
          },
        ],
      }));
      setActiveThreadTargetId(targetId);
      setActiveThreadLabel(COMMENT_TARGET_LABELS['row-budget-total']);
      setThreadDrafts((d) => ({ ...d, [targetId]: d[targetId] ?? '' }));
    }, CAMPAIGN_MANAGER_AGENT_DELAY_MS);
    budgetLowCommentTimeoutsRef.current.set(targetId, timer);
  }, []);

  const handleBudgetChange = useCallback(
    (newBudget: number) => {
      setBudget((prev) => {
        maybeScheduleBudgetLowComment(prev, newBudget);
        return newBudget;
      });
      setDailyLimit(dailyFromBudget(newBudget));
    },
    [dailyFromBudget, maybeScheduleBudgetLowComment]
  );

  const handleDailyChange = useCallback(
    (newDaily: number) => {
      const nextBudget = budgetFromDaily(newDaily);
      setDailyLimit(newDaily);
      setBudget((prev) => {
        maybeScheduleBudgetLowComment(prev, nextBudget);
        return nextBudget;
      });
    },
    [budgetFromDaily, maybeScheduleBudgetLowComment]
  );

  /** Ao mudar o período da campanha, mantém a alocação total e recalcula a média diária. */
  useEffect(() => {
    setDailyLimit(dailyFromBudget(budget));
    // budget: valor atual do total nesta renderização quando `campaignDays` muda
    // eslint-disable-next-line react-hooks/exhaustive-deps -- não incluir `budget`: evita sobrescrever a média após edição direta do utilizador
  }, [campaignDays, dailyFromBudget]);

  const handleBidChange = useCallback((mt: MediaType, patch: { currentBid?: number; suggestedBid?: number }) => {
    setBids((prev) => {
      const old = prev.find((b) => b.mediaType === mt);
      const newCurrent =
        patch.currentBid !== undefined ? patch.currentBid : old?.currentBid;
      const oldCurrent = old?.currentBid;
      const bidLabel = MEDIA_LABELS[mt]?.bidLabel;

      const crossedBelowThreshold =
        patch.currentBid !== undefined &&
        bidLabel === 'CPC' &&
        newCurrent !== undefined &&
        newCurrent < CPC_LOW_THRESHOLD &&
        (oldCurrent === undefined || oldCurrent >= CPC_LOW_THRESHOLD);

      if (crossedBelowThreshold && newCurrent !== undefined) {
        const targetId = `media-${mt}`;
        const currentCpc = newCurrent;
        const pending = cpcLowCommentTimeoutsRef.current.get(targetId);
        if (pending) clearTimeout(pending);
        const timer = setTimeout(() => {
          cpcLowCommentTimeoutsRef.current.delete(targetId);
          setThreadsByTarget((tp) => ({
            ...tp,
            [targetId]: [
              ...(tp[targetId] ?? []),
              {
                id: `agent-cpc-low-${Date.now()}`,
                author: 'Campaign Manager',
                message: [
                  `O CPC de R$ ${formatBr(currentCpc)} BRL está abaixo do patamar usual (R$ ${formatBr(CPC_LOW_THRESHOLD)}). Com isso, é bem provável que você entregue pouca ou nenhuma mídia.`,
                  '',
                  `${AGENT_CPC_OFFER_MARKER} R$ ${formatBr(RECOMMENDED_CPC_BRL)} BRL por clique. Quer que eu aplique esse valor?`,
                  '',
                  'Responda "sim" para aplicar.',
                ].join('\n'),
                createdAt: Date.now(),
              },
            ],
          }));
          setActiveThreadTargetId(targetId);
          setActiveThreadLabel(`Tipo de mídia: ${mt}`);
          setThreadDrafts((d) => ({ ...d, [targetId]: d[targetId] ?? '' }));
        }, CAMPAIGN_MANAGER_AGENT_DELAY_MS);
        cpcLowCommentTimeoutsRef.current.set(targetId, timer);
      }

      return prev.map((b) => (b.mediaType === mt ? { ...b, ...patch } : b));
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeThreadTargetId) {
        setActiveThreadTargetId(null);
      } else if (showSegmentDrawer) {
        handleCloseSegmentDrawer();
      } else if (openMediaDetail) {
        handleCloseDrawer();
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeThreadTargetId, openMediaDetail, handleCloseDrawer, showSegmentDrawer, handleCloseSegmentDrawer, onClose]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(`doc-section-${id}`);
    if (el && scrollRef.current) {
      const top = el.offsetTop - scrollRef.current.offsetTop;
      scrollRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const monthName = startDate.toLocaleDateString('pt-BR', { month: 'long' });
  const capMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const piLabel = `Pedido de Inserção - ${capMonth} ${startDate.getFullYear()} - ${publishers.join(', ') || '—'}`;
  const activeThreadComments = activeThreadTargetId ? (threadsByTarget[activeThreadTargetId] ?? []) : [];
  const activeThreadDraft = activeThreadTargetId ? (threadDrafts[activeThreadTargetId] ?? '') : '';

  const openCommentThread = useCallback((targetId: string, label?: string) => {
    setActiveThreadTargetId(targetId);
    setActiveThreadLabel(label ?? COMMENT_TARGET_LABELS[targetId] ?? 'Comentário');
    setThreadDrafts((prev) => ({ ...prev, [targetId]: prev[targetId] ?? '' }));
  }, []);

  const closeCommentThread = useCallback(() => {
    setActiveThreadTargetId(null);
  }, []);

  const handleThreadDraftChange = useCallback((targetId: string, message: string) => {
    setThreadDrafts((prev) => ({ ...prev, [targetId]: message }));
  }, []);

  const handleAddCommentToThread = useCallback((targetId: string) => {
    const message = (threadDrafts[targetId] ?? '').trim();
    if (!message) return;

    const existing = threadsByTarget[targetId] ?? [];
    const lastBeforeUser = existing[existing.length - 1];
    const hasPendingCpcOffer =
      lastBeforeUser?.author === 'Campaign Manager' &&
      lastBeforeUser.message.includes(AGENT_CPC_OFFER_MARKER);
    const hasPendingBudgetOffer =
      lastBeforeUser?.author === 'Campaign Manager' &&
      lastBeforeUser.message.includes(AGENT_BUDGET_OFFER_MARKER);
    const wantsApply =
      hasPendingCpcOffer &&
      targetId.startsWith('media-') &&
      userMessageAcceptsCpcRecommendation(message);
    const wantsApplyBudget =
      hasPendingBudgetOffer &&
      targetId === 'row-budget-total' &&
      userMessageAcceptsCpcRecommendation(message);

    const nextComment: DocComment = {
      id: `${targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author: 'Você',
      message,
      createdAt: Date.now(),
    };

    setThreadsByTarget((prev) => ({
      ...prev,
      [targetId]: [...(prev[targetId] ?? []), nextComment],
    }));

    if (wantsApply) {
      const mt = targetId.slice('media-'.length) as MediaType;
      const pending = cpcSimApplyTimeoutsRef.current.get(targetId);
      if (pending) clearTimeout(pending);
      const timer = setTimeout(() => {
        cpcSimApplyTimeoutsRef.current.delete(targetId);
        setBids((bprev) =>
          bprev.map((b) =>
            b.mediaType === mt ? { ...b, currentBid: RECOMMENDED_CPC_BRL } : b
          )
        );
        setThreadsByTarget((tp) => ({
          ...tp,
          [targetId]: [
            ...(tp[targetId] ?? []),
            {
              id: `agent-cpc-applied-${Date.now()}`,
              author: 'Campaign Manager',
              message: `Feito — CPC ajustado para R$ ${formatBr(RECOMMENDED_CPC_BRL)} BRL neste tipo de mídia.`,
              createdAt: Date.now(),
            },
          ],
        }));
      }, CAMPAIGN_MANAGER_AGENT_DELAY_MS);
      cpcSimApplyTimeoutsRef.current.set(targetId, timer);
    }

    if (wantsApplyBudget) {
      const pending = cpcSimApplyTimeoutsRef.current.get(targetId);
      if (pending) clearTimeout(pending);
      const timer = setTimeout(() => {
        cpcSimApplyTimeoutsRef.current.delete(targetId);
        setBudget(RECOMMENDED_BUDGET_BRL);
        setDailyLimit(dailyFromBudget(RECOMMENDED_BUDGET_BRL));
        setThreadsByTarget((tp) => ({
          ...tp,
          [targetId]: [
            ...(tp[targetId] ?? []),
            {
              id: `agent-budget-applied-${Date.now()}`,
              author: 'Campaign Manager',
              message: `Feito — alocação total ajustada para R$ ${formatBr(RECOMMENDED_BUDGET_BRL)} BRL.`,
              createdAt: Date.now(),
            },
          ],
        }));
      }, CAMPAIGN_MANAGER_AGENT_DELAY_MS);
      cpcSimApplyTimeoutsRef.current.set(targetId, timer);
    }

    setThreadDrafts((prev) => ({ ...prev, [targetId]: '' }));
  }, [threadDrafts, threadsByTarget, dailyFromBudget]);

  const handleEditThreadComment = useCallback((targetId: string, commentId: string, message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setThreadsByTarget((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] ?? []).map((c) =>
        c.id === commentId ? { ...c, message: trimmed } : c
      ),
    }));
  }, []);

  const handleDeleteThreadComment = useCallback((targetId: string, commentId: string) => {
    setThreadsByTarget((prev) => ({
      ...prev,
      [targetId]: (prev[targetId] ?? []).filter((c) => c.id !== commentId),
    }));
  }, []);

  const handleToggleThreadReaction = useCallback((targetId: string, commentId: string, emoji: string) => {
    const reactor = 'me';
    setThreadsByTarget((prev) => {
      const list = prev[targetId] ?? [];
      return {
        ...prev,
        [targetId]: list.map((c) => {
          if (c.id !== commentId) return c;
          const raw: Record<string, string[]> = { ...(c.reactions ?? {}) };
          const onThis = [...(raw[emoji] ?? [])];
          const already = onThis.indexOf(reactor);
          if (already >= 0) {
            onThis.splice(already, 1);
            if (onThis.length === 0) delete raw[emoji];
            else raw[emoji] = onThis;
          } else {
            for (const k of Object.keys(raw)) {
              const u = (raw[k] ?? []).filter((x) => x !== reactor);
              if (u.length === 0) delete raw[k];
              else raw[k] = u;
            }
            raw[emoji] = [reactor];
          }
          const keys = Object.keys(raw);
          return { ...c, reactions: keys.length > 0 ? raw : undefined };
        }),
      };
    });
  }, []);

  const handleResolveThread = useCallback((targetId: string) => {
    setThreadsByTarget((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setThreadDrafts((prev) => {
      const next = { ...prev };
      delete next[targetId];
      return next;
    });
    setActiveThreadTargetId((current) => (current === targetId ? null : current));
  }, []);
  const getThreadCount = useCallback((targetId: string) => (threadsByTarget[targetId] ?? []).length, [threadsByTarget]);
  const hasThread = useCallback((targetId: string) => getThreadCount(targetId) > 0, [getThreadCount]);

  const updateThreadPanelPosition = useCallback(() => {
    if (!activeThreadTargetId) return;
    const anchor = Array.from(document.querySelectorAll('[data-comment-target]')).find((n) => {
      const el = n as HTMLElement;
      return el.dataset.commentTarget === activeThreadTargetId || el.getAttribute('data-comment-target') === activeThreadTargetId;
    }) as HTMLElement | undefined;
    if (!anchor) {
      setThreadPanelPos(null);
      return;
    }
    const r = anchor.getBoundingClientRect();
    const column = anchor.closest('.doc-page-column') as HTMLElement | null;
    const colRect = column?.getBoundingClientRect();
    const gap = 8;
    const maxPanel = 480;
    const minPanel = 280;

    let centerX: number;
    let w: number;

    if (colRect) {
      const contentLeft = colRect.left + DOC_COLUMN_CONTENT_INSET_PX;
      const contentWidth = Math.max(0, colRect.width - DOC_COLUMN_CONTENT_INSET_PX);
      centerX = contentLeft + contentWidth / 2;
      w = Math.min(maxPanel, Math.max(minPanel, contentWidth - 24));
    } else {
      centerX = r.left + r.width / 2;
      w = Math.min(maxPanel, Math.max(minPanel, r.width));
    }

    let left = centerX - w / 2;
    if (left < 16) left = 16;
    if (left + w > window.innerWidth - 16) left = Math.max(16, window.innerWidth - w - 16);

    const isMediaPlanRow = activeThreadTargetId.startsWith('media-');
    if (isMediaPlanRow) {
      setThreadPanelPos({ top: r.top - gap, left, width: w, placement: 'above' });
    } else {
      setThreadPanelPos({ top: r.bottom + gap, left, width: w, placement: 'below' });
    }
  }, [activeThreadTargetId]);

  useLayoutEffect(() => {
    if (!activeThreadTargetId) {
      setThreadPanelPos(null);
      return;
    }
    updateThreadPanelPosition();
    window.addEventListener('scroll', updateThreadPanelPosition, true);
    window.addEventListener('resize', updateThreadPanelPosition);
    return () => {
      window.removeEventListener('scroll', updateThreadPanelPosition, true);
      window.removeEventListener('resize', updateThreadPanelPosition);
    };
  }, [activeThreadTargetId, updateThreadPanelPosition]);

  useEffect(() => {
    if (!activeThreadTargetId) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (threadPanelRef.current?.contains(t)) return;
      if ((e.target as Element | null)?.closest?.('[data-comment-target]')) return;
      // Portais do CommentThreadPanel (menu ⋮, @mentions) ficam em document.body fora de threadPanelRef
      if ((e.target as Element | null)?.closest?.('[data-comment-thread-portal]')) return;
      closeCommentThread();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [activeThreadTargetId, closeCommentThread]);

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-white relative">
      {/* ─── Header ─── */}
      <div className="shrink-0 flex items-center justify-between px-5 h-[64px] border-b-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <span className="font-semibold text-[20px] tracking-[-0.45px] text-[color:var(--sl-fg-base)] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center justify-center px-2">
            <span className="text-[11px] tracking-[-0.33px] text-[color:var(--sl-fg-base-soft)] whitespace-nowrap">Salvo agora há pouco</span>
          </div>
          <UserAvatar size="sm" />
          <button type="button" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors">
            <span className="material-symbols-outlined text-[16px]">history</span>
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-0.5 h-7 min-w-[56px] px-2 rounded-lg text-[11px] font-semibold tracking-[-0.22px] text-[color:var(--sl-fg-base)] border border-[#e5e5e5] bg-[#f5f5f5] hover:bg-[#ebebeb] transition-colors shadow-[0_1px_1px_rgba(0,0,0,0.11)]"
          >
            {status.label}
            <span className="material-symbols-outlined text-[12px]">expand_more</span>
          </button>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">more_horiz</span>
          </button>
        </div>
      </div>

      {/* ─── Body ─── */}
      <div className="flex-1 flex min-h-0 relative">
        <div ref={scrollRef} className={`flex-1 overflow-y-auto${openMediaDetail || drawerClosing ? ' overflow-hidden' : ''}`}>
          {/* ── Título + Propriedades ── */}
          <div className="flex flex-col gap-[30px] pl-10 pr-14 py-10">
            <div className="doc-page-column w-full max-w-[800px] mx-auto pl-[106px]">
              <CommentableField
                targetId="input-title"
                targetLabel={COMMENT_TARGET_LABELS['input-title']}
                hasComments={hasThread('input-title')}
                commentCount={getThreadCount('input-title')}
                isActive={activeThreadTargetId === 'input-title'}
                onOpenThread={openCommentThread}
              >
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full font-semibold text-[32px] leading-8 tracking-[-1.28px] text-[color:var(--sl-fg-base)] bg-transparent border-none outline-none placeholder:text-[color:var(--sl-fg-base-muted)] cursor-text rounded-lg px-3 -mx-3 py-1 -my-1 transition-colors hover:bg-gray-100"
                  placeholder="Nome da campanha"
                />
              </CommentableField>
            </div>
            <div className="doc-page-column w-full max-w-[800px] mx-auto pl-[106px] flex flex-col gap-[8px]">
              {/* PI */}
              <CommentableField
                targetId="row-pi"
                targetLabel={COMMENT_TARGET_LABELS['row-pi']}
                hasComments={hasThread('row-pi')}
                commentCount={getThreadCount('row-pi')}
                isActive={activeThreadTargetId === 'row-pi'}
                onOpenThread={openCommentThread}
              >
                <PropertyRow label="PI">
                  <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">↗ {piLabel}</span>
                </PropertyRow>
              </CommentableField>

              {/* Alocação (funil) */}
              <CommentableField
                targetId="row-funnel"
                targetLabel={COMMENT_TARGET_LABELS['row-funnel']}
                hasComments={hasThread('row-funnel')}
                commentCount={getThreadCount('row-funnel')}
                isActive={activeThreadTargetId === 'row-funnel'}
                onOpenThread={openCommentThread}
              >
                <PropertyRow label="Alocação">
                  <DropdownPill
                    value={funnelPosition}
                    open={showFunnelMenu}
                    onToggle={() => setShowFunnelMenu(!showFunnelMenu)}
                    onClose={() => setShowFunnelMenu(false)}
                    options={FUNNEL_POSITIONS}
                    onSelect={(v) => { setFunnelPosition(v); setShowFunnelMenu(false); }}
                  />
                </PropertyRow>
              </CommentableField>

              {/* Anunciante */}
              <CommentableField
                targetId="row-anunciante"
                targetLabel={COMMENT_TARGET_LABELS['row-anunciante']}
                hasComments={hasThread('row-anunciante')}
                commentCount={getThreadCount('row-anunciante')}
                isActive={activeThreadTargetId === 'row-anunciante'}
                onOpenThread={openCommentThread}
              >
                <PropertyRow label="Anunciante">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#0057b8] flex items-center justify-center shrink-0">
                      <span className="text-white text-[10px] font-bold">N</span>
                    </div>
                    <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">Nestlé</span>
                  </div>
                </PropertyRow>
              </CommentableField>

              {/* Publishers */}
              <CommentableField
                targetId="row-publishers"
                targetLabel={COMMENT_TARGET_LABELS['row-publishers']}
                hasComments={hasThread('row-publishers')}
                commentCount={getThreadCount('row-publishers')}
                isActive={activeThreadTargetId === 'row-publishers'}
                onOpenThread={openCommentThread}
              >
                <PropertyRow label="Publishers">
                  <div className="flex items-center gap-1.5 flex-wrap relative">
                  {publishers.map((pub) => (
                    <button
                      key={pub}
                      type="button"
                      onClick={() => setPublishers((prev) => prev.filter((p) => p !== pub))}
                      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg bg-[#f8f8f8] hover:bg-[#efefef] transition-colors"
                    >
                      <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] whitespace-nowrap">{pub}</span>
                      <span className="material-symbols-outlined text-[12px] text-[color:var(--sl-fg-base-muted)]">close</span>
                    </button>
                  ))}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPublisherMenu(!showPublisherMenu)}
                      className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors border border-dashed border-gray-300"
                    >
                      <span className="material-symbols-outlined text-[14px]">add</span>
                    </button>
                    {showPublisherMenu && (
                      <DropdownMenu onClose={() => setShowPublisherMenu(false)} width={220}>
                        {PUBLISHERS.filter((p) => !publishers.includes(p)).map((pub) => (
                          <button
                            key={pub}
                            type="button"
                            onClick={() => { setPublishers((prev) => [...prev, pub]); setShowPublisherMenu(false); }}
                            className="w-full text-left px-3 py-2 text-sm text-[color:var(--sl-fg-base)] hover:bg-black/[0.04] transition-colors"
                          >
                            {pub}
                          </button>
                        ))}
                      </DropdownMenu>
                    )}
                  </div>
                  </div>
                </PropertyRow>
              </CommentableField>

              {/* Objetivo */}
              <CommentableField
                targetId="row-objetivo"
                targetLabel={COMMENT_TARGET_LABELS['row-objetivo']}
                hasComments={hasThread('row-objetivo')}
                commentCount={getThreadCount('row-objetivo')}
                isActive={activeThreadTargetId === 'row-objetivo'}
                onOpenThread={openCommentThread}
              >
                <PropertyRow label="Objetivo">
                  <DropdownPill
                    value={objective}
                    open={showObjectiveMenu}
                    onToggle={() => setShowObjectiveMenu(!showObjectiveMenu)}
                    onClose={() => setShowObjectiveMenu(false)}
                    options={OBJECTIVES}
                    onSelect={(v) => { setObjective(v); setShowObjectiveMenu(false); }}
                  />
                </PropertyRow>
              </CommentableField>

              {/* Período */}
              <CommentableField
                targetId="row-periodo"
                targetLabel={COMMENT_TARGET_LABELS['row-periodo']}
                hasComments={hasThread('row-periodo')}
                commentCount={getThreadCount('row-periodo')}
                isActive={activeThreadTargetId === 'row-periodo'}
                onOpenThread={openCommentThread}
              >
                <PropertyRow label="Período">
                  <DateRangePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStartChange={setStartDate}
                    onEndChange={setEndDate}
                  />
                </PropertyRow>
              </CommentableField>
            </div>
          </div>

          {/* ── Produtos ── */}
          <div id="doc-section-produtos" className="flex flex-col pl-10 pr-14 py-10">
            <div className="doc-page-column w-full max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] pb-2">Produtos</h2>
              <div className="flex items-center justify-between h-10 mb-1 gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {showProductSearch ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-muted)] shrink-0">search</span>
                      <input
                        ref={productSearchRef}
                        type="text"
                        value={productSearch}
                        onChange={(e) => { setProductSearch(e.target.value); setProductPage(0); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setProductSearch('');
                            setShowProductSearch(false);
                            setProductPage(0);
                          }
                        }}
                        placeholder="Buscar por nome ou SKU..."
                        className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)]"
                      />
                    </div>
                  ) : (
                    <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)] font-normal">{products.length} SKU{products.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 relative shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (showProductSearch) {
                        setProductSearch('');
                        setShowProductSearch(false);
                        setProductPage(0);
                      } else {
                        setShowProductSearch(true);
                        setTimeout(() => productSearchRef.current?.focus(), 50);
                      }
                    }}
                    className="min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0] transition-colors"
                    aria-label={showProductSearch ? 'Fechar busca' : 'Buscar'}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {showProductSearch ? 'close' : 'search'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowProductPicker(!showProductPicker)}
                    className="min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0] transition-colors"
                    aria-label="Adicionar produto"
                  >
                    <span className="material-symbols-outlined text-[15px]">add</span>
                  </button>
                  {showProductPicker && (
                    <DropdownMenu onClose={() => { setShowProductPicker(false); setPickerProductSearch(''); }} width={360} alignRight>
                      <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                          <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)]">search</span>
                          <input
                            type="text"
                            value={pickerProductSearch}
                            onChange={(e) => setPickerProductSearch(e.target.value)}
                            placeholder="Buscar produto..."
                            className="flex-1 min-w-0 text-sm bg-transparent border-none outline-none text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)]"
                            autoFocus
                          />
                          {pickerProductSearch && (
                            <button
                              type="button"
                              onClick={() => setPickerProductSearch('')}
                              className="w-5 h-5 flex items-center justify-center rounded text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base)] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-[240px] overflow-y-auto py-1">
                        {pickerFilteredProducts.length === 0 && (
                          <p className="px-3 py-3 text-sm text-[color:var(--sl-fg-base-soft)]">
                            {pickerProductSearch ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                          </p>
                        )}
                        {pickerFilteredProducts.slice(0, 20).map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => addProduct(p)}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-black/[0.04] transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded border shrink-0 overflow-hidden bg-white flex items-center justify-center" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                              {p.imageUrl ? (
                                <LazyImage src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-[color:var(--sl-fg-base-muted)] text-[16px]">inventory_2</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-[color:var(--sl-fg-base)] truncate block">{p.name}</span>
                              <span className="text-xs text-[color:var(--sl-fg-base-muted)] truncate block">{p.id}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <CommentableField
                targetId="produtos"
                targetLabel={COMMENT_TARGET_LABELS.produtos}
                hasComments={hasThread('produtos')}
                commentCount={getThreadCount('produtos')}
                isActive={activeThreadTargetId === 'produtos'}
                onOpenThread={openCommentThread}
                highlightRounded={false}
              >
              {(() => {
                const searchLower = productSearch.toLowerCase();
                const filtered = productSearch
                  ? products.filter((p) => p.name.toLowerCase().includes(searchLower) || p.id.toLowerCase().includes(searchLower))
                  : products;
                const paginated = filtered.slice(productPage * PAGE_SIZE, (productPage + 1) * PAGE_SIZE);
                const filteredTotalPages = Math.ceil(filtered.length / PAGE_SIZE);

                const highlightMatch = (text: string) => {
                  if (!productSearch) return text;
                  const idx = text.toLowerCase().indexOf(searchLower);
                  if (idx === -1) return text;
                  return (
                    <>
                      {text.slice(0, idx)}
                      <mark className="bg-yellow-200/60 text-inherit rounded-sm px-[1px]">{text.slice(idx, idx + productSearch.length)}</mark>
                      {text.slice(idx + productSearch.length)}
                    </>
                  );
                };

                return (
                  <>
                    {/* Result count when searching */}
                    {productSearch && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-md ${
                          filtered.length === 0 ? 'text-[color:var(--sl-fg-base-soft)] bg-red-50' : 'text-[color:var(--sl-fg-base-soft)] bg-[#f5f5f5]'
                        }`}>
                          {filtered.length === 0 ? 'Sem resultados' : `${filtered.length} encontrado${filtered.length !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-[4px]">
                      {paginated.map((p) => (
                        <div key={p.id} className="flex items-center justify-center p-2 rounded-xl border group transition-colors" style={{ borderColor: '#e0e0e0' }}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-[7px] border shrink-0 overflow-hidden bg-white flex items-center justify-center" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
                              {p.imageUrl ? (
                                <LazyImage src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-[color:var(--sl-fg-base-muted)] text-[20px]">inventory_2</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                              <p className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] truncate">{highlightMatch(p.name)}</p>
                              <p className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">{highlightMatch(p.id)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeProduct(p.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-muted)] hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            >
                              <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {filtered.length > 0 && (
                      <div className="flex items-center justify-between h-12 px-2">
                        <div className="flex items-center gap-1 text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">
                          <span>{productPage * PAGE_SIZE + 1}</span>
                          <span>—</span>
                          <span>{Math.min((productPage + 1) * PAGE_SIZE, filtered.length)}</span>
                          <span>de</span>
                          <span>{filtered.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setProductPage((p) => Math.max(0, p - 1))}
                            disabled={productPage === 0}
                            className="w-4 h-4 flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] disabled:opacity-30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductPage((p) => Math.min(filteredTotalPages - 1, p + 1))}
                            disabled={productPage >= filteredTotalPages - 1}
                            className="w-4 h-4 flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] disabled:opacity-30 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                          </button>
                        </div>
                      </div>
                    )}
                    {filtered.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 gap-2">
                        <span className="material-symbols-outlined text-[32px] text-[#d0d0d0]">search_off</span>
                        <p className="text-sm text-[color:var(--sl-fg-base-muted)]">
                          {productSearch ? `Nenhum produto com "${productSearch}"` : 'Nenhum produto adicionado'}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
              </CommentableField>
            </div>
          </div>

          {/* ── Investimento (sem wrapper comentável: evita dois botões ao hover nas linhas internas) ── */}
          <div id="doc-section-investimento" className="flex flex-col pl-10 pr-14 py-10">
            <div className="doc-page-column w-full max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] pb-2">Investimento</h2>
              <div className="flex flex-col">
                <CommentableField
                  targetId="row-budget-total"
                  targetLabel={COMMENT_TARGET_LABELS['row-budget-total']}
                  hasComments={hasThread('row-budget-total')}
                  commentCount={getThreadCount('row-budget-total')}
                  isActive={activeThreadTargetId === 'row-budget-total'}
                  onOpenThread={openCommentThread}
                  highlightRounded={false}
                >
                  <EditableMoneyRow
                    label="Alocação total"
                    value={budget}
                    onChange={handleBudgetChange}
                  />
                </CommentableField>
                <CommentableField
                  targetId="row-daily-limit"
                  targetLabel={COMMENT_TARGET_LABELS['row-daily-limit']}
                  hasComments={hasThread('row-daily-limit')}
                  commentCount={getThreadCount('row-daily-limit')}
                  isActive={activeThreadTargetId === 'row-daily-limit'}
                  onOpenThread={openCommentThread}
                  highlightRounded={false}
                >
                  <EditableMoneyRow
                    label="Média diária"
                    value={dailyLimit}
                    onChange={handleDailyChange}
                  />
                </CommentableField>
                <CommentableField
                  targetId="row-spending-rhythm"
                  targetLabel={COMMENT_TARGET_LABELS['row-spending-rhythm']}
                  hasComments={hasThread('row-spending-rhythm')}
                  commentCount={getThreadCount('row-spending-rhythm')}
                  isActive={activeThreadTargetId === 'row-spending-rhythm'}
                  onOpenThread={openCommentThread}
                  highlightRounded={false}
                >
                <div className="flex items-center gap-5 py-3 border-b" style={{ borderColor: '#e0e0e0' }}>
                  <div className="w-[240px] shrink-0">
                    <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">Ritmo de gasto</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <DropdownPill
                      value={spendingRhythm}
                      open={showRhythmMenu}
                      onToggle={() => setShowRhythmMenu(!showRhythmMenu)}
                      onClose={() => setShowRhythmMenu(false)}
                      options={SPENDING_RHYTHMS}
                      onSelect={(v) => { setSpendingRhythm(v); setShowRhythmMenu(false); }}
                    />
                  </div>
                </div>
                </CommentableField>
              </div>
            </div>
          </div>

          {/* ── Segmentação ── */}
          <div id="doc-section-segmentacao" className="flex flex-col pl-10 pr-14 py-10">
            <div className="doc-page-column w-full max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] pb-4">Segmentação</h2>
              <CommentableField
                targetId="row-segmentar-por"
                targetLabel={COMMENT_TARGET_LABELS['row-segmentar-por']}
                hasComments={hasThread('row-segmentar-por')}
                commentCount={getThreadCount('row-segmentar-por')}
                isActive={activeThreadTargetId === 'row-segmentar-por'}
                onOpenThread={openCommentThread}
                highlightRounded={false}
              >
                <div className="flex items-center gap-5 py-3 border-b" style={{ borderColor: '#e0e0e0' }}>
                  <div className="w-[240px] shrink-0">
                    <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">Segmentar por</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {(() => {
                      const seg = SEGMENTS.find((s) => s.label === segment);
                      const fmtBase = seg
                        ? seg.base >= 1_000_000
                          ? `${(seg.base / 1_000_000).toFixed(1).replace('.', ',')}M`
                          : seg.base >= 1_000
                          ? `${(seg.base / 1_000).toFixed(1).replace('.', ',')}K`
                          : String(seg.base)
                        : '';
                      return (
                        <button
                          type="button"
                          onClick={handleOpenSegmentDrawer}
                          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#f8f8f8] hover:bg-[#ebebeb] transition-colors cursor-pointer"
                        >
                          {seg && (
                            <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)]">{seg.icon}</span>
                          )}
                          <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{segment}</span>
                          {seg && (
                            <span className="text-xs text-[color:var(--sl-fg-base-muted)] tabular-nums">{fmtBase}</span>
                          )}
                          <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-soft)]">chevron_right</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </CommentableField>
            </div>
          </div>

          {/* ── Plano de mídia (sem wrapper comentável: cada MediaRow tem o seu botão) ── */}
          <div id="doc-section-plano-midia" className="flex flex-col pl-10 pr-14 py-10 min-w-0">
            <div className="doc-page-column w-full min-w-0 max-w-[800px] mx-auto pl-[106px]">
              <h2 className="font-semibold text-[20px] leading-7 tracking-[-0.8px] text-[color:var(--sl-fg-base)] mb-[24px]">Plano de mídia</h2>
              <div className="flex items-center justify-between h-12 mb-1">
                <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base-soft)] font-normal">Mídias</span>
                <div className="relative">
                  <SmallIconBtn icon="add" size={15} onClick={() => setShowMediaMenu(!showMediaMenu)} />
                  {showMediaMenu && (
                    <DropdownMenu onClose={() => setShowMediaMenu(false)} width={320} alignRight>
                      <div className="px-3 py-2 border-b border-gray-100">
                        <p className="text-xs text-[color:var(--sl-fg-base-soft)]">Adicionar tipo de mídia</p>
                      </div>
                      <div className="py-1">
                        {ALL_MEDIA_TYPES.map((type) => {
                          const style = MEDIA_STYLES[type] ?? { icon: 'campaign', bg: '#e0e0e0' };
                          const labels = MEDIA_LABELS[type] ?? { name: type, bidLabel: '', desc: '' };
                          const isAdded = mediaTypes.includes(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                if (isAdded) {
                                  setShowMediaMenu(false);
                                  handleOpenDrawer(type);
                                } else {
                                  addMediaType(type);
                                  handleOpenDrawer(type);
                                }
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.04] cursor-pointer"
                            >
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: style.bg }}>
                                <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base)]/70">{style.icon}</span>
                              </div>
                              <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-[color:var(--sl-fg-base)]">{labels.name}</span>
                                {labels.bidLabel && (
                                  <span className="text-xs text-[color:var(--sl-fg-base-soft)]">{labels.bidLabel}</span>
                                )}
                              </div>
                              {isAdded && (
                                <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-soft)] shrink-0">check_circle</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </DropdownMenu>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-0 w-full min-w-0">
                {mediaTypes.map((mt) => (
                  <MediaRow
                    key={mt}
                    mediaType={mt}
                    commentId={`media-${mt}`}
                    commentLabel={`Tipo de mídia: ${mt}`}
                    hasComments={hasThread(`media-${mt}`)}
                    commentCount={getThreadCount(`media-${mt}`)}
                    isCommentActive={activeThreadTargetId === `media-${mt}`}
                    onOpenCommentThread={openCommentThread}
                    allocation={getAllocation(mt)}
                    bid={bids.find((b) => b.mediaType === mt)}
                    productCount={products.length}
                    onAllocationChange={(v) => handleAllocationChange(mt, v)}
                    onBidChange={(patch) => handleBidChange(mt, patch)}
                    onOpenDetail={() => handleOpenDrawer(mt)}
                    onRemove={() => removeMediaType(mt)}
                  />
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>

      {activeThreadTargetId &&
        threadPanelPos &&
        createPortal(
          <div
            ref={threadPanelRef}
            className="fixed pointer-events-auto"
            style={{
              top: threadPanelPos.top,
              left: threadPanelPos.left,
              width: threadPanelPos.width,
              zIndex: 10050,
              transform: threadPanelPos.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
          >
            <CommentThreadPanel
              comments={activeThreadComments}
              draft={activeThreadDraft}
              onDraftChange={(v) => activeThreadTargetId && handleThreadDraftChange(activeThreadTargetId, v)}
              onSend={() => activeThreadTargetId && handleAddCommentToThread(activeThreadTargetId)}
              onResolve={() => activeThreadTargetId && handleResolveThread(activeThreadTargetId)}
              onClose={closeCommentThread}
              contextLabel={activeThreadLabel}
              onEditComment={(commentId, message) =>
                activeThreadTargetId && handleEditThreadComment(activeThreadTargetId, commentId, message)
              }
              onDeleteComment={(commentId) =>
                activeThreadTargetId && handleDeleteThreadComment(activeThreadTargetId, commentId)
              }
              onToggleReaction={(commentId, emoji) =>
                activeThreadTargetId && handleToggleThreadReaction(activeThreadTargetId, commentId, emoji)
              }
            />
          </div>,
          document.body
        )}

      {/* Drawer de detalhe da mídia */}
      {(openMediaDetail || drawerClosing) && (
        <div
          className="absolute right-0 top-0 bottom-0 z-50"
          style={{
            width: `${drawerWidth}%`,
            transform: drawerEntered ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group/handle"
          >
            <div className="absolute inset-y-0 left-0 w-[2px] bg-transparent group-hover/handle:bg-blue-400 transition-colors" />
          </div>
          <MediaDetailDocument
            campaign={campaign}
            mediaType={(openMediaDetail ?? closingMediaRef.current)!}
            allocation={getAllocation((openMediaDetail ?? closingMediaRef.current)!)}
            bid={bids.find((b) => b.mediaType === (openMediaDetail ?? closingMediaRef.current))}
            onClose={handleCloseDrawer}
            onAllocationChange={(v) => handleAllocationChange((openMediaDetail ?? closingMediaRef.current)!, v)}
            onBidChange={(patch) => handleBidChange((openMediaDetail ?? closingMediaRef.current)!, patch)}
          />
        </div>
      )}

      {/* Drawer de segmentação */}
      {(showSegmentDrawer || segDrawerClosing) && (
        <div
          className="absolute right-0 top-0 bottom-0 z-50"
          style={{
            width: `${drawerWidth}%`,
            transform: segDrawerEntered ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <div className="h-full flex flex-col bg-white border-l shadow-[0px_24px_48px_rgba(0,0,0,0.16)]" style={{ borderColor: '#e1e1e1' }}>
            <div className="shrink-0 flex items-center justify-between px-5 h-[64px] border-b-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCloseSegmentDrawer}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-[color:var(--sl-fg-base-soft)] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <span className="font-semibold text-[20px] tracking-[-0.45px] text-[color:var(--sl-fg-base)]">Segmentação</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-xs uppercase tracking-[0.5px] text-[color:var(--sl-fg-base-muted)] font-medium mb-3">Selecione um segmento</p>
              <div className="flex flex-col gap-2">
                {SEGMENTS.map((seg) => {
                  const isSelected = segment === seg.label;
                  const maxBase = Math.max(...SEGMENTS.map((s) => s.base));
                  const pct = (seg.base / maxBase) * 100;
                  const fmtBase = seg.base >= 1_000_000
                    ? `${(seg.base / 1_000_000).toFixed(1).replace('.', ',')}M`
                    : seg.base >= 1_000
                    ? `${(seg.base / 1_000).toFixed(1).replace('.', ',')}K`
                    : String(seg.base);

                  return (
                    <button
                      key={seg.label}
                      type="button"
                      onClick={() => { setSegment(seg.label); handleCloseSegmentDrawer(); }}
                      className={`relative flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left overflow-hidden ${
                        isSelected
                          ? 'border-[#1f1f1f] bg-[#fafafa]'
                          : 'border-[#e5e5e5] hover:border-[#ccc] bg-white'
                      }`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 transition-all ${isSelected ? 'bg-[#1f1f1f]/[0.05]' : 'bg-[#f5f5f5]'}`}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center gap-3 flex-1 min-w-0 z-[1]">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'bg-[#1f1f1f] text-white' : 'bg-[#f0f0f0] text-[color:var(--sl-fg-base-soft)]'
                        }`}>
                          <span className="material-symbols-outlined text-[18px]">{seg.icon}</span>
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className={`text-sm font-medium tracking-[-0.14px] ${isSelected ? 'text-[color:var(--sl-fg-base)]' : 'text-[#444]'}`}>{seg.label}</span>
                          <span className="text-xs text-[color:var(--sl-fg-base-muted)] truncate">{seg.desc}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span className={`text-sm font-semibold tabular-nums tracking-[-0.14px] ${isSelected ? 'text-[color:var(--sl-fg-base)]' : 'text-[#555]'}`}>{fmtBase}</span>
                          <span className="text-[11px] text-[color:var(--sl-fg-base-muted)]">pessoas</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Subcomponentes ─── */

const PropertyRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-center gap-1 py-1.5">
    <div className="w-[160px] shrink-0">
      <span className="text-sm font-semibold leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{label}</span>
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const getCommentHighlightClasses = (hasComments: boolean, isActive: boolean) => {
  if (isActive) return 'bg-[#e0f0ff] ring-1 ring-[#7bb7ff]/70';
  if (hasComments) return 'bg-[#e9f4ff] ring-1 ring-[#c4dfff]';
  return '';
};

interface CommentableFieldProps {
  targetId: string;
  targetLabel: string;
  hasComments: boolean;
  commentCount: number;
  isActive: boolean;
  onOpenThread: (targetId: string, label?: string) => void;
  children: React.ReactNode;
  className?: string;
  /** Cantos do destaque de comentário; false = retos (ex. linhas da tabela de investimento). */
  highlightRounded?: boolean;
}

/** 8px para fora da borda direita da coluna de conteúdo (gutter estilo Notion). */
const COMMENT_BTN_GUTTER_CLASS =
  'absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2';

const CommentableField: React.FC<CommentableFieldProps> = ({
  targetId,
  targetLabel,
  hasComments,
  commentCount,
  isActive,
  onOpenThread,
  children,
  className,
  highlightRounded = true,
}) => {
  const [hovered, setHovered] = useState(false);
  /** Com thread: ícone + contagem sempre visíveis; sem thread: só no hover (gutter Notion). */
  const showBtn = hovered || hasComments;
  const rootRef = useRef<HTMLDivElement>(null);
  const lastClientYRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const syncHoverToPointerY = useCallback(() => {
    const el = rootRef.current;
    const y = lastClientYRef.current;
    if (!el || y === null) return;
    const r = el.getBoundingClientRect();
    setHovered(y >= r.top && y <= r.bottom);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      lastClientYRef.current = e.clientY;
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        syncHoverToPointerY();
      });
    };
    const onScroll = () => {
      syncHoverToPointerY();
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [syncHoverToPointerY]);

  useEffect(() => {
    const onLeaveDoc = () => setHovered(false);
    document.documentElement.addEventListener('mouseleave', onLeaveDoc);
    return () => document.documentElement.removeEventListener('mouseleave', onLeaveDoc);
  }, []);

  return (
    <div
      ref={rootRef}
      data-comment-target={targetId}
      className={`relative overflow-visible ${className ?? ''}`}
    >
      <div
        className={`${highlightRounded ? 'rounded-[10px]' : 'rounded-none'} transition-colors w-full min-w-0 ${getCommentHighlightClasses(hasComments, isActive)}`}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => onOpenThread(targetId, targetLabel)}
        className={`${COMMENT_BTN_GUTTER_CLASS} inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-opacity duration-150 bg-white border-[#e4e4e7] text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] ${
          showBtn ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-label="Abrir thread de comentários"
        title="Comentar elemento"
        tabIndex={showBtn ? 0 : -1}
      >
        <span className="material-symbols-outlined text-[14px]">comment</span>
        {hasComments && <span className="tabular-nums">{commentCount}</span>}
      </button>
    </div>
  );
};

const SmallIconBtn: React.FC<{ icon: string; size?: number; onClick?: () => void }> = ({ icon, size = 24, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="min-w-8 min-h-8 w-8 h-8 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0] transition-colors"
  >
    <span className="material-symbols-outlined" style={{ fontSize: size }}>{icon}</span>
  </button>
);

/* ─── DateRangePicker ─── */

const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const isBetween = (d: Date, start: Date, end: Date) => {
  const t = d.getTime();
  return t > start.getTime() && t < end.getTime();
};

const fmtShortDate = (d: Date) =>
  `${d.getDate()} ${MONTHS_PT[d.getMonth()].slice(0, 3).toLowerCase()} ${d.getFullYear()}`;

const DateRangePicker: React.FC<{
  startDate: Date;
  endDate: Date;
  onStartChange: (d: Date) => void;
  onEndChange: (d: Date) => void;
}> = ({ startDate, endDate, onStartChange, onEndChange }) => {
  const [open, setOpen] = useState(false);
  const [noEndDate, setNoEndDate] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date(startDate.getFullYear(), startDate.getMonth(), 1));
  const [selecting, setSelecting] = useState<'start' | 'end'>('start');
  const [hovered, setHovered] = useState<Date | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setViewDate(new Date(startDate.getFullYear(), startDate.getMonth(), 1));
      setSelecting('start');
      setHovered(null);
    }
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const handleDayClick = (day: Date) => {
    if (selecting === 'start') {
      onStartChange(day);
      if (!noEndDate) {
        setSelecting('end');
        if (day.getTime() > endDate.getTime()) {
          const newEnd = new Date(day);
          newEnd.setDate(newEnd.getDate() + 7);
          onEndChange(newEnd);
        }
      }
    } else {
      if (day.getTime() < startDate.getTime()) {
        onStartChange(day);
      } else {
        onEndChange(day);
        setOpen(false);
      }
    }
  };

  const effectiveEnd = noEndDate ? null : endDate;
  const pillLabel = noEndDate
    ? `${fmtShortDate(startDate)} → Sem fim`
    : `${fmtShortDate(startDate)} → ${fmtShortDate(endDate)}`;

  const cells: { day: number; date: Date; current: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    const d = prevMonthDays - firstDay + 1 + i;
    cells.push({ day: d, date: new Date(year, month - 1, d), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, date: new Date(year, month, d), current: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ day: d, date: new Date(year, month + 1, d), current: false });
    }
  }

  const getClass = (date: Date, current: boolean) => {
    const isStart = isSameDay(date, startDate);
    const isEnd = effectiveEnd && isSameDay(date, effectiveEnd);
    const inRange = effectiveEnd && isBetween(date, startDate, effectiveEnd);
    const isHoverEnd = selecting === 'end' && hovered && !noEndDate && isSameDay(date, hovered);
    const inHoverRange = selecting === 'end' && hovered && !noEndDate && date.getTime() > startDate.getTime() && date.getTime() < hovered.getTime();

    if (isStart || isEnd) return 'bg-[#1f1f1f] text-white font-medium';
    if (isHoverEnd) return 'bg-[#1f1f1f]/80 text-white font-medium';
    if (inRange) return 'bg-[#f0f0f0] text-[color:var(--sl-fg-base)]';
    if (inHoverRange) return 'bg-[#f5f5f5] text-[color:var(--sl-fg-base)]';
    if (!current) return 'text-[color:var(--sl-fg-base-muted)]';
    return 'text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0]';
  };

  const getRound = (date: Date) => {
    const isStart = isSameDay(date, startDate);
    const isEnd = effectiveEnd && isSameDay(date, effectiveEnd);
    if (isStart && isEnd) return 'rounded-full';
    if (isStart) return 'rounded-l-full';
    if (isEnd) return 'rounded-r-full';
    return '';
  };

  const getBgStrip = (date: Date) => {
    const isStart = isSameDay(date, startDate);
    const isEnd = effectiveEnd && isSameDay(date, effectiveEnd);
    if (isStart || isEnd) return '';
    const inRange = effectiveEnd && isBetween(date, startDate, effectiveEnd);
    if (inRange) return 'bg-[#f0f0f0]';
    return '';
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#f8f8f8] hover:bg-[#ebebeb] transition-colors cursor-pointer"
      >
        <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{pillLabel}</span>
        <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-soft)]">expand_more</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1.5 bg-white rounded-2xl border shadow-xl z-50 w-[320px] overflow-hidden" style={{ borderColor: '#e0e0e0' }}>
          {/* Selection tabs */}
          <div className="flex border-b border-[#f0f0f0]">
            <button
              type="button"
              onClick={() => setSelecting('start')}
              className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                selecting === 'start' ? 'text-[color:var(--sl-fg-base)] border-b-2 border-[#1f1f1f]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]'
              }`}
            >
              <span className="block text-[10px] uppercase tracking-[0.5px] text-[color:var(--sl-fg-base-muted)] mb-0.5">Início</span>
              {fmtShortDate(startDate)}
            </button>
            <button
              type="button"
              onClick={() => { if (!noEndDate) setSelecting('end'); }}
              className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                noEndDate ? 'opacity-40 cursor-not-allowed' : selecting === 'end' ? 'text-[color:var(--sl-fg-base)] border-b-2 border-[#1f1f1f]' : 'text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)]'
              }`}
            >
              <span className="block text-[10px] uppercase tracking-[0.5px] text-[color:var(--sl-fg-base-muted)] mb-0.5">Fim</span>
              {noEndDate ? 'Sem fim' : fmtShortDate(endDate)}
            </button>
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <button type="button" onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] text-[color:var(--sl-fg-base-soft)] transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-sm font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.14px]">
              {MONTHS_PT[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] text-[color:var(--sl-fg-base-soft)] transition-colors">
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3">
            {WEEKDAYS_PT.map((d, i) => (
              <div key={i} className="h-8 flex items-center justify-center text-[11px] font-medium text-[color:var(--sl-fg-base-muted)]">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-3 pb-2">
            {cells.map(({ day, date, current }, i) => (
              <div key={i} className={`flex items-center justify-center h-[38px] ${getBgStrip(date)}`}>
                <button
                  type="button"
                  onClick={() => handleDayClick(date)}
                  onMouseEnter={() => setHovered(date)}
                  onMouseLeave={() => setHovered(null)}
                  className={`w-[38px] h-[38px] flex items-center justify-center text-[13px] transition-colors ${getClass(date, current)} ${getRound(date)}`}
                >
                  {day}
                </button>
              </div>
            ))}
          </div>

          {/* No end date toggle */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-t border-[#f0f0f0]">
            <button
              type="button"
              onClick={() => {
                setNoEndDate(!noEndDate);
                if (!noEndDate) setSelecting('start');
              }}
              className={`relative w-9 h-5 rounded-full transition-colors ${noEndDate ? 'bg-[#1f1f1f]' : 'bg-[#d9d9d9]'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${noEndDate ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-[13px] text-[#555]">Sem data fim</span>
          </div>
        </div>
      )}
    </div>
  );
};

const DropdownPill: React.FC<{
  value: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  options: string[];
  onSelect: (v: string) => void;
}> = ({ value, open, onToggle, onClose, options, onSelect }) => (
  <div className="relative inline-block">
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#f8f8f8] hover:bg-[#ebebeb] transition-colors cursor-pointer"
    >
      <span className="text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{value}</span>
      <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-soft)]">expand_more</span>
    </button>
    {open && (
      <DropdownMenu onClose={onClose}>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
              opt === value ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)] font-medium' : 'text-[color:var(--sl-fg-base)] hover:bg-black/[0.04]'
            }`}
          >
            {opt}
          </button>
        ))}
      </DropdownMenu>
    )}
  </div>
);

const DropdownMenu: React.FC<{ onClose: () => void; children: React.ReactNode; width?: number; alignRight?: boolean }> = ({ onClose, children, width = 200, alignRight = false }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={`absolute top-full mt-1 bg-white rounded-xl border shadow-lg z-50 py-1 overflow-hidden ${alignRight ? 'right-0' : 'left-0'}`}
      style={{ borderColor: '#e0e0e0', width, maxHeight: 320 }}
    >
      {children}
    </div>
  );
};

/** Linha editável (Investimento): máscara pt-BR; caret estável; Enter/Esc; colar valor. */
const EditableMoneyRow: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
}> = ({ label, value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const pendingCaretRef = useRef<{ s: number; e: number } | null>(null);
  const selectAllOnFocusRef = useRef(false);
  const decimals = 2;

  useLayoutEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus({ preventScroll: true });
    if (selectAllOnFocusRef.current) {
      selectAllOnFocusRef.current = false;
      inputRef.current.select();
      pendingCaretRef.current = null;
      return;
    }
    const p = pendingCaretRef.current;
    if (p) {
      pendingCaretRef.current = null;
      try {
        inputRef.current.setSelectionRange(p.s, p.e);
      } catch {
        /* ignore */
      }
    }
  }, [draft, editing]);

  const commit = () => {
    const t = draft.trim();
    if (t === '') {
      setDraft(formatBr(value, decimals));
      setEditing(false);
      return;
    }
    onChange(roundMoneyDecimals(clampMoney(parseMaskedMoneyFull(t, decimals)), decimals));
    setEditing(false);
  };

  const revert = () => {
    setDraft(formatBr(value, decimals));
    setEditing(false);
  };

  const startEditing = () => {
    setDraft(formatBr(value, decimals));
    selectAllOnFocusRef.current = true;
    setEditing(true);
  };

  const handleDraftChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    selectAllOnFocusRef.current = false;
    const raw = ev.target.value;
    const selStart = ev.target.selectionStart ?? 0;
    const selEnd = ev.target.selectionEnd ?? 0;
    const { text, selStart: nextStart, selEnd: nextEnd } = applyMoneyMask(raw, selStart, selEnd, decimals);
    pendingCaretRef.current = { s: nextStart, e: nextEnd };
    setDraft(text);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    selectAllOnFocusRef.current = false;
    const pasted = normalizeMoneyDraft(e.clipboardData.getData('text'));
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const merged = draft.slice(0, start) + pasted + draft.slice(end);
    const caret = start + pasted.length;
    const { text, selStart: ns, selEnd: ne } = applyMoneyMask(merged, caret, caret, decimals);
    pendingCaretRef.current = { s: ns, e: ne };
    setDraft(text);
  };

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      skipBlurCommitRef.current = true;
      commit();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      revert();
    }
  };

  const handleBlur = () => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    commit();
  };

  const hintId = `money-hint-row-${label.replace(/\s/g, '-')}`;

  return (
    <div className="flex items-center gap-5 py-3 border-b" style={{ borderColor: '#e0e0e0' }}>
      <div className="w-[240px] shrink-0">
        <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{label}</span>
      </div>
      <div className="flex-1 min-w-0">
        {editing ? (
          <>
            <span id={hintId} className="sr-only">
              Use vírgula para centavos. Enter confirma, Esc cancela.
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              spellCheck={false}
              aria-label={label}
              aria-describedby={hintId}
              value={draft}
              onChange={handleDraftChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className="box-border min-w-[12rem] w-max max-w-full rounded-lg border border-solid px-3 py-1.5 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/35 text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-blue-50/60 border-blue-200 caret-[color:var(--sl-fg-base)] whitespace-nowrap tabular-nums [field-sizing:content]"
            />
          </>
        ) : (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={startEditing}
            title="Editar valor (Enter confirma)"
            className="box-border min-w-[12rem] w-max max-w-full rounded-lg border border-solid px-3 py-1.5 outline-none text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-transparent border-transparent hover:bg-black/[0.04] text-left transition-colors cursor-text whitespace-nowrap tabular-nums"
          >
            {fmtMoney(value)}
          </button>
        )}
      </div>
    </div>
  );
};

/** Valor monetário editável (pt-BR): máscara; caret com useLayoutEffect; colar; área de toque maior. */
const EditableMoneyCell: React.FC<{
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  decimals?: number;
  size?: 'sm' | 'md' | 'compact' | 'compactAllocation';
  ariaLabel?: string;
}> = ({ value, onChange, suffix = '', decimals = 2, size = 'sm', ariaLabel = 'Valor monetário' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurCommitRef = useRef(false);
  const pendingCaretRef = useRef<{ s: number; e: number } | null>(null);
  const selectAllOnFocusRef = useRef(false);
  const cellShape =
    size === 'md'
      ? 'min-w-[12rem] rounded-md px-2 py-1 whitespace-nowrap tabular-nums w-max max-w-full [field-sizing:content]'
      : size === 'compactAllocation'
      ? 'w-full min-w-[6rem] max-w-[11rem] rounded-md px-2 py-1 whitespace-nowrap tabular-nums text-xs leading-4 [field-sizing:content]'
      : size === 'compact'
      ? 'w-full min-w-[5.75rem] max-w-[9rem] rounded-md px-2 py-1 whitespace-nowrap tabular-nums text-xs leading-4 [field-sizing:content]'
      : 'min-w-[6.5rem] rounded-md px-2 py-1 whitespace-nowrap tabular-nums w-max max-w-full [field-sizing:content]';

  useLayoutEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus({ preventScroll: true });
    if (selectAllOnFocusRef.current) {
      selectAllOnFocusRef.current = false;
      inputRef.current.select();
      pendingCaretRef.current = null;
      return;
    }
    const p = pendingCaretRef.current;
    if (p) {
      pendingCaretRef.current = null;
      try {
        inputRef.current.setSelectionRange(p.s, p.e);
      } catch {
        /* ignore */
      }
    }
  }, [draft, editing]);

  const commit = () => {
    const t = draft.trim();
    if (t === '') {
      setDraft(formatBr(value, decimals));
      setEditing(false);
      return;
    }
    onChange(roundMoneyDecimals(clampMoney(parseMaskedMoneyFull(t, decimals)), decimals));
    setEditing(false);
  };

  const revert = () => {
    setDraft(formatBr(value, decimals));
    setEditing(false);
  };

  const startEditing = () => {
    setDraft(formatBr(value, decimals));
    selectAllOnFocusRef.current = true;
    setEditing(true);
  };

  const handleDraftChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    selectAllOnFocusRef.current = false;
    const raw = ev.target.value;
    const selStart = ev.target.selectionStart ?? 0;
    const selEnd = ev.target.selectionEnd ?? 0;
    const { text, selStart: nextStart, selEnd: nextEnd } = applyMoneyMask(raw, selStart, selEnd, decimals);
    pendingCaretRef.current = { s: nextStart, e: nextEnd };
    setDraft(text);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    selectAllOnFocusRef.current = false;
    const pasted = normalizeMoneyDraft(e.clipboardData.getData('text'));
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const merged = draft.slice(0, start) + pasted + draft.slice(end);
    const caret = start + pasted.length;
    const { text, selStart: ns, selEnd: ne } = applyMoneyMask(merged, caret, caret, decimals);
    pendingCaretRef.current = { s: ns, e: ne };
    setDraft(text);
  };

  const handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      skipBlurCommitRef.current = true;
      commit();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      revert();
    }
  };

  const handleBlur = () => {
    if (skipBlurCommitRef.current) {
      skipBlurCommitRef.current = false;
      return;
    }
    commit();
  };

  const hintId = `money-hint-${String(ariaLabel).replace(/\s/g, '-')}`;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex flex-col justify-center shrink-0 ${
        size === 'compact' || size === 'compactAllocation'
          ? `w-full min-w-0 ${size === 'compactAllocation' ? 'max-w-[11rem]' : 'max-w-[9rem]'}`
          : 'w-max max-w-full'
      }`}
    >
      {editing ? (
        <>
          <span id={hintId} className="sr-only">
            Vírgula para centavos. Enter confirma, Esc cancela.
          </span>
          <input
            ref={inputRef}
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            spellCheck={false}
            aria-label={ariaLabel}
            aria-describedby={hintId}
            value={draft}
            onChange={handleDraftChange}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={`box-border border border-solid outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/35 text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-blue-50/60 border-blue-200 caret-[color:var(--sl-fg-base)] ${cellShape}`}
          />
        </>
      ) : (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={startEditing}
          title="Editar valor"
          className={`box-border border border-solid outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/30 text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)] bg-transparent border-transparent hover:bg-black/[0.04] text-left transition-colors cursor-text ${cellShape}`}
        >
          {formatBr(value, decimals)}
          {suffix ? ` ${suffix}` : ''}
        </button>
      )}
    </div>
  );
};

const MediaRow: React.FC<{
  mediaType: MediaType;
  commentId: string;
  commentLabel: string;
  hasComments: boolean;
  commentCount: number;
  isCommentActive: boolean;
  onOpenCommentThread: (targetId: string, label?: string) => void;
  allocation: number;
  bid?: { currentBid: number; suggestedBid: number };
  productCount: number;
  onAllocationChange?: (v: number) => void;
  onBidChange?: (patch: { currentBid?: number; suggestedBid?: number }) => void;
  onOpenDetail?: () => void;
  onRemove?: () => void;
}> = ({
  mediaType,
  commentId,
  commentLabel,
  hasComments,
  commentCount,
  isCommentActive,
  onOpenCommentThread,
  allocation,
  bid,
  productCount,
  onAllocationChange,
  onBidChange,
  onOpenDetail,
  onRemove,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const style = MEDIA_STYLES[mediaType] ?? { icon: 'campaign', bg: '#e0e0e0' };
  const labels = MEDIA_LABELS[mediaType] ?? { name: mediaType, bidLabel: 'CPC', desc: '{n} itens' };

  const stableCount = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < mediaType.length; i++) hash = ((hash << 5) - hash + mediaType.charCodeAt(i)) | 0;
    return (Math.abs(hash) % 4) + 2;
  }, [mediaType]);

  const descText = mediaType === 'Produto patrocinado'
    ? labels.desc.replace('{n}', String(productCount))
    : mediaType === 'Instore display'
    ? labels.desc.replace('{n}', '32')
    : labels.desc.replace('{n}', String(stableCount));

  const showSecondBid = mediaType === 'Marca patrocinada' || mediaType === 'Banner Patrocinado Offsite';
  const canEdit = Boolean(onAllocationChange || onBidChange);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <CommentableField
      targetId={commentId}
      targetLabel={commentLabel}
      hasComments={hasComments}
      commentCount={commentCount}
      isActive={isCommentActive}
      onOpenThread={onOpenCommentThread}
      className="block w-full min-w-0 py-1"
    >
      <div
        onClick={onOpenDetail}
        className={`flex w-full min-w-0 max-w-full items-center gap-3 rounded-xl border pl-4 pr-2.5 py-4 group transition-colors box-border ${onOpenDetail ? 'cursor-pointer hover:bg-black/[0.02]' : ''}`}
        style={{ borderColor: 'rgba(0,0,0,0.1)', boxShadow: '0 1px 1px rgba(0,0,0,0.08)' }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0 max-w-full">
          <div className="flex items-center gap-3 w-[240px] shrink-0 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: style.bg }}>
              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]/60">{style.icon}</span>
            </div>
            <div className="flex flex-col justify-center whitespace-nowrap">
              <span className="font-medium text-sm leading-5 tracking-[-0.14px] text-[color:var(--sl-fg-base)]">{labels.name}</span>
              <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)]">{descText}</span>
            </div>
          </div>
          {/* Grid fixo: alocação alinhada à esquerda em todas as linhas; CPC/CPM com mesma largura (cliques nas células não abrem a drawer — stop no EditableMoneyCell) */}
          <div className="grid flex-1 min-w-0 grid-cols-[minmax(0,1fr)_4.75rem_4.75rem] gap-x-2 sm:gap-x-3 items-start">
            <div className="flex flex-col justify-center min-w-0 items-start text-left">
              <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)] pl-1">Alocação total</span>
              {canEdit && onAllocationChange ? (
                <EditableMoneyCell
                  value={allocation}
                  onChange={onAllocationChange}
                  suffix="BRL"
                  size="compactAllocation"
                  ariaLabel={`Alocação total em reais, ${labels.name}`}
                />
              ) : (
                <span className="text-xs leading-4 tracking-[-0.14px] text-[color:var(--sl-fg-base)] tabular-nums max-w-[10rem] truncate">
                  {fmtMoney(allocation)}
                </span>
              )}
            </div>
            <div className="w-[4.75rem] min-w-[4.75rem] max-w-[4.75rem] flex flex-col justify-center items-start">
              {bid && labels.bidLabel ? (
                <>
                  <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)] truncate w-full pl-1">{labels.bidLabel}</span>
                  {canEdit && onBidChange ? (
                    <EditableMoneyCell
                      value={bid.currentBid}
                      onChange={(v) => onBidChange({ currentBid: v })}
                      suffix="BRL"
                      size="compact"
                      ariaLabel={`${labels.bidLabel} em reais, ${labels.name}`}
                    />
                  ) : (
                    <span className="text-xs leading-4 tracking-[-0.14px] text-[color:var(--sl-fg-base)] tabular-nums max-w-[4.75rem] truncate">
                      {formatBr(bid.currentBid)} BRL
                    </span>
                  )}
                </>
              ) : (
                <div className="min-h-[2.75rem] w-full flex flex-col justify-end" aria-hidden>
                  <span className="invisible text-xs leading-4 select-none">CPM</span>
                  <span className="invisible text-xs tabular-nums">0</span>
                </div>
              )}
            </div>
            <div className="w-[4.75rem] min-w-[4.75rem] max-w-[4.75rem] flex flex-col justify-center items-start">
              {bid && showSecondBid ? (
                <>
                  <span className="text-xs leading-4 text-[color:var(--sl-fg-base-soft)] pl-1">CPM</span>
                  {canEdit && onBidChange ? (
                    <EditableMoneyCell
                      value={bid.suggestedBid}
                      onChange={(v) => onBidChange({ suggestedBid: v })}
                      suffix="BRL"
                      size="compact"
                      ariaLabel={`CPM em reais, ${labels.name}`}
                    />
                  ) : (
                    <span className="text-xs leading-4 tracking-[-0.14px] text-[color:var(--sl-fg-base)] tabular-nums max-w-[4.75rem] truncate">
                      {formatBr(bid.suggestedBid)} BRL
                    </span>
                  )}
                </>
              ) : (
                <div className="min-h-[2.75rem] w-full flex flex-col justify-end" aria-hidden>
                  <span className="invisible text-xs leading-4 select-none">CPM</span>
                  <span className="invisible text-xs tabular-nums">0</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="relative shrink-0" onClick={stop} ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowMenu((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-black/[0.06] opacity-0 group-hover:opacity-100 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 bg-white rounded-xl border shadow-lg z-50 py-1 overflow-hidden w-[160px]"
              style={{ borderColor: '#e0e0e0' }}
            >
              {onOpenDetail && (
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onOpenDetail(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--sl-fg-base)] hover:bg-black/[0.04] transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)]">edit</span>
                  Editar
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  onClick={() => { setShowMenu(false); onRemove(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--sl-fg-base-soft)] hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  Apagar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </CommentableField>
  );
};
