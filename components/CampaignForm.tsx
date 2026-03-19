import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Campaign, CampaignStatus, MediaType, Product } from '../types';
import { ALL_MEDIA_TYPES, calculateOverallStrength, MONTH_NAMES_PT } from '../constants';

type CampaignStrategy = 'Indefinida' | 'Alcance' | 'Crescimento' | 'Rentabilidade' | 'Novos compradores';
type AllocationType = 'Inteligente' | 'Manual';
type AllocationFrequency = 'Única' | 'Diária';
type SpendingPace = 'Conforme a demanda' | 'Distribuído igualmente';
type FormStep = 'estrategia' | 'data' | 'publishers' | 'produtos' | 'investimento' | 'segmentacao' | 'plano_midia';

const formatBRL = (value: number): string => {
  if (!value) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseBRL = (text: string): number => {
  const cleaned = text.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const CurrencyInput: React.FC<{
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  className?: string;
}> = ({ value, onChange, placeholder, className }) => {
  const [display, setDisplay] = useState(() => formatBRL(value));
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setDisplay(formatBRL(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { setDisplay(''); onChange(0); return; }
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) { setDisplay(''); onChange(0); return; }
    const cents = parseInt(digits, 10);
    const numValue = cents / 100;
    setDisplay(formatBRL(numValue));
    onChange(numValue);
  };

  const handleBlur = () => {
    setDisplay(formatBRL(value));
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};

interface CampaignFormProps {
  campaign: Campaign;
  allCampaigns?: Campaign[];
  onClose: () => void;
  onSave: (updatedCampaign: Campaign) => void;
}

const STRATEGY_OPTIONS: { id: CampaignStrategy; icon: string; iconBg: string; description: string }[] = [
  { id: 'Indefinida', icon: 'tune', iconBg: 'bg-blue-100 text-[color:var(--sl-fg-base-soft)]', description: 'A plataforma não aplicará um foco de otimização específico.' },
  { id: 'Alcance', icon: 'campaign', iconBg: 'bg-blue-100 text-[color:var(--sl-fg-base-soft)]', description: 'Maximize visibilidade e frequência para o maior número de pessoas dentro do público.' },
  { id: 'Crescimento', icon: 'trending_up', iconBg: 'bg-blue-100 text-[color:var(--sl-fg-base-soft)]', description: 'Aumente vendas e participação da marca na categoria, expandindo volume com eficiência.' },
  { id: 'Rentabilidade', icon: 'savings', iconBg: 'bg-blue-100 text-[color:var(--sl-fg-base-soft)]', description: 'Priorize retorno: foque em ROAS/ACOS e em conversões com melhor custo.' },
  { id: 'Novos compradores', icon: 'person_add', iconBg: 'bg-blue-100 text-[color:var(--sl-fg-base-soft)]', description: 'Encontre novos públicos e aumente a base de clientes, priorizando first-time buyers.' },
];

const SIDEBAR_SECTIONS: { key: FormStep; label: string }[] = [
  { key: 'estrategia', label: 'Estratégia' },
  { key: 'data', label: 'Data' },
  { key: 'publishers', label: 'Publishers' },
  { key: 'investimento', label: 'Investimento' },
  { key: 'produtos', label: 'Produtos' },
  { key: 'segmentacao', label: 'Segmentação' },
  { key: 'plano_midia', label: 'Plano de mídia' },
];

const MEDIA_TYPE_META: Record<string, { color: string; icon: string; subtitle: string; pricing?: string }> = {
  'Produto patrocinado': { color: '#ffc8dc', icon: 'shopping_bag', subtitle: 'Destaque SKUs nos resultados de busca do varejista', pricing: 'CPC' },
  'Banner patrocinado': { color: '#ffc8dc', icon: 'ad_units', subtitle: 'Banners em posições premium dentro do e-commerce', pricing: 'CPM' },
  'Marca patrocinada': { color: '#ffc8dc', icon: 'branding_watermark', subtitle: 'Vitrine de marca com vídeo e produtos em destaque', pricing: 'CPC' },
  'Video': { color: '#ffc8dc', icon: 'play_circle', subtitle: 'Anúncios em vídeo nas páginas do varejista', pricing: 'CPM' },
  'Banner Patrocinado Offsite': { color: '#f5eafe', icon: 'public', subtitle: 'Banners fora do e-commerce usando audiência do varejista', pricing: 'CPC' },
  'Instore display': { color: '#cefdc0', icon: 'desktop_windows', subtitle: 'Telas digitais nas lojas físicas do varejista' },
};

const ALLOCATION_OPTIONS: AllocationType[] = ['Inteligente', 'Manual'];
const ALLOCATION_FREQUENCY_OPTIONS: AllocationFrequency[] = ['Única', 'Diária'];
const SPENDING_PACE_OPTIONS: SpendingPace[] = ['Conforme a demanda', 'Distribuído igualmente'];

const ALLOCATION_LABEL_BY_FREQUENCY: Record<AllocationFrequency, string> = {
  'Única': 'Alocação única',
  'Diária': 'Média diária',
};

type PublisherMode = 'network' | 'specific';

interface CatalogPublisher {
  id: string;
  name: string;
  logoUrl: string;
  logoBg: string;
}

const publisherInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const PUBLISHER_CATALOG: CatalogPublisher[] = [
  { id: 'pub1', name: 'Casas Bahia', logoUrl: '', logoBg: '#003399' },
  { id: 'pub2', name: 'Americanas', logoUrl: '', logoBg: '#e60014' },
  { id: 'pub3', name: 'Cencosud', logoUrl: '', logoBg: '#D4213D' },
  { id: 'pub4', name: 'Carrefour', logoUrl: '', logoBg: '#004E9A' },
  { id: 'pub5', name: 'KaBuM!', logoUrl: '', logoBg: '#FF6500' },
  { id: 'pub6', name: 'Pernambucanas', logoUrl: '', logoBg: '#e2001a' },
  { id: 'pub7', name: 'Livelo', logoUrl: '', logoBg: '#6B2D8B' },
  { id: 'pub8', name: 'Magazine Luiza', logoUrl: '', logoBg: '#0086FF' },
  { id: 'pub9', name: 'Mercado Livre', logoUrl: '', logoBg: '#FFE600' },
  { id: 'pub10', name: 'Amazon', logoUrl: '', logoBg: '#FF9900' },
];

interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  imageUrl: string;
}

const APPLE_IMG = (slug: string) => `https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/${slug}?wid=400&hei=400&fmt=png-alpha`;

const PRODUCT_CATALOG: CatalogProduct[] = [
  // iPhones
  { id: 'c1', name: 'iPhone 16 Pro Max', sku: 'MYW53', imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium') },
  { id: 'c2', name: 'iPhone 16 Pro', sku: 'MYW23', imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-3inch-deserttitanium') },
  { id: 'c3', name: 'iPhone 16', sku: 'MYE13', imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-1inch-ultramarine') },
  { id: 'c4', name: 'iPhone 16 Plus', sku: 'MYW73', imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-7inch-ultramarine') },
  { id: 'c5', name: 'iPhone 16e', sku: 'MYE43', imageUrl: APPLE_IMG('iphone-16e-finish-select-202502-black') },
  { id: 'c6', name: 'iPhone 15', sku: 'MTP03', imageUrl: APPLE_IMG('iphone-15-finish-select-202309-6-1inch-black') },
  // Macs
  { id: 'c7', name: 'MacBook Pro 16"', sku: 'CTO16', imageUrl: APPLE_IMG('mbp16-spaceblack-select-202410') },
  { id: 'c8', name: 'MacBook Pro 14"', sku: 'CTO14', imageUrl: APPLE_IMG('mbp14-spaceblack-select-202410') },
  { id: 'c9', name: 'MacBook Air 15"', sku: 'MRYQ3', imageUrl: APPLE_IMG('mba15-midnight-select-202306') },
  { id: 'c10', name: 'MacBook Air 13"', sku: 'CTO13A', imageUrl: APPLE_IMG('mba13-midnight-select-202402') },
  { id: 'c11', name: 'iMac 24"', sku: 'CTO24', imageUrl: APPLE_IMG('imac-color-unselect-202601-gallery-1') },
  { id: 'c12', name: 'Mac Mini', sku: 'CTOMM', imageUrl: APPLE_IMG('mac-mini-chip-unselect-202601-gallery-1') },
  { id: 'c13', name: 'Mac Studio', sku: 'CTOMS', imageUrl: APPLE_IMG('mac-studio-select-202503') },
  // iPads
  { id: 'c14', name: 'iPad Pro 13" M4', sku: 'MW5E3', imageUrl: APPLE_IMG('ipad-pro-13-select-wifi-spaceblack-202405') },
  { id: 'c15', name: 'iPad Pro 11" M4', sku: 'MW5F3', imageUrl: APPLE_IMG('ipad-pro-11-select-wifi-spaceblack-202405') },
  { id: 'c16', name: 'iPad Air 13"', sku: 'MURF3', imageUrl: APPLE_IMG('ipad-air-finish-select-gallery-202405-13inch-blue-wifi') },
  { id: 'c17', name: 'iPad Air 11"', sku: 'MURG3', imageUrl: APPLE_IMG('ipad-air-finish-select-gallery-202405-11inch-blue-wifi') },
  { id: 'c18', name: 'iPad 10ª geração', sku: 'MPQ03', imageUrl: APPLE_IMG('ipad-2022-hero-blue-wifi-select') },
  { id: 'c19', name: 'iPad mini', sku: 'MUV93', imageUrl: APPLE_IMG('ipad-mini-select-wifi-blue-202410') },
  // Wearables & Audio
  { id: 'c20', name: 'Apple Watch Ultra 2', sku: 'MQDY3', imageUrl: APPLE_IMG('ultra-case-unselect-gallery-1-202409') },
  { id: 'c21', name: 'Apple Watch Series 10', sku: 'MQE03', imageUrl: APPLE_IMG('s10-case-unselect-gallery-1-202409') },
  { id: 'c22', name: 'AirPods Pro 2', sku: 'MTJV3', imageUrl: APPLE_IMG('airpods-pro-2-hero-select-202409') },
  { id: 'c23', name: 'AirPods Max', sku: 'MQTP3', imageUrl: APPLE_IMG('airpods-max-select-202409-midnight') },
  { id: 'c24', name: 'AirPods 4', sku: 'MPJH3', imageUrl: APPLE_IMG('airpods-4-hero-select-202409') },
];

type SegmentDimension = 'keyword' | 'category' | 'brand' | 'price_range' | 'device' | 'region' | 'gender' | 'age';
type SegmentOperator = 'is' | 'is_not' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'between';
type ConditionGroupLogic = 'AND' | 'OR';

interface SegmentCondition {
  id: string;
  dimension: SegmentDimension | '';
  operator: SegmentOperator;
  value: string;
}

interface SegmentGroup {
  id: string;
  logic: ConditionGroupLogic;
  conditions: SegmentCondition[];
}

const OPERATOR_LABELS: Record<SegmentOperator, string> = {
  is: 'é',
  is_not: 'não é',
  contains: 'contém',
  not_contains: 'não contém',
  greater_than: 'maior que',
  less_than: 'menor que',
  between: 'entre',
};

const SEGMENT_DIMENSIONS: { key: SegmentDimension; label: string; operators: SegmentOperator[]; suggestions: string[] }[] = [
  { key: 'keyword', label: 'Palavra-chave', operators: ['is', 'is_not', 'contains', 'not_contains'], suggestions: ['iPhone', 'MacBook', 'iPad', 'AirPods', 'Apple Watch'] },
  { key: 'category', label: 'Categoria', operators: ['is', 'is_not'], suggestions: ['Smartphones', 'Notebooks', 'Tablets', 'Wearables', 'Áudio', 'Desktops'] },
  { key: 'brand', label: 'Marca', operators: ['is', 'is_not'], suggestions: ['Apple', 'Samsung', 'Xiaomi', 'Motorola', 'Dell'] },
  { key: 'price_range', label: 'Faixa de preço', operators: ['greater_than', 'less_than', 'between'], suggestions: ['1000', '3000', '5000', '10000'] },
  { key: 'device', label: 'Dispositivo', operators: ['is', 'is_not'], suggestions: ['Mobile', 'Desktop', 'Tablet'] },
  { key: 'region', label: 'Região', operators: ['is', 'is_not'], suggestions: ['Sudeste', 'Sul', 'Nordeste', 'Norte', 'Centro-Oeste'] },
  { key: 'gender', label: 'Gênero', operators: ['is', 'is_not'], suggestions: ['Masculino', 'Feminino', 'Todos'] },
  { key: 'age', label: 'Faixa etária', operators: ['is', 'between'], suggestions: ['18-24', '25-34', '35-44', '45-54', '55+'] },
];

let _segmentIdCounter = 0;
const makeCondition = (): SegmentCondition => ({
  id: `sc-${Date.now()}-${_segmentIdCounter++}`,
  dimension: '' as SegmentDimension | '',
  operator: 'is',
  value: '',
});

const makeGroup = (): SegmentGroup => ({
  id: `sg-${Date.now()}-${_segmentIdCounter++}`,
  logic: 'AND',
  conditions: [makeCondition()],
});

const toDate = (v: unknown): Date => {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
};

const isValidDate = (d: unknown): d is Date =>
  d instanceof Date && typeof (d as Date).getTime === 'function' && !isNaN((d as Date).getTime());

const normalizeCampaign = (c: Campaign): Campaign => ({
  ...c,
  mediaTypes: Array.isArray(c.mediaTypes) ? c.mediaTypes : [],
  products: Array.isArray(c.products) ? c.products : [],
  startDate: toDate(c.startDate),
  endDate: toDate(c.endDate),
});

const SectionStatusIcon: React.FC<{ status: 'completed' | 'pending' | 'error' }> = ({ status }) => {
  if (status === 'completed') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
        <mask id="mask_check" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
          <rect width="16" height="16" fill="#D9D9D9" />
        </mask>
        <g mask="url(#mask_check)">
          <path d="M6.36665 12.0001L2.56665 8.20007L3.51665 7.25007L6.36665 10.1001L12.4833 3.9834L13.4333 4.9334L6.36665 12.0001Z" fill="#1C1B1F" />
        </g>
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
        <rect x="1.83496" y="1.83496" width="12.33" height="12.33" rx="6.165" stroke="#EC3727" strokeDasharray="2 2" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <rect x="1.83496" y="1.83496" width="12.33" height="12.33" rx="6.165" stroke="black" strokeDasharray="2 2" />
    </svg>
  );
};

export const CampaignForm: React.FC<CampaignFormProps> = ({ campaign, allCampaigns = [], onClose, onSave }) => {
  const [activeStep, setActiveStep] = useState<FormStep>('estrategia');
  const [strategy, setStrategy] = useState<CampaignStrategy>('Indefinida');
  const [formData, setFormData] = useState<Campaign>(() => normalizeCampaign(campaign));
  const [allocation, setAllocation] = useState<AllocationType>('Inteligente');
  const [allocationFrequency, setAllocationFrequency] = useState<AllocationFrequency>(() => {
    const c = normalizeCampaign(campaign);
    return c.budget > 0 ? 'Única' : 'Diária';
  });
  const [allocationAmount, setAllocationAmount] = useState(() => {
    const c = normalizeCampaign(campaign);
    return c.budget > 0 ? c.budget : 0;
  });
  const [spendingPace, setSpendingPace] = useState<SpendingPace>('Conforme a demanda');
  const [mediaBudgets, setMediaBudgets] = useState<Record<string, number>>(() => {
    const c = normalizeCampaign(campaign);
    const initial: Record<string, number> = {};
    (c.mediaTypes ?? []).forEach(mt => { initial[mt] = 0; });
    return initial;
  });

  /** Reserva de orçamento por publisher (só quando mode = specific). Chave = publisher id. */
  const [publisherBudgetReservations, setPublisherBudgetReservations] = useState<Record<string, number>>({});
  /** Toggle: ativar reserva por publisher. Se desativado, todos têm o mesmo budget total disponível. */
  const [reservaPorPublisherEnabled, setReservaPorPublisherEnabled] = useState(false);
  /** Publishers que o usuário escolheu para definir reserva; os demais compartilham o restante do orçamento. */
  const [publishersComReservaSelecionados, setPublishersComReservaSelecionados] = useState<CatalogPublisher[]>([]);
  const [showReservaPublisherPicker, setShowReservaPublisherPicker] = useState(false);
  const [reservaPublisherPickerClosing, setReservaPublisherPickerClosing] = useState(false);
  const [reservaPublisherPickerEntered, setReservaPublisherPickerEntered] = useState(false);
  const [reservaPublisherSearch, setReservaPublisherSearch] = useState('');
  const [reservaPublisherSearchResults, setReservaPublisherSearchResults] = useState<CatalogPublisher[] | null>(null);
  const [reservaPublisherSearchLoading, setReservaPublisherSearchLoading] = useState(false);

  const [targeting, setTargeting] = useState('Automática');
  const toggleBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [toggleIndicator, setToggleIndicator] = useState({ left: 0, width: 0 });
  const [segmentGroups, setSegmentGroups] = useState<SegmentGroup[]>([]);
  const [groupsLogic, setGroupsLogic] = useState<ConditionGroupLogic>('AND');
  const [publisherMode, setPublisherMode] = useState<PublisherMode>('network');
  const [selectedPublishers, setSelectedPublishers] = useState<CatalogPublisher[]>([]);
  const [showPublisherPicker, setShowPublisherPicker] = useState(false);
  const [publisherPickerClosing, setPublisherPickerClosing] = useState(false);
  const [publisherPickerEntered, setPublisherPickerEntered] = useState(false);
  const [publisherSearch, setPublisherSearch] = useState('');
  const [publisherSearchLoading, setPublisherSearchLoading] = useState(false);
  const [publisherSearchResults, setPublisherSearchResults] = useState<CatalogPublisher[] | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productPickerClosing, setProductPickerClosing] = useState(false);
  const [productPickerEntered, setProductPickerEntered] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [productSearchResults, setProductSearchResults] = useState<CatalogProduct[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [noEndDate, setNoEndDate] = useState(false);
  const [showMediaDrawer, setShowMediaDrawer] = useState(false);
  const [mediaDrawerClosing, setMediaDrawerClosing] = useState(false);
  const [mediaDrawerEntered, setMediaDrawerEntered] = useState(false);
  const [mediaAllocMode, setMediaAllocMode] = useState<Record<string, 'intelligent' | 'manual'>>({});
  const [mediaCpc, setMediaCpc] = useState<Record<string, number>>({});
  const [mediaCpm, setMediaCpm] = useState<Record<string, number>>({});
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [generationPhase, setGenerationPhase] = useState(0);
  const [recentlyAddedItems, setRecentlyAddedItems] = useState<Set<string>>(new Set());
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkAddClosing, setBulkAddClosing] = useState(false);
  const [bulkAddEntered, setBulkAddEntered] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResults, setBulkResults] = useState<{ found: CatalogProduct[]; notFound: string[]; alreadyAdded: CatalogProduct[] } | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [clearListConfirm, setClearListConfirm] = useState<'products' | 'publishers' | null>(null);
  const [clearListEntered, setClearListEntered] = useState(false);
  const [clearListClosing, setClearListClosing] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [submitErrors, setSubmitErrors] = useState<string[] | null>(null);
  const [submitErrorsEntered, setSubmitErrorsEntered] = useState(false);
  const [submitErrorsClosing, setSubmitErrorsClosing] = useState(false);
  const [mediaDetailOpen, setMediaDetailOpen] = useState<string | null>(null);
  const [mediaDetailEntered, setMediaDetailEntered] = useState(false);
  const [mediaDetailClosing, setMediaDetailClosing] = useState(false);
  const [mediaDetailDraft, setMediaDetailDraft] = useState<{
    allocMode: 'intelligent' | 'manual';
    budget: number;
    dailyBudget: number;
    cpc: number;
    cpm: number;
  } | null>(null);
  const mediaDetailInitialRef = useRef<typeof mediaDetailDraft>(null);
  const [mediaMenuOpen, setMediaMenuOpen] = useState<string | null>(null);
  const mediaMenuRef = useRef<HTMLDivElement>(null);

  const [offsitePublishers, setOffsitePublishers] = useState<Record<string, string[]>>({});
  const [offsiteSelectedVariation, setOffsiteSelectedVariation] = useState<Record<string, { publisher: string; retailer: string }>>({});
  const [offsiteBannerVariationMode, setOffsiteBannerVariationMode] = useState<Record<string, 'none' | 'publisher' | 'retailer' | 'both'>>({});
  const [offsiteBannerVariationMenuOpen, setOffsiteBannerVariationMenuOpen] = useState<string | null>(null);
  const [offsitePublishersDropdownOpen, setOffsitePublishersDropdownOpen] = useState(false);
  const offsitePublishersDropdownRef = useRef<HTMLDivElement>(null);

  const [bannerImages, setBannerImages] = useState<Record<string, { id: string; name: string; previewUrl: string; width: number; height: number }[]>>({});

  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const offsiteBannerFileInputRef = useRef<HTMLInputElement>(null);
  const [bannerDragOver, setBannerDragOver] = useState(false);
  const [bannerThumbMenu, setBannerThumbMenu] = useState<string | null>(null);
  const bannerThumbMenuRef = useRef<HTMLDivElement>(null);

  const [reorderDragId, setReorderDragId] = useState<string | null>(null);
  const reorderStateRef = useRef<{ mediaType: string; originalList: { id: string; name: string; previewUrl: string; width: number; height: number }[] } | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);

  const [showcaseData, setShowcaseData] = useState<Record<string, {
    logoImages: { id: string; name: string; previewUrl: string; width: number; height: number }[];
    mediaImages: { id: string; name: string; previewUrl: string; width: number; height: number }[];
    title: string;
    description: string;
    brandName: string;
  }>>({});
  const showcaseLogoInputRef = useRef<HTMLInputElement>(null);
  const showcaseMediaInputRef = useRef<HTMLInputElement>(null);
  const [showcaseLogoDragOver, setShowcaseLogoDragOver] = useState(false);
  const [showcaseMediaDragOver, setShowcaseMediaDragOver] = useState(false);
  const [showcaseReorderDragId, setShowcaseReorderDragId] = useState<string | null>(null);
  const showcaseReorderRef = useRef<{ mediaType: string; field: 'mediaImages'; originalList: { id: string; name: string; previewUrl: string; width: number; height: number }[] } | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  type DragType = 'move' | 'resize-start' | 'resize-end';
  interface DragState {
    type: DragType;
    startX: number;
    initialStartDate: Date;
    initialEndDate: Date;
    colWidth: number;
    hasMoved: boolean;
    currentDayDelta: number;
  }
  const [drag, setDrag] = useState<DragState | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(440);
  const sidebarDrag = useRef<{ startX: number; startW: number } | null>(null);

  const handleDividerPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    sidebarDrag.current = { startX: e.clientX, startW: sidebarWidth };
  };
  const handleDividerPointerMove = (e: React.PointerEvent) => {
    if (!sidebarDrag.current) return;
    const delta = e.clientX - sidebarDrag.current.startX;
    const newW = Math.max(280, Math.min(600, sidebarDrag.current.startW + delta));
    setSidebarWidth(newW);
  };
  const handleDividerPointerUp = () => {
    sidebarDrag.current = null;
  };

  const isNewCampaign = !campaign.title;

  const handlePillPointerDown = (e: React.PointerEvent, type: DragType, colWidth: number) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      type,
      startX: e.clientX,
      initialStartDate: new Date(formData.startDate),
      initialEndDate: new Date(formData.endDate),
      colWidth,
      hasMoved: false,
      currentDayDelta: 0,
    });
  };

  const handlePillPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const deltaX = e.clientX - drag.startX;
    const dayDelta = Math.round(deltaX / drag.colWidth);
    if (!drag.hasMoved && Math.abs(deltaX) > 4) {
      setDrag(prev => prev ? { ...prev, hasMoved: true, currentDayDelta: dayDelta } : null);
    } else if (drag.hasMoved) {
      setDrag(prev => prev ? { ...prev, currentDayDelta: dayDelta } : null);
    }
  };

  const handlePillPointerUp = () => {
    if (!drag) return;
    if (drag.hasMoved && drag.currentDayDelta !== 0) {
      const { type, initialStartDate, initialEndDate, currentDayDelta } = drag;
      const newStart = new Date(initialStartDate);
      const newEnd = new Date(initialEndDate);
      const durationDays = Math.round((initialEndDate.getTime() - initialStartDate.getTime()) / (1000 * 60 * 60 * 24));

      if (type === 'move') {
        newStart.setDate(newStart.getDate() + currentDayDelta);
        newEnd.setDate(newEnd.getDate() + currentDayDelta);
      } else if (type === 'resize-start') {
        const clamped = Math.min(currentDayDelta, durationDays - 1);
        newStart.setDate(newStart.getDate() + clamped);
      } else if (type === 'resize-end') {
        const clamped = Math.max(currentDayDelta, -(durationDays - 1));
        newEnd.setDate(newEnd.getDate() + clamped);
      }
      setFormData(prev => ({ ...prev, startDate: newStart, endDate: newEnd }));
    }
    setDrag(null);
  };

  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsVisible(true));
    if (isNewCampaign) {
      setTimeout(() => titleInputRef.current?.focus(), 100);
    }
    return () => cancelAnimationFrame(timer);
  }, []);

  const updateToggleIndicator = useCallback(() => {
    const btn = toggleBtnRefs.current[targeting];
    if (btn) {
      const parent = btn.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const btnRect = btn.getBoundingClientRect();
        setToggleIndicator({
          left: btnRect.left - parentRect.left,
          width: btnRect.width,
        });
      }
    }
  }, [targeting]);

  useEffect(() => {
    if (activeStep === 'segmentacao') {
      const id = requestAnimationFrame(() => {
        updateToggleIndicator();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [activeStep, updateToggleIndicator]);

  const timelineScrollInitialized = useRef(false);
  useEffect(() => {
    if (!timelineScrollRef.current) return;
    const start = formData.startDate;
    const end = formData.endDate;
    if (!isValidDate(start) || !isValidDate(end) || end < start) return;
    const el = timelineScrollRef.current;
    const COL_W = 40;
    const marginDays = 7;
    const viewStart = new Date(start);
    viewStart.setDate(viewStart.getDate() - marginDays);
    const startX = Math.floor((start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)) * COL_W;
    const endX = Math.floor((end.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)) * COL_W + COL_W;
    const barCenter = (startX + endX) / 2;
    const targetScroll = Math.max(0, barCenter - el.clientWidth / 2);
    if (!timelineScrollInitialized.current) {
      requestAnimationFrame(() => { el.scrollLeft = targetScroll; });
      timelineScrollInitialized.current = true;
    } else {
      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
  }, [formData.startDate, formData.endDate]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setIsVisible(false);
    setTimeout(onClose, 350);
  }, [onClose]);

  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [statusDropdownOpen]);

  useEffect(() => {
    if (!mediaMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (mediaMenuRef.current && !mediaMenuRef.current.contains(e.target as Node)) {
        setMediaMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mediaMenuOpen]);

  useEffect(() => {
    if (!bannerThumbMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (bannerThumbMenuRef.current && !bannerThumbMenuRef.current.contains(e.target as Node)) {
        setBannerThumbMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bannerThumbMenu]);

  useEffect(() => {
    if (!offsitePublishersDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (offsitePublishersDropdownRef.current && !offsitePublishersDropdownRef.current.contains(e.target as Node)) {
        setOffsitePublishersDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [offsitePublishersDropdownOpen]);

  const offsiteBannerVariationMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offsiteBannerVariationMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (offsiteBannerVariationMenuRef.current && !offsiteBannerVariationMenuRef.current.contains(e.target as Node)) {
        setOffsiteBannerVariationMenuOpen(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [offsiteBannerVariationMenuOpen]);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const el = sidebarRef.current.querySelector(`[data-step="${activeStep}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeStep]);

  const handleSubmit = () => {
    const errors: string[] = [];
    if (!formData.title.trim()) errors.push('Defina um nome para a campanha.');
    if (isNaN(formData.startDate.getTime()) || isNaN(formData.endDate.getTime())) errors.push('Defina as datas de início e término.');
    else if (formData.endDate < formData.startDate) errors.push('A data de término deve ser posterior à de início.');
    if (formData.products.length === 0) errors.push('Adicione pelo menos um produto à campanha.');
    if (formData.mediaTypes.length === 0) errors.push('Selecione pelo menos um tipo de mídia.');
    if (formData.budget <= 0) errors.push('Defina o orçamento total da campanha.');
    if (budgetErrors.allocation) errors.push(budgetErrors.allocation);
    if (budgetErrors.reservaPorPublisher) errors.push(budgetErrors.reservaPorPublisher);
    if (hasMediaBudgetError) errors.push('A soma das alocações por mídia excede o orçamento total.');

    if (errors.length > 0) {
      setSubmitErrors(errors);
      setSubmitErrorsClosing(false);
      setSubmitErrorsEntered(false);
      requestAnimationFrame(() => setSubmitErrorsEntered(true));
      return;
    }
    onSave({ ...formData, budget: formData.budget || 0 });
    handleClose();
  };

  const closeSubmitErrors = useCallback(() => {
    setSubmitErrorsClosing(true);
    setSubmitErrorsEntered(false);
  }, []);

  useEffect(() => {
    if (!submitErrorsClosing) return;
    const id = setTimeout(() => {
      setSubmitErrors(null);
      setSubmitErrorsClosing(false);
    }, 240);
    return () => clearTimeout(id);
  }, [submitErrorsClosing]);

  const formatDate = (date: Date) => {
    if (!isValidDate(date)) return '—';
    return date.toLocaleDateString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    if (!value) return '—';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' BRL';
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newDate = value ? new Date(value + 'T12:00:00') : new Date('');
    setFormData(prev => ({ ...prev, [field]: newDate }));
  };

  const formatDateForInput = (date: Date) => {
    if (!isValidDate(date)) return '';
    return date.toISOString().split('T')[0];
  };

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleProductSearch = (query: string) => {
    setProductSearch(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setProductSearchLoading(false);
      setProductSearchResults(null);
      return;
    }
    setProductSearchLoading(true);
    setProductSearchResults(null);
    searchTimeoutRef.current = setTimeout(() => {
      const q = query.toLowerCase();
      const results = PRODUCT_CATALOG.filter(p => p.name.toLowerCase().includes(q));
      setProductSearchResults(results);
      setProductSearchLoading(false);
    }, 800);
  };

  const addProduct = (catalogProduct: CatalogProduct) => {
    const alreadyAdded = formData.products.some(p => p.id === catalogProduct.id);
    if (alreadyAdded) return;
    const id = catalogProduct.id;
    const newProduct: Product = { id, name: catalogProduct.name, imageUrl: catalogProduct.imageUrl };
    setRecentlyAddedItems(prev => new Set(prev).add(id));
    setFormData(prev => ({ ...prev, products: [...prev.products, newProduct] }));
    setToast('Produto adicionado à lista');
    setTimeout(() => setToast(null), 2500);
    setTimeout(() => setRecentlyAddedItems(prev => { const next = new Set(prev); next.delete(id); return next; }), 300);
  };

  const removeProduct = (productId: string) => {
    setFormData(prev => ({ ...prev, products: prev.products.filter(p => p.id !== productId) }));
  };

  const clearProducts = () => {
    setFormData(prev => ({ ...prev, products: [] }));
  };

  const handleClearListConfirm = () => {
    if (clearListConfirm === 'products') clearProducts();
    else if (clearListConfirm === 'publishers') clearPublishers();
    closeClearListDialog();
  };

  const openClearListDialog = (type: 'products' | 'publishers') => {
    setClearListConfirm(type);
    setClearListClosing(false);
    setClearListEntered(false);
    requestAnimationFrame(() => setClearListEntered(true));
  };

  const closeClearListDialog = useCallback(() => {
    setClearListClosing(true);
    setClearListEntered(false);
  }, []);

  useEffect(() => {
    if (!clearListClosing) return;
    const id = setTimeout(() => {
      setClearListConfirm(null);
      setClearListClosing(false);
    }, 240);
    return () => clearTimeout(id);
  }, [clearListClosing]);

  const openProductPicker = () => {
    setShowProductPicker(true);
    setProductSearch('');
    setProductSearchResults(null);
    setProductSearchLoading(false);
  };

  const publisherSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reservaPublisherSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleReservaPublisherSearch = (query: string) => {
    setReservaPublisherSearch(query);
    if (reservaPublisherSearchTimeoutRef.current) clearTimeout(reservaPublisherSearchTimeoutRef.current);
    if (!query.trim()) {
      setReservaPublisherSearchLoading(false);
      setReservaPublisherSearchResults(null);
      return;
    }
    setReservaPublisherSearchLoading(true);
    setReservaPublisherSearchResults(null);
    reservaPublisherSearchTimeoutRef.current = setTimeout(() => {
      const pool = publisherMode === 'network' ? PUBLISHER_CATALOG : selectedPublishers;
      const results = pool.filter(p => p.name.toLowerCase().includes(query.toLowerCase().trim()));
      setReservaPublisherSearchResults(results);
      setReservaPublisherSearchLoading(false);
    }, 600);
  };

  const handlePublisherSearch = (query: string) => {
    setPublisherSearch(query);
    if (publisherSearchTimeoutRef.current) clearTimeout(publisherSearchTimeoutRef.current);
    if (!query.trim()) {
      setPublisherSearchLoading(false);
      setPublisherSearchResults(null);
      return;
    }
    setPublisherSearchLoading(true);
    setPublisherSearchResults(null);
    publisherSearchTimeoutRef.current = setTimeout(() => {
      const q = query.toLowerCase();
      const results = PUBLISHER_CATALOG.filter(p => p.name.toLowerCase().includes(q));
      setPublisherSearchResults(results);
      setPublisherSearchLoading(false);
    }, 600);
  };

  const addPublisher = (pub: CatalogPublisher) => {
    if (selectedPublishers.some(p => p.id === pub.id)) return;
    const id = pub.id;
    setRecentlyAddedItems(prev => new Set(prev).add(id));
    setSelectedPublishers(prev => [...prev, pub]);
    setFormData(prev => ({ ...prev, publisher: prev.publisher ? prev.publisher : pub.name }));
    setToast('Publisher adicionado');
    setTimeout(() => setToast(null), 2500);
    setTimeout(() => setRecentlyAddedItems(prev => { const next = new Set(prev); next.delete(id); return next; }), 300);
  };

  const removePublisher = (pubId: string) => {
    setSelectedPublishers(prev => {
      const updated = prev.filter(p => p.id !== pubId);
      setFormData(f => ({ ...f, publisher: updated[0]?.name || '' }));
      return updated;
    });
  };

  const clearPublishers = () => {
    setSelectedPublishers([]);
    setFormData(prev => ({ ...prev, publisher: '' }));
  };

  const openPublisherPicker = () => {
    setShowPublisherPicker(true);
    setPublisherSearch('');
    setPublisherSearchResults(null);
    setPublisherSearchLoading(false);
  };

  const closePublisherPicker = useCallback(() => {
    setPublisherPickerClosing(true);
  }, []);

  const addPublisherToReserva = (pub: CatalogPublisher) => {
    if (publishersComReservaSelecionados.some(p => p.id === pub.id)) return;
    setPublishersComReservaSelecionados(prev => [...prev, pub]);
  };

  const removePublisherFromReserva = (pubId: string) => {
    setPublishersComReservaSelecionados(prev => prev.filter(p => p.id !== pubId));
  };

  const openReservaPublisherPicker = () => {
    setShowReservaPublisherPicker(true);
    setReservaPublisherSearch('');
    setReservaPublisherSearchResults(null);
    setReservaPublisherSearchLoading(false);
  };

  const closeReservaPublisherPicker = useCallback(() => {
    setReservaPublisherPickerClosing(true);
  }, []);

  const clearDragImage = useCallback(() => {
    if (dragImageRef.current?.parentNode) {
      dragImageRef.current.parentNode.removeChild(dragImageRef.current);
      dragImageRef.current = null;
    }
  }, []);

  const DRAG_CURSOR_STYLE_ID = 'campaign-form-drag-grabbing-cursor';
  const setDragGrabbingCursor = useCallback(() => {
    let style = document.getElementById(DRAG_CURSOR_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = DRAG_CURSOR_STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = 'html, body, body * { cursor: grabbing !important; }';
  }, []);
  const clearDragGrabbingCursor = useCallback(() => {
    const style = document.getElementById(DRAG_CURSOR_STYLE_ID);
    style?.remove();
    document.body.style.cursor = '';
    document.documentElement.style.cursor = '';
  }, []);

  const setupRoundedDragImage = useCallback((e: React.DragEvent, previewUrl: string) => {
    clearDragImage();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const baseSize = Math.max(rect.width, rect.height);
    const size = Math.round(baseSize * 1.025);
    const el = document.createElement('div');
    el.style.cssText = `position:absolute;top:-9999px;left:-9999px;width:${size}px;height:${size}px;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,0.12);pointer-events:none;`;
    const img = document.createElement('img');
    img.src = previewUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    el.appendChild(img);
    document.body.appendChild(el);
    dragImageRef.current = el;
    e.dataTransfer.setDragImage(el, size / 2, size / 2);
  }, [clearDragImage]);

  const toggleMediaType = (type: MediaType) => {
    setFormData(prev => {
      const current = new Set(prev.mediaTypes);
      if (current.has(type)) {
        current.delete(type);
        const newBudgets = { ...mediaBudgets };
        delete newBudgets[type];
        setMediaBudgets(newBudgets);
      } else {
        current.add(type);
        setMediaBudgets(prev2 => ({ ...prev2, [type]: 0 }));
        const meta = MEDIA_TYPE_META[type];
        if (meta?.pricing === 'CPC') {
          setMediaCpc(prev2 => ({ ...prev2, [type]: 2.9 }));
          setMediaCpm(prev2 => ({ ...prev2, [type]: 3.2 }));
        } else if (meta?.pricing === 'CPM') {
          setMediaCpm(prev2 => ({ ...prev2, [type]: 1.5 }));
        }
      }
      return { ...prev, mediaTypes: Array.from(current) };
    });
  };

  const campaignDays = (() => {
    const start = formData.startDate;
    const end = formData.endDate;
    if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return 0;
    return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  })();

  const maxTotalAllocation = (() => {
    if (allocationAmount <= 0) return 0;
    switch (allocationFrequency) {
      case 'Única':
        return allocationAmount;
      case 'Diária':
        return allocationAmount * campaignDays;
      default:
        return 0;
    }
  })();

  useEffect(() => {
    setFormData(prev => ({ ...prev, budget: maxTotalAllocation }));
  }, [maxTotalAllocation]);

  const isUnlimitedAllocation = allocationFrequency !== 'Única' && campaignDays <= 0 && allocationAmount > 0;

  /** Pool de publishers que podem ser adicionados à reserva: network = catálogo; specific = selecionados. */
  const reservaPool: CatalogPublisher[] = publisherMode === 'network' ? PUBLISHER_CATALOG : selectedPublishers;
  /** Lista efetiva para reserva: quando toggle ligado, só os que o usuário selecionou; senão vazio. */
  const publishersForReservation: CatalogPublisher[] = reservaPorPublisherEnabled ? publishersComReservaSelecionados : [];
  /** Só considera reservas quando o toggle está ativado; senão todos têm o mesmo budget disponível. */
  const publisherReservedTotal = publishersForReservation.length > 0
    ? publishersForReservation.reduce((s, p) => s + (publisherBudgetReservations[p.id] ?? 0), 0)
    : 0;
  const totalBudgetForReservations = isUnlimitedAllocation ? 0 : maxTotalAllocation;
  const hasPublisherReservationError = publishersForReservation.length > 0 && totalBudgetForReservations > 0 && publisherReservedTotal > totalBudgetForReservations;

  const budgetErrors = (() => {
    const errors: { allocation?: string; reservaPorPublisher?: string } = {};
    if (allocationAmount <= 0) {
      errors.allocation = 'Informe o valor de alocação.';
    }
    if (hasPublisherReservationError) {
      errors.allocation = errors.allocation
        ? `${errors.allocation} A soma das reservas por publisher excede o orçamento.`
        : `A soma das reservas por publisher (R$ ${formatBRL(publisherReservedTotal)}) excede o orçamento (R$ ${formatBRL(totalBudgetForReservations)}).`;
    }
    if (reservaPorPublisherEnabled) {
      if (publishersComReservaSelecionados.length === 0) {
        errors.reservaPorPublisher = 'Adicione ao menos um publisher e defina o valor de reserva para poder salvar.';
      } else if (publisherReservedTotal <= 0) {
        errors.reservaPorPublisher = 'Defina o valor de reserva para ao menos um publisher.';
      }
    }
    return errors;
  })();

  const mediaBudgetTotal = Object.values(mediaBudgets).reduce((sum, v) => sum + v, 0);
  const hasMediaBudgetError = formData.budget > 0 && mediaBudgetTotal > formData.budget;
  const mediaBudgetError = hasMediaBudgetError
    ? `A soma das alocações em mídias (R$ ${formatBRL(mediaBudgetTotal)}) excede a alocação total da campanha (R$ ${formatBRL(formData.budget)}).`
    : undefined;

  const lastValidRef = useRef<Record<string, number>>({ ...mediaBudgets });
  useEffect(() => {
    if (!hasMediaBudgetError) {
      lastValidRef.current = { ...mediaBudgets };
    }
  }, [mediaBudgets, hasMediaBudgetError]);

  const undoMediaBudgets = () => {
    setMediaBudgets({ ...lastValidRef.current });
  };

  const reallocateMediaBudgets = () => {
    const total = formData.budget;
    if (total <= 0) return;
    const entries = Object.entries(mediaBudgets) as [string, number][];
    const currentSum = entries.reduce((s, [, v]) => s + v, 0);
    if (currentSum <= 0) return;
    const ratio = total / currentSum;
    const reallocated: Record<string, number> = {};
    entries.forEach(([key, val]) => { reallocated[key] = Math.round(val * ratio); });
    const newSum = Object.values(reallocated).reduce((s, v) => s + v, 0);
    if (newSum > total && entries.length > 0) {
      const lastKey = entries[entries.length - 1][0];
      reallocated[lastKey] -= (newSum - total);
    }
    setMediaBudgets(reallocated);
  };

  const isSectionComplete = (step: FormStep): boolean => {
    switch (step) {
      case 'estrategia': return true;
      case 'data': return !isNaN(formData.startDate.getTime()) && !isNaN(formData.endDate.getTime());
      case 'publishers': return publisherMode === 'network' || selectedPublishers.length > 0;
      case 'produtos': return formData.products.length > 0;
      case 'investimento': return (formData.budget > 0 || isUnlimitedAllocation) && !budgetErrors.allocation && !budgetErrors.reservaPorPublisher;
      case 'segmentacao': return targeting === 'Automática' || segmentGroups.some(g => g.conditions.some(c => c.dimension && c.value));
      case 'plano_midia': return formData.mediaTypes.length > 0 && !mediaBudgetError;
      default: return false;
    }
  };

  const sectionHasError = (step: FormStep): boolean => {
    switch (step) {
      case 'investimento': return !!budgetErrors.allocation || !!budgetErrors.reservaPorPublisher;
      case 'plano_midia': return !!mediaBudgetError;
      default: return false;
    }
  };

  const getSectionStatus = (step: FormStep): 'completed' | 'pending' | 'error' => {
    if (isSectionComplete(step)) return 'completed';
    if (sectionHasError(step)) return 'error';
    return 'pending';
  };

  const getStrategyHint = (): string => {
    switch (strategy) {
      case 'Indefinida': return 'Sem foco específico';
      case 'Alcance': return 'Privilegia entrega';
      case 'Crescimento': return 'Volume com eficiência';
      case 'Rentabilidade': return 'Foco em retorno';
      case 'Novos compradores': return 'Aquisição de clientes';
      default: return '';
    }
  };

  const renderSectionSummary = (step: FormStep) => {
    switch (step) {
      case 'estrategia':
        return (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between h-11 px-3 gap-2 min-w-0">
              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">{strategy}</span>
              <span className="text-sm text-[color:var(--sl-fg-base-soft)] shrink-0 truncate max-w-[45%] px-1.5">{getStrategyHint()}</span>
            </div>
          </div>
        );
      case 'data':
        return (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between h-11 px-3 border-b border-[#f2f2f2] gap-2 min-w-0">
              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">Data de início</span>
              <span className="text-sm text-[color:var(--sl-fg-base-soft)] shrink-0 px-1.5">{formatDate(formData.startDate)}</span>
            </div>
            <div className="flex items-center justify-between h-11 px-3 gap-2 min-w-0">
              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">Data de término</span>
              <span className="text-sm text-[color:var(--sl-fg-base-soft)] shrink-0 px-1.5">{formatDate(formData.endDate)}</span>
            </div>
          </div>
        );
      case 'publishers':
        if (publisherMode === 'network') {
          return (
            <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
              <div className="flex items-center h-11 px-3 min-w-0">
                <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">VTEX Ads Network</span>
              </div>
            </div>
          );
        }
        if (selectedPublishers.length > 0) {
          const maxShow = 6;
          const remaining = selectedPublishers.length - maxShow;
          return (
            <div className="flex items-center flex-wrap gap-y-1 h-[46px]">
              {selectedPublishers.slice(0, maxShow).map((pub, i) => (
                <div
                  key={pub.id}
                  title={pub.name}
                  className="w-9 h-9 rounded-lg border border-[#e8e8e8] shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ backgroundColor: pub.logoBg, marginLeft: i > 0 ? -8 : 0, zIndex: maxShow - i }}
                >
                  <span className="text-white font-bold text-[9px]">{publisherInitials(pub.name)}</span>
                </div>
              ))}
              {remaining > 0 && (
                <span className="text-xs text-[color:var(--sl-fg-base-soft)] ml-2 shrink-0">+{remaining}</span>
              )}
            </div>
          );
        }
        return (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="flex items-center h-11 px-3 min-w-0">
              <span className="text-sm text-[color:var(--sl-fg-base-muted)] truncate min-w-0">Nenhum publisher</span>
            </div>
          </div>
        );
      case 'produtos':
        if (formData.products && formData.products.length > 0) {
          const maxShow = 6;
          const remaining = formData.products.length - maxShow;
          return (
            <div className="flex items-center flex-wrap gap-y-1 h-[46px]">
              {formData.products.slice(0, maxShow).map((p, i) => (
                <div
                  key={p.id}
                  title={p.name}
                  className="w-9 h-9 rounded-lg border border-[#e8e8e8] bg-[#f9f9f9] shrink-0 overflow-hidden"
                  style={{ marginLeft: i > 0 ? -8 : 0, zIndex: maxShow - i }}
                >
                  {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-contain" />}
                </div>
              ))}
              {remaining > 0 && (
                <span className="text-xs text-[color:var(--sl-fg-base-soft)] ml-2 shrink-0">+{remaining}</span>
              )}
            </div>
          );
        }
        return (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="flex items-center h-11 px-3 min-w-0">
              <span className="text-sm text-[color:var(--sl-fg-base-soft)] truncate min-w-0">Nenhum produto selecionado</span>
            </div>
          </div>
        );
      case 'investimento':
        return (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between h-11 px-3 border-b border-[#f2f2f2] gap-2 min-w-0">
              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">Alocação</span>
              <span className="text-sm text-[color:var(--sl-fg-base-soft)] shrink-0 px-1.5">{allocationFrequency} · {formatCurrency(allocationAmount)}</span>
            </div>
            <div className="flex items-center justify-between h-11 px-3 border-b border-[#f2f2f2] gap-2 min-w-0">
              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">Máx. total</span>
              <span className="text-sm text-[color:var(--sl-fg-base-soft)] shrink-0 px-1.5">{isUnlimitedAllocation ? 'Sem limites' : formatCurrency(formData.budget)}</span>
            </div>
            <div className="flex items-center justify-between h-11 px-3 gap-2 min-w-0">
              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">Ritmo</span>
              <span className="text-sm text-[color:var(--sl-fg-base-soft)] shrink-0 truncate max-w-[55%] text-right px-1.5">{spendingPace === 'Conforme a demanda' ? 'Conforme a demanda' : 'Uniforme'}</span>
            </div>
          </div>
        );
      case 'segmentacao': {
        const condCount = segmentGroups.reduce((s, g) => s + g.conditions.filter(c => c.dimension && c.value).length, 0);
        return (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            <div className="flex items-center h-11 px-3 min-w-0">
              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">
                {targeting === 'Personalizada' && condCount > 0
                  ? `${condCount} condição${condCount !== 1 ? 'ões' : ''}`
                  : targeting}
              </span>
            </div>
          </div>
        );
      }
      case 'plano_midia':
        if (formData.mediaTypes.length === 0) {
          return (
            <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
              <div className="flex items-center h-11 px-3 min-w-0">
                <span className="text-sm text-[color:var(--sl-fg-base-soft)] truncate min-w-0">Sem mídias</span>
              </div>
            </div>
          );
        }
        return (
          <div className="bg-white border border-[#e0e0e0] rounded-xl overflow-hidden">
            {formData.mediaTypes.map((mt, i) => {
              const meta = MEDIA_TYPE_META[mt] || { color: '#e0e0e0', icon: 'help', subtitle: '' };
              const allocMode = mediaAllocMode[mt] || 'manual';
              const isIntelligent = allocMode === 'intelligent';
              return (
                <div key={mt} className={`flex items-center justify-between h-11 px-3 gap-2 min-w-0 ${i < formData.mediaTypes.length - 1 ? 'border-b border-[#f2f2f2]' : ''}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
                      <span className="material-symbols-outlined text-[13px] text-[color:var(--sl-fg-base)] opacity-60">{meta.icon}</span>
                    </div>
                    <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0">{mt}</span>
                  </div>
                  <span className="text-sm text-[color:var(--sl-fg-base-soft)] shrink-0 px-1.5">
                    {isIntelligent ? 'Inteligente' : formatCurrency(mediaBudgets[mt] || 0)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  const sidebarRef = useRef<HTMLDivElement>(null);

  const renderSidebar = () => (
    <div ref={sidebarRef} className="shrink-0 overflow-y-auto overflow-x-hidden py-2 scroll-smooth" style={{ width: sidebarWidth }}>
      {SIDEBAR_SECTIONS.map(({ key, label }, idx) => {
        const isActive = activeStep === key;
        const status = getSectionStatus(key);
        return (
          <div key={key}>
            <div
              data-step={key}
              onClick={() => setActiveStep(key)}
              className={`flex flex-col gap-3 mx-2 px-4 py-4 rounded-xl cursor-pointer transition-all duration-200 min-w-0 overflow-hidden ${
                isActive
                  ? 'bg-[#f7f8fa] ring-1 ring-black/[0.04]'
                  : 'hover:bg-[#ebebeb]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <SectionStatusIcon status={status} />
                <span className={`text-[15px] font-semibold tracking-[-0.32px] leading-6 transition-colors truncate min-w-0 ${isActive ? 'text-[color:var(--sl-fg-base)]' : 'text-[color:var(--sl-fg-base)]'}`}>{label}</span>
              </div>
              {renderSectionSummary(key)}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderEstrategia = () => (
    <div className="flex flex-col gap-8 w-full max-w-[740px]">
      <div className="flex flex-col gap-1">
        <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">Estratégia</h2>
        <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Selecione o principal objetivo. Isso ajuda a otimizar entrega, lances e relatórios.</p>
      </div>
      <div className="flex flex-col gap-2">
        {STRATEGY_OPTIONS.map(opt => {
          const isSelected = strategy === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setStrategy(opt.id)}
              className={`flex items-start gap-3 w-full pl-4 pr-4 py-4 rounded-xl shadow-[0_1px_1px_rgba(0,0,0,0.08)] transition-all text-left overflow-hidden border-[1.5px] ${
                isSelected
                  ? 'bg-[#f1f8fd] border-[#0366dd]'
                  : 'bg-white border-[#e0e0e0] hover:border-[#c2c2c2]'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${opt.iconBg}`}>
                <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">{opt.id}</p>
                <p className="text-xs text-[color:var(--sl-fg-base-soft)] tracking-[-0.05px] leading-4 mt-0.5">{opt.description}</p>
              </div>
              <div className="shrink-0 ml-auto self-center">
                {isSelected ? (
                  <div className="w-5 h-5 rounded-full bg-[#0366dd] flex items-center justify-center">
                    <div className="w-[8px] h-[8px] rounded-full bg-white" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-[#c2c2c2] bg-white" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderTimelinePreview = () => {
    const start = formData.startDate;
    const end = formData.endDate;
    const hasValidDates = start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()) && end >= start;

    if (!hasValidDates) return null;

    const COL_W = 40;
    const CARD_H = 40;
    const ROW_H = 48;
    const marginDays = 7;

    const viewStart = new Date(start);
    viewStart.setDate(viewStart.getDate() - marginDays);
    const viewEnd = new Date(end);
    viewEnd.setDate(viewEnd.getDate() + marginDays);

    const totalDays = Math.ceil((viewEnd.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const totalWidth = totalDays * COL_W;

    const dayToX = (d: Date) => {
      const diff = Math.floor((d.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
      return diff * COL_W;
    };

    const days: { date: Date; label: string; dayOfWeek: number }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(viewStart);
      d.setDate(d.getDate() + i);
      days.push({
        date: d,
        label: d.getDate().toString().padStart(2, '0'),
        dayOfWeek: d.getDay(),
      });
    }

    const months: { name: string; year: number; startIdx: number; count: number }[] = [];
    let prevKey = '';
    days.forEach((day, i) => {
      const key = `${day.date.getMonth()}-${day.date.getFullYear()}`;
      if (key !== prevKey) {
        months.push({ name: MONTH_NAMES_PT[day.date.getMonth()], year: day.date.getFullYear(), startIdx: i, count: 1 });
        prevKey = key;
      } else {
        months[months.length - 1].count++;
      }
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const todayIdx = days.findIndex(d => `${d.date.getFullYear()}-${d.date.getMonth()}-${d.date.getDate()}` === todayStr);

    const otherCampaigns = allCampaigns.filter(c =>
      c.id !== campaign.id &&
      c.startDate && c.endDate &&
      !isNaN(c.startDate.getTime()) && !isNaN(c.endDate.getTime()) &&
      c.endDate >= viewStart && c.startDate <= viewEnd
    );

    let currentBarX = dayToX(start);
    let currentBarW = Math.max((dayToX(end) - currentBarX) + COL_W, COL_W);

    if (drag) {
      const snapped = drag.currentDayDelta * COL_W;
      const durationPx = currentBarW;
      if (drag.type === 'move') {
        currentBarX += snapped;
      } else if (drag.type === 'resize-start') {
        const maxSnap = durationPx - COL_W;
        const actual = Math.min(snapped, maxSnap);
        currentBarX += actual;
        currentBarW -= actual;
      } else if (drag.type === 'resize-end') {
        const minSnap = -(durationPx - COL_W);
        currentBarW += Math.max(snapped, minSnap);
      }
    }

    type BarInfo = { id: string; title: string; publisher: string; status: string; x: number; w: number; isCurrent?: boolean };

    const otherBars: BarInfo[] = otherCampaigns.map(c => ({
      id: c.id,
      title: c.title,
      publisher: c.publisher,
      status: c.status as string,
      x: Math.max(dayToX(c.startDate), 0),
      w: Math.max(Math.min(dayToX(c.endDate), totalWidth) - Math.max(dayToX(c.startDate), 0) + COL_W, COL_W),
    }));

    const rows: BarInfo[][] = [];
    const currentBar: BarInfo = { id: campaign.id, title: formData.title || 'Nova campanha', publisher: formData.publisher, status: formData.status as string, x: currentBarX, w: currentBarW, isCurrent: true };
    rows.push([currentBar]);

    otherBars.forEach(bar => {
      let placed = false;
      for (const row of rows) {
        const overlaps = row.some(existing => !(bar.x + bar.w <= existing.x || bar.x >= existing.x + existing.w));
        if (!overlaps) { row.push(bar); placed = true; break; }
      }
      if (!placed) rows.push([bar]);
    });

    const HEADER_H = 72;
    const minGanttHeight = 480 - HEADER_H;
    const chartHeight = Math.max(rows.length * ROW_H + 8, minGanttHeight);

    const statusDot = (status: string, isCurrent: boolean) => {
      if (status === CampaignStatus.ACTIVE) return <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]'}`} />;
      if (status === CampaignStatus.COMPLETED) return <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-blue-400' : 'bg-blue-500'}`} />;
      return <div className={`w-2 h-2 rounded-full shrink-0 ${isCurrent ? 'bg-gray-300' : 'bg-gray-400'}`} />;
    };

    return (
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div ref={timelineScrollRef} className="overflow-x-auto overflow-y-auto" style={{ height: 480 }}>
          <div style={{ width: totalWidth }}>
            {/* Month headers */}
            <div className="sticky top-0 bg-white z-10 flex h-10" style={{ width: totalWidth }}>
              {months.map((m, i) => (
                <div key={i} className="relative h-full shrink-0" style={{ width: m.count * COL_W }}>
                  <div className="sticky left-0 h-full flex items-center px-3 bg-white gap-1">
                    <span className="text-[13px] font-medium text-[color:var(--sl-fg-base)] whitespace-nowrap">{m.name}</span>
                    <span className="text-[13px] font-normal text-[color:var(--sl-fg-base-muted)] whitespace-nowrap">{m.year}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Day numbers */}
            <div className="sticky top-10 bg-white z-10 flex h-8 border-b border-gray-200" style={{ width: totalWidth }}>
              {days.map((day, i) => {
                const isToday = i === todayIdx;
                return (
                  <div
                    key={i}
                    className={`shrink-0 flex items-center justify-center text-[10px] font-medium ${isToday ? 'text-[color:var(--sl-fg-base-soft)] bg-blue-50/50' : 'text-[color:var(--sl-fg-base-soft)]'}`}
                    style={{ width: COL_W }}
                  >
                    {day.label}
                  </div>
                );
              })}
            </div>

            {/* Gantt area */}
            <div className="relative" style={{ height: chartHeight, width: totalWidth }}>
              {/* Grid background */}
              <div className="absolute inset-0 flex pointer-events-none">
                {days.map((day, i) => {
                  const isWeekend = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                  const isToday = i === todayIdx;
                  return (
                    <div
                      key={i}
                      className="border-r border-gray-100 shrink-0 relative"
                      style={{ width: COL_W, height: chartHeight, backgroundColor: isWeekend ? '#FAFAFA' : 'transparent' }}
                    >
                      {isToday && (
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-600" style={{ transform: 'translateX(-50%)' }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Campaign bars */}
              {rows.map((row, ri) =>
                row.map((bar) => {
                  const isCurrent = !!bar.isCurrent;
                  const isDragging = isCurrent && drag?.hasMoved;
                  return (
                    <div
                      key={bar.id}
                      className={`absolute ${isCurrent ? 'z-20' : 'z-10'}`}
                      style={{
                        left: bar.x,
                        width: bar.w,
                        top: ri * ROW_H + 8,
                        height: CARD_H,
                      }}
                    >
                      {/* Current pill: interactive with drag handles */}
                      {isCurrent ? (
                        <div className="relative w-full h-full">
                          {/* Left resize handle */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-3 -ml-1 cursor-ew-resize z-30 hover:bg-blue-200/5 rounded-bl transition-colors"
                            onPointerDown={(e) => handlePillPointerDown(e, 'resize-start', COL_W)}
                            onPointerMove={handlePillPointerMove}
                            onPointerUp={handlePillPointerUp}
                          />
                          {/* Right resize handle */}
                          <div
                            className="absolute right-0 top-0 bottom-0 w-3 -mr-1 cursor-ew-resize z-30 hover:bg-blue-200/5 rounded-br transition-colors"
                            onPointerDown={(e) => handlePillPointerDown(e, 'resize-end', COL_W)}
                            onPointerMove={handlePillPointerMove}
                            onPointerUp={handlePillPointerUp}
                          />
                          {/* Pill body */}
                          <div
                            className={`mx-0.5 h-full rounded-xl overflow-hidden flex items-center pl-3 pr-4 gap-3 select-none transition-shadow border-[1.5px] ${
                              isDragging
                                ? 'bg-white border-blue-500 shadow-lg ring-2 ring-blue-500/20 cursor-grabbing'
                                : 'bg-white border-[#e0e0e0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-md cursor-grab'
                            }`}
                            onPointerDown={(e) => handlePillPointerDown(e, 'move', COL_W)}
                            onPointerMove={handlePillPointerMove}
                            onPointerUp={handlePillPointerUp}
                          >
                            {statusDot(bar.status, true)}
                            <span className="text-xs font-medium truncate text-[color:var(--sl-fg-base)] pointer-events-none">
                              {bar.title}
                            </span>
                          </div>
                        </div>
                      ) : (
                        /* Other pills */
                        <div className="mx-0.5 h-full rounded-xl bg-white border border-[#e0e0e0] overflow-hidden flex items-center pl-3 pr-4 gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
                          <div className="opacity-50">{statusDot(bar.status, false)}</div>
                          <span className="text-[11px] font-medium truncate text-[color:var(--sl-fg-base)] opacity-50">
                            {bar.title}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const formatDateDisplay = (date: Date): string => {
    if (!isValidDate(date)) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd} / ${mm} / ${yyyy}`;
  };

  const parseDateDisplay = (text: string): Date | null => {
    const clean = text.replace(/\s/g, '');
    const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    const d = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const y = parseInt(match[3], 10);
    const date = new Date(y, m, d, 12, 0, 0);
    if (isNaN(date.getTime()) || date.getDate() !== d || date.getMonth() !== m) return null;
    return date;
  };

  const startDateInputRef = useRef<HTMLInputElement>(null);
  const endDateInputRef = useRef<HTMLInputElement>(null);

  const DateInput: React.FC<{
    label: string;
    value: Date;
    onChange: (date: Date) => void;
    onClear: () => void;
    disabled?: boolean;
    inputRef?: React.RefObject<HTMLInputElement>;
    nativeInputRef?: React.RefObject<HTMLInputElement>;
  }> = ({ label, value, onChange, onClear, disabled, inputRef, nativeInputRef }) => {
    const hasValue = isValidDate(value);
    const [localText, setLocalText] = useState(hasValue ? formatDateDisplay(value) : '');
    const [isFocused, setIsFocused] = useState(false);
    const hiddenRef = useRef<HTMLInputElement>(null);
    const activeHiddenRef = nativeInputRef || hiddenRef;

    useEffect(() => {
      if (!isFocused) setLocalText(hasValue ? formatDateDisplay(value) : '');
    }, [value, hasValue, isFocused]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value.replace(/[^\d/]/g, '');
      const digits = raw.replace(/\//g, '');
      if (digits.length <= 8) {
        let formatted = '';
        for (let i = 0; i < digits.length; i++) {
          if (i === 2 || i === 4) formatted += ' / ';
          formatted += digits[i];
        }
        setLocalText(formatted);
        if (digits.length === 8) {
          const parsed = parseDateDisplay(formatted);
          if (parsed) onChange(parsed);
        }
      }
    };

    const handleBlur = () => {
      setIsFocused(false);
      const parsed = parseDateDisplay(localText);
      if (parsed) {
        onChange(parsed);
      } else if (localText.trim()) {
        setLocalText(hasValue ? formatDateDisplay(value) : '');
      }
    };

    return (
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        <label className="text-xs font-medium text-[color:var(--sl-fg-base-soft)]">{label}</label>
        <div className={`flex items-center h-11 border rounded-lg overflow-hidden transition-all ${
          disabled ? 'bg-[#f9f9f9] border-[#e0e0e0] opacity-50' :
          isFocused ? 'border-[#0366dd] ring-2 ring-[#0366dd]/20' : 'border-[#e0e0e0]'
        }`}>
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            value={localText}
            onChange={handleTextChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            placeholder="DD / MM / AAAA"
            className="flex-1 h-full px-3 bg-transparent outline-none text-sm text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)] disabled:cursor-not-allowed"
          />
          {hasValue && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => { onClear(); setLocalText(''); }}
              className="shrink-0 w-8 h-8 flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
            </button>
          )}
          <input
            ref={activeHiddenRef}
            type="date"
            disabled={disabled}
            value={formatDateForInput(value)}
            onChange={(e) => {
              if (e.target.value) {
                const d = new Date(e.target.value + 'T12:00:00');
                if (!isNaN(d.getTime())) { onChange(d); setLocalText(formatDateDisplay(d)); }
              }
            }}
            className="sr-only"
            tabIndex={-1}
          />
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => activeHiddenRef.current?.showPicker?.()}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-md border border-[#e0e0e0] bg-white text-[color:var(--sl-fg-base)] hover:bg-[#f5f5f5] active:bg-[#ebebeb] transition-colors mr-0.5 shadow-[0_1px_2px_rgba(10,13,18,0.05)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
          </button>
        </div>
      </div>
    );
  };

  const renderData = () => {
    const showTimeline = !noEndDate && formData.startDate && formData.endDate && !isNaN(formData.startDate.getTime()) && !isNaN(formData.endDate.getTime()) && formData.endDate >= formData.startDate;
    return (
      <div className="flex flex-col gap-5 w-full max-w-[740px]">
        {/* Title + checkbox */}
        <div className="flex items-center justify-between">
          <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">Data</h2>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noEndDate}
              onChange={(e) => {
                const checked = e.target.checked;
                setNoEndDate(checked);
                if (checked) setFormData(prev => ({ ...prev, endDate: new Date('') }));
              }}
              className="w-4 h-4 rounded border-[#c2c2c2] text-[color:var(--sl-fg-base-soft)] focus:ring-[#0366dd]/20 accent-[#0366dd]"
            />
            <span className="text-sm text-[color:var(--sl-fg-base)] tracking-[-0.14px]">Sem data de fim</span>
          </label>
        </div>

        {/* Date inputs */}
        <div className="flex gap-4">
          <DateInput
            label="Início"
            value={formData.startDate}
            onChange={(d) => handleDateChange('startDate', formatDateForInput(d))}
            onClear={() => setFormData(prev => ({ ...prev, startDate: new Date('') }))}
          />
          <DateInput
            label="Fim"
            value={formData.endDate}
            onChange={(d) => handleDateChange('endDate', formatDateForInput(d))}
            onClear={() => setFormData(prev => ({ ...prev, endDate: new Date('') }))}
            disabled={noEndDate}
          />
        </div>

        {/* Timeline preview */}
        {showTimeline && renderTimelinePreview()}
      </div>
    );
  };

  const PublisherLogo: React.FC<{ pub: CatalogPublisher; size?: string }> = ({ pub, size = 'w-10 h-10' }) => (
    <div className={`${size} rounded-lg shrink-0 overflow-hidden flex items-center justify-center`} style={{ backgroundColor: pub.logoBg }}>
      <span className="text-white font-bold text-xs">{publisherInitials(pub.name)}</span>
    </div>
  );

  const renderPublishers = () => {
    const pubCount = selectedPublishers.length;

    return (
      <div className="flex flex-col gap-8 w-full max-w-[740px]">
        <div className="flex flex-col gap-1">
          <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">Publisher</h2>
          <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Selecione em quais publishers a campanha será veiculada</p>
        </div>

        {/* Mode selection — radio cards */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => { setPublisherMode('network'); setFormData(prev => ({ ...prev, publisher: 'VTEX Ads Network' })); }}
            className={`flex items-center justify-between w-full px-5 py-4 rounded-xl text-left transition-all border-[1.5px] ${
              publisherMode === 'network'
                ? 'bg-[#f1f8fd] border-[#0366dd]'
                : 'bg-white border-[#e0e0e0] hover:border-[#c2c2c2]'
            }`}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm font-medium text-[color:var(--sl-fg-base)]">VTEX Ads Network</p>
              <p className="text-xs text-[color:var(--sl-fg-base-soft)]">A campanha será veiculada na rede, podendo aparecer em diversos publishers ao mesmo tempo</p>
            </div>
            <div className="shrink-0 ml-4">
              {publisherMode === 'network' ? (
                <div className="w-5 h-5 rounded-full bg-[#0366dd] flex items-center justify-center">
                  <div className="w-[8px] h-[8px] rounded-full bg-white" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-[#c2c2c2] bg-white" />
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => { setPublisherMode('specific'); if (selectedPublishers.length === 0) setFormData(prev => ({ ...prev, publisher: '' })); }}
            className={`flex items-center justify-between w-full px-5 py-4 rounded-xl text-left transition-all border-[1.5px] ${
              publisherMode === 'specific'
                ? 'bg-[#f1f8fd] border-[#0366dd]'
                : 'bg-white border-[#e0e0e0] hover:border-[#c2c2c2]'
            }`}
          >
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-sm font-medium text-[color:var(--sl-fg-base)]">Escolher publishers específicos</p>
              <p className="text-xs text-[color:var(--sl-fg-base-soft)]">A campanha será veiculada apenas nos publishers definidos</p>
            </div>
            <div className="shrink-0 ml-4">
              {publisherMode === 'specific' ? (
                <div className="w-5 h-5 rounded-full bg-[#0366dd] flex items-center justify-center">
                  <div className="w-[8px] h-[8px] rounded-full bg-white" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-[#c2c2c2] bg-white" />
              )}
            </div>
          </button>
        </div>

        {/* Specific publishers content */}
        {publisherMode === 'specific' && (
          <div className="animate-in fade-in duration-200">
            <div className="flex flex-col gap-0 pt-0">
              {pubCount > 0 ? (
                <>
                  <div ref={publisherStickyRef} className="h-0 w-0" aria-hidden="true" />
                  <div className="sticky -top-8 z-20 py-0 h-[72px] bg-white flex flex-col before:content-[''] before:absolute before:inset-0 before:-left-[9999px] before:-right-[9999px] before:bg-white before:-z-10">
                    <div className={`flex items-center justify-between py-2 border-b transition-colors duration-200 h-full ${publisherHeaderStuck ? 'border-[#e8e8e8]' : 'border-transparent'}`}>
                      <span className="text-sm font-medium text-[color:var(--sl-fg-base-soft)]">{pubCount} Publisher{pubCount !== 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-3">
                        {pubCount > 1 && (
                          <button type="button" onClick={() => openClearListDialog('publishers')} className="h-10 px-3 rounded-lg text-sm font-semibold text-[color:var(--sl-fg-base)] hover:text-[color:var(--sl-fg-base)] hover:bg-red-50 active:scale-[0.98] transition-all">
                            Limpar lista
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={openPublisherPicker}
                          className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-[#d5d7da] text-[color:var(--sl-fg-base)] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[20px]">add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedPublishers.map(pub => (
                      <div
                        key={pub.id}
                        className="group flex items-center gap-[12px] px-4 h-[72px] rounded-xl border border-[#e8e8e8] bg-white hover:border-[#d0d0d0] transition-all"
                      >
                        <PublisherLogo pub={pub} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate leading-5">{pub.name}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePublisher(pub.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] transition-all shrink-0"
                        >
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[color:var(--sl-fg-base-soft)]">Nenhum publisher</span>
                    <button
                      type="button"
                      onClick={openPublisherPicker}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-[#d5d7da] text-[color:var(--sl-fg-base)] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-95 transition-all"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>
                  <div className="bg-[#f9f9f9] rounded-[12px] flex flex-col items-center justify-center h-[530px] gap-6">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <p className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px]">Selecione publishers para a campanha</p>
                      <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Escolha em quais publishers deseja veicular a campanha.</p>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={openPublisherPicker}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#d5d7da] text-[color:var(--sl-fg-base)] text-sm font-semibold tracking-[-0.42px] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-[0.98] transition-all"
                      >
                        Selecionar publishers
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const suggestedProducts = PRODUCT_CATALOG.filter(cp => !formData.products.some(p => p.id === cp.id) || recentlyAddedItems.has(cp.id));

  const productPickerSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showProductPicker && !productPickerClosing) {
      setProductPickerEntered(false);
      const t = requestAnimationFrame(() => setProductPickerEntered(true));
      return () => cancelAnimationFrame(t);
    }
    if (!showProductPicker) setProductPickerEntered(false);
  }, [showProductPicker, productPickerClosing]);

  useEffect(() => {
    if (showProductPicker) {
      setTimeout(() => productPickerSearchRef.current?.focus(), 120);
    }
  }, [showProductPicker]);

  const closeProductPicker = useCallback(() => {
    setProductPickerClosing(true);
  }, []);

  useEffect(() => {
    if (!productPickerClosing) return;
    const id = setTimeout(() => {
      setShowProductPicker(false);
      setProductPickerClosing(false);
    }, 240);
    return () => clearTimeout(id);
  }, [productPickerClosing]);

  const publisherPickerSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showPublisherPicker && !publisherPickerClosing) {
      setPublisherPickerEntered(false);
      const t = requestAnimationFrame(() => setPublisherPickerEntered(true));
      return () => cancelAnimationFrame(t);
    }
    if (!showPublisherPicker) setPublisherPickerEntered(false);
  }, [showPublisherPicker, publisherPickerClosing]);

  useEffect(() => {
    if (showPublisherPicker) {
      setTimeout(() => publisherPickerSearchRef.current?.focus(), 120);
    }
  }, [showPublisherPicker]);

  useEffect(() => {
    if (!publisherPickerClosing) return;
    const id = setTimeout(() => {
      setShowPublisherPicker(false);
      setPublisherPickerClosing(false);
    }, 240);
    return () => clearTimeout(id);
  }, [publisherPickerClosing]);

  const reservaPublisherPickerSearchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (showReservaPublisherPicker && !reservaPublisherPickerClosing) {
      setReservaPublisherPickerEntered(false);
      const t = requestAnimationFrame(() => setReservaPublisherPickerEntered(true));
      return () => cancelAnimationFrame(t);
    }
    if (!showReservaPublisherPicker) setReservaPublisherPickerEntered(false);
  }, [showReservaPublisherPicker, reservaPublisherPickerClosing]);
  useEffect(() => {
    if (showReservaPublisherPicker) {
      setTimeout(() => reservaPublisherPickerSearchRef.current?.focus(), 120);
    }
  }, [showReservaPublisherPicker]);
  useEffect(() => {
    if (!reservaPublisherPickerClosing) return;
    const id = setTimeout(() => {
      setShowReservaPublisherPicker(false);
      setReservaPublisherPickerClosing(false);
    }, 240);
    return () => clearTimeout(id);
  }, [reservaPublisherPickerClosing]);

  const bulkTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (showBulkAdd && !bulkAddClosing) {
      setBulkAddEntered(false);
      const t = requestAnimationFrame(() => setBulkAddEntered(true));
      return () => cancelAnimationFrame(t);
    }
    if (!showBulkAdd) setBulkAddEntered(false);
  }, [showBulkAdd, bulkAddClosing]);

  useEffect(() => {
    if (showBulkAdd) {
      setTimeout(() => bulkTextareaRef.current?.focus(), 120);
    }
  }, [showBulkAdd]);

  const openBulkAdd = () => {
    setShowBulkAdd(true);
    setBulkText('');
    setBulkResults(null);
    setBulkProcessing(false);
  };

  const closeBulkAdd = useCallback(() => {
    setBulkAddClosing(true);
  }, []);

  useEffect(() => {
    if (!bulkAddClosing) return;
    const id = setTimeout(() => {
      setShowBulkAdd(false);
      setBulkAddClosing(false);
      setBulkResults(null);
      setBulkText('');
    }, 240);
    return () => clearTimeout(id);
  }, [bulkAddClosing]);

  const parseBulkIds = (text: string): string[] => {
    const ids = text
      .split(/[\n\r,;\t]+/)
      .map(s => s.trim())
      .filter(Boolean);
    return [...new Set(ids)];
  };

  const processBulkAdd = () => {
    const ids = parseBulkIds(bulkText);
    if (ids.length === 0) return;
    setBulkProcessing(true);
    setTimeout(() => {
      const found: CatalogProduct[] = [];
      const alreadyAdded: CatalogProduct[] = [];
      const notFound: string[] = [];
      for (const raw of ids) {
        const q = raw.toLowerCase();
        const match = PRODUCT_CATALOG.find(p => p.sku.toLowerCase() === q || p.id.toLowerCase() === q);
        if (match) {
          if (formData.products.some(p => p.id === match.id)) {
            alreadyAdded.push(match);
          } else {
            found.push(match);
          }
        } else {
          notFound.push(raw);
        }
      }
      setBulkResults({ found, notFound, alreadyAdded });
      setBulkProcessing(false);
    }, 600);
  };

  const confirmBulkAdd = () => {
    if (!bulkResults) return;
    const newProducts: Product[] = bulkResults.found.map(cp => ({ id: cp.id, name: cp.name, imageUrl: cp.imageUrl }));
    if (newProducts.length === 0) return;
    setFormData(prev => ({ ...prev, products: [...prev.products, ...newProducts] }));
    setToast(`${newProducts.length} produto${newProducts.length !== 1 ? 's' : ''} adicionado${newProducts.length !== 1 ? 's' : ''} à lista`);
    setTimeout(() => setToast(null), 2500);
    closeBulkAdd();
  };

  const renderBulkAddModal = () => {
    if (!showBulkAdd && !bulkAddClosing) return null;
    const isLeaving = bulkAddClosing;
    const isEntered = bulkAddEntered;
    const idCount = parseBulkIds(bulkText).length;

    return (
      <>
        <div
          className={`fixed inset-0 z-[400] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-[240ms] ${
            isLeaving ? 'opacity-0' : isEntered ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeBulkAdd}
        />
        <div
          className={`fixed top-1/2 left-1/2 z-[401] w-[560px] max-h-[calc(100vh-80px)] bg-white border border-[#e0e0e0] rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-all duration-[240ms] ease-out ${
            isLeaving ? 'opacity-0 -translate-x-1/2 -translate-y-1/2 scale-[0.97]' : isEntered ? 'opacity-100 -translate-x-1/2 -translate-y-1/2 scale-100' : 'opacity-0 -translate-x-1/2 -translate-y-1/2 scale-[0.97]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-7 pt-6 pb-1 shrink-0">
            <div className="flex flex-col gap-2">
              <h2 className="text-[18px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.5px] leading-6">Adicionar SKUs em lote</h2>
              <p className="text-[13px] text-[color:var(--sl-fg-base-soft)] tracking-[-0.13px]">Cole ou digite os IDs separados por vírgula, ponto e vírgula, ou quebra de linha.</p>
            </div>
            <button
              type="button"
              onClick={closeBulkAdd}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors shrink-0 -mr-1 -mt-4"
            >
              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]">close</span>
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col px-7 pt-4 pb-6 gap-4 flex-1 min-h-0 overflow-y-auto">
            {!bulkResults ? (
              <>
                <div className="relative">
                  <textarea
                    ref={bulkTextareaRef}
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={"APL-IP17P-SLV-256\nAPL-IP17P-COR-512\nAPL-AWS10-GPS"}
                    className="w-full h-[200px] px-4 py-3 bg-white border border-[#e0e0e0] rounded-xl text-[13px] text-[color:var(--sl-fg-base)] font-mono tracking-[-0.13px] placeholder:text-[color:var(--sl-fg-base-muted)] focus:shadow-[0_0_0_3px_#C2C2C2,0_0_0_1px_#fff] focus:border-[#a0a0a0] outline-none transition-all resize-none"
                  />
                  {idCount > 0 && (
                    <span className="absolute bottom-3 right-3 text-[12px] text-[color:var(--sl-fg-base-muted)] font-medium tabular-nums">
                      {idCount} ID{idCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 px-1">
                  <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-4">Compatível com cópia direta de planilhas e arquivos CSV. Cada linha ou valor separado é tratado como um ID.</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Summary */}
                <div className="flex items-center gap-2 flex-wrap">
                  {bulkResults.found.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf3] text-[12px] font-semibold text-[color:var(--sl-fg-base)]">
                      <span className="material-symbols-outlined text-[14px]">check_circle</span>
                      {bulkResults.found.length} encontrado{bulkResults.found.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {bulkResults.alreadyAdded.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#f0f1f3] text-[12px] font-semibold text-[color:var(--sl-fg-base)]">
                      <span className="material-symbols-outlined text-[14px]">playlist_add_check</span>
                      {bulkResults.alreadyAdded.length} já na lista
                    </span>
                  )}
                  {bulkResults.notFound.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#fef3f2] text-[12px] font-semibold text-[color:var(--sl-fg-base)]">
                      <span className="material-symbols-outlined text-[14px]">error</span>
                      {bulkResults.notFound.length} não encontrado{bulkResults.notFound.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Found products */}
                {bulkResults.found.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] uppercase tracking-wide px-0.5">Serão adicionados</span>
                    <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto">
                      {bulkResults.found.map(p => (
                        <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#f8fdf9]">
                          <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover bg-[#f5f5f5] shrink-0" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[13px] font-medium text-[color:var(--sl-fg-base)] truncate">{p.name}</span>
                            <span className="text-[11px] text-[color:var(--sl-fg-base-muted)] font-mono">{p.sku}</span>
                          </div>
                          <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base)] shrink-0">check</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Already added */}
                {bulkResults.alreadyAdded.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] uppercase tracking-wide px-0.5">Já estão na lista</span>
                    <div className="flex flex-col gap-1 max-h-[120px] overflow-y-auto">
                      {bulkResults.alreadyAdded.map(p => (
                        <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#fafafa]">
                          <img src={p.imageUrl} alt="" className="w-8 h-8 rounded-md object-cover bg-[#f5f5f5] shrink-0 opacity-50" />
                          <div className="flex flex-col min-w-0 flex-1 opacity-50">
                            <span className="text-[13px] font-medium text-[color:var(--sl-fg-base)] truncate">{p.name}</span>
                            <span className="text-[11px] text-[color:var(--sl-fg-base-muted)] font-mono">{p.sku}</span>
                          </div>
                          <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-muted)] shrink-0">playlist_add_check</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Not found */}
                {bulkResults.notFound.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] uppercase tracking-wide px-0.5">Não encontrados</span>
                    <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                      {bulkResults.notFound.map((id, i) => (
                        <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-md bg-[#fef3f2] text-[12px] font-mono text-[color:var(--sl-fg-base)]">
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-7 py-5 border-t border-[#f0f0f0] shrink-0">
            {!bulkResults ? (
              <>
                <button
                  type="button"
                  onClick={closeBulkAdd}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[color:var(--sl-fg-base)] hover:bg-[#f5f5f5] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={processBulkAdd}
                  disabled={idCount === 0 || bulkProcessing}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0366dd] text-white text-sm font-semibold shadow-[0_1px_2px_rgba(3,102,221,0.3)] hover:bg-[#0255b8] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  {bulkProcessing ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processando…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">search</span>
                      Buscar {idCount > 0 ? `${idCount} ID${idCount !== 1 ? 's' : ''}` : ''}
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setBulkResults(null); setBulkText(''); }}
                  className="px-4 py-2.5 rounded-lg text-sm font-semibold text-[color:var(--sl-fg-base)] hover:bg-[#f5f5f5] transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={confirmBulkAdd}
                  disabled={bulkResults.found.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1f1f1f] text-white text-sm font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.1)] hover:bg-[#333] active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Adicionar {bulkResults.found.length} produto{bulkResults.found.length !== 1 ? 's' : ''}
                </button>
              </>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderProductPickerModal = () => {
    if (!showProductPicker && !productPickerClosing) return null;
    const displayProducts = productSearch.trim()
      ? (productSearchResults ?? [])
      : suggestedProducts.slice(0, 8);
    const isSearching = productSearch.trim().length > 0;
    const isLeaving = productPickerClosing;
    const isEntered = productPickerEntered;

    return (
      <>
        {/* Backdrop — click outside to close */}
        <div
          className={`fixed inset-0 z-[400] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-[240ms] ${
            isLeaving ? 'opacity-0' : isEntered ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeProductPicker}
        />
        {/* Modal panel */}
        <div
          className={`fixed top-10 left-1/2 z-[401] w-[800px] h-[calc(100%-40px)] bg-white border border-[#e0e0e0] rounded-t-xl shadow-[0px_24px_48px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-all duration-[240ms] ease-out ${
            isLeaving ? 'opacity-0 translate-x-[-50%] translate-y-10' : isEntered ? 'opacity-100 translate-x-[-50%] translate-y-0' : 'opacity-0 translate-x-[-50%] translate-y-10'
          }`}
        >
          <div className="flex items-center justify-between h-[80px] px-8 shrink-0">
            <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8 truncate">Adicionar produtos à lista</h2>
            <button
              type="button"
              onClick={closeProductPicker}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors shrink-0 -mr-2"
            >
              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]">close</span>
            </button>
          </div>

          {/* Body — pt-24 pb-32 px-32 */}
          <div className="flex flex-col flex-1 min-h-0 pt-6 pb-8 px-8">
            {/* Search */}
            <div className="relative mb-6 shrink-0">
              <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
              <input
                ref={productPickerSearchRef}
                type="text"
                value={productSearch}
                onChange={(e) => handleProductSearch(e.target.value)}
                placeholder="Buscar produtos"
                className="w-full h-[48px] pl-11 pr-10 bg-white border border-[#e0e0e0] rounded-xl text-[14px] text-[color:var(--sl-fg-base)] tracking-[-0.14px] placeholder:text-[color:var(--sl-fg-base-muted)] focus:shadow-[0_0_0_3px_#C2C2C2,0_0_0_1px_#fff] focus:border-[#a0a0a0] outline-none transition-all"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => handleProductSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#f0f0f0] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)]">cancel</span>
                </button>
              )}
            </div>

            {/* Status label */}
            <div className="shrink-0 mb-3">
              {productSearchLoading && isSearching ? (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">buscando "{productSearch}"</p>
              ) : !productSearchLoading && isSearching && productSearchResults !== null ? (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">
                  {productSearchResults.length} resultado{productSearchResults.length !== 1 ? 's' : ''} para "{productSearch}"
                </p>
              ) : (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">Produtos sugeridos</p>
              )}
            </div>

            {/* Product list */}
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 -mx-8 px-8">
              {productSearchLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[72px] rounded-xl bg-[#f5f5f5] skeleton-shimmer shrink-0" />
                ))
              ) : displayProducts.length > 0 ? (
                displayProducts.map(product => {
                  const alreadyAdded = formData.products.some(p => p.id === product.id);
                  const justAdded = recentlyAddedItems.has(product.id);
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center justify-between p-4 rounded-xl border shrink-0 transition-colors ${
                        alreadyAdded && !justAdded
                          ? 'border-[#e0e0e0] bg-[#fafafa] opacity-40'
                          : 'border-[#e0e0e0] bg-white hover:bg-[#fafafa]'
                      }`}
                      style={justAdded ? { animation: 'itemAddedPulse 300ms ease-out forwards' } : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-lg bg-[#f9f9f9] border border-[#e0e0e0] shrink-0 overflow-hidden">
                          <img src={product.imageUrl} alt="" className="w-full h-full object-contain" loading="lazy" />
                        </div>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5 truncate">{product.name}</p>
                          <p className="text-[12px] font-normal text-[color:var(--sl-fg-base-soft)] leading-4 truncate">{product.sku}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => addProduct(product)}
                        disabled={alreadyAdded}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg border shrink-0 ml-3 transition-all ${
                          alreadyAdded
                            ? 'border-transparent cursor-default'
                            : 'border-[#e0e0e0] bg-white text-[color:var(--sl-fg-base)] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#f5f5f5] active:scale-95'
                        }`}
                        style={justAdded ? { color: '#2b7fff' } : alreadyAdded ? { color: '#c2c2c2' } : undefined}
                      >
                        {alreadyAdded ? (
                          <span
                            className="material-symbols-outlined text-[20px]"
                            style={justAdded ? { animation: 'checkPop 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : undefined}
                          >check</span>
                        ) : (
                          <span className="material-symbols-outlined text-[20px]">add</span>
                        )}
                      </button>
                    </div>
                  );
                })
              ) : isSearching && !productSearchLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-3xl text-[#d0d0d0] mb-2">search_off</span>
                  <p className="text-[14px] text-[color:var(--sl-fg-base-soft)]">Nenhum produto encontrado</p>
                  <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] mt-1">Tente outro termo de busca</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderPublisherPickerModal = () => {
    if (!showPublisherPicker && !publisherPickerClosing) return null;
    const suggestedPublishers = PUBLISHER_CATALOG.filter(p => !selectedPublishers.some(s => s.id === p.id) || recentlyAddedItems.has(p.id));
    const displayPublishers = publisherSearch.trim()
      ? (publisherSearchResults ?? [])
      : suggestedPublishers.slice(0, 8);
    const isSearching = publisherSearch.trim().length > 0;
    const isLeaving = publisherPickerClosing;
    const isEntered = publisherPickerEntered;

    return (
      <>
        {/* Backdrop — click outside to close */}
        <div
          className={`fixed inset-0 z-[400] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-[240ms] ${
            isLeaving ? 'opacity-0' : isEntered ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closePublisherPicker}
        />
        <div
          className={`fixed top-10 left-1/2 z-[401] w-[800px] h-[calc(100%-40px)] bg-white border border-[#e0e0e0] rounded-t-xl shadow-[0px_24px_48px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-all duration-[240ms] ease-out ${
            isLeaving ? 'opacity-0 translate-x-[-50%] translate-y-10' : isEntered ? 'opacity-100 translate-x-[-50%] translate-y-0' : 'opacity-0 translate-x-[-50%] translate-y-10'
          }`}
        >
          <div className="flex items-center justify-between h-[80px] px-8 shrink-0">
            <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8 truncate">Selecionar publishers</h2>
            <button
              type="button"
              onClick={closePublisherPicker}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors shrink-0 -mr-2"
            >
              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]">close</span>
            </button>
          </div>

          <div className="flex flex-col flex-1 min-h-0 pt-6 pb-8 px-8">
            <div className="relative mb-6 shrink-0">
              <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
              <input
                ref={publisherPickerSearchRef}
                type="text"
                value={publisherSearch}
                onChange={(e) => handlePublisherSearch(e.target.value)}
                placeholder="Buscar publishers"
                className="w-full h-[48px] pl-11 pr-10 bg-white border border-[#e0e0e0] rounded-xl text-[14px] text-[color:var(--sl-fg-base)] tracking-[-0.14px] placeholder:text-[color:var(--sl-fg-base-muted)] focus:shadow-[0_0_0_3px_#C2C2C2,0_0_0_1px_#fff] focus:border-[#a0a0a0] outline-none transition-all"
              />
              {publisherSearch && (
                <button
                  type="button"
                  onClick={() => handlePublisherSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#f0f0f0] transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)]">cancel</span>
                </button>
              )}
            </div>

            <div className="shrink-0 mb-3">
              {publisherSearchLoading && isSearching ? (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">buscando "{publisherSearch}"</p>
              ) : !publisherSearchLoading && isSearching && publisherSearchResults !== null ? (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">
                  {publisherSearchResults.length} resultado{publisherSearchResults.length !== 1 ? 's' : ''} para "{publisherSearch}"
                </p>
              ) : (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">Sugeridos</p>
              )}
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 -mx-8 px-8">
              {publisherSearchLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-[72px] rounded-xl bg-[#f5f5f5] skeleton-shimmer shrink-0" />
                ))
              ) : displayPublishers.length > 0 ? (
                displayPublishers.map(pub => {
                  const alreadyAdded = selectedPublishers.some(p => p.id === pub.id);
                  const justAdded = recentlyAddedItems.has(pub.id);
                  return (
                    <div
                      key={pub.id}
                      className={`flex items-center justify-between p-4 rounded-xl border shrink-0 transition-colors ${
                        alreadyAdded && !justAdded
                          ? 'border-[#e0e0e0] bg-[#fafafa] opacity-40'
                          : 'border-[#e0e0e0] bg-white hover:bg-[#fafafa]'
                      }`}
                      style={justAdded ? { animation: 'itemAddedPulse 300ms ease-out forwards' } : undefined}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <PublisherLogo pub={pub} />
                        <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5 truncate">{pub.name}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addPublisher(pub)}
                        disabled={alreadyAdded}
                        className={`w-10 h-10 flex items-center justify-center rounded-lg border shrink-0 ml-3 transition-all ${
                          alreadyAdded
                            ? 'border-transparent cursor-default'
                            : 'border-[#e0e0e0] bg-white text-[color:var(--sl-fg-base)] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#f5f5f5] active:scale-95'
                        }`}
                        style={justAdded ? { color: '#2b7fff' } : alreadyAdded ? { color: '#c2c2c2' } : undefined}
                      >
                        {alreadyAdded ? (
                          <span
                            className="material-symbols-outlined text-[20px]"
                            style={justAdded ? { animation: 'checkPop 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : undefined}
                          >check</span>
                        ) : (
                          <span className="material-symbols-outlined text-[20px]">add</span>
                        )}
                      </button>
                    </div>
                  );
                })
              ) : isSearching && !publisherSearchLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-3xl text-[#d0d0d0] mb-2">search_off</span>
                  <p className="text-[14px] text-[color:var(--sl-fg-base-soft)]">Nenhum publisher encontrado</p>
                  <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] mt-1">Tente outro termo de busca</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderReservaPublisherPickerModal = () => {
    if (!showReservaPublisherPicker && !reservaPublisherPickerClosing) return null;
    const pool = publisherMode === 'network' ? PUBLISHER_CATALOG : selectedPublishers;
    const suggestedReserva = pool.filter(p => !publishersComReservaSelecionados.some(s => s.id === p.id));
    const displayReserva = reservaPublisherSearch.trim()
      ? (reservaPublisherSearchResults ?? []).filter(p => !publishersComReservaSelecionados.some(s => s.id === p.id))
      : suggestedReserva.slice(0, 12);
    const isSearching = reservaPublisherSearch.trim().length > 0;
    const isLeaving = reservaPublisherPickerClosing;
    const isEntered = reservaPublisherPickerEntered;

    return (
      <>
        <div
          className={`fixed inset-0 z-[400] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-[240ms] ${
            isLeaving ? 'opacity-0' : isEntered ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeReservaPublisherPicker}
        />
        <div
          className={`fixed top-10 left-1/2 z-[401] w-[800px] max-h-[calc(100%-40px)] bg-white border border-[#e0e0e0] rounded-t-xl shadow-[0px_24px_48px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-all duration-[240ms] ease-out ${
            isLeaving ? 'opacity-0 translate-x-[-50%] translate-y-10' : isEntered ? 'opacity-100 translate-x-[-50%] translate-y-0' : 'opacity-0 translate-x-[-50%] translate-y-10'
          }`}
        >
          <div className="flex items-center justify-between h-[80px] px-8 shrink-0">
            <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8 truncate">Selecionar publishers para reserva</h2>
            <button type="button" onClick={closeReservaPublisherPicker} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors shrink-0 -mr-2">
              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]">close</span>
            </button>
          </div>
          <div className="flex flex-col flex-1 min-h-0 pt-6 pb-8 px-8">
            <div className="relative mb-6 shrink-0">
              <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
              <input
                ref={reservaPublisherPickerSearchRef}
                type="text"
                value={reservaPublisherSearch}
                onChange={(e) => handleReservaPublisherSearch(e.target.value)}
                placeholder="Buscar publishers"
                className="w-full h-[48px] pl-11 pr-10 bg-white border border-[#e0e0e0] rounded-xl text-[14px] text-[color:var(--sl-fg-base)] tracking-[-0.14px] placeholder:text-[color:var(--sl-fg-base-muted)] focus:shadow-[0_0_0_3px_#C2C2C2,0_0_0_1px_#fff] focus:border-[#a0a0a0] outline-none transition-all"
              />
              {reservaPublisherSearch && (
                <button type="button" onClick={() => handleReservaPublisherSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#f0f0f0] transition-colors">
                  <span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-muted)]">cancel</span>
                </button>
              )}
            </div>
            <div className="shrink-0 mb-3">
              {reservaPublisherSearchLoading && isSearching ? (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">Buscando &quot;{reservaPublisherSearch}&quot;</p>
              ) : !reservaPublisherSearchLoading && isSearching && reservaPublisherSearchResults !== null ? (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">
                  {reservaPublisherSearchResults.filter(p => !publishersComReservaSelecionados.some(s => s.id === p.id)).length} resultado(s) para &quot;{reservaPublisherSearch}&quot;
                </p>
              ) : (
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">Selecione os publishers que terão reserva de orçamento</p>
              )}
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 -mx-8 px-8">
              {reservaPublisherSearchLoading ? (
                Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[72px] rounded-xl bg-[#f5f5f5] skeleton-shimmer shrink-0" />)
              ) : displayReserva.length > 0 ? (
                displayReserva.map(pub => (
                  <div key={pub.id} className="flex items-center justify-between p-4 rounded-xl border border-[#e0e0e0] bg-white hover:bg-[#fafafa] shrink-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <PublisherLogo pub={pub} />
                      <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5 truncate">{pub.name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addPublisherToReserva(pub)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#e0e0e0] bg-white text-[color:var(--sl-fg-base)] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#f5f5f5] active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                    </button>
                  </div>
                ))
              ) : isSearching && !reservaPublisherSearchLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-3xl text-[#d0d0d0] mb-2">search_off</span>
                  <p className="text-[14px] text-[color:var(--sl-fg-base-soft)]">Nenhum publisher encontrado</p>
                  <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] mt-1">Tente outro termo de busca</p>
                </div>
              ) : suggestedReserva.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-[14px] text-[color:var(--sl-fg-base-soft)]">Todos os publishers já foram adicionados à reserva.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </>
    );
  };

  const productStickyRef = useRef<HTMLDivElement>(null);
  const [productHeaderStuck, setProductHeaderStuck] = useState(false);

  useEffect(() => {
    const sentinel = productStickyRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setProductHeaderStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeStep]);

  const publisherStickyRef = useRef<HTMLDivElement>(null);
  const [publisherHeaderStuck, setPublisherHeaderStuck] = useState(false);

  useEffect(() => {
    const sentinel = publisherStickyRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPublisherHeaderStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeStep]);

  const renderProdutos = () => {

    const productCount = formData.products.length;

    return (
      <div className="flex flex-col gap-10 w-full max-w-[740px]">
        <div className="flex flex-col gap-1">
          <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">Produtos</h2>
          <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Defina quais produtos deseja anunciar nessa campanha</p>
        </div>

        <div className="flex flex-col gap-2">
          <div ref={productStickyRef} className="h-0 w-0" aria-hidden="true" />
          {/* Counter + add button */}
          <div className="sticky -top-8 z-20 py-0 h-[72px] bg-white flex flex-col before:content-[''] before:absolute before:inset-0 before:-left-[9999px] before:-right-[9999px] before:bg-white before:-z-10">
            <div className={`flex items-center justify-between py-2 border-b transition-colors duration-200 h-full ${productHeaderStuck ? 'border-[#e8e8e8]' : 'border-transparent'}`}>
              <span className="text-sm font-medium text-[color:var(--sl-fg-base-soft)]">
                {productCount === 0 ? 'Nenhum SKU' : `${productCount} SKU${productCount !== 1 ? 's' : ''}`}
              </span>
              <div className="flex items-center gap-2">
                {productCount > 1 && (
                  <button
                    type="button"
                    onClick={() => openClearListDialog('products')}
                    className="h-10 px-3 rounded-lg text-sm font-semibold text-[color:var(--sl-fg-base)] hover:text-[color:var(--sl-fg-base)] hover:bg-red-50 active:scale-[0.98] transition-all"
                  >
                    Limpar lista
                  </button>
                )}
                <button
                  type="button"
                  onClick={openBulkAdd}
                  className="h-10 px-3 flex items-center gap-1.5 rounded-lg bg-transparent text-[color:var(--sl-fg-base)] text-[13px] font-medium hover:bg-[#f5f5f5] hover:text-[color:var(--sl-fg-base)] active:scale-[0.98] transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">view_list</span>
                  Em lote
                </button>
                <button
                  type="button"
                  onClick={openProductPicker}
                  className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-[#d5d7da] text-[color:var(--sl-fg-base)] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
            </div>
          </div>

          {/* Product list or empty state */}
          {productCount > 0 ? (
            <div className="flex flex-col gap-2">
              {formData.products.map(p => {
                const catalogInfo = PRODUCT_CATALOG.find(cp => cp.id === p.id);
                return (
                  <div
                    key={p.id}
                    className="group flex items-center gap-[12px] px-4 h-[72px] rounded-xl border border-[#e8e8e8] bg-white hover:border-[#d0d0d0] transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#f5f5f5] border border-[#e8e8e8] shrink-0 overflow-hidden">
                      {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-contain" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate leading-5">{p.name}</p>
                      {catalogInfo && <p className="text-xs text-[color:var(--sl-fg-base-muted)] leading-4">{catalogInfo.sku}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeProduct(p.id)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] transition-all shrink-0"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#f9f9f9] rounded-[12px] flex flex-col items-center justify-center h-[530px] gap-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <p className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px]">Adicione produtos à campanha</p>
                <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Escolha um ou mais produtos para começar a anunciar.</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={openProductPicker}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#d5d7da] text-[color:var(--sl-fg-base)] text-sm font-semibold tracking-[-0.42px] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-[0.98] transition-all"
                >
                  Adicionar SKUs
                </button>
                <button
                  type="button"
                  onClick={openBulkAdd}
                  className="text-sm font-semibold text-[color:var(--sl-fg-base)] hover:text-[color:var(--sl-fg-base)] transition-colors py-1.5 tracking-[-0.42px]"
                >
                  Adicionar em lote
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const DELIVERY_PACE_OPTIONS: { id: SpendingPace; label: string; description: string }[] = [
    { id: 'Conforme a demanda', label: 'Conforme a demanda', description: 'Aumenta a entrega quando há mais oportunidades e pode consumir o orçamento diário mais cedo' },
    { id: 'Distribuído igualmente', label: 'Uniforme', description: 'Distribui a entrega de forma constante ao longo do dia e da campanha' },
  ];

  const formulaNumberClass = 'text-[12px] leading-4 text-[color:var(--sl-fg-base)] font-medium';

  const renderInvestimento = () => {
    const allocationLabel = ALLOCATION_LABEL_BY_FREQUENCY[allocationFrequency];
    const showFormula = allocationFrequency !== 'Única' && allocationAmount > 0;

    return (
      <div className="flex flex-col gap-10 w-full max-w-[740px]">
        {/* Título e subtítulo — Figma: Alocação de orçamento */}
        <div className="flex flex-col gap-1">
          <h2 className="text-[20px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.8px] leading-7">Alocação de orçamento</h2>
          <p className="text-[14px] text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px] leading-5">Defina a alocação do orçamento e como será entregue ao longo da campanha.</p>
        </div>

        {/* Alocação: Frequência + valor */}
        <div className="flex flex-col gap-4">
          <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Alocação</h3>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3 flex-wrap">
              <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                <label className="text-xs font-medium text-[color:var(--sl-fg-base-soft)]">Frequência</label>
                <select
                  value={allocationFrequency}
                  onChange={(e) => setAllocationFrequency(e.target.value as AllocationFrequency)}
                  className="w-full px-4 py-3 border border-[#e0e0e0] rounded-xl bg-white text-sm font-medium text-[color:var(--sl-fg-base)] outline-none focus:ring-2 focus:ring-[#0366dd]/20 focus:border-[#0366dd] appearance-none cursor-pointer"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23707070' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36 }}
                >
                  {ALLOCATION_FREQUENCY_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 min-w-[200px] flex-1">
                <label className="text-xs font-medium text-[color:var(--sl-fg-base-soft)]">{allocationLabel}</label>
                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${
                  budgetErrors.allocation ? 'border-[#d92d20] focus-within:ring-2 focus-within:ring-[#d92d20]/20' : 'border-[#e0e0e0] focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd]'
                }`}>
                  <CurrencyInput
                    value={allocationAmount}
                    onChange={setAllocationAmount}
                    placeholder="5.000,00"
                    className="flex-1 px-4 py-3 bg-white outline-none text-sm font-medium text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)]"
                  />
                  <span className="pr-4 text-sm text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                </div>
                {budgetErrors.allocation && (
                  <p className="text-xs text-[color:var(--sl-fg-base)] mt-0.5">{budgetErrors.allocation}</p>
                )}
              </div>
            </div>
            {allocationFrequency === 'Diária' && (
              <div className="flex gap-3 items-start p-4 rounded-xl bg-[#f1f8fd] border border-[#cbe9ff]">
                <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)] shrink-0 mt-0.5" aria-hidden>info</span>
                <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5">
                  O investimento diário pode variar ao longo da campanha e não corresponder exatamente à média definida. Ao final, o gasto se mantém dentro do orçamento planejado.
                </p>
              </div>
            )}
            {/* Alocação máxima total da campanha */}
            <div className="bg-[#f5f5f5] rounded-xl p-4 flex flex-col gap-2.5">
              <p className="text-[12px] font-medium text-[color:var(--sl-fg-base)] leading-4">Alocação máxima total da campanha</p>
              <p className="text-[20px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.8px] leading-7">
                {isUnlimitedAllocation ? 'Sem limites' : maxTotalAllocation > 0 ? `R$ ${formatBRL(maxTotalAllocation)} ` : '—'}
              </p>
              {showFormula && (
                <p className="text-[12px] text-[color:var(--sl-fg-base)] leading-4">
                  <span className="text-[color:var(--sl-fg-base-soft)]">= </span>
                  <span className={formulaNumberClass}>{formatBRL(allocationAmount)}</span>
                  <span className="text-[color:var(--sl-fg-base-soft)]"> BRL alocação média </span>
                  <span className={formulaNumberClass}> x {campaignDays > 0 ? campaignDays : '∞'} </span>
                  <span className="text-[color:var(--sl-fg-base-soft)]">duração da campanha (dias)</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Reserva por publisher — toggle: desativado = todos com mesmo budget; ativado = usuário seleciona publishers para reserva */}
        <div className="flex flex-col gap-4 w-full max-w-[740px]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Reserva por publisher</h3>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={reservaPorPublisherEnabled}
                onClick={() => setReservaPorPublisherEnabled((prev) => !prev)}
                className={`shrink-0 relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0366dd]/30 focus:ring-offset-2 ${reservaPorPublisherEnabled ? 'bg-[#0366dd]' : 'bg-[#e0e0e0]'}`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${reservaPorPublisherEnabled ? 'left-6' : 'left-1'}`}
                />
              </button>
            </div>
          </div>
          {reservaPorPublisherEnabled && (
            <>
              {reservaPool.length > 0 ? (
                <>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={openReservaPublisherPicker}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#e0e0e0] bg-white text-[color:var(--sl-fg-base)] text-sm font-medium hover:bg-[#fafafa] hover:border-[#c2c2c2] transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      Adicionar publisher
                    </button>
                  </div>
                  {publishersComReservaSelecionados.length > 0 ? (
                    <div className="border border-[#e8e8e8] rounded-xl overflow-hidden bg-white">
                      <ul className="divide-y divide-[#e8e8e8] list-none p-0 m-0">
                        {publishersComReservaSelecionados.map((pub) => {
                          const reserved = publisherBudgetReservations[pub.id] ?? 0;
                          return (
                            <li key={pub.id} className="flex items-center gap-4 px-4 py-3 min-w-0 group">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-xs font-bold" style={{ backgroundColor: pub.logoBg || '#e0e0e0' }}>
                                {publisherInitials(pub.name)}
                              </div>
                              <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate min-w-0 flex-1">{pub.name}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center border border-[#e0e0e0] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] transition-all min-w-[120px]">
                                  <CurrencyInput
                                    value={reserved}
                                    onChange={(v) => setPublisherBudgetReservations((prev) => ({ ...prev, [pub.id]: Math.max(0, v) }))}
                                    placeholder="0"
                                    className="flex-1 px-3 py-2 bg-white outline-none text-sm font-medium text-[color:var(--sl-fg-base)] placeholder:text-[color:var(--sl-fg-base-muted)] text-right min-w-0"
                                  />
                                  <span className="pr-4 text-sm text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removePublisherFromReserva(pub.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-[color:var(--sl-fg-base-muted)] hover:text-[color:var(--sl-fg-base-soft)] transition-all shrink-0"
                                  title="Remover da reserva (orçamento será redistribuído)"
                                >
                                  <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {(() => {
                        const totalBudget = isUnlimitedAllocation ? 0 : maxTotalAllocation;
                        const reservedTotal = publishersComReservaSelecionados.reduce((s, p) => s + (publisherBudgetReservations[p.id] ?? 0), 0);
                        const remaining = totalBudget > 0 ? Math.max(0, totalBudget - reservedTotal) : 0;
                        const overBudget = totalBudget > 0 && reservedTotal > totalBudget;
                        const demaisCount = reservaPool.length - publishersComReservaSelecionados.length;
                        return (
                          <div className={`px-4 py-3 border-t border-[#e8e8e8] flex flex-wrap items-center justify-between gap-2 text-[12px] ${overBudget ? 'bg-[#fef3f2] text-[color:var(--sl-fg-base)]' : 'bg-[#fafafa] text-[color:var(--sl-fg-base-soft)]'}`}>
                            <span>
                              {overBudget
                                ? `A soma das reservas (R$ ${formatBRL(reservedTotal)}) excede o orçamento (R$ ${formatBRL(totalBudget)}).`
                                : demaisCount > 0
                                  ? `Restante: R$ ${formatBRL(remaining)} será redistribuído entre os demais ${demaisCount} publisher${demaisCount !== 1 ? 's' : ''} (não listados acima).`
                                  : reservedTotal > 0
                                    ? 'Todo o orçamento reservado para os publishers listados.'
                                    : 'Defina valores para reservar parte do orçamento por publisher.'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">
                      Nenhum publisher selecionado. Clique no botão acima para escolher quais terão reserva; os demais compartilham o orçamento restante.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">
                  Selecione publishers na seção Publishers para definir reservas de orçamento por publisher.
                </p>
              )}
            </>
          )}
        </div>

        {/* Ritmo de entrega */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Ritmo de entrega</h3>
            <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">Escolha como o orçamento diário será consumido ao longo do dia e da campanha</p>
          </div>
          <div className="flex flex-col gap-2">
            {DELIVERY_PACE_OPTIONS.map(opt => {
              const isSelected = spendingPace === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSpendingPace(opt.id)}
                  className={`flex items-center justify-between w-full px-4 py-3 h-fit rounded-xl text-left transition-all border-[1.5px] shadow-[0_1px_1px_rgba(0,0,0,0.08)] ${
                    isSelected
                      ? 'bg-[#f1f8fd] border-[#0366dd]'
                      : 'bg-white border-[#e0e0e0] hover:border-[#c2c2c2]'
                  }`}
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px]">{opt.label}</p>
                    <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">{opt.description}</p>
                  </div>
                  <div className="shrink-0 ml-4">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-[#0366dd] flex items-center justify-center">
                        <div className="w-[8px] h-[8px] rounded-full bg-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-[#c2c2c2] bg-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const updateCondition = (groupId: string, condId: string, patch: Partial<SegmentCondition>) => {
    setSegmentGroups(prev => prev.map(g => g.id === groupId ? { ...g, conditions: g.conditions.map(c => c.id === condId ? { ...c, ...patch } : c) } : g));
  };
  const addConditionToGroup = (groupId: string) => {
    setSegmentGroups(prev => prev.map(g => g.id === groupId ? { ...g, conditions: [...g.conditions, makeCondition()] } : g));
  };
  const removeCondition = (groupId: string, condId: string) => {
    setSegmentGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const filtered = g.conditions.filter(c => c.id !== condId);
      return filtered.length > 0 ? { ...g, conditions: filtered } : g;
    }).filter(g => g.conditions.length > 0));
  };
  const removeGroup = (groupId: string) => {
    setSegmentGroups(prev => prev.filter(g => g.id !== groupId));
  };
  const toggleGroupLogic = (groupId: string) => {
    setSegmentGroups(prev => prev.map(g => g.id === groupId ? { ...g, logic: g.logic === 'AND' ? 'OR' : 'AND' } : g));
  };

  const renderSegmentacao = () => {
    const hasConditions = segmentGroups.length > 0;
    const isCustom = targeting === 'Personalizada';

    const renderConditionRow = (group: SegmentGroup, cond: SegmentCondition, idx: number) => {
      const dimMeta = SEGMENT_DIMENSIONS.find(d => d.key === cond.dimension);
      const operators = dimMeta?.operators || ['is', 'is_not', 'contains'];
      const suggestions = dimMeta?.suggestions || [];

      return (
        <div key={cond.id} className="flex items-center gap-2 animate-[fadeInUp_300ms_ease-out]">
          {idx > 0 && (
            <button
              type="button"
              onClick={() => toggleGroupLogic(group.id)}
              className="shrink-0 w-10 h-7 flex items-center justify-center rounded-md text-[11px] font-semibold tracking-wide text-[color:var(--sl-fg-base)] bg-white border border-[#e0e0e0] hover:border-[#c2c2c2] transition-colors"
            >
              {group.logic === 'AND' ? 'E' : 'OU'}
            </button>
          )}
          {idx === 0 && <div className="shrink-0 w-10" />}

          <div className="flex-1 flex items-center gap-2 bg-white border border-[#e0e0e0] rounded-xl px-3 py-2.5 hover:border-[#c2c2c2] transition-colors min-w-0">
            {/* Dimension selector */}
            <div className="relative min-w-0">
              <select
                value={cond.dimension}
                onChange={e => {
                  const dim = e.target.value as SegmentDimension;
                  const newOps = SEGMENT_DIMENSIONS.find(d => d.key === dim)?.operators || ['is'];
                  updateCondition(group.id, cond.id, { dimension: dim, operator: newOps[0], value: '' });
                }}
                className="appearance-none bg-transparent text-sm font-medium text-[color:var(--sl-fg-base)] pr-5 outline-none cursor-pointer min-w-[120px]"
              >
                <option value="" disabled>Selecionar...</option>
                {SEGMENT_DIMENSIONS.map(d => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-muted)] absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
            </div>

            <div className="w-px h-5 bg-[#e8e8e8] shrink-0" />

            {/* Operator selector */}
            <div className="relative min-w-0">
              <select
                value={cond.operator}
                onChange={e => updateCondition(group.id, cond.id, { operator: e.target.value as SegmentOperator })}
                className="appearance-none bg-transparent text-sm text-[color:var(--sl-fg-base-soft)] pr-5 outline-none cursor-pointer min-w-[80px]"
              >
                {operators.map(op => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                ))}
              </select>
              <span className="material-symbols-outlined text-[14px] text-[color:var(--sl-fg-base-muted)] absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
            </div>

            <div className="w-px h-5 bg-[#e8e8e8] shrink-0" />

            {/* Value input */}
            <div className="flex-1 min-w-0 relative">
              <input
                type="text"
                value={cond.value}
                onChange={e => updateCondition(group.id, cond.id, { value: e.target.value })}
                placeholder={suggestions[0] ? `Ex: ${suggestions[0]}` : 'Valor...'}
                list={`suggestions-${cond.id}`}
                className="w-full bg-transparent text-sm text-[color:var(--sl-fg-base)] outline-none placeholder:text-[#c2c2c2]"
              />
              {suggestions.length > 0 && (
                <datalist id={`suggestions-${cond.id}`}>
                  {suggestions.map(s => <option key={s} value={s} />)}
                </datalist>
              )}
            </div>
          </div>

          {/* Remove condition */}
          <button
            type="button"
            onClick={() => removeCondition(group.id, cond.id)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-[#c2c2c2] hover:text-[color:var(--sl-fg-base)] hover:bg-red-50 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      );
    };

    const renderGroup = (group: SegmentGroup, groupIdx: number) => (
      <div key={group.id} className="flex flex-col gap-0">
        {/* Group connector */}
        {groupIdx > 0 && (
          <div className="flex items-center gap-3 py-3">
            <div className="flex-1 h-px bg-[#e8e8e8]" />
            <button
              type="button"
              onClick={() => setGroupsLogic(prev => prev === 'AND' ? 'OR' : 'AND')}
              className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide border border-[#e0e0e0] text-[color:var(--sl-fg-base)] bg-white hover:border-[#c2c2c2] transition-all"
            >
              {groupsLogic === 'AND' ? 'E' : 'OU'}
            </button>
            <div className="flex-1 h-px bg-[#e8e8e8]" />
          </div>
        )}

        <div className="bg-[#fafafa] rounded-xl border border-[#e8e8e8] p-4">
          <div className="flex flex-col gap-2">
            {group.conditions.map((cond, idx) => renderConditionRow(group, cond, idx))}
          </div>

          <div className="flex items-start justify-between mt-3 pt-1 pb-1">
            <button
              type="button"
              onClick={() => addConditionToGroup(group.id)}
              className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--sl-fg-base)] hover:text-[color:var(--sl-fg-base)] transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Condição
            </button>
            {segmentGroups.length > 1 && (
              <button
                type="button"
                onClick={() => removeGroup(group.id)}
                className="flex items-center gap-1 text-sm text-[#c2c2c2] hover:text-[color:var(--sl-fg-base)] transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">delete</span>
                Remover grupo
              </button>
            )}
          </div>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col gap-8 w-full max-w-[740px]">
        <div className="flex flex-col gap-1">
          <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">Segmentação</h2>
          <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Defina regras para segmentar o público-alvo desta campanha.</p>
        </div>

        {/* Mode toggle */}
        <div className="relative flex items-center p-1 bg-[#f5f5f5] rounded-lg w-fit">
          <div
            className="absolute top-1 bottom-1 rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            style={{
              left: toggleIndicator.left || 4,
              width: toggleIndicator.width || 'auto',
              transition: 'left 400ms cubic-bezier(0.34, 1.12, 0.64, 1), width 400ms cubic-bezier(0.34, 1.12, 0.64, 1)',
            }}
          />
          {(['Automática', 'Personalizada'] as const).map(opt => (
            <button
              key={opt}
              ref={el => { toggleBtnRefs.current[opt] = el; }}
              type="button"
              onClick={() => {
                setTargeting(opt);
                if (opt === 'Personalizada' && segmentGroups.length === 0) {
                  setSegmentGroups([makeGroup()]);
                }
              }}
              className={`relative z-[1] px-5 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${
                targeting === opt
                  ? 'text-[color:var(--sl-fg-base)]'
                  : 'text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)]'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        {/* Condition builder */}
        {isCustom && (
          <div className="flex flex-col gap-0">
            {/* Groups */}
            {segmentGroups.map((group, idx) => renderGroup(group, idx))}

            {/* Add group button */}
            <button
              type="button"
              onClick={() => setSegmentGroups(prev => [...prev, makeGroup()])}
              className="flex items-center justify-center gap-2 mt-4 py-3 rounded-xl border border-dashed border-[#d0d0d0] text-sm font-semibold text-[color:var(--sl-fg-base)] hover:border-[#0366dd] hover:text-[color:var(--sl-fg-base-soft)] hover:bg-[#f9fbfe] transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle_outline</span>
              Adicionar grupo de condições
            </button>

            {/* Summary */}
            {hasConditions && segmentGroups.some(g => g.conditions.some(c => c.dimension && c.value)) && (
              <div className="mt-6 p-4 bg-[#f9f9f9] rounded-xl border border-[#e8e8e8]">
                <p className="text-xs font-medium text-[color:var(--sl-fg-base-soft)] mb-2 uppercase tracking-wider">Resumo da segmentação</p>
                <p className="text-sm text-[color:var(--sl-fg-base)] leading-6">
                  {segmentGroups.map((g, gi) => {
                    const filled = g.conditions.filter(c => c.dimension && c.value);
                    if (filled.length === 0) return null;
                    const parts = filled.map((c, ci) => {
                      const dimLabel = SEGMENT_DIMENSIONS.find(d => d.key === c.dimension)?.label || c.dimension;
                      return (
                        <span key={c.id}>
                          {ci > 0 && <span className="text-[color:var(--sl-fg-base-soft)] font-semibold"> {g.logic === 'AND' ? ' e ' : ' ou '}</span>}
                          <span className="font-medium">{dimLabel}</span>
                          <span className="text-[color:var(--sl-fg-base-soft)]"> {OPERATOR_LABELS[c.operator]} </span>
                          <span className="font-semibold text-[color:var(--sl-fg-base-soft)]">{c.value}</span>
                        </span>
                      );
                    });
                    return (
                      <span key={g.id}>
                        {gi > 0 && <span className="text-[color:var(--sl-fg-base-soft)] font-semibold"> {groupsLogic === 'AND' ? ' e ' : ' ou '} </span>}
                        {filled.length > 1 ? <span>(</span> : null}
                        {parts}
                        {filled.length > 1 ? <span>)</span> : null}
                      </span>
                    );
                  })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* No segmentation info */}
        {!isCustom && (
          <div className="bg-[#f9f9f9] rounded-[12px] flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-[32px] text-[#d0d0d0]">auto_awesome</span>
            <p className="text-sm text-[color:var(--sl-fg-base-soft)] text-center max-w-[320px]">O sistema irá otimizar a entrega para o melhor público dado os produtos e objetivos definidos.</p>
          </div>
        )}
      </div>
    );
  };

  const openMediaDrawer = () => {
    setShowMediaDrawer(true);
    setMediaDrawerClosing(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setMediaDrawerEntered(true)));
  };

  const closeMediaDrawer = () => {
    setMediaDrawerClosing(true);
    setMediaDrawerEntered(false);
    setTimeout(() => { setShowMediaDrawer(false); setMediaDrawerClosing(false); }, 400);
  };

  const generateAutoPlan = () => {
    if (isGeneratingPlan) return;
    setIsGeneratingPlan(true);
    setGenerationPhase(0);

    setTimeout(() => setGenerationPhase(1), 800);
    setTimeout(() => setGenerationPhase(2), 1800);

    setTimeout(() => {
      const allTypes = [...ALL_MEDIA_TYPES];
      const budget = formData.budget || 60000;
      const perType = Math.floor(budget / allTypes.length);
      const remainder = budget - perType * allTypes.length;

      const newBudgets: Record<string, number> = {};
      const newAllocModes: Record<string, 'intelligent' | 'manual'> = {};
      const newCpc: Record<string, number> = {};
      const newCpm: Record<string, number> = {};
      allTypes.forEach((mt, i) => {
        newBudgets[mt] = perType + (i === allTypes.length - 1 ? remainder : 0);
        newAllocModes[mt] = 'intelligent';
        const meta = MEDIA_TYPE_META[mt];
        if (meta?.pricing === 'CPC') { newCpc[mt] = 2.9; newCpm[mt] = 3.2; }
        else if (meta?.pricing === 'CPM') { newCpm[mt] = 1.5; }
      });

      setFormData(prev => ({ ...prev, mediaTypes: allTypes }));
      setMediaBudgets(newBudgets);
      setMediaAllocMode(newAllocModes);
      setMediaCpc(newCpc);
      setMediaCpm(newCpm);
      setIsGeneratingPlan(false);
      setGenerationPhase(0);
    }, 2800);
  };

  const openMediaDetail = (mt: string) => {
    const initial = {
      allocMode: (mediaAllocMode[mt] || 'manual') as 'intelligent' | 'manual',
      budget: mediaBudgets[mt] || 0,
      dailyBudget: 0,
      cpc: mediaCpc[mt] || 0,
      cpm: mediaCpm[mt] || 0,
    };
    setMediaDetailDraft({ ...initial });
    mediaDetailInitialRef.current = { ...initial };
    setMediaDetailOpen(mt);
    setMediaDetailClosing(false);
    setMediaDetailEntered(false);
    requestAnimationFrame(() => setMediaDetailEntered(true));
  };

  const closeMediaDetail = useCallback(() => {
    setMediaDetailClosing(true);
    setMediaDetailEntered(false);
  }, []);

  useEffect(() => {
    if (!mediaDetailClosing) return;
    const id = setTimeout(() => {
      setMediaDetailOpen(null);
      setMediaDetailClosing(false);
      setMediaDetailDraft(null);
    }, 280);
    return () => clearTimeout(id);
  }, [mediaDetailClosing]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (submitErrors && !submitErrorsClosing) { closeSubmitErrors(); return; }
      if (clearListConfirm && !clearListClosing) { closeClearListDialog(); return; }
      if (mediaDetailOpen && !mediaDetailClosing) { closeMediaDetail(); return; }
      if (showBulkAdd && !bulkAddClosing) { closeBulkAdd(); return; }
      if (showProductPicker && !productPickerClosing) { closeProductPicker(); return; }
      if (showPublisherPicker && !publisherPickerClosing) { closePublisherPicker(); return; }
      if (showReservaPublisherPicker && !reservaPublisherPickerClosing) { closeReservaPublisherPicker(); return; }
      if (showMediaDrawer && !mediaDrawerClosing) { closeMediaDrawer(); return; }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    submitErrors, submitErrorsClosing, closeSubmitErrors,
    clearListConfirm, clearListClosing, closeClearListDialog,
    mediaDetailOpen, mediaDetailClosing, closeMediaDetail,
    showBulkAdd, bulkAddClosing, closeBulkAdd,
    showProductPicker, productPickerClosing, closeProductPicker,
    showPublisherPicker, publisherPickerClosing, closePublisherPicker,
    showReservaPublisherPicker, reservaPublisherPickerClosing, closeReservaPublisherPicker,
    showMediaDrawer, mediaDrawerClosing,
  ]);

  const applyMediaDetail = () => {
    if (!mediaDetailOpen || !mediaDetailDraft) return;
    const mt = mediaDetailOpen;
    setMediaAllocMode(prev => ({ ...prev, [mt]: mediaDetailDraft.allocMode }));
    setMediaBudgets(prev => ({ ...prev, [mt]: mediaDetailDraft.budget }));
    setMediaCpc(prev => ({ ...prev, [mt]: mediaDetailDraft.cpc }));
    setMediaCpm(prev => ({ ...prev, [mt]: mediaDetailDraft.cpm }));
    closeMediaDetail();
  };

  const discardMediaDetail = () => {
    if (mediaDetailInitialRef.current) {
      setMediaDetailDraft({ ...mediaDetailInitialRef.current });
    }
  };

  const ALLOWED_BANNER_SIZES = '160×600, 300×250, 320×50, 320×100, 320×280, 336×280, 644×90, 688×200, 688×320, 728×90, 1352×120, 1352×360';

  const handleBannerFiles = (files: FileList | null, mt: string) => {
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setBannerImages(prev => ({
          ...prev,
          [mt]: [...(prev[mt] || []), { id: crypto.randomUUID(), name: file.name, previewUrl: url, width: img.naturalWidth, height: img.naturalHeight }],
        }));
      };
      img.src = url;
    });
  };

  const removeBannerImage = (mt: string, imageId: string) => {
    setBannerImages(prev => ({
      ...prev,
      [mt]: (prev[mt] || []).filter(i => i.id !== imageId),
    }));
  };

  const isBannerMedia = (mt: string) => mt === 'Banner patrocinado' || mt === 'Banner Patrocinado Offsite';
  const isBannerOffsite = (mt: string) => mt === 'Banner Patrocinado Offsite';
  const isMarcaPatrocinada = (mt: string) => mt === 'Marca patrocinada';

  const OFFSITE_PUBLISHERS = ['Instagram', 'Buscapé', 'Globo.com'];

  /** Por padrão, todos os publishers da campanha são os varejistas de destino para a variação do banner. */
  const offsiteRetailersUniverse = selectedPublishers.map((p) => p.name);

  const getOffsitePublishers = (mt: string) => offsitePublishers[mt] ?? OFFSITE_PUBLISHERS;
  /** Varejistas de destino = todos os publishers da campanha (não exibimos seletor; uso direto nas variações). */
  const getOffsiteRetailers = (_mt: string) => offsiteRetailersUniverse;
  const setOffsitePublishersFor = (mt: string, list: string[]) => setOffsitePublishers(prev => ({ ...prev, [mt]: list }));

  /** Variações conforme o modo: só publisher (1 por publisher), só varejista (1 por varejista), ou ambos (1 por combinação). */
  const offsiteVariations = (mt: string): { publisher: string; retailer: string }[] => {
    const mode = offsiteBannerVariationMode[mt] ?? 'none';
    const pubs = getOffsitePublishers(mt);
    const rets = getOffsiteRetailers(mt);
    if (mode === 'publisher') return pubs.map(p => ({ publisher: p, retailer: '' }));
    if (mode === 'retailer') return rets.map(r => ({ publisher: '', retailer: r }));
    if (mode === 'both') return pubs.flatMap(p => rets.map(r => ({ publisher: p, retailer: r })));
    return [];
  };

  const offsiteVariationLabel = (v: { publisher: string; retailer: string }, mode: 'publisher' | 'retailer' | 'both') => {
    if (mode === 'publisher') return v.publisher;
    if (mode === 'retailer') return v.retailer;
    return `${v.publisher} → ${v.retailer}`;
  };

  const offsiteVariationKey = (v: { publisher: string; retailer: string }) =>
    v.publisher ? `${v.publisher}-${v.retailer}` : v.retailer;

  /** Chave de armazenamento do banner: por variação (1 banner por variação) ou só mt quando "Não varia". */
  const offsiteBannerStorageKey = (mt: string): string => {
    const mode = offsiteBannerVariationMode[mt] ?? 'none';
    if (mode === 'none') return mt;
    const sel = offsiteSelectedVariation[mt];
    if (!sel) return mt;
    return `${mt}\u241F${sel.publisher}\u241F${sel.retailer}`;
  };

  /** Total de banners para offsite: 1 por variação ou só mt quando "Não varia". */
  const offsiteBannerCount = (mt: string): number => {
    if (mt !== 'Banner Patrocinado Offsite') return (bannerImages[mt] || []).length;
    const mode = offsiteBannerVariationMode[mt] ?? 'none';
    if (mode === 'none') return (bannerImages[mt] || []).length;
    const prefix = `${mt}\u241F`;
    return Object.keys(bannerImages).filter(k => k === mt || k.startsWith(prefix)).reduce((sum, k) => sum + (bannerImages[k] || []).length, 0);
  };

  const ALLOWED_OFFSITE_BANNER_SIZES = '160×600, 300×250, 320×50, 320×100, 320×280, 336×280, 644×90, 688×200, 688×320, 728×90, 1352×120, 1352×360';

  const getShowcase = (mt: string) => showcaseData[mt] || { logoImages: [], mediaImages: [], title: '', description: '', brandName: '' };
  const updateShowcase = (mt: string, patch: Partial<typeof showcaseData[string]>) => {
    setShowcaseData(prev => ({ ...prev, [mt]: { ...getShowcase(mt), ...patch } }));
  };

  const handleShowcaseFiles = (files: FileList | null, mt: string, field: 'logoImages' | 'mediaImages', maxItems?: number) => {
    if (!files) return;
    const fileArray = maxItems ? Array.from(files).slice(0, maxItems) : Array.from(files);
    fileArray.forEach(file => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          const current = getShowcase(mt);
          updateShowcase(mt, { [field]: [...current[field], { id: crypto.randomUUID(), name: file.name, previewUrl: url, width: video.videoWidth, height: video.videoHeight }] });
        };
        video.src = url;
      } else {
        const img = new Image();
        img.onload = () => {
          const current = getShowcase(mt);
          updateShowcase(mt, { [field]: [...current[field], { id: crypto.randomUUID(), name: file.name, previewUrl: url, width: img.naturalWidth, height: img.naturalHeight }] });
        };
        img.src = url;
      }
    });
  };

  const removeShowcaseImage = (mt: string, field: 'logoImages' | 'mediaImages', imageId: string) => {
    const current = getShowcase(mt);
    updateShowcase(mt, { [field]: current[field].filter(i => i.id !== imageId) });
  };

  const removeMediaType = (mt: string) => {
    setFormData(prev => ({ ...prev, mediaTypes: prev.mediaTypes.filter(t => t !== mt) }));
    setMediaBudgets(prev => { const n = { ...prev }; delete n[mt]; return n; });
    setMediaAllocMode(prev => { const n = { ...prev }; delete n[mt]; return n; });
    setMediaCpc(prev => { const n = { ...prev }; delete n[mt]; return n; });
    setMediaCpm(prev => { const n = { ...prev }; delete n[mt]; return n; });
  };

  const renderMediaPickerDrawer = () => {
    if (!showMediaDrawer) return null;
    return (
      <>
        <div
          className={`fixed inset-0 z-[250] transition-opacity duration-300 ${mediaDrawerEntered && !mediaDrawerClosing ? 'opacity-100' : 'opacity-0'}`}
          onClick={closeMediaDrawer}
        />
        <div
          className={`fixed right-0 top-0 bottom-0 z-[260] w-[520px] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.06)] flex flex-col transition-transform duration-[400ms] ease-in-out ${
            mediaDrawerEntered && !mediaDrawerClosing ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-center justify-between px-6 pt-6 shrink-0">
            <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">Adicionar mídia</h2>
            <button type="button" onClick={closeMediaDrawer} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] transition-colors">
              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)]">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6" style={{ paddingTop: 32 }}>
            <p className="text-sm text-[color:var(--sl-fg-base-soft)] mb-4">Selecione os formatos que deseja adicionar ao plano.</p>
            <div className="flex flex-col gap-2">
              {ALL_MEDIA_TYPES.map(type => {
                const isSelected = formData.mediaTypes.includes(type);
                const meta = MEDIA_TYPE_META[type] || { color: '#e0e0e0', icon: 'help', subtitle: '' };
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        removeMediaType(type);
                      } else {
                        toggleMediaType(type);
                        setMediaAllocMode(prev => ({ ...prev, [type]: 'manual' }));
                      }
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-all border-[1.5px] ${
                      isSelected
                        ? 'bg-[#f1f8fd] border-[#0366dd]'
                        : 'bg-white border-[#e0e0e0] hover:border-[#c2c2c2]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
                      <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base)] opacity-60">{meta.icon}</span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-medium text-[color:var(--sl-fg-base)]">{type}</span>
                      <span className="text-xs text-[color:var(--sl-fg-base-soft)]">{meta.subtitle}</span>
                    </div>
                    {isSelected && (
                      <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)] shrink-0">check_circle</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderMediaDetailModal = () => {
    if (!mediaDetailOpen || !mediaDetailDraft) return null;
    const mt = mediaDetailOpen;
    const meta = MEDIA_TYPE_META[mt] || { color: '#e0e0e0', icon: 'help', subtitle: '', pricing: 'CPC' };
    const isIntelligent = mediaDetailDraft.allocMode === 'intelligent';
    const pricingLabel = meta.pricing === 'CPM' ? 'Custo por mil impressões máximo' : 'Custo por clique máximo';
    const pricingValue = meta.pricing === 'CPM' ? mediaDetailDraft.cpm : mediaDetailDraft.cpc;
    const ini = mediaDetailInitialRef.current;
    const hasChanges = !ini || ini.allocMode !== mediaDetailDraft.allocMode || ini.budget !== mediaDetailDraft.budget || ini.dailyBudget !== mediaDetailDraft.dailyBudget || ini.cpc !== mediaDetailDraft.cpc || ini.cpm !== mediaDetailDraft.cpm;
    const setPricingValue = (v: number) => {
      setMediaDetailDraft(prev => prev ? ({
        ...prev,
        ...(meta.pricing === 'CPM' ? { cpm: v } : { cpc: v }),
      }) : prev);
    };

    const isLeaving = mediaDetailClosing;
    const isEntered = mediaDetailEntered;

    return (
      <>
        <div
          className={`fixed inset-0 z-[500] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-[280ms] ${
            isLeaving ? 'opacity-0' : isEntered ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeMediaDetail}
        />
        <div className="fixed inset-0 z-[501] flex items-center justify-center pointer-events-none">
          <div
            className={`relative bg-white rounded-2xl shadow-[0_24px_48px_rgba(0,0,0,0.12)] w-[calc(100%-80px)] max-w-[1440px] h-[calc(100%-80px)] flex flex-col pointer-events-auto transition-all duration-[280ms] ease-out ${
              isLeaving
                ? 'opacity-0 scale-[0.97] translate-y-2'
                : isEntered
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-[0.97] translate-y-2'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 h-[80px] shrink-0 border-b border-[#f0f0f0]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
                  <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)] opacity-60">{meta.icon}</span>
                </div>
                <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">{mt}</h2>
              </div>
              <div className="flex items-center gap-3">
                {hasChanges ? (
                  <>
                    <button
                      type="button"
                      onClick={discardMediaDetail}
                      className="h-10 px-4 rounded-lg text-[14px] font-semibold text-[color:var(--sl-fg-base)] hover:text-[color:var(--sl-fg-base)] hover:bg-[#f5f5f5] active:scale-[0.98] transition-colors tracking-[-0.42px]"
                    >
                      Descartar tudo
                    </button>
                    <button
                      type="button"
                      onClick={applyMediaDetail}
                      className="h-10 px-4 rounded-lg bg-[#1570ef] text-white text-[14px] font-semibold tracking-[-0.42px] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#1260d4] active:scale-[0.98] transition-all"
                    >
                      Aplicar alterações
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={closeMediaDetail}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#f5f5f5] transition-colors -mr-2"
                  >
                    <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* Body: two or three columns based on media type */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {isBannerOffsite(mt) ? (
                /* Banner Offsite: 3-column layout per Figma */
                <>
                  {/* Left: Publishers, Varejistas, Investimento */}
                  <div className="w-[400px] shrink-0 border-r border-[#f0f0f0] flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8">
                      {/* Section: Canais offsite (multiselect) */}
                      <section className="flex flex-col gap-3 shrink-0" ref={offsitePublishersDropdownRef}>
                        <div>
                          <h3 className="text-[15px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.3px] leading-5">Canais offsite</h3>
                          <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4 mt-0.5">Onde o banner será veiculado.</p>
                        </div>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOffsitePublishersDropdownOpen(prev => !prev)}
                            className="w-full flex flex-wrap items-center gap-2 py-2 px-2 rounded-xl border border-[#e8e8e8] bg-white min-h-[48px] h-fit text-left transition-colors hover:border-[#c2c2c2] focus:outline-none focus:ring-2 focus:ring-[#0366dd]/20 focus:border-[#0366dd]"
                            aria-haspopup="listbox"
                            aria-expanded={offsitePublishersDropdownOpen}
                          >
                            {getOffsitePublishers(mt).length > 0 ? (
                              getOffsitePublishers(mt).map((pub) => (
                                <span key={pub} className="inline-flex items-center gap-1 pl-2 pr-1 pt-[3px] pb-[3px] rounded-lg bg-[#fafafa] text-[13px] font-medium leading-[20px] text-[#111111] border border-[#e8e8e8] shadow-sm h-fit">
                                  {pub}
                                  <button type="button" onClick={(e) => { e.stopPropagation(); setOffsitePublishersFor(mt, getOffsitePublishers(mt).filter(p => p !== pub)); }} className="p-0.5 rounded hover:bg-[#f0f0f0] text-[color:var(--sl-fg-base-soft)] transition-colors" aria-label="Remover">
                                    <span className="material-symbols-outlined text-[14px] leading-none">close</span>
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-[13px] text-[color:var(--sl-fg-base-muted)]">Selecione os canais</span>
                            )}
                            <span className="material-symbols-outlined ml-auto text-[18px] text-[color:var(--sl-fg-base-soft)] shrink-0 transition-transform" style={{ transform: offsitePublishersDropdownOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                          </button>
                          {offsitePublishersDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 z-50 mt-1 py-1 rounded-xl border border-[#e8e8e8] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] max-h-[240px] overflow-y-auto" role="listbox">
                              {OFFSITE_PUBLISHERS.map((opt) => {
                                const selected = getOffsitePublishers(mt).includes(opt);
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => {
                                      if (selected) setOffsitePublishersFor(mt, getOffsitePublishers(mt).filter(p => p !== opt));
                                      else setOffsitePublishersFor(mt, [...getOffsitePublishers(mt), opt]);
                                    }}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-[13px] font-medium text-[color:var(--sl-fg-base)] hover:bg-[#f5f5f5] transition-colors"
                                  >
                                    <span className={`flex items-center justify-center w-5 h-5 rounded border shrink-0 ${selected ? 'bg-[#0366dd] border-[#0366dd]' : 'border-[#c2c2c2]'}`}>
                                      {selected && <span className="material-symbols-outlined text-white text-[14px]">check</span>}
                                    </span>
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Section: Investimento */}
                      <section className="flex flex-col gap-4 shrink-0">
                        <div>
                          <h3 className="text-[15px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.3px] leading-5">Investimento</h3>
                          <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4 mt-0.5">Alocação e lance para esta mídia.</p>
                        </div>

                        <div className="flex flex-col gap-4">
                          <div>
                            <h4 className="text-[14px] font-medium text-[color:var(--sl-fg-base)] leading-5 mb-3 tracking-[-0.25px]">Alocação</h4>
                            <label className="flex items-center gap-3 cursor-pointer">
                              <button type="button" onClick={() => setMediaDetailDraft(prev => prev ? ({ ...prev, allocMode: prev.allocMode === 'intelligent' ? 'manual' : 'intelligent' }) : prev)} className={`relative w-[36px] h-[20px] rounded-full shrink-0 transition-colors duration-300 ease-[cubic-bezier(0.34,1.12,0.64,1)] ${mediaDetailDraft?.allocMode === 'intelligent' ? 'bg-[#32a436]' : 'bg-[#e0e0e0]'}`}>
                                <div className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]" style={{ left: mediaDetailDraft?.allocMode === 'intelligent' ? '18px' : '2px', transition: 'left 400ms cubic-bezier(0.34, 1.12, 0.64, 1)' }} />
                              </button>
                              <span className="text-[14px] font-medium text-[color:var(--sl-fg-base)] leading-5">Alocação inteligente</span>
                            </label>
                          </div>

                          {mediaDetailDraft?.allocMode !== 'intelligent' && (
                            <div className="flex flex-col gap-3 pl-0">
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">Alocação total</label>
                                <div className="flex items-center border border-[#e0e0e0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] transition-all h-11">
                                  <CurrencyInput value={mediaDetailDraft?.budget ?? 0} onChange={(v) => setMediaDetailDraft(prev => prev ? ({ ...prev, budget: v }) : prev)} placeholder="0,00" className="flex-1 h-full min-w-0 px-3 text-[14px] font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none tracking-[-0.14px]" />
                                  <span className="pr-3 text-[12px] text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">Alocação máxima diária <span className="font-normal text-[color:var(--sl-fg-base-muted)]">(opcional)</span></label>
                                <div className="flex items-center border border-[#e0e0e0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] transition-all h-11">
                                  <CurrencyInput value={mediaDetailDraft?.dailyBudget ?? 0} onChange={(v) => setMediaDetailDraft(prev => prev ? ({ ...prev, dailyBudget: v }) : prev)} placeholder="0,00" className="flex-1 h-full min-w-0 px-3 text-[14px] font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none tracking-[-0.14px]" />
                                  <span className="pr-3 text-[12px] text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <h4 className="text-[14px] font-medium text-[color:var(--sl-fg-base)] leading-5">Lance</h4>
                          <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4 flex flex-col gap-2">
                            {pricingLabel}
                            <div className="flex items-center border border-[#e0e0e0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] transition-all h-11">
                              <CurrencyInput value={pricingValue} onChange={setPricingValue} placeholder="0,00" className="flex-1 h-full min-w-0 px-3 text-[14px] font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none tracking-[-0.14px]" />
                              <span className="pr-3 text-[12px] text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                            </div>
                          </label>
                        </div>
                      </section>
                    </div>
                  </div>

                  {/* Middle: Variações (só quando o banner varia por algum critério) */}
                  {(offsiteBannerVariationMode[mt] ?? 'none') !== 'none' && (() => {
                    const variationMode = (offsiteBannerVariationMode[mt] ?? 'none') as 'publisher' | 'retailer' | 'both';
                    const variations = offsiteVariations(mt);
                    return (
                      <div className="w-[280px] shrink-0 border-r border-[#f0f0f0] flex flex-col overflow-hidden">
                        <div className="px-[18px] pt-3 pb-2">
                          <span className="text-[12px] font-semibold text-[color:var(--sl-fg-base-soft)]">{variations.length} variações</span>
                        </div>
                        <div className="flex-1 overflow-y-auto pt-0 px-2 pb-2 flex flex-col gap-0">
                          {variations.map((v, i) => {
                            const sel = offsiteSelectedVariation[mt];
                            const isSelected = sel
                              ? (variationMode === 'publisher' ? sel.publisher === v.publisher
                                : variationMode === 'retailer' ? sel.retailer === v.retailer
                                : sel.publisher === v.publisher && sel.retailer === v.retailer)
                              : i === 0;
                            return (
                              <button key={offsiteVariationKey(v)} type="button" onClick={() => setOffsiteSelectedVariation(prev => ({ ...prev, [mt]: v }))} className={`w-full px-[10px] py-2 text-left text-[13px] font-medium text-[color:var(--sl-fg-base)] transition-colors rounded-lg ${isSelected ? 'bg-[#f5f5f5]' : 'hover:bg-[#fafafa]'}`}>
                                {offsiteVariationLabel(v, variationMode)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Right: Banner (ocupa toda a seção direita quando "Não varia") */}
                  <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <div className="px-6 py-4 flex flex-col gap-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px]">Banner</h3>
                        <div className="relative" ref={offsiteBannerVariationMenuRef}>
                        <button type="button" onClick={() => setOffsiteBannerVariationMenuOpen(prev => prev === mt ? null : mt)} className="flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-lg border border-[#e8e8e8] bg-white text-[13px] font-medium text-[color:var(--sl-fg-base)] hover:border-[#c2c2c2] hover:bg-[#fafafa] transition-colors" title="Como o banner varia">
                          {(() => {
                            const mode = offsiteBannerVariationMode[mt] ?? 'none';
                            const label = mode === 'none' ? 'Não varia' : mode === 'publisher' ? 'Canal' : mode === 'retailer' ? 'Varejista de destino' : 'Canal e Varejista de destino';
                            return <span className="truncate max-w-[160px]">{label}</span>;
                          })()}
                          <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)] shrink-0 transition-transform" style={{ transform: offsiteBannerVariationMenuOpen === mt ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                        </button>
                        {offsiteBannerVariationMenuOpen === mt && (
                          <div className="absolute top-full right-0 mt-1 py-1.5 px-1.5 bg-white rounded-xl border border-[#e0e0e0] shadow-lg min-w-[220px] z-50 flex flex-col gap-0.5">
                            {(['none', 'publisher', 'retailer', 'both'] as const).map((mode) => {
                              const isSelected = (offsiteBannerVariationMode[mt] ?? 'none') === mode;
                              return (
                              <button key={mode} type="button" onClick={() => {
                                setOffsiteBannerVariationMode(prev => ({ ...prev, [mt]: mode }));
                                setOffsiteBannerVariationMenuOpen(null);
                                if (mode !== 'none') {
                                  const pubs = getOffsitePublishers(mt);
                                  const rets = getOffsiteRetailers(mt);
                                  const first = mode === 'publisher' ? { publisher: pubs[0] ?? '', retailer: '' }
                                    : mode === 'retailer' ? { publisher: '', retailer: rets[0] ?? '' }
                                    : { publisher: pubs[0] ?? '', retailer: rets[0] ?? '' };
                                  setOffsiteSelectedVariation(prev => ({ ...prev, [mt]: first }));
                                }
                              }} className={`w-full px-2.5 py-2 text-left text-[13px] font-medium flex items-center gap-2 transition-colors rounded-lg ${isSelected ? 'bg-[#f0f7ff] text-[color:var(--sl-fg-base-soft)]' : 'text-[color:var(--sl-fg-base)] hover:bg-[#f5f5f5]'}`}>
                                {isSelected && <span className="material-symbols-outlined text-[16px]">check</span>}
                                {mode === 'none' && 'Não varia'}
                                {mode === 'publisher' && 'Canal'}
                                {mode === 'retailer' && 'Varejista de destino'}
                                {mode === 'both' && 'Canal e Varejista de destino'}
                              </button>
                            );})}
                          </div>
                        )}
                      </div>
                      </div>
                      {(offsiteBannerVariationMode[mt] ?? 'none') !== 'none' && offsiteSelectedVariation[mt] && (
                        <p className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] tracking-[-0.1px]">{offsiteVariationLabel(offsiteSelectedVariation[mt]!, offsiteBannerVariationMode[mt] as 'publisher' | 'retailer' | 'both')}</p>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col pt-2 px-6 pb-6 overflow-y-auto">
                      {(() => {
                        const bannerKey = offsiteBannerStorageKey(mt);
                        const images = bannerImages[bannerKey] || [];
                        return images.length === 0 ? (
                          <div className={`flex-1 min-h-[280px] border border-dashed rounded-xl flex flex-col gap-4 items-center justify-center cursor-pointer transition-colors pl-10 pr-10 pb-10 ${bannerDragOver ? 'border-[#1570ef] bg-[#f0f7ff]' : 'border-[#e0e0e0] bg-[rgba(29,29,29,0.02)] hover:border-[#c2c2c2]'}`} onClick={() => offsiteBannerFileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setBannerDragOver(true); }} onDragLeave={() => setBannerDragOver(false)} onDrop={(e) => { e.preventDefault(); setBannerDragOver(false); handleBannerFiles(e.dataTransfer.files, bannerKey); }}>
                            <span className="material-symbols-outlined text-[32px] text-[color:var(--sl-fg-base-muted)]">add_photo_alternate</span>
                            <p className="text-[14px] font-medium text-[color:var(--sl-fg-base)]">Clique aqui ou solte os arquivos nessa área</p>
                            <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] text-center">Tamanhos permitidos: {ALLOWED_OFFSITE_BANNER_SIZES}</p>
                            <input ref={offsiteBannerFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleBannerFiles(e.target.files, bannerKey)} />
                          </div>
                        ) : (
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"><span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-soft)]">open_in_full</span></button>
                              <button type="button" className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"><span className="material-symbols-outlined text-[18px] text-[color:var(--sl-fg-base-soft)]">auto_fix_high</span></button>
                              <button type="button" onClick={() => { if (images[0]) removeBannerImage(bannerKey, images[0].id); }} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 text-[#cc3d3d] transition-colors"><span className="material-symbols-outlined text-[18px]">delete</span></button>
                            </div>
                            <div className="relative max-h-[280px] rounded-xl overflow-hidden border border-[#e6e6e6] bg-white flex items-center justify-center" style={images[0] ? { aspectRatio: `${images[0].width} / ${images[0].height}` } : undefined}>
                              <img src={images[0]?.previewUrl} alt="" className="max-w-full max-h-full w-auto h-auto object-contain" />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
              <>
              {/* Left: Investimento (non-Offsite) */}
              <div className="w-[400px] shrink-0 border-r border-[#f0f0f0] px-8 pt-6 pb-8 flex flex-col gap-6 overflow-y-auto">
                <div className="flex flex-col gap-1">
                  <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Investimento</h3>
                  <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">Defina como o orçamento será alocado entre as mídias.</p>
                </div>

                {/* Alocação subsection */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-[16px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Alocação</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setMediaDetailDraft(prev => prev ? ({ ...prev, allocMode: prev.allocMode === 'intelligent' ? 'manual' : 'intelligent' }) : prev)}
                      className={`relative w-[36px] h-[20px] rounded-full shrink-0 transition-colors duration-300 ease-[cubic-bezier(0.34,1.12,0.64,1)] ${
                        isIntelligent ? 'bg-[#32a436]' : 'bg-[#e0e0e0]'
                      }`}
                    >
                      <div
                        className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)]"
                        style={{
                          left: isIntelligent ? '18px' : '2px',
                          transition: 'left 400ms cubic-bezier(0.34, 1.12, 0.64, 1), transform 300ms cubic-bezier(0.34, 1.12, 0.64, 1)',
                        }}
                      />
                    </button>
                    <span className="text-[14px] font-medium text-[color:var(--sl-fg-base)] leading-5">Alocação inteligente</span>
                  </label>

                  {isIntelligent && (
                    <div className="bg-[#f0f7ff] rounded-lg p-4 border border-black/[0.08] leading-8">
                      <p className="text-[12px] text-[color:var(--sl-fg-base)] leading-[18px]">
                        Ajusta a alocação do orçamento dentro desta mídia conforme oportunidades de entrega e performance, respeitando o orçamento total e o limite diário definidos para a campanha.
                      </p>
                    </div>
                  )}

                  {!isIntelligent && (
                    <>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">Alocação total</label>
                        <div className="flex items-center border border-[#e0e0e0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] transition-all">
                          <CurrencyInput
                            value={mediaDetailDraft.budget}
                            onChange={(v) => setMediaDetailDraft(prev => prev ? ({ ...prev, budget: v }) : prev)}
                            placeholder="0,00"
                            className="flex-1 h-10 px-3 text-[14px] font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none tracking-[-0.14px]"
                          />
                          <span className="pr-3 text-[12px] text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">Alocação máxima diária <span className="font-normal text-[color:var(--sl-fg-base-muted)]">(opcional)</span></label>
                        <div className="flex items-center border border-[#e0e0e0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] transition-all">
                          <CurrencyInput
                            value={mediaDetailDraft.dailyBudget}
                            onChange={(v) => setMediaDetailDraft(prev => prev ? ({ ...prev, dailyBudget: v }) : prev)}
                            placeholder="0,00"
                            className="flex-1 h-10 px-3 text-[14px] font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none tracking-[-0.14px]"
                          />
                          <span className="pr-3 text-[12px] text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Lance subsection */}
                <div className="flex flex-col gap-4">
                  <h4 className="text-[16px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Lance</h4>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">{pricingLabel}</label>
                    <div className="flex items-center border border-[#e0e0e0] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] transition-all">
                      <CurrencyInput
                        value={pricingValue}
                        onChange={setPricingValue}
                        placeholder="0,00"
                        className="flex-1 h-10 px-3 text-[14px] font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none tracking-[-0.14px]"
                      />
                      <span className="pr-3 text-[12px] text-[color:var(--sl-fg-base-soft)] shrink-0">BRL</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column: conditional based on media type */}
              {isBannerMedia(mt) ? (
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <div className="flex-1 flex flex-col gap-6 px-8 py-6 overflow-y-auto">
                    {/* Imagens header */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Imagens</h3>
                      <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">Adicione um ou mais formatos de banners que deseja que sejam exibidos na sua campanha</p>
                    </div>

                    {(bannerImages[mt] || []).length === 0 ? (
                      <div
                        className={`flex-1 min-h-[200px] border border-dashed rounded-lg flex flex-col gap-4 items-center justify-center cursor-pointer transition-colors ${
                          bannerDragOver
                            ? 'border-[#1570ef] bg-[#f0f7ff]'
                            : 'border-[#e0e0e0] bg-[rgba(29,29,29,0.03)]'
                        }`}
                        onClick={() => bannerFileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setBannerDragOver(true); }}
                        onDragLeave={() => setBannerDragOver(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setBannerDragOver(false);
                          handleBannerFiles(e.dataTransfer.files, mt);
                        }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-[24px] text-[color:var(--sl-fg-base)]">add_photo_alternate</span>
                          <p className="text-[12px] text-[color:var(--sl-fg-base)] leading-4 text-center">Clique aqui ou solte os arquivos nessa área</p>
                        </div>
                        <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-4 text-center max-w-[510px]">
                          Tamanhos permitidos: {ALLOWED_BANNER_SIZES}
                        </p>
                        <input
                          ref={bannerFileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleBannerFiles(e.target.files, mt)}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col">
                          <div
                            className="grid grid-cols-4 gap-2"
                            onDragOver={(e) => {
                              if (reorderDragId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return; }
                              e.preventDefault(); setBannerDragOver(true);
                            }}
                            onDragLeave={() => { if (reorderDragId) return; setBannerDragOver(false); }}
                            onDrop={(e) => {
                              if (reorderDragId) {
                                e.preventDefault();
                                setReorderDragId(null);
                                reorderStateRef.current = null;
                                return;
                              }
                              e.preventDefault();
                              setBannerDragOver(false);
                              handleBannerFiles(e.dataTransfer.files, mt);
                            }}
                          >
                            {/* Add image button */}
                            <button
                              type="button"
                              onClick={() => bannerFileInputRef.current?.click()}
                              className="aspect-square rounded-lg bg-[rgba(29,29,29,0.05)] flex items-center justify-center hover:bg-[rgba(29,29,29,0.08)] transition-colors"
                            >
                              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)]">add</span>
                            </button>
                            <input
                              ref={bannerFileInputRef}
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => handleBannerFiles(e.target.files, mt)}
                            />
                            {/* Image thumbnails */}
                            {(bannerImages[mt] || []).map((img) => (
                              <div
                                key={img.id}
                                draggable
                                onDragStart={(e) => {
                                  setReorderDragId(img.id);
                                  reorderStateRef.current = { mediaType: mt, originalList: [...(bannerImages[mt] || [])] };
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDragGrabbingCursor();
                                  setupRoundedDragImage(e, img.previewUrl);
                                  requestAnimationFrame(() => {
                                    if (e.target instanceof HTMLElement) e.target.style.opacity = '0.25';
                                  });
                                }}
                                onDragEnd={(e) => {
                                  clearDragGrabbingCursor();
                                  if (e.target instanceof HTMLElement) e.target.style.opacity = '';
                                  clearDragImage();
                                  if (reorderStateRef.current && e.dataTransfer.dropEffect === 'none') {
                                    const { mediaType, originalList } = reorderStateRef.current;
                                    setBannerImages(prev => ({ ...prev, [mediaType]: originalList }));
                                  }
                                  setReorderDragId(null);
                                  reorderStateRef.current = null;
                                }}
                                onDragEnter={(e) => {
                                  if (!reorderDragId || reorderDragId === img.id) return;
                                  if (!reorderStateRef.current || reorderStateRef.current.mediaType !== mt) return;
                                  e.preventDefault();
                                  setBannerImages(prev => {
                                    const list = [...(prev[mt] || [])];
                                    const fromIdx = list.findIndex(i => i.id === reorderDragId);
                                    const toIdx = list.findIndex(i => i.id === img.id);
                                    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
                                    const [moved] = list.splice(fromIdx, 1);
                                    list.splice(toIdx, 0, moved);
                                    return { ...prev, [mt]: list };
                                  });
                                }}
                                onDragOver={(e) => {
                                  if (!reorderDragId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onDrop={(e) => {
                                  if (!reorderDragId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setReorderDragId(null);
                                  reorderStateRef.current = null;
                                }}
                                className={`relative group aspect-square cursor-grab active:cursor-grabbing transition-opacity duration-150 rounded-[8px] ${bannerThumbMenu === img.id ? 'overflow-visible' : 'overflow-hidden'} ${
                                  reorderDragId && reorderDragId !== img.id ? 'pointer-events-auto' : ''
                                }`}
                              >
                                {/* Clipped image area */}
                                <div className="absolute inset-0 rounded-[8px] overflow-hidden border border-[#e6e6e6] bg-white">
                                  <div className="absolute inset-[-1px] rounded-[4px] border border-[#d7dadf]">
                                    <div className="absolute inset-0 rounded-[4px] flex items-center justify-center">
                                      <img
                                        src={img.previewUrl}
                                        alt={img.name}
                                        className="max-w-full max-h-full pointer-events-none rounded-[4px]"
                                      />
                                    </div>
                                    <div className="absolute inset-0 rounded-[4px] bg-[rgba(0,0,0,0.05)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                {/* Size label - top left */}
                                <div className="absolute top-[3px] left-[3px] flex items-center h-fit">
                                  <div className="bg-[rgba(248,248,248,0.8)] rounded-[4px] p-1 h-fit w-fit flex items-center leading-[16px] align-middle text-center overflow-hidden m-[2px]">
                                    <span className="font-normal text-[10px] text-[color:var(--sl-fg-base-soft)] leading-[12px] whitespace-nowrap h-fit">{img.width} × {img.height}</span>
                                  </div>
                                </div>
                                {/* Resolution tags - bottom left */}
                                <div className="absolute bottom-[3px] left-[3px] flex gap-[2px] items-center">
                                  {['1x', '2x', '4x'].map(res => (
                                    <div key={res} className="bg-[rgba(248,248,248,0.8)] rounded-[4px] p-1 w-fit flex items-center justify-center">
                                      <span className="font-normal text-[10px] text-[color:var(--sl-fg-base-soft)] leading-[12px]">{res}</span>
                                    </div>
                                  ))}
                                </div>
                                {/* Action menu - bottom right (visible on hover), outside clipped area */}
                                <div
                                  className={`absolute bottom-[4px] right-[4px] z-[60] ${bannerThumbMenu === img.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                                  onPointerDown={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setBannerThumbMenu(bannerThumbMenu === img.id ? null : img.id);
                                    }}
                                    className="w-[32px] h-[32px] rounded-[8px] bg-white border border-[rgba(0,0,0,0.1)] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.08)] flex items-center justify-center hover:bg-[#f5f5f5] transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base)] leading-none">more_vert</span>
                                  </button>
                                  {bannerThumbMenu === img.id && (
                                    <div
                                      ref={bannerThumbMenuRef}
                                      className="absolute top-[36px] right-0 z-[600] bg-white rounded-[8px] border border-[rgba(0,0,0,0.1)] shadow-[0px_4px_12px_rgba(0,0,0,0.12)] py-[4px] min-w-[180px]"
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setBannerThumbMenu(null); }}
                                        className="w-full px-[12px] py-[8px] text-left text-[13px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.13px] leading-[20px] hover:bg-[rgba(29,29,29,0.05)] transition-colors flex items-center gap-[8px]"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)]">edit</span>
                                        Editar metadados
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setBannerThumbMenu(null); }}
                                        className="w-full px-[12px] py-[8px] text-left text-[13px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.13px] leading-[20px] hover:bg-[rgba(29,29,29,0.05)] transition-colors flex items-center gap-[8px]"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)]">aspect_ratio</span>
                                        Variações de resolução
                                      </button>
                                      <div className="mx-[8px] my-[4px] h-px bg-[#f0f0f0]" />
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); removeBannerImage(mt, img.id); setBannerThumbMenu(null); }}
                                        className="w-full px-[12px] py-[8px] text-left text-[13px] font-medium text-[#cc3d3d] tracking-[-0.13px] leading-[20px] hover:bg-[rgba(29,29,29,0.05)] transition-colors flex items-center gap-[8px]"
                                      >
                                        <span className="material-symbols-outlined text-[16px] text-[#cc3d3d]">delete</span>
                                        Apagar
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-[13.5px]">
                          Tamanhos permitidos: {ALLOWED_BANNER_SIZES}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : isMarcaPatrocinada(mt) ? (
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <div className="flex-1 flex flex-col gap-6 px-8 py-6 overflow-y-auto">
                    {/* Header */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Elementos da vitrine</h3>
                      <p className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">Adicione um ou mais formatos de banners que deseja que sejam exibidos na sua campanha</p>
                    </div>

                    {/* Logo section */}
                    <div className="flex flex-col gap-3 shrink-0">
                      <h4 className="text-[16px] font-normal text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Logo</h4>
                      {getShowcase(mt).logoImages.length === 0 ? (
                        <div
                          className={`min-h-[165px] border border-dashed rounded-lg flex flex-col gap-4 items-center justify-center cursor-pointer transition-colors ${
                            showcaseLogoDragOver ? 'border-[#1570ef] bg-[#f0f7ff]' : 'border-[#e0e0e0] bg-[rgba(29,29,29,0.03)]'
                          }`}
                          onClick={() => showcaseLogoInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setShowcaseLogoDragOver(true); }}
                          onDragLeave={() => setShowcaseLogoDragOver(false)}
                          onDrop={(e) => { e.preventDefault(); setShowcaseLogoDragOver(false); handleShowcaseFiles(e.dataTransfer.files, mt, 'logoImages', 1); }}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-[24px] text-[color:var(--sl-fg-base)]">add_photo_alternate</span>
                            <p className="text-[12px] text-[color:var(--sl-fg-base)] leading-4 text-center">Clique aqui ou solte os arquivos nessa área</p>
                          </div>
                          <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-4 text-center">Tamanhos permitidos: 438 x 100</p>
                          <input ref={showcaseLogoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleShowcaseFiles(e.target.files, mt, 'logoImages', 1)} />
                        </div>
                      ) : (() => {
                        const logoImg = getShowcase(mt).logoImages[0];
                        return (
                          <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-4 gap-2">
                              <div className="relative group aspect-square">
                                <div className="absolute inset-0 rounded-[8px] overflow-hidden border border-[#e6e6e6] bg-white">
                                  <div className="absolute inset-[-1px] rounded-[4px] border border-[#d7dadf]">
                                    <div className="absolute inset-0 rounded-[4px] flex items-center justify-center">
                                      <img src={logoImg.previewUrl} alt={logoImg.name} className="max-w-full max-h-full pointer-events-none rounded-[4px]" />
                                    </div>
                                    <div className="absolute inset-0 rounded-[4px] bg-[rgba(0,0,0,0.05)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                <div className="absolute top-[3px] left-[3px] flex items-center h-fit">
                                  <div className="bg-[rgba(248,248,248,0.8)] rounded-[4px] p-1 h-fit w-fit flex items-center leading-[16px] m-[2px]">
                                    <span className="font-normal text-[10px] text-[color:var(--sl-fg-base-soft)] leading-[12px] whitespace-nowrap">{logoImg.width} × {logoImg.height}</span>
                                  </div>
                                </div>
                                <div className="absolute bottom-[3px] left-[3px] flex gap-[2px] items-center">
                                  {['1x', '2x', '4x'].map(res => (
                                    <div key={res} className="bg-[rgba(248,248,248,0.8)] rounded-[4px] p-1 w-fit flex items-center justify-center">
                                      <span className="font-normal text-[10px] text-[color:var(--sl-fg-base-soft)] leading-[12px]">{res}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="absolute bottom-[4px] right-[4px] z-[60] opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                  <button type="button" onClick={() => showcaseLogoInputRef.current?.click()} className="w-[32px] h-[32px] rounded-[8px] bg-white border border-[rgba(0,0,0,0.1)] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.08)] flex items-center justify-center hover:bg-[#f5f5f5] transition-colors">
                                    <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base)] leading-none">swap_horiz</span>
                                  </button>
                                  <button type="button" onClick={() => removeShowcaseImage(mt, 'logoImages', logoImg.id)} className="w-[32px] h-[32px] rounded-[8px] bg-white border border-[rgba(0,0,0,0.1)] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.08)] flex items-center justify-center hover:bg-[#f5f5f5] transition-colors">
                                    <span className="material-symbols-outlined text-[16px] text-[#cc3d3d] leading-none">delete</span>
                                  </button>
                                </div>
                                <input ref={showcaseLogoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { updateShowcase(mt, { logoImages: [] }); handleShowcaseFiles(e.target.files, mt, 'logoImages'); }} />
                              </div>
                            </div>
                            <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-[13.5px]">Tamanhos permitidos: 438 x 100</p>
                          </div>
                        );
                      })()
                      }
                    </div>

                    {/* Mídia da vitrine section */}
                    <div className="flex flex-col gap-3 shrink-0">
                      <h4 className="text-[16px] font-normal text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Mídia da vitrine</h4>
                      {getShowcase(mt).mediaImages.length === 0 ? (
                        <div
                          className={`min-h-[165px] border border-dashed rounded-lg flex flex-col gap-4 items-center justify-center cursor-pointer transition-colors ${
                            showcaseMediaDragOver ? 'border-[#1570ef] bg-[#f0f7ff]' : 'border-[#e0e0e0] bg-[rgba(29,29,29,0.03)]'
                          }`}
                          onClick={() => showcaseMediaInputRef.current?.click()}
                          onDragOver={(e) => { e.preventDefault(); setShowcaseMediaDragOver(true); }}
                          onDragLeave={() => setShowcaseMediaDragOver(false)}
                          onDrop={(e) => { e.preventDefault(); setShowcaseMediaDragOver(false); handleShowcaseFiles(e.dataTransfer.files, mt, 'mediaImages'); }}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-[24px] text-[color:var(--sl-fg-base)]">animated_images</span>
                            <p className="text-[12px] text-[color:var(--sl-fg-base)] leading-4 text-center">Clique aqui ou solte os arquivos nessa área</p>
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-4 text-center max-w-[510px]">Formatos permitidos: Video (MP4) ou Imagens (PNG, JPEG, GIF)</p>
                            <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-4 text-center">Tamanhos permitidos: 970 x 250</p>
                          </div>
                          <input ref={showcaseMediaInputRef} type="file" accept="image/*,video/mp4" multiple className="hidden" onChange={(e) => handleShowcaseFiles(e.target.files, mt, 'mediaImages')} />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <div
                            className="grid grid-cols-4 gap-2"
                            onDragOver={(e) => {
                              if (showcaseReorderDragId) { e.preventDefault(); return; }
                              e.preventDefault();
                              setShowcaseMediaDragOver(true);
                            }}
                            onDragLeave={() => { if (!showcaseReorderDragId) setShowcaseMediaDragOver(false); }}
                            onDrop={(e) => {
                              if (showcaseReorderDragId) { e.preventDefault(); setShowcaseReorderDragId(null); showcaseReorderRef.current = null; return; }
                              e.preventDefault();
                              setShowcaseMediaDragOver(false);
                              handleShowcaseFiles(e.dataTransfer.files, mt, 'mediaImages');
                            }}
                          >
                            <button type="button" onClick={() => showcaseMediaInputRef.current?.click()} className="aspect-square rounded-lg bg-[rgba(29,29,29,0.05)] flex items-center justify-center hover:bg-[rgba(29,29,29,0.08)] transition-colors">
                              <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)]">add</span>
                            </button>
                            <input ref={showcaseMediaInputRef} type="file" accept="image/*,video/mp4" multiple className="hidden" onChange={(e) => handleShowcaseFiles(e.target.files, mt, 'mediaImages')} />
                            {getShowcase(mt).mediaImages.map((img) => (
                              <div
                                key={img.id}
                                draggable
                                onDragStart={(e) => {
                                  setShowcaseReorderDragId(img.id);
                                  showcaseReorderRef.current = { mediaType: mt, field: 'mediaImages', originalList: [...getShowcase(mt).mediaImages] };
                                  e.dataTransfer.effectAllowed = 'move';
                                  setDragGrabbingCursor();
                                  setupRoundedDragImage(e, img.previewUrl);
                                  requestAnimationFrame(() => {
                                    if (e.target instanceof HTMLElement) e.target.style.opacity = '0.25';
                                  });
                                }}
                                onDragEnd={(e) => {
                                  clearDragGrabbingCursor();
                                  if (e.target instanceof HTMLElement) e.target.style.opacity = '';
                                  clearDragImage();
                                  if (showcaseReorderRef.current && e.dataTransfer.dropEffect === 'none') {
                                    const { mediaType, field, originalList } = showcaseReorderRef.current;
                                    updateShowcase(mediaType, { [field]: originalList });
                                  }
                                  setShowcaseReorderDragId(null);
                                  showcaseReorderRef.current = null;
                                }}
                                onDragEnter={(e) => {
                                  if (!showcaseReorderDragId || showcaseReorderDragId === img.id) return;
                                  if (!showcaseReorderRef.current || showcaseReorderRef.current.mediaType !== mt) return;
                                  e.preventDefault();
                                  setShowcaseData(prev => {
                                    const sc = prev[mt] || { logoImages: [], mediaImages: [], title: '', description: '', brandName: '' };
                                    const list = [...sc.mediaImages];
                                    const fromIdx = list.findIndex(i => i.id === showcaseReorderDragId);
                                    const toIdx = list.findIndex(i => i.id === img.id);
                                    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
                                    const [moved] = list.splice(fromIdx, 1);
                                    list.splice(toIdx, 0, moved);
                                    return { ...prev, [mt]: { ...sc, mediaImages: list } };
                                  });
                                }}
                                onDragOver={(e) => {
                                  if (!showcaseReorderDragId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onDrop={(e) => {
                                  if (!showcaseReorderDragId) return;
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowcaseReorderDragId(null);
                                  showcaseReorderRef.current = null;
                                }}
                                className="relative group aspect-square cursor-grab active:cursor-grabbing rounded-[8px] overflow-hidden"
                              >
                                <div className="absolute inset-0 rounded-[8px] overflow-hidden border border-[#e6e6e6] bg-white">
                                  <div className="absolute inset-[-1px] rounded-[4px] border border-[#d7dadf]">
                                    <div className="absolute inset-0 rounded-[4px] flex items-center justify-center">
                                      <img src={img.previewUrl} alt={img.name} className="max-w-full max-h-full pointer-events-none rounded-[4px]" />
                                    </div>
                                    <div className="absolute inset-0 rounded-[4px] bg-[rgba(0,0,0,0.05)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                </div>
                                <div className="absolute top-[3px] left-[3px] flex items-center h-fit">
                                  <div className="bg-[rgba(248,248,248,0.8)] rounded-[4px] p-1 h-fit w-fit flex items-center leading-[16px] m-[2px]">
                                    <span className="font-normal text-[10px] text-[color:var(--sl-fg-base-soft)] leading-[12px] whitespace-nowrap">{img.width} × {img.height}</span>
                                  </div>
                                </div>
                                <div className="absolute bottom-[3px] left-[3px] flex gap-[2px] items-center">
                                  {['1x', '2x', '4x'].map(res => (
                                    <div key={res} className="bg-[rgba(248,248,248,0.8)] rounded-[4px] p-1 w-fit flex items-center justify-center">
                                      <span className="font-normal text-[10px] text-[color:var(--sl-fg-base-soft)] leading-[12px]">{res}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="absolute bottom-[4px] right-[4px] z-[60] opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => removeShowcaseImage(mt, 'mediaImages', img.id)} className="w-[32px] h-[32px] rounded-[8px] bg-white border border-[rgba(0,0,0,0.1)] shadow-[0px_1px_1px_0px_rgba(0,0,0,0.08)] flex items-center justify-center hover:bg-[#f5f5f5] transition-colors">
                                    <span className="material-symbols-outlined text-[16px] text-[#cc3d3d] leading-none">delete</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-[12px] text-[color:var(--sl-fg-base-muted)] leading-[13.5px]">Tamanhos permitidos: 970 x 250</p>
                        </div>
                      )}
                    </div>

                    {/* Textos */}
                    <div className="flex flex-col gap-6 shrink-0">
                      <h4 className="text-[16px] font-normal text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Textos</h4>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">Título</label>
                        <input
                          type="text"
                          value={getShowcase(mt).title}
                          onChange={(e) => updateShowcase(mt, { title: e.target.value })}
                          placeholder="Ex: Conheça os novos produtos Apple"
                          className="h-10 px-3 border border-[#e0e0e0] rounded-xl text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] placeholder:text-[color:var(--sl-fg-base-muted)] focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] outline-none transition-all"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">Descrição</label>
                        <textarea
                          value={getShowcase(mt).description}
                          onChange={(e) => updateShowcase(mt, { description: e.target.value })}
                          placeholder="Descreva brevemente a oferta ou campanha"
                          rows={3}
                          className="px-3 py-2.5 border border-[#e0e0e0] rounded-xl text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] placeholder:text-[color:var(--sl-fg-base-muted)] focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] outline-none transition-all resize-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[12px] font-medium text-[color:var(--sl-fg-base-soft)] leading-4">Nome da marca</label>
                        <input
                          type="text"
                          value={getShowcase(mt).brandName}
                          onChange={(e) => updateShowcase(mt, { brandName: e.target.value })}
                          placeholder="Ex: Apple"
                          className="h-10 px-3 border border-[#e0e0e0] rounded-xl text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] placeholder:text-[color:var(--sl-fg-base-muted)] focus-within:ring-2 focus-within:ring-[#0366dd]/20 focus-within:border-[#0366dd] outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <div className="px-8 pt-6 pb-4 shrink-0">
                    <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px] leading-6">Produtos</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto px-8 pb-8">
                    {formData.products.length === 0 ? (
                      <div className="flex items-center justify-center h-[200px]">
                        <p className="text-[14px] text-[color:var(--sl-fg-base-muted)]">Nenhum produto na campanha</p>
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        {formData.products.map((p, idx) => {
                          const catalogInfo = PRODUCT_CATALOG.find(cp => cp.id === p.id);
                          return (
                            <div
                              key={p.id}
                              className={`flex items-center gap-4 py-4 ${
                                idx < formData.products.length - 1 ? 'border-b border-[#f0f0f0]' : ''
                              }`}
                            >
                              <div className="w-10 h-10 rounded-lg border border-[#e8e8e8] bg-[#f9f9f9] shrink-0 overflow-hidden">
                                {p.imageUrl && <img src={p.imageUrl} alt="" className="w-full h-full object-contain" />}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-[14px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.14px] leading-5 truncate">{p.name}</span>
                                <span className="text-[12px] text-[color:var(--sl-fg-base-soft)] leading-4">{catalogInfo?.sku || p.id}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
              </>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderPlanoMidia = () => {
    const count = formData.mediaTypes.length;
    const isEmpty = count === 0;

    return (
      <div className="flex flex-col gap-10 w-full min-w-0 max-w-[740px]">
        <div className="flex flex-col gap-1">
          <h2 className="text-[24px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-1px] leading-8">Plano de mídia</h2>
          <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Defina onde seus anúncios vão aparecer e como cada mídia será configurada.</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[color:var(--sl-fg-base-soft)]">
              {isEmpty ? 'Nenhuma mídia' : `${count} mídia${count !== 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              onClick={openMediaDrawer}
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-white border border-[#d5d7da] text-[color:var(--sl-fg-base)] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">add</span>
            </button>
          </div>

          {isEmpty ? (
            <div className="bg-[#f9f9f9] rounded-[12px] flex flex-col items-center justify-center h-[530px] gap-6 relative overflow-hidden">
              {isGeneratingPlan ? (
                <div className="flex flex-col items-center gap-5">
                  {/* Pulsing sparkle icon */}
                  <div className="relative">
                    <div className="w-10 h-10 flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-[28px] text-[color:var(--sl-fg-base)]"
                        style={{
                          animation: 'sparkleBreath 2s ease-in-out infinite',
                          opacity: 0.7,
                        }}
                      >
                        auto_awesome
                      </span>
                    </div>
                  </div>

                  {/* Phase text */}
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <p
                      className="text-[15px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.2px] transition-opacity duration-500"
                      style={{ opacity: 1 }}
                    >
                      {generationPhase === 0 && 'Analisando campanha...'}
                      {generationPhase === 1 && 'Selecionando formatos...'}
                      {generationPhase === 2 && 'Alocando orçamento...'}
                    </p>
                    <p className="text-xs text-[color:var(--sl-fg-base-muted)] tracking-[-0.1px]">
                      Gerando plano com base nos atributos da campanha
                    </p>
                  </div>

                  {/* Subtle progress dots */}
                  <div className="flex items-center gap-1.5 mt-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1 h-1 rounded-full transition-all duration-500"
                        style={{
                          backgroundColor: i <= generationPhase ? '#1f1f1f' : '#d5d7da',
                          transform: i <= generationPhase ? 'scale(1)' : 'scale(0.8)',
                        }}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center gap-2 text-center">
                    <p className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px]">Nenhuma mídia adicionada</p>
                    <p className="text-sm text-[color:var(--sl-fg-base-soft)] tracking-[-0.14px]">Escolha uma mídia para começar ou gere um plano automaticamente.</p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <button
                      type="button"
                      onClick={generateAutoPlan}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-[#d5d7da] text-[color:var(--sl-fg-base)] text-sm font-semibold tracking-[-0.42px] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-[0.98] transition-all"
                    >
                      Gerar plano automático
                      <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
                    </button>
                    <button
                      type="button"
                      onClick={openMediaDrawer}
                      className="text-sm font-semibold text-[color:var(--sl-fg-base)] hover:text-[color:var(--sl-fg-base)] transition-colors py-1.5 tracking-[-0.42px]"
                    >
                      Adicionar mídia manualmente
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3 w-full min-w-0" style={{ animation: 'mediaFadeInUp 400ms ease-out both' }}>
              {formData.mediaTypes.map(mt => {
                const meta = MEDIA_TYPE_META[mt] || { color: '#e0e0e0', icon: 'help', subtitle: '' };
                const allocMode = mediaAllocMode[mt] || 'manual';
                const isIntelligent = allocMode === 'intelligent';
                const budget = mediaBudgets[mt] || 0;
                return (
                  <div key={mt} className="bg-white border border-[#e0e0e0] rounded-xl px-5 py-4 w-full min-w-0 max-w-full flex items-center gap-3 sm:gap-4 cursor-pointer hover:border-[#c2c2c2] hover:shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all box-border" onClick={() => openMediaDetail(mt)}>
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color }}>
                      <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)] opacity-60">{meta.icon}</span>
                    </div>

                    {/* Name + count */}
                    <div className="flex flex-col min-w-0 w-[140px] sm:w-[160px] shrink-0">
                      <span className="text-sm font-medium text-[color:var(--sl-fg-base)] tracking-[-0.42px] truncate">{mt}</span>
                      <span className="text-xs text-[color:var(--sl-fg-base-soft)]">
                        {isBannerMedia(mt)
                          ? (() => { const n = isBannerOffsite(mt) ? offsiteBannerCount(mt) : (bannerImages[mt] || []).length; return `${n} ${n === 1 ? 'banner' : 'banners'}`; })()
                          : isMarcaPatrocinada(mt)
                            ? (() => { const s = getShowcase(mt); const mc = s.mediaImages.length; return mc > 0 ? `${mc} ${mc === 1 ? 'mídia' : 'mídias'}` : 'Configurar vitrine'; })()
                            : `${formData.products.length} ${formData.products.length === 1 ? 'SKU' : 'SKUs'}`
                        }
                      </span>
                    </div>

                    {/* Allocation + lances: flex-1 min-w-0 evita o card ultrapassar a largura da coluna */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs text-[color:var(--sl-fg-base-soft)] mb-0.5">Investimento total</span>
                      {isIntelligent ? (
                        <span className="text-sm font-medium text-[color:var(--sl-fg-base)] truncate">Inteligente</span>
                      ) : (
                        <CurrencyInput
                          value={budget}
                          onChange={(v) => setMediaBudgets(prev => ({ ...prev, [mt]: v }))}
                          placeholder="0,00"
                          className="w-[100px] max-w-full text-sm font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none border-b border-transparent hover:border-[#e0e0e0] focus:border-[#0366dd] transition-colors py-0.5"
                        />
                      )}
                    </div>

                    {(meta.pricing === 'CPC' || mediaCpc[mt] !== undefined) && (
                      <div className="flex flex-col min-w-0 shrink-0 w-[4.5rem]">
                        <span className="text-xs text-[color:var(--sl-fg-base-soft)] mb-0.5">CPC (BRL)</span>
                        <CurrencyInput
                          value={mediaCpc[mt] || 0}
                          onChange={(v) => setMediaCpc(prev => ({ ...prev, [mt]: v }))}
                          placeholder="0,00"
                          className="w-full min-w-0 text-sm font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none border-b border-transparent hover:border-[#e0e0e0] focus:border-[#0366dd] transition-colors py-0.5"
                        />
                      </div>
                    )}

                    {(meta.pricing === 'CPM' || mediaCpm[mt] !== undefined) && (
                      <div className="flex flex-col min-w-0 shrink-0 w-[4.5rem]">
                        <span className="text-xs text-[color:var(--sl-fg-base-soft)] mb-0.5">CPM (BRL)</span>
                        <CurrencyInput
                          value={mediaCpm[mt] || 0}
                          onChange={(v) => setMediaCpm(prev => ({ ...prev, [mt]: v }))}
                          placeholder="0,00"
                          className="w-full min-w-0 text-sm font-medium text-[color:var(--sl-fg-base)] bg-transparent outline-none border-b border-transparent hover:border-[#e0e0e0] focus:border-[#0366dd] transition-colors py-0.5"
                        />
                      </div>
                    )}

                    {/* Action menu */}
                    <div className="relative shrink-0" ref={mediaMenuOpen === mt ? mediaMenuRef : undefined}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMediaMenuOpen(prev => prev === mt ? null : mt); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#f0f0f0] transition-colors"
                      >
                        <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base-soft)]">more_vert</span>
                      </button>
                      {mediaMenuOpen === mt && (
                        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-[140px] bg-white rounded-xl border border-[#e8e8e8] shadow-lg py-1 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMediaMenuOpen(null); openMediaDetail(mt); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--sl-fg-base)] text-left hover:bg-[#f5f5f5] transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base-soft)]">edit</span>
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMediaMenuOpen(null); removeMediaType(mt); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[color:var(--sl-fg-base)] text-left hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            Apagar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 'estrategia': return renderEstrategia();
      case 'data': return renderData();
      case 'publishers': return renderPublishers();
      case 'produtos': return renderProdutos();
      case 'investimento': return renderInvestimento();
      case 'segmentacao': return renderSegmentacao();
      case 'plano_midia': return renderPlanoMidia();
      default: return null;
    }
  };

  const containerClasses = `fixed inset-0 z-[200] bg-white flex flex-col transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
    isVisible && !isClosing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
  }`;

  return (
    <div className={containerClasses}>
      {/* HEADER */}
      <header className="flex items-center justify-between h-16 px-4 border-b border-[#e8e8e8] bg-white shrink-0">
        <div className="flex items-center gap-4 w-[60%] min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[color:var(--sl-fg-base)] hover:bg-[#f0f0f0] hover:text-[color:var(--sl-fg-base)] active:scale-[0.95] transition-all shrink-0"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <input
            ref={titleInputRef}
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder={isNewCampaign ? 'Nome da campanha' : ''}
            className="text-2xl font-medium text-[color:var(--sl-fg-base)] tracking-[-0.475px] bg-transparent border-none outline-none flex-1 min-w-0 placeholder:text-[#c2c2c2] leading-7 rounded-lg px-2 py-1 -mx-2 -my-1 hover:bg-[#f5f5f5] transition-colors cursor-text"
          />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <div ref={statusDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(prev => !prev)}
              className="h-10 px-3.5 flex items-center gap-2 text-sm font-medium rounded-lg hover:bg-[#f5f5f5] active:scale-[0.98] transition-all"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                formData.status === CampaignStatus.ACTIVE ? 'bg-green-500' :
                formData.status === CampaignStatus.COMPLETED ? 'bg-blue-500' : 'bg-gray-400'
              }`} />
              <span className="text-[color:var(--sl-fg-base)] tracking-[-0.2px]">{formData.status}</span>
              <span className="material-symbols-outlined text-[16px] text-[#98a1b2] -mr-0.5">expand_more</span>
            </button>
            {statusDropdownOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[180px] bg-white rounded-xl border border-[#e8e8e8] shadow-lg py-1.5 animate-in fade-in zoom-in-95 duration-100">
                {[CampaignStatus.DRAFT, CampaignStatus.ACTIVE, CampaignStatus.COMPLETED].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({ ...prev, status: s }));
                      setStatusDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left transition-colors ${
                      formData.status === s ? 'bg-[#f5f5f5] font-medium text-[color:var(--sl-fg-base)]' : 'text-[color:var(--sl-fg-base)] hover:bg-[#ebebeb]'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      s === CampaignStatus.ACTIVE ? 'bg-green-500' :
                      s === CampaignStatus.COMPLETED ? 'bg-blue-500' : 'bg-gray-400'
                    }`} />
                    {s}
                    {formData.status === s && (
                      <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base)] ml-auto">check</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            className="h-10 px-4 bg-white text-[color:var(--sl-fg-base)] text-sm font-semibold rounded-lg border border-[#d5d7da] shadow-[0_1px_2px_rgba(10,13,18,0.05)] hover:bg-[#fafafa] hover:text-[color:var(--sl-fg-base)] active:scale-[0.98] transition-all tracking-[-0.42px]"
          >
            {isNewCampaign ? 'Criar campanha' : 'Salvar alterações'}
          </button>
        </div>
      </header>

      {/* CONTENT */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* LEFT SIDEBAR */}
        {renderSidebar()}

        {/* Resizable divider */}
        <div
          className="shrink-0 w-[5px] relative cursor-col-resize group z-10 -ml-[2px] -mr-[2px]"
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onPointerUp={handleDividerPointerUp}
        >
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-[#e8e8e8] group-hover:w-[2px] group-active:w-[2px] transition-all" />
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto overflow-x-hidden pt-8 px-8" style={{ scrollbarGutter: 'stable' }}>
            <div key={activeStep} className="w-full min-w-0 flex justify-center animate-[fadeInUp_400ms_ease-out]">
              {renderStepContent()}
            </div>
          </div>
          {activeStep === 'segmentacao' && (() => {
            const filledConditions = segmentGroups.reduce((acc, g) => acc + g.conditions.filter(c => c.dimension && c.value).length, 0);
            const isCustom = targeting === 'Personalizada';
            const baseReach = 5_240_000;
            const reach = !isCustom ? baseReach : Math.max(120_000, Math.round(baseReach * Math.pow(0.55, filledConditions)));
            const balanceLevel: 'amplo' | 'equilibrado' | 'restritivo' =
              !isCustom || filledConditions === 0 ? 'amplo'
              : filledConditions <= 3 ? 'equilibrado'
              : 'restritivo';
            const balanceLabel = balanceLevel === 'amplo' ? 'Amplo' : balanceLevel === 'equilibrado' ? 'Equilibrado' : 'Restritivo';
            const formattedReach = reach.toLocaleString('pt-BR');

            return (
              <div className="absolute bottom-6 left-8 right-8 z-30 pointer-events-none flex justify-center" style={{ scrollbarGutter: 'stable' }}>
                <div className="pointer-events-auto w-full max-w-[440px] bg-white rounded-xl border border-[#e8e8e8] shadow-[0px_4px_8px_0px_rgba(0,0,0,0.04)] px-4 pt-4 pb-3 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] text-[color:var(--sl-fg-base-soft)] leading-4">Alcance potencial</span>
                    <span className="text-[18px] font-medium text-[color:var(--sl-fg-base)] tracking-[-0.5px] leading-8">{formattedReach} pessoas</span>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span className="text-[13px] text-[color:var(--sl-fg-base-soft)] leading-4">{balanceLabel}</span>
                    <div className="flex items-center gap-[3px]">
                      <div className={`w-[28px] h-[6px] rounded-full transition-colors duration-300 ${balanceLevel === 'restritivo' ? 'bg-[#f59e0b]' : 'bg-[#d9d9d9]'}`} />
                      <div className={`w-[28px] h-[6px] rounded-full transition-colors duration-300 ${balanceLevel === 'equilibrado' ? 'bg-[#22c55e]' : 'bg-[#d9d9d9]'}`} />
                      <div className={`w-[28px] h-[6px] rounded-full transition-colors duration-300 ${balanceLevel === 'amplo' ? 'bg-[#3b82f6]' : 'bg-[#d9d9d9]'}`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          {renderProductPickerModal()}
          {renderPublisherPickerModal()}
          {renderReservaPublisherPickerModal()}
          {renderBulkAddModal()}
          {renderMediaPickerDrawer()}
          {renderMediaDetailModal()}
        </div>
      </div>

      {/* Clear list confirmation dialog */}
      {clearListConfirm && (
        <>
          <div
            className={`fixed inset-0 z-[600] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-[240ms] ${
              clearListClosing ? 'opacity-0' : clearListEntered ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeClearListDialog}
          />
          <div className="fixed inset-0 z-[601] flex items-center justify-center pointer-events-none">
            <div
              className={`relative bg-white rounded-2xl shadow-2xl w-[360px] p-6 flex flex-col gap-6 pointer-events-auto transition-all duration-[240ms] ease-out ${
                clearListClosing
                  ? 'opacity-0 scale-95 translate-y-2'
                  : clearListEntered
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 translate-y-2'
              }`}
            >
              <div className="flex flex-col gap-3">
                <h3 className="text-[18px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.32px]">Limpar lista</h3>
                <p className="text-sm text-[color:var(--sl-fg-base-soft)] leading-5">
                  {clearListConfirm === 'products'
                    ? 'Todos os produtos serão removidos da campanha. Deseja continuar?'
                    : 'Todos os publishers serão removidos da campanha. Deseja continuar?'}
                </p>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeClearListDialog}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-[color:var(--sl-fg-base)] hover:bg-[#f5f5f5] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleClearListConfirm}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#d92d20] hover:bg-[#b42318] active:scale-[0.98] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                >
                  Limpar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Submit validation alert */}
      {submitErrors && (
        <>
          <div
            className={`fixed inset-0 z-[600] bg-gray-900/40 backdrop-blur-sm transition-opacity duration-[240ms] ${
              submitErrorsClosing ? 'opacity-0' : submitErrorsEntered ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={closeSubmitErrors}
          />
          <div className="fixed inset-0 z-[601] flex items-center justify-center pointer-events-none">
            <div
              className={`relative bg-white rounded-2xl shadow-2xl w-[420px] p-6 flex flex-col gap-5 pointer-events-auto transition-all duration-[240ms] ease-out ${
                submitErrorsClosing
                  ? 'opacity-0 scale-95 translate-y-2'
                  : submitErrorsEntered
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 translate-y-2'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#fef3f2] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[20px] text-[color:var(--sl-fg-base)]">warning</span>
                </div>
                <div className="flex flex-col gap-1.5 min-w-0">
                  <h3 className="text-[16px] font-semibold text-[color:var(--sl-fg-base)] tracking-[-0.2px]">Não é possível criar a campanha</h3>
                  <p className="text-sm text-[color:var(--sl-fg-base-soft)] leading-5">Resolva os itens abaixo para continuar:</p>
                </div>
              </div>
              <ul className="flex flex-col gap-2 pl-[52px]">
                {submitErrors.map((err, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--sl-fg-base)] leading-5">
                    <span className="material-symbols-outlined text-[16px] text-[color:var(--sl-fg-base)] mt-0.5 shrink-0">close</span>
                    {err}
                  </li>
                ))}
              </ul>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={closeSubmitErrors}
                  className="h-10 px-5 rounded-lg text-sm font-semibold text-white bg-[#1f1f1f] hover:bg-[#333] active:scale-[0.98] transition-all shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Toast notification */}
      <div
        className={`fixed bottom-6 right-6 z-[500] px-5 py-3 bg-[#1f1f1f] text-white text-sm font-medium rounded-xl shadow-xl transition-all duration-300 pointer-events-none ${
          toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
        }`}
      >
        {toast}
      </div>

      {/* Media budget error toast */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] transition-all duration-300 ${
          mediaBudgetError ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-4 px-5 py-3.5 bg-[#1f1f1f] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] max-w-[640px]">
          <span className="material-symbols-outlined text-[18px] text-[#f87171] shrink-0">error</span>
          <p className="text-sm text-white/90 font-medium flex-1">{mediaBudgetError}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={undoMediaBudgets}
              className="px-3.5 py-1.5 text-sm font-semibold text-white/70 hover:text-white transition-colors"
            >
              Desfazer
            </button>
            <button
              type="button"
              onClick={reallocateMediaBudgets}
              className="px-3.5 py-1.5 text-sm font-semibold text-white bg-white/15 hover:bg-white/25 rounded-lg transition-colors"
            >
              Realocar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
