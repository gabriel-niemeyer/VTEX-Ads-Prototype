
import React, { useState, useMemo, useEffect, Component } from 'react';
import { GlobalTopbar } from './components/GlobalTopbar';
import { ClassicToolbar } from './components/ClassicToolbar';
import { FilterDrawer } from './components/FilterDrawer';
import { Timeline } from './components/Timeline';
import { ListView } from './components/ListView';
import { PerformanceView } from './components/PerformanceView';
import { CampaignForm } from './components/CampaignForm';
import { ColumnSelector } from './components/ColumnSelector';
import { BidAdjustmentModal } from './components/BidAdjustmentModal';
import { BudgetReportModal } from './components/BudgetReportModal';
import { Tooltip } from './components/Tooltip';
import { AgentLayout } from './components/AgentLayout';
import { Campaign, CampaignStatus, SortKey, ColumnConfig, MediaType, Product, Bid } from './types';
import { COLUMNS, PERFORMANCE_COLUMNS, ALL_MEDIA_TYPES, calculateOverallStrength } from './constants';
import { inferCampaignObjective } from './utils/campaignObjective';

class FormErrorBoundary extends Component<
  { children: React.ReactNode; onClose: () => void },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('FormErrorBoundary:', error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8">
          <div className="max-w-xl w-full bg-red-50 border-2 border-red-200 rounded-xl p-6">
            <h2 className="text-[color:var(--sl-fg-base)] font-semibold text-lg mb-3">Erro ao abrir o formulário</h2>
            <pre className="text-sm text-[color:var(--sl-fg-base)] whitespace-pre-wrap mb-4 font-mono">{this.state.error.message}</pre>
            <button
              type="button"
              onClick={this.props.onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Fechar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const APPLE_IMG = (slug: string) => `https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/${slug}?wid=400&hei=400&fmt=png-alpha`;

const MOCK_PRODUCTS: Record<string, Product[]> = {
  iphones: [
    { id: 'p1', name: 'iPhone 16 Pro Max', imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium') },
    { id: 'p2', name: 'iPhone 16 Pro', imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-3inch-deserttitanium') },
    { id: 'p3', name: 'iPhone 16', imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-1inch-ultramarine') },
    { id: 'p4', name: 'iPhone 16 Plus', imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-7inch-ultramarine') },
    { id: 'p5', name: 'iPhone 16e', imageUrl: APPLE_IMG('iphone-16e-finish-select-202502-black') },
    { id: 'p6', name: 'iPhone 15', imageUrl: APPLE_IMG('iphone-15-finish-select-202309-6-1inch-black') },
  ],
  macs: [
    { id: 'p7', name: 'MacBook Pro 16"', imageUrl: APPLE_IMG('mbp16-spaceblack-select-202410') },
    { id: 'p8', name: 'MacBook Pro 14"', imageUrl: APPLE_IMG('mbp14-spaceblack-select-202410') },
    { id: 'p9', name: 'MacBook Air 15"', imageUrl: APPLE_IMG('mba15-midnight-select-202306') },
    { id: 'p10', name: 'MacBook Air 13"', imageUrl: APPLE_IMG('mba13-midnight-select-202402') },
    { id: 'p11', name: 'iMac 24"', imageUrl: APPLE_IMG('imac-color-unselect-202601-gallery-1') },
    { id: 'p12', name: 'Mac Mini', imageUrl: APPLE_IMG('mac-mini-chip-unselect-202601-gallery-1') },
    { id: 'p13', name: 'Mac Studio', imageUrl: APPLE_IMG('mac-studio-select-202503') },
  ],
  ipads: [
    { id: 'p14', name: 'iPad Pro 13" M4', imageUrl: APPLE_IMG('ipad-pro-13-select-wifi-spaceblack-202405') },
    { id: 'p15', name: 'iPad Pro 11" M4', imageUrl: APPLE_IMG('ipad-pro-11-select-wifi-spaceblack-202405') },
    { id: 'p16', name: 'iPad Air 13"', imageUrl: APPLE_IMG('ipad-air-finish-select-gallery-202405-13inch-blue-wifi') },
    { id: 'p17', name: 'iPad Air 11"', imageUrl: APPLE_IMG('ipad-air-finish-select-gallery-202405-11inch-blue-wifi') },
    { id: 'p18', name: 'iPad 10ª geração', imageUrl: APPLE_IMG('ipad-2022-hero-blue-wifi-select') },
    { id: 'p19', name: 'iPad mini', imageUrl: APPLE_IMG('ipad-mini-select-wifi-blue-202410') },
  ],
  wearables: [
    { id: 'p20', name: 'Apple Watch Ultra 2', imageUrl: APPLE_IMG('ultra-case-unselect-gallery-1-202409') },
    { id: 'p21', name: 'Apple Watch Series 10', imageUrl: APPLE_IMG('s10-case-unselect-gallery-1-202409') },
    { id: 'p22', name: 'AirPods Pro 2', imageUrl: APPLE_IMG('airpods-pro-2-hero-select-202409') },
    { id: 'p23', name: 'AirPods Max', imageUrl: APPLE_IMG('airpods-max-select-202409-midnight') },
    { id: 'p24', name: 'AirPods 4', imageUrl: APPLE_IMG('airpods-4-hero-select-202409') },
  ],
};

const ALL_PRODUCTS: Product[] = [
  ...MOCK_PRODUCTS.iphones,
  ...MOCK_PRODUCTS.macs,
  ...MOCK_PRODUCTS.ipads,
  ...MOCK_PRODUCTS.wearables,
];

// Helper to generate mock bids
const generateMockBids = (mediaTypes: MediaType[]): Bid[] => {
  return mediaTypes.map(type => {
    const suggested = Number((Math.random() * 3 + 1).toFixed(2));
    // Generate current bid with more variety
    const match = Math.random() > 0.4;
    const current = match 
        ? suggested * (0.95 + Math.random() * 0.1) // Strong
        : suggested * (0.4 + Math.random() * 0.5); // Intermediate/Weak
    
    return {
      mediaType: type,
      currentBid: Number(current.toFixed(2)),
      suggestedBid: suggested
    };
  });
};

const DEFAULT_APPLE_IMAGE = APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium');

/** Data de hoje (meia-noite) para comparação com datas de campanha. */
function todayMidnight(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Se a campanha ainda não começou (startDate > hoje), zera gasto e métricas de entrega. */
function ensureNoSpendForFutureCampaigns(c: Campaign): Campaign {
  const today = todayMidnight();
  const start = new Date(c.startDate.getFullYear(), c.startDate.getMonth(), c.startDate.getDate());
  if (start > today) {
    return {
      ...c,
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      ntbConversions: 0,
      ntbRevenue: 0,
      units: 0,
      ntbUnits: 0,
      impressionShare: 0,
    };
  }
  return c;
}

const INITIAL_CAMPAIGNS: Campaign[] = [
  // JANEIRO
  {
    id: '1',
    title: 'Volta às Aulas: iPad para Estudantes',
    status: CampaignStatus.COMPLETED,
    publisher: 'Casas Bahia',
    startDate: new Date(2026, 0, 5),
    endDate: new Date(2026, 0, 25),
    imageUrl: APPLE_IMG('ipad-air-finish-select-gallery-202405-13inch-blue-wifi'),
    budget: 50000,
    spend: 50000,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Instore display'],
    products: MOCK_PRODUCTS.ipads,
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Instore display']),
    impressions: 2500000,
    clicks: 45000,
    conversions: 1200,
    revenue: 480000,
    ntbConversions: 400,
    ntbRevenue: 150000,
    units: 1860,
    ntbUnits: 620,
    impressionShare: 85.5
  },
  {
    id: '2',
    title: 'Lançamento MacBook Air M4',
    status: CampaignStatus.COMPLETED,
    publisher: 'Magalu',
    startDate: new Date(2026, 0, 10),
    endDate: new Date(2026, 0, 20),
    imageUrl: APPLE_IMG('mba13-midnight-select-202402'),
    budget: 35000,
    spend: 34200,
    mediaTypes: ['Produto patrocinado', 'Video'],
    products: MOCK_PRODUCTS.macs,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Video']),
    impressions: 1800000,
    clicks: 32000,
    conversions: 850,
    revenue: 290000,
    ntbConversions: 200,
    ntbRevenue: 60000,
    units: 1320,
    ntbUnits: 310,
    impressionShare: 60.2
  },
  // FEVEREIRO
  {
    id: '3',
    title: 'Carnaval com AirPods: Música Sem Limites',
    status: CampaignStatus.COMPLETED,
    publisher: 'Mercado Livre',
    startDate: new Date(2026, 1, 1),
    endDate: new Date(2026, 1, 15),
    imageUrl: APPLE_IMG('airpods-pro-2-hero-select-202409'),
    budget: 20000,
    spend: 19500,
    mediaTypes: ['Banner patrocinado', 'Video'],
    products: [...MOCK_PRODUCTS.wearables.slice(2), MOCK_PRODUCTS.iphones[0]],
    bidStrength: 'Fraco',
    bids: generateMockBids(['Banner patrocinado', 'Video']),
    impressions: 1250000,
    clicks: 23400,
    conversions: 624,
    revenue: 148000,
    ntbConversions: 390,
    ntbRevenue: 86000,
    units: 967,
    ntbUnits: 608,
    impressionShare: 45.0
  },
  {
    id: '4',
    title: 'iPhone 16 Pro: Compre o Seu',
    status: CampaignStatus.COMPLETED,
    publisher: 'Americanas',
    startDate: new Date(2026, 1, 12),
    endDate: new Date(2026, 1, 28),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-3inch-deserttitanium'),
    budget: 45000,
    spend: 40500,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada'],
    products: MOCK_PRODUCTS.iphones,
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada']),
    impressions: 2430000,
    clicks: 48600,
    conversions: 945,
    revenue: 378000,
    ntbConversions: 486,
    ntbRevenue: 189000,
    units: 1458,
    ntbUnits: 756,
    impressionShare: 72.3
  },
  // MARÇO
  {
    id: '5',
    title: 'Semana do Consumidor: iPhone 16 Pro Max',
    status: CampaignStatus.ACTIVE,
    publisher: 'Fast Shop',
    startDate: new Date(2026, 2, 5),
    endDate: new Date(2026, 2, 20),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium'),
    budget: 80000,
    spend: 45000,
    mediaTypes: ['Banner patrocinado', 'Instore display', 'Marca patrocinada'],
    products: [MOCK_PRODUCTS.iphones[0], MOCK_PRODUCTS.iphones[1]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Banner patrocinado', 'Instore display', 'Marca patrocinada']),
    impressions: 1250000,
    clicks: 28000,
    conversions: 620,
    revenue: 520000,
    ntbConversions: 200,
    ntbRevenue: 150000,
    units: 960,
    ntbUnits: 310,
    impressionShare: 65.4
  },
  {
    id: '6',
    title: 'Semana do Consumidor: Ofertas Apple',
    status: CampaignStatus.ACTIVE,
    publisher: 'Amazon Brasil',
    startDate: new Date(2026, 2, 10),
    endDate: new Date(2026, 2, 18),
    imageUrl: APPLE_IMG('mbp16-spaceblack-select-202410'),
    budget: 60000,
    spend: 26700,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada', 'Video'],
    products: [...MOCK_PRODUCTS.iphones, ...MOCK_PRODUCTS.macs],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada', 'Video']),
    impressions: 659000,
    clicks: 15300,
    conversions: 333,
    revenue: 264000,
    ntbConversions: 104,
    ntbRevenue: 76300,
    units: 517,
    ntbUnits: 163,
    impressionShare: 55.8
  },
  // ABRIL
  {
    id: '7',
    title: 'Apple Watch Ultra 2: Aventura e Esporte',
    status: CampaignStatus.ACTIVE,
    publisher: 'Kabum',
    startDate: new Date(2026, 3, 1),
    endDate: new Date(2026, 3, 15),
    imageUrl: APPLE_IMG('ultra-case-unselect-gallery-1-202409'),
    budget: 15000,
    spend: 0,
    mediaTypes: ['Produto patrocinado'],
    products: MOCK_PRODUCTS.wearables,
    bidStrength: 'Fraco',
    bids: generateMockBids(['Produto patrocinado']),
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    ntbConversions: 0,
    ntbRevenue: 0,
    units: 0,
    ntbUnits: 0,
    impressionShare: 0
  },
  {
    id: '8',
    title: 'iPad Pro M4: Criatividade Profissional',
    status: CampaignStatus.ACTIVE,
    publisher: 'Americanas',
    startDate: new Date(2026, 3, 10),
    endDate: new Date(2026, 3, 22),
    imageUrl: APPLE_IMG('ipad-pro-13-select-wifi-spaceblack-202405'),
    budget: 40000,
    spend: 0,
    mediaTypes: ['Banner patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.ipads[0], MOCK_PRODUCTS.ipads[1]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Banner patrocinado', 'Video']),
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    ntbConversions: 0,
    ntbRevenue: 0,
    units: 0,
    ntbUnits: 0,
    impressionShare: 0
  },
  // MAIO
  {
    id: '9',
    title: 'Dia das Mães: Presentes Apple',
    status: CampaignStatus.DRAFT,
    publisher: 'Casas Bahia',
    startDate: new Date(2026, 4, 1),
    endDate: new Date(2026, 4, 12),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium'),
    budget: 120000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada', 'Video', 'Instore display'],
    products: [...MOCK_PRODUCTS.iphones, ...MOCK_PRODUCTS.wearables],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada', 'Video', 'Instore display']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  {
    id: '10',
    title: 'MacBook Pro para Mães Criativas',
    status: CampaignStatus.DRAFT,
    publisher: 'Magalu',
    startDate: new Date(2026, 4, 10),
    endDate: new Date(2026, 4, 25),
    imageUrl: APPLE_IMG('mbp14-spaceblack-select-202410'),
    budget: 30000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: MOCK_PRODUCTS.macs,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // JUNHO
  {
    id: '11',
    title: 'Dia dos Namorados: Apple Watch Series 10',
    status: CampaignStatus.DRAFT,
    publisher: 'Submarino',
    startDate: new Date(2026, 5, 1),
    endDate: new Date(2026, 5, 12),
    imageUrl: APPLE_IMG('s10-case-unselect-gallery-1-202409'),
    budget: 25000,
    spend: 0,
    mediaTypes: ['Video', 'Marca patrocinada'],
    products: [...MOCK_PRODUCTS.wearables, ...MOCK_PRODUCTS.iphones],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Video', 'Marca patrocinada']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  {
    id: '12',
    title: 'Festa Junina: AirPods & Wearables',
    status: CampaignStatus.DRAFT,
    publisher: 'Carrefour',
    startDate: new Date(2026, 5, 15),
    endDate: new Date(2026, 5, 30),
    imageUrl: APPLE_IMG('airpods-max-select-202409-midnight'),
    budget: 10000,
    spend: 0,
    mediaTypes: ['Produto patrocinado'],
    products: MOCK_PRODUCTS.wearables,
    bidStrength: 'Fraco',
    bids: generateMockBids(['Produto patrocinado']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // JULHO
  {
    id: '13',
    title: 'Férias de Inverno: Mac para Produtividade',
    status: CampaignStatus.DRAFT,
    publisher: 'Casas Bahia',
    startDate: new Date(2026, 6, 1),
    endDate: new Date(2026, 6, 31),
    imageUrl: APPLE_IMG('imac-color-unselect-202601-gallery-1'),
    budget: 45000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: MOCK_PRODUCTS.macs,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // AGOSTO
  {
    id: '14',
    title: 'Dia dos Pais: iPhone & Apple Watch',
    status: CampaignStatus.DRAFT,
    publisher: 'Shoptime',
    startDate: new Date(2026, 7, 1),
    endDate: new Date(2026, 7, 10),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-3inch-deserttitanium'),
    budget: 60000,
    spend: 0,
    mediaTypes: ['Banner patrocinado', 'Video', 'Instore display'],
    products: [...MOCK_PRODUCTS.iphones, ...MOCK_PRODUCTS.wearables],
    bidStrength: 'Forte',
    bids: generateMockBids(['Banner patrocinado', 'Video', 'Instore display']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  {
    id: '15',
    title: 'Ecossistema Apple: iPhone + Mac + iPad',
    status: CampaignStatus.DRAFT,
    publisher: 'Extra',
    startDate: new Date(2026, 7, 15),
    endDate: new Date(2026, 7, 30),
    imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-1inch-ultramarine'),
    budget: 55000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada'],
    products: [...MOCK_PRODUCTS.iphones, ...MOCK_PRODUCTS.macs, ...MOCK_PRODUCTS.ipads],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // SETEMBRO
  {
    id: '16',
    title: 'Lançamento: iPhone 17 Pro',
    status: CampaignStatus.DRAFT,
    publisher: 'Amazon Brasil',
    startDate: new Date(2026, 8, 15),
    endDate: new Date(2026, 9, 15),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium'),
    budget: 250000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada', 'Video', 'Instore display'],
    products: MOCK_PRODUCTS.iphones,
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada', 'Video', 'Instore display']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // OUTUBRO
  {
    id: '17',
    title: 'Dia das Crianças: iPad e Apple Watch',
    status: CampaignStatus.DRAFT,
    publisher: 'Magalu',
    startDate: new Date(2026, 9, 1),
    endDate: new Date(2026, 9, 12),
    imageUrl: APPLE_IMG('ipad-2022-hero-blue-wifi-select'),
    budget: 35000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Video'],
    products: [...MOCK_PRODUCTS.ipads, ...MOCK_PRODUCTS.wearables],
    bidStrength: 'Fraco',
    bids: generateMockBids(['Produto patrocinado', 'Video']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // NOVEMBRO
  {
    id: '18',
    title: 'Esquenta Black Friday: MacBook Pro',
    status: CampaignStatus.DRAFT,
    publisher: 'Kabum',
    startDate: new Date(2026, 10, 1),
    endDate: new Date(2026, 10, 15),
    imageUrl: APPLE_IMG('mbp16-spaceblack-select-202410'),
    budget: 15000,
    spend: 0,
    mediaTypes: ['Banner patrocinado'],
    products: MOCK_PRODUCTS.macs,
    bidStrength: 'Fraco',
    bids: generateMockBids(['Banner patrocinado']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  {
    id: '19',
    title: 'Black Friday: Apple em Oferta',
    status: CampaignStatus.DRAFT,
    publisher: 'Amazon Brasil',
    startDate: new Date(2026, 10, 20),
    endDate: new Date(2026, 10, 30),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium'),
    budget: 330000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada', 'Video', 'Instore display'],
    products: [...MOCK_PRODUCTS.iphones, ...MOCK_PRODUCTS.macs, ...MOCK_PRODUCTS.ipads, ...MOCK_PRODUCTS.wearables],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada', 'Video', 'Instore display']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // DEZEMBRO
  {
    id: '20',
    title: 'Natal Apple: O Presente Perfeito',
    status: CampaignStatus.DRAFT,
    publisher: 'Casas Bahia',
    startDate: new Date(2026, 11, 1),
    endDate: new Date(2026, 11, 24),
    imageUrl: APPLE_IMG('airpods-pro-2-hero-select-202409'),
    budget: 150000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Video'],
    products: [...MOCK_PRODUCTS.iphones, ...MOCK_PRODUCTS.wearables],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Video']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  {
    id: '21',
    title: 'Réveillon: iPad & Mac para o Novo Ano',
    status: CampaignStatus.DRAFT,
    publisher: 'Mercado Livre',
    startDate: new Date(2026, 11, 26),
    endDate: new Date(2027, 0, 5),
    imageUrl: APPLE_IMG('ipad-pro-11-select-wifi-spaceblack-202405'),
    budget: 60000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada'],
    products: [...MOCK_PRODUCTS.ipads, ...MOCK_PRODUCTS.macs],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada']),
    impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0
  },
  // ——— Campanhas adicionais para teste do relatório de orçamento ———
  // Ongoing: abaixo do ritmo
  {
    id: '22',
    title: 'Março: iPhone em Destaque (em andamento)',
    status: CampaignStatus.ACTIVE,
    publisher: 'Fast Shop',
    startDate: new Date(2026, 2, 1),
    endDate: new Date(2026, 2, 25),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-3inch-deserttitanium'),
    budget: 60000,
    spend: 24000,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: MOCK_PRODUCTS.iphones,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 820000,
    clicks: 18500,
    conversions: 412,
    revenue: 328000,
    ntbConversions: 120,
    ntbRevenue: 48000,
    units: 618,
    ntbUnits: 185,
    impressionShare: 52.0
  },
  // Ongoing: no ritmo
  {
    id: '23',
    title: 'Campanha Março: MacBook e iPad',
    status: CampaignStatus.ACTIVE,
    publisher: 'Magalu',
    startDate: new Date(2026, 2, 5),
    endDate: new Date(2026, 2, 28),
    imageUrl: APPLE_IMG('mbp16-spaceblack-select-202410'),
    budget: 80000,
    spend: 42000,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada', 'Video'],
    products: [...MOCK_PRODUCTS.macs, ...MOCK_PRODUCTS.ipads],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada', 'Video']),
    impressions: 1580000,
    clicks: 35200,
    conversions: 780,
    revenue: 624000,
    ntbConversions: 234,
    ntbRevenue: 187200,
    units: 1170,
    ntbUnits: 351,
    impressionShare: 68.2
  },
  // Ongoing: acima do ritmo
  {
    id: '24',
    title: 'Ofertas Março: Wearables',
    status: CampaignStatus.ACTIVE,
    publisher: 'Americanas',
    startDate: new Date(2026, 2, 8),
    endDate: new Date(2026, 2, 22),
    imageUrl: APPLE_IMG('s10-case-unselect-gallery-1-202409'),
    budget: 35000,
    spend: 28500,
    mediaTypes: ['Banner patrocinado', 'Video'],
    products: MOCK_PRODUCTS.wearables,
    bidStrength: 'Forte',
    bids: generateMockBids(['Banner patrocinado', 'Video']),
    impressions: 980000,
    clicks: 24500,
    conversions: 612,
    revenue: 183600,
    ntbConversions: 245,
    ntbRevenue: 73500,
    units: 918,
    ntbUnits: 368,
    impressionShare: 58.5
  },
  // Ongoing: com histórico de orçamento (aumento no meio)
  {
    id: '25',
    title: 'Semana do Consumidor Extendida',
    status: CampaignStatus.ACTIVE,
    publisher: 'Amazon Brasil',
    startDate: new Date(2026, 2, 1),
    endDate: new Date(2026, 2, 31),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium'),
    budget: 100000,
    spend: 72000,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada'],
    products: MOCK_PRODUCTS.iphones,
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada']),
    impressions: 2100000,
    clicks: 52000,
    conversions: 1300,
    revenue: 1040000,
    ntbConversions: 390,
    ntbRevenue: 312000,
    units: 1950,
    ntbUnits: 585,
    impressionShare: 75.0
  },
  // Ongoing: gasto zero ainda (começou há pouco)
  {
    id: '26',
    title: 'Lançamento Março: AirPods Pro',
    status: CampaignStatus.ACTIVE,
    publisher: 'Kabum',
    startDate: new Date(2026, 2, 14),
    endDate: new Date(2026, 2, 30),
    imageUrl: APPLE_IMG('airpods-pro-2-hero-select-202409'),
    budget: 28000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Video'],
    products: MOCK_PRODUCTS.wearables,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Video']),
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    ntbConversions: 0,
    ntbRevenue: 0,
    units: 0,
    ntbUnits: 0,
    impressionShare: 0
  },
  // ——— Campanhas passadas com histórico de uso ———
  {
    id: '27',
    title: 'Janeiro: Promoção iPad (encerrada)',
    status: CampaignStatus.COMPLETED,
    publisher: 'Casas Bahia',
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 0, 20),
    imageUrl: APPLE_IMG('ipad-air-finish-select-gallery-202405-11inch-blue-wifi'),
    budget: 30000,
    spend: 27800,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: MOCK_PRODUCTS.ipads,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 1450000,
    clicks: 29000,
    conversions: 580,
    revenue: 232000,
    ntbConversions: 174,
    ntbRevenue: 69600,
    units: 870,
    ntbUnits: 261,
    impressionShare: 62.0
  },
  {
    id: '28',
    title: 'Fevereiro: Black Month Mac (encerrada – esgotou orçamento)',
    status: CampaignStatus.COMPLETED,
    publisher: 'Submarino',
    startDate: new Date(2026, 1, 1),
    endDate: new Date(2026, 1, 14),
    imageUrl: APPLE_IMG('mbp14-spaceblack-select-202410'),
    budget: 55000,
    spend: 55000,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada', 'Video'],
    products: MOCK_PRODUCTS.macs,
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada', 'Video']),
    impressions: 2200000,
    clicks: 44000,
    conversions: 880,
    revenue: 704000,
    ntbConversions: 264,
    ntbRevenue: 211200,
    units: 1320,
    ntbUnits: 396,
    impressionShare: 78.5
  },
  {
    id: '29',
    title: 'Fev–Mar: iPhone (encerrada – estourou orçamento, com alteração de meta)',
    status: CampaignStatus.COMPLETED,
    publisher: 'Mercado Livre',
    startDate: new Date(2026, 1, 10),
    endDate: new Date(2026, 2, 5),
    imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-1inch-ultramarine'),
    budget: 45000,
    spend: 51800,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: MOCK_PRODUCTS.iphones,
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 1950000,
    clicks: 48750,
    conversions: 975,
    revenue: 390000,
    ntbConversions: 293,
    ntbRevenue: 117200,
    units: 1463,
    ntbUnits: 439,
    impressionShare: 71.0
  },
  {
    id: '30',
    title: 'Janeiro: Dia do Respeito (encerrada – subutilização)',
    status: CampaignStatus.COMPLETED,
    publisher: 'Carrefour',
    startDate: new Date(2026, 0, 15),
    endDate: new Date(2026, 1, 5),
    imageUrl: APPLE_IMG('airpods-4-hero-select-202409'),
    budget: 25000,
    spend: 21800,
    mediaTypes: ['Video', 'Marca patrocinada'],
    products: MOCK_PRODUCTS.wearables,
    bidStrength: 'Fraco',
    bids: generateMockBids(['Video', 'Marca patrocinada']),
    impressions: 980000,
    clicks: 19600,
    conversions: 392,
    revenue: 78400,
    ntbConversions: 118,
    ntbRevenue: 23520,
    units: 588,
    ntbUnits: 176,
    impressionShare: 48.0
  },
  {
    id: '31',
    title: 'Fev–Mar: Watch Ultra (encerrada, orçamento aumentado no meio)',
    status: CampaignStatus.COMPLETED,
    publisher: 'Extra',
    startDate: new Date(2026, 1, 20),
    endDate: new Date(2026, 2, 10),
    imageUrl: APPLE_IMG('ultra-case-unselect-gallery-1-202409'),
    budget: 70000,
    spend: 66800,
    mediaTypes: ['Produto patrocinado', 'Instore display'],
    products: MOCK_PRODUCTS.wearables,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Instore display']),
    impressions: 1680000,
    clicks: 33600,
    conversions: 672,
    revenue: 268800,
    ntbConversions: 202,
    ntbRevenue: 80640,
    units: 1008,
    ntbUnits: 303,
    impressionShare: 65.0
  },
  // ——— Mais 10 campanhas em andamento ———
  {
    id: '32',
    title: 'Março Premium: iPhone 16 Pro Max',
    status: CampaignStatus.ACTIVE,
    publisher: 'Shoptime',
    startDate: new Date(2026, 2, 1),
    endDate: new Date(2026, 2, 28),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium'),
    budget: 95000,
    spend: 52000,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada', 'Video'],
    products: [MOCK_PRODUCTS.iphones[0], MOCK_PRODUCTS.iphones[1]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada', 'Video']),
    impressions: 1650000,
    clicks: 41200,
    conversions: 824,
    revenue: 659200,
    ntbConversions: 247,
    ntbRevenue: 98800,
    units: 1236,
    ntbUnits: 371,
    impressionShare: 70.0
  },
  {
    id: '33',
    title: 'Campanha Março: iMac e Mac Studio',
    status: CampaignStatus.ACTIVE,
    publisher: 'Kabum',
    startDate: new Date(2026, 2, 3),
    endDate: new Date(2026, 2, 25),
    imageUrl: APPLE_IMG('imac-color-unselect-202601-gallery-1'),
    budget: 42000,
    spend: 18900,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: [MOCK_PRODUCTS.macs[4], MOCK_PRODUCTS.macs[5]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 720000,
    clicks: 14400,
    conversions: 288,
    revenue: 201600,
    ntbConversions: 86,
    ntbRevenue: 25800,
    units: 432,
    ntbUnits: 130,
    impressionShare: 55.0
  },
  {
    id: '34',
    title: 'Ofertas Março: iPad Air e mini',
    status: CampaignStatus.ACTIVE,
    publisher: 'Mercado Livre',
    startDate: new Date(2026, 2, 5),
    endDate: new Date(2026, 2, 22),
    imageUrl: APPLE_IMG('ipad-air-finish-select-gallery-202405-11inch-blue-wifi'),
    budget: 38000,
    spend: 31200,
    mediaTypes: ['Produto patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.ipads[2], MOCK_PRODUCTS.ipads[4]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Video']),
    impressions: 1280000,
    clicks: 25600,
    conversions: 512,
    revenue: 204800,
    ntbConversions: 154,
    ntbRevenue: 61440,
    units: 768,
    ntbUnits: 230,
    impressionShare: 62.0
  },
  {
    id: '35',
    title: 'Março: Ecossistema Apple (iPhone + Watch)',
    status: CampaignStatus.ACTIVE,
    publisher: 'Americanas',
    startDate: new Date(2026, 2, 7),
    endDate: new Date(2026, 2, 29),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-3inch-deserttitanium'),
    budget: 72000,
    spend: 45800,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Instore display'],
    products: [...MOCK_PRODUCTS.iphones.slice(0, 3), ...MOCK_PRODUCTS.wearables.slice(0, 2)],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Instore display']),
    impressions: 1920000,
    clicks: 38400,
    conversions: 768,
    revenue: 614400,
    ntbConversions: 230,
    ntbRevenue: 92160,
    units: 1152,
    ntbUnits: 346,
    impressionShare: 68.0
  },
  {
    id: '36',
    title: 'Semana do Consumidor: MacBook Pro',
    status: CampaignStatus.ACTIVE,
    publisher: 'Fast Shop',
    startDate: new Date(2026, 2, 10),
    endDate: new Date(2026, 2, 20),
    imageUrl: APPLE_IMG('mbp16-spaceblack-select-202410'),
    budget: 65000,
    spend: 48500,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada'],
    products: MOCK_PRODUCTS.macs.slice(0, 3),
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada']),
    impressions: 1420000,
    clicks: 35500,
    conversions: 710,
    revenue: 568000,
    ntbConversions: 213,
    ntbRevenue: 85200,
    units: 1065,
    ntbUnits: 320,
    impressionShare: 72.0
  },
  {
    id: '37',
    title: 'Março: AirPods e Wearables',
    status: CampaignStatus.ACTIVE,
    publisher: 'Carrefour',
    startDate: new Date(2026, 2, 1),
    endDate: new Date(2026, 2, 26),
    imageUrl: APPLE_IMG('airpods-pro-2-hero-select-202409'),
    budget: 22000,
    spend: 8200,
    mediaTypes: ['Banner patrocinado', 'Video'],
    products: MOCK_PRODUCTS.wearables,
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Banner patrocinado', 'Video']),
    impressions: 410000,
    clicks: 10200,
    conversions: 204,
    revenue: 61200,
    ntbConversions: 61,
    ntbRevenue: 18360,
    units: 306,
    ntbUnits: 92,
    impressionShare: 48.0
  },
  {
    id: '38',
    title: 'Campanha Continuada: iPhone 16 Plus',
    status: CampaignStatus.ACTIVE,
    publisher: 'Magalu',
    startDate: new Date(2026, 2, 4),
    endDate: new Date(2026, 2, 31),
    imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-7inch-ultramarine'),
    budget: 58000,
    spend: 34800,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.iphones[3], MOCK_PRODUCTS.iphones[2]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Video']),
    impressions: 1160000,
    clicks: 29000,
    conversions: 580,
    revenue: 348000,
    ntbConversions: 174,
    ntbRevenue: 69600,
    units: 870,
    ntbUnits: 261,
    impressionShare: 59.0
  },
  {
    id: '39',
    title: 'Março: iPad Pro M4 em Destaque',
    status: CampaignStatus.ACTIVE,
    publisher: 'Submarino',
    startDate: new Date(2026, 2, 6),
    endDate: new Date(2026, 2, 24),
    imageUrl: APPLE_IMG('ipad-pro-13-select-wifi-spaceblack-202405'),
    budget: 48000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada'],
    products: [MOCK_PRODUCTS.ipads[0], MOCK_PRODUCTS.ipads[1]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada']),
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    ntbConversions: 0,
    ntbRevenue: 0,
    units: 0,
    ntbUnits: 0,
    impressionShare: 0
  },
  {
    id: '40',
    title: 'Promoção Março: MacBook Air',
    status: CampaignStatus.ACTIVE,
    publisher: 'Extra',
    startDate: new Date(2026, 2, 2),
    endDate: new Date(2026, 2, 27),
    imageUrl: APPLE_IMG('mba13-midnight-select-202402'),
    budget: 33000,
    spend: 26500,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Instore display'],
    products: [MOCK_PRODUCTS.macs[2], MOCK_PRODUCTS.macs[3]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Instore display']),
    impressions: 1050000,
    clicks: 26200,
    conversions: 524,
    revenue: 209600,
    ntbConversions: 157,
    ntbRevenue: 62880,
    units: 786,
    ntbUnits: 236,
    impressionShare: 64.0
  },
  {
    id: '41',
    title: 'Março: Apple Watch Series 10',
    status: CampaignStatus.ACTIVE,
    publisher: 'Amazon Brasil',
    startDate: new Date(2026, 2, 12),
    endDate: new Date(2026, 2, 30),
    imageUrl: APPLE_IMG('s10-case-unselect-gallery-1-202409'),
    budget: 29000,
    spend: 4200,
    mediaTypes: ['Produto patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.wearables[1], MOCK_PRODUCTS.wearables[0]],
    bidStrength: 'Fraco',
    bids: generateMockBids(['Produto patrocinado', 'Video']),
    impressions: 280000,
    clicks: 7000,
    conversions: 140,
    revenue: 84000,
    ntbConversions: 42,
    ntbRevenue: 12600,
    units: 210,
    ntbUnits: 63,
    impressionShare: 42.0
  },
  // ——— Mais campanhas em andamento para teste do relatório de orçamento ———
  {
    id: '42',
    title: 'Março Digital: iPhone 16e',
    status: CampaignStatus.ACTIVE,
    publisher: 'Shoptime',
    startDate: new Date(2026, 2, 1),
    endDate: new Date(2026, 2, 28),
    imageUrl: APPLE_IMG('iphone-16e-finish-select-202502-black'),
    budget: 44000,
    spend: 19800,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: [MOCK_PRODUCTS.iphones[4]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 880000,
    clicks: 22000,
    conversions: 440,
    revenue: 176000,
    ntbConversions: 132,
    ntbRevenue: 52800,
    units: 660,
    ntbUnits: 198,
    impressionShare: 54.0
  },
  {
    id: '43',
    title: 'Campanha Março: Mac Mini e Studio',
    status: CampaignStatus.ACTIVE,
    publisher: 'Kabum',
    startDate: new Date(2026, 2, 5),
    endDate: new Date(2026, 2, 25),
    imageUrl: APPLE_IMG('mac-mini-chip-unselect-202601-gallery-1'),
    budget: 26000,
    spend: 18200,
    mediaTypes: ['Produto patrocinado'],
    products: [MOCK_PRODUCTS.macs[5], MOCK_PRODUCTS.macs[6]],
    bidStrength: 'Fraco',
    bids: generateMockBids(['Produto patrocinado']),
    impressions: 520000,
    clicks: 13000,
    conversions: 260,
    revenue: 208000,
    ntbConversions: 78,
    ntbRevenue: 31200,
    units: 390,
    ntbUnits: 117,
    impressionShare: 48.0
  },
  {
    id: '44',
    title: 'Ofertas Março: iPad 10ª geração',
    status: CampaignStatus.ACTIVE,
    publisher: 'Mercado Livre',
    startDate: new Date(2026, 2, 8),
    endDate: new Date(2026, 2, 24),
    imageUrl: APPLE_IMG('ipad-2022-hero-blue-wifi-select'),
    budget: 19500,
    spend: 15600,
    mediaTypes: ['Produto patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.ipads[4]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Video']),
    impressions: 780000,
    clicks: 19500,
    conversions: 390,
    revenue: 117000,
    ntbConversions: 117,
    ntbRevenue: 35100,
    units: 585,
    ntbUnits: 176,
    impressionShare: 61.0
  },
  {
    id: '45',
    title: 'Março: iPhone + AirPods Bundle',
    status: CampaignStatus.ACTIVE,
    publisher: 'Americanas',
    startDate: new Date(2026, 2, 3),
    endDate: new Date(2026, 2, 29),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-3inch-deserttitanium'),
    budget: 88000,
    spend: 52800,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada', 'Instore display'],
    products: [...MOCK_PRODUCTS.iphones.slice(0, 2), ...MOCK_PRODUCTS.wearables.slice(2, 4)],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada', 'Instore display']),
    impressions: 2112000,
    clicks: 52800,
    conversions: 1056,
    revenue: 844800,
    ntbConversions: 317,
    ntbRevenue: 126720,
    units: 1584,
    ntbUnits: 475,
    impressionShare: 73.0
  },
  {
    id: '46',
    title: 'Semana do Consumidor: iMac',
    status: CampaignStatus.ACTIVE,
    publisher: 'Fast Shop',
    startDate: new Date(2026, 2, 9),
    endDate: new Date(2026, 2, 21),
    imageUrl: APPLE_IMG('imac-color-unselect-202601-gallery-1'),
    budget: 52000,
    spend: 0,
    mediaTypes: ['Banner patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.macs[4]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Banner patrocinado', 'Video']),
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    ntbConversions: 0,
    ntbRevenue: 0,
    units: 0,
    ntbUnits: 0,
    impressionShare: 0
  },
  {
    id: '47',
    title: 'Março: AirPods Max Premium',
    status: CampaignStatus.ACTIVE,
    publisher: 'Carrefour',
    startDate: new Date(2026, 2, 6),
    endDate: new Date(2026, 2, 26),
    imageUrl: APPLE_IMG('airpods-max-select-202409-midnight'),
    budget: 31000,
    spend: 24800,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada'],
    products: [MOCK_PRODUCTS.wearables[3]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada']),
    impressions: 992000,
    clicks: 24800,
    conversions: 496,
    revenue: 198400,
    ntbConversions: 149,
    ntbRevenue: 59520,
    units: 744,
    ntbUnits: 223,
    impressionShare: 66.0
  },
  {
    id: '48',
    title: 'Campanha Continuada Março: MacBook Pro 14"',
    status: CampaignStatus.ACTIVE,
    publisher: 'Magalu',
    startDate: new Date(2026, 2, 2),
    endDate: new Date(2026, 2, 31),
    imageUrl: APPLE_IMG('mbp14-spaceblack-select-202410'),
    budget: 76000,
    spend: 60800,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.macs[1]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Video']),
    impressions: 1824000,
    clicks: 45600,
    conversions: 912,
    revenue: 729600,
    ntbConversions: 274,
    ntbRevenue: 109440,
    units: 1368,
    ntbUnits: 411,
    impressionShare: 71.0
  },
  {
    id: '49',
    title: 'Março: iPad mini em Destaque',
    status: CampaignStatus.ACTIVE,
    publisher: 'Submarino',
    startDate: new Date(2026, 2, 11),
    endDate: new Date(2026, 2, 28),
    imageUrl: APPLE_IMG('ipad-mini-select-wifi-blue-202410'),
    budget: 23500,
    spend: 3600,
    mediaTypes: ['Produto patrocinado'],
    products: [MOCK_PRODUCTS.ipads[5]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado']),
    impressions: 180000,
    clicks: 4500,
    conversions: 90,
    revenue: 36000,
    ntbConversions: 27,
    ntbRevenue: 10800,
    units: 135,
    ntbUnits: 41,
    impressionShare: 38.0
  },
  {
    id: '50',
    title: 'Promoção Março: Ecossistema Completo',
    status: CampaignStatus.ACTIVE,
    publisher: 'Extra',
    startDate: new Date(2026, 2, 1),
    endDate: new Date(2026, 2, 30),
    imageUrl: APPLE_IMG('iphone-16-pro-finish-select-202409-6-9inch-deserttitanium'),
    budget: 125000,
    spend: 87500,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada', 'Video'],
    products: [...MOCK_PRODUCTS.iphones, ...MOCK_PRODUCTS.wearables],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada', 'Video']),
    impressions: 3125000,
    clicks: 78100,
    conversions: 1562,
    revenue: 1249600,
    ntbConversions: 469,
    ntbRevenue: 187440,
    units: 2343,
    ntbUnits: 703,
    impressionShare: 76.0
  },
  {
    id: '51',
    title: 'Março: Apple Watch Ultra 2 Aventura',
    status: CampaignStatus.ACTIVE,
    publisher: 'Amazon Brasil',
    startDate: new Date(2026, 2, 7),
    endDate: new Date(2026, 2, 22),
    imageUrl: APPLE_IMG('ultra-case-unselect-gallery-1-202409'),
    budget: 41000,
    spend: 36900,
    mediaTypes: ['Produto patrocinado', 'Video', 'Instore display'],
    products: [MOCK_PRODUCTS.wearables[0]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Video', 'Instore display']),
    impressions: 1476000,
    clicks: 36900,
    conversions: 738,
    revenue: 295200,
    ntbConversions: 221,
    ntbRevenue: 88560,
    units: 1107,
    ntbUnits: 332,
    impressionShare: 69.0
  },
  {
    id: '52',
    title: 'Campanha Março: iPhone 16 Plus',
    status: CampaignStatus.ACTIVE,
    publisher: 'Casas Bahia',
    startDate: new Date(2026, 2, 4),
    endDate: new Date(2026, 2, 27),
    imageUrl: APPLE_IMG('iphone-16-finish-select-202409-6-7inch-ultramarine'),
    budget: 54000,
    spend: 24300,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: [MOCK_PRODUCTS.iphones[3]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 972000,
    clicks: 24300,
    conversions: 486,
    revenue: 291600,
    ntbConversions: 146,
    ntbRevenue: 58320,
    units: 729,
    ntbUnits: 219,
    impressionShare: 58.0
  },
  {
    id: '53',
    title: 'Março: MacBook Air 15" Criatividade',
    status: CampaignStatus.ACTIVE,
    publisher: 'Shoptime',
    startDate: new Date(2026, 2, 10),
    endDate: new Date(2026, 2, 29),
    imageUrl: APPLE_IMG('mba15-midnight-select-202306'),
    budget: 47000,
    spend: 28200,
    mediaTypes: ['Produto patrocinado', 'Marca patrocinada'],
    products: [MOCK_PRODUCTS.macs[2]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Marca patrocinada']),
    impressions: 1128000,
    clicks: 28200,
    conversions: 564,
    revenue: 451200,
    ntbConversions: 169,
    ntbRevenue: 67680,
    units: 846,
    ntbUnits: 254,
    impressionShare: 63.0
  },
  {
    id: '54',
    title: 'Ofertas Março: iPad Pro 11"',
    status: CampaignStatus.ACTIVE,
    publisher: 'Kabum',
    startDate: new Date(2026, 2, 8),
    endDate: new Date(2026, 2, 25),
    imageUrl: APPLE_IMG('ipad-pro-11-select-wifi-spaceblack-202405'),
    budget: 39000,
    spend: 0,
    mediaTypes: ['Produto patrocinado', 'Video'],
    products: [MOCK_PRODUCTS.ipads[1]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Video']),
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    ntbConversions: 0,
    ntbRevenue: 0,
    units: 0,
    ntbUnits: 0,
    impressionShare: 0
  },
  {
    id: '55',
    title: 'Março: AirPods 4 e Pro 2',
    status: CampaignStatus.ACTIVE,
    publisher: 'Mercado Livre',
    startDate: new Date(2026, 2, 6),
    endDate: new Date(2026, 2, 26),
    imageUrl: APPLE_IMG('airpods-4-hero-select-202409'),
    budget: 27500,
    spend: 23100,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: [MOCK_PRODUCTS.wearables[2], MOCK_PRODUCTS.wearables[4]],
    bidStrength: 'Forte',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 924000,
    clicks: 23100,
    conversions: 462,
    revenue: 138600,
    ntbConversions: 139,
    ntbRevenue: 41640,
    units: 693,
    ntbUnits: 208,
    impressionShare: 64.0
  },
  {
    id: '56',
    title: 'Campanha Março: iPhone 15 Entrada',
    status: CampaignStatus.ACTIVE,
    publisher: 'Americanas',
    startDate: new Date(2026, 2, 12),
    endDate: new Date(2026, 2, 31),
    imageUrl: APPLE_IMG('iphone-15-finish-select-202309-6-1inch-black'),
    budget: 36000,
    spend: 12600,
    mediaTypes: ['Produto patrocinado', 'Banner patrocinado'],
    products: [MOCK_PRODUCTS.iphones[5]],
    bidStrength: 'Intermediário',
    bids: generateMockBids(['Produto patrocinado', 'Banner patrocinado']),
    impressions: 504000,
    clicks: 12600,
    conversions: 252,
    revenue: 100800,
    ntbConversions: 76,
    ntbRevenue: 30240,
    units: 378,
    ntbUnits: 113,
    impressionShare: 52.0
  }
];

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<'agent' | 'classic'>('classic');
  const [suggestedCampaignIds, setSuggestedCampaignIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'performance'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter States
  const [selectedPublisher, setSelectedPublisher] = useState<string>('Todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('Todos');
  const [selectedMediaType, setSelectedMediaType] = useState<string>('Todas');
  const [selectedObjective, setSelectedObjective] = useState<string>('Todos');
  const [selectedBidStrength, setSelectedBidStrength] = useState<string>('Todas');
  const [selectedSpendingPace, setSelectedSpendingPace] = useState<string>('Todos');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Initialize campaigns with calculated bidStrength, spendingPace and sem gasto em campanhas futuras
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    return INITIAL_CAMPAIGNS.map((campaign, index) => {
      const withStrength = {
        ...campaign,
        bidStrength: calculateOverallStrength(campaign.bids),
        spendingPace: campaign.spendingPace ?? (index % 2 === 0 ? 'Conforme a demanda' : 'Distribuído igualmente'),
      };
      return ensureNoSpendForFutureCampaigns(withStrength);
    });
  });

  const [zoomLevel, setZoomLevel] = useState(48);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [scrollToTodayTrigger, setScrollToTodayTrigger] = useState(0);
  const [scrollLeftTrigger, setScrollLeftTrigger] = useState(0);
  const [scrollRightTrigger, setScrollRightTrigger] = useState(0);

  // Bid Adjustment State
  const [bidEditingCampaign, setBidEditingCampaign] = useState<Campaign | null>(null);
  // Budget Report (opens from ListView budget cell)
  const [budgetReportCampaign, setBudgetReportCampaign] = useState<Campaign | null>(null);

  // List View Column State
  const [orderedListColumns, setOrderedListColumns] = useState<ColumnConfig[]>(COLUMNS);
  const [visibleListColumns, setVisibleListColumns] = useState<Set<SortKey>>(
    new Set(COLUMNS.map(c => c.id))
  );

  // Performance View Column State
  const [orderedPerfColumns, setOrderedPerfColumns] = useState<ColumnConfig[]>(PERFORMANCE_COLUMNS);
  const [visiblePerfColumns, setVisiblePerfColumns] = useState<Set<SortKey>>(
    new Set(PERFORMANCE_COLUMNS.map(c => c.id))
  );

  const publishers = useMemo(() => {
    const pubs = new Set(campaigns.map(c => c.publisher));
    return ['Todos', ...Array.from(pubs)];
  }, [campaigns]);

  const statuses = useMemo(() => ['Todos', ...Object.values(CampaignStatus)], []);
  const mediaTypes = useMemo(() => ['Todas', ...ALL_MEDIA_TYPES], []);
  const objectives = useMemo(() => ['Todos', 'Conversão', 'Consideração', 'Alcance'], []);
  const bidStrengths = useMemo(() => ['Todas', 'Forte', 'Intermediário', 'Fraco'], []);
  const spendingPaces = useMemo(() => ['Todos', 'Abaixo', 'No Ritmo', 'Acima'], []);

  /** Ritmo de gasto: label calculado (Abaixo / No Ritmo / Acima) para filtrar por pacing. */
  const getBudgetPacingLabel = (c: Campaign): 'Abaixo' | 'No Ritmo' | 'Acima' => {
    const now = Date.now();
    const start = c.startDate.getTime();
    const end = c.endDate.getTime();
    const total = Math.max(1, end - start);
    const elapsed = Math.min(total, Math.max(0, now - start));
    const fraction = elapsed / total;
    const expectedSpend = c.budget * fraction;
    if (expectedSpend <= 0) return 'No Ritmo';
    const ratio = c.spend / expectedSpend;
    if (ratio < 0.9) return 'Abaixo';
    if (ratio > 1.1) return 'Acima';
    return 'No Ritmo';
  };

  const hasActiveFilters = useMemo(() => {
    return selectedPublisher !== 'Todos' || selectedStatus !== 'Todos' || selectedMediaType !== 'Todas' || selectedObjective !== 'Todos' || selectedBidStrength !== 'Todas' || selectedSpendingPace !== 'Todos';
  }, [selectedPublisher, selectedStatus, selectedMediaType, selectedObjective, selectedBidStrength, selectedSpendingPace]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedPublisher !== 'Todos') count++;
    if (selectedStatus !== 'Todos') count++;
    if (selectedMediaType !== 'Todas') count++;
    if (selectedObjective !== 'Todos') count++;
    if (selectedBidStrength !== 'Todas') count++;
    if (selectedSpendingPace !== 'Todos') count++;
    return count;
  }, [selectedPublisher, selectedStatus, selectedMediaType, selectedObjective, selectedBidStrength, selectedSpendingPace]);

  const filteredCampaigns = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return campaigns.filter(c => {
      const matchesSearch = !q ||
        c.title.toLowerCase().includes(q) ||
        c.publisher.toLowerCase().includes(q) ||
        c.status.toLowerCase().includes(q) ||
        c.mediaTypes.some(mt => mt.toLowerCase().includes(q)) ||
        inferCampaignObjective(c).toLowerCase().includes(q) ||
        (c.bidStrength && c.bidStrength.toLowerCase().includes(q));
      const matchesPublisher = selectedPublisher === 'Todos' || c.publisher === selectedPublisher;
      const matchesStatus = selectedStatus === 'Todos' || c.status === selectedStatus;
      const matchesMedia = selectedMediaType === 'Todas' || c.mediaTypes.includes(selectedMediaType as MediaType);
      const matchesObjective =
        selectedObjective === 'Todos' || inferCampaignObjective(c) === selectedObjective;
      const matchesStrength = selectedBidStrength === 'Todas' || c.bidStrength === selectedBidStrength;
      const pacingLabel = getBudgetPacingLabel(c);
      const matchesPace = selectedSpendingPace === 'Todos' || pacingLabel === selectedSpendingPace;

      return matchesSearch && matchesPublisher && matchesStatus && matchesMedia && matchesObjective && matchesStrength && matchesPace;
    });
  }, [campaigns, searchTerm, selectedPublisher, selectedStatus, selectedMediaType, selectedObjective, selectedBidStrength, selectedSpendingPace]);

  const handleCampaignUpdate = (id: string, startDate: Date, endDate: Date) => {
    setCampaigns(prev => prev.map(c => {
      if (c.id !== id) return c;
      const updated = ensureNoSpendForFutureCampaigns({ ...c, startDate, endDate });
      return updated;
    }));
  };

  const handleCampaignStatusChange = (campaignId: string, newStatus: CampaignStatus) => {
    setCampaigns(prev => prev.map(c => 
      c.id === campaignId ? { ...c, status: newStatus } : c
    ));
  };

  const handleSaveCampaign = (updated: Campaign) => {
    const normalized = ensureNoSpendForFutureCampaigns(updated);
    const existing = campaigns.some(c => c.id === normalized.id);
    if (existing) {
      setCampaigns(prev => prev.map(c => c.id === normalized.id ? normalized : c));
    } else {
      setCampaigns(prev => [...prev, normalized]);
      if (appMode === 'agent') {
        setSuggestedCampaignIds(prev => [...prev, normalized.id]);
      }
    }
    setEditingCampaign(null);
  };

  const handleDocumentSave = (updated: Campaign) => {
    const normalized = ensureNoSpendForFutureCampaigns(updated);
    const exists = campaigns.some(c => c.id === normalized.id);

    if (exists) {
      setCampaigns(prev => prev.map(c => c.id === normalized.id ? normalized : c));
      return;
    }

    setCampaigns(prev => [...prev, normalized]);
    if (appMode === 'agent') {
      setSuggestedCampaignIds(prev => (prev.includes(normalized.id) ? prev : [...prev, normalized.id]));
    }
  };

  const handleSaveBids = (campaignId: string, newBids: Bid[]) => {
    // Recalculate strength based on new bids
    const newStrength = calculateOverallStrength(newBids);
    setCampaigns(prev => prev.map(c => 
      c.id === campaignId ? { ...c, bids: newBids, bidStrength: newStrength } : c
    ));
  };

  const handleNewCampaign = () => {
    const bids = generateMockBids(['Produto patrocinado']);
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultEnd.getDate() + 15);
    setEditingCampaign({
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      status: CampaignStatus.DRAFT,
      publisher: '',
      startDate: defaultStart,
      endDate: defaultEnd,
      budget: 0,
      spend: 0,
      mediaTypes: [], // Começa vazio
      products: [],
      bidStrength: calculateOverallStrength(bids),
      bids: bids,
      impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0,
      imageUrl: DEFAULT_APPLE_IMAGE
    });
  };

  const downloadCSV = () => {
    const headers = [
      'ID', 
      'Título', 
      'Status', 
      'Publisher', 
      'Início', 
      'Fim', 
      'Orçamento', 
      'Gasto', 
      'Mídias',
      'Força do Lance',
      'Impressões',
      'Clicks',
      'CTR (%)',
      'CPC (R$)',
      'CPM (R$)',
      'Pedidos',
      'Receita (R$)',
      'ROAS',
      'ACOS (%)',
      'CVR (%)',
      'AOV (R$)',
      'Pedidos NTB',
      'Vendas NTB (R$)',
      '% NTB',
      'Share de Impressão (%)'
    ];

    const rows = filteredCampaigns.map(c => {
      // Calculate derived metrics identical to PerformanceView
      const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
      const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
      const cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
      const roas = c.spend > 0 ? c.revenue / c.spend : 0;
      const acos = c.revenue > 0 ? (c.spend / c.revenue) * 100 : 0;
      const cvr = c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0;
      const aov = c.conversions > 0 ? c.revenue / c.conversions : 0;
      const ntbPercent = c.conversions > 0 ? (c.ntbConversions / c.conversions) * 100 : 0;

      return [
        c.id,
        `"${c.title.replace(/"/g, '""')}"`, // Escape quotes
        c.status,
        `"${c.publisher.replace(/"/g, '""')}"`,
        c.startDate.toLocaleDateString('pt-BR'),
        c.endDate.toLocaleDateString('pt-BR'),
        c.budget.toFixed(2).replace('.', ','),
        c.spend.toFixed(2).replace('.', ','),
        `"${c.mediaTypes.join(', ')}"`,
        c.bidStrength,
        c.impressions,
        c.clicks,
        ctr.toFixed(2).replace('.', ','),
        cpc.toFixed(2).replace('.', ','),
        cpm.toFixed(2).replace('.', ','),
        c.conversions,
        c.revenue.toFixed(2).replace('.', ','),
        roas.toFixed(2).replace('.', ','),
        acos.toFixed(2).replace('.', ','),
        cvr.toFixed(2).replace('.', ','),
        aov.toFixed(2).replace('.', ','),
        c.ntbConversions,
        c.ntbRevenue.toFixed(2).replace('.', ','),
        ntbPercent.toFixed(2).replace('.', ','),
        c.impressionShare.toFixed(1).replace('.', ',')
      ].join(';'); // Using semicolon for standard Excel CSV in many regions
    });

    // Add BOM for UTF-8 compatibility
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `performance_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Keyboard Shortcuts for N (New), F (Filter) and Shift + E (Export)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Prevent shortcut if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();

      // Shift + E -> Export CSV (Only in Performance Mode)
      if (e.shiftKey && key === 'e') {
        e.preventDefault();
        if (viewMode === 'performance') {
            downloadCSV();
        }
        return;
      }

      // N -> New Campaign
      if (key === 'n') {
        e.preventDefault();
        handleNewCampaign();
        return;
      }

      // F -> Filter
      if (key === 'f') {
        e.preventDefault();
        setIsFilterDrawerOpen(prev => !prev);
        return;
      }

      // View Modes
      // L -> List
      if (key === 'l') {
        e.preventDefault();
        setViewMode('list');
        return;
      }

      // T -> Timeline ou, se já na timeline, voltar para hoje
      if (key === 't') {
        e.preventDefault();
        if (viewMode === 'timeline') {
          setScrollToTodayTrigger((n) => n + 1);
        } else {
          setViewMode('timeline');
        }
        return;
      }

      // D -> Performance (Dashboard/Data)
      if (key === 'd') {
        e.preventDefault();
        setViewMode('performance');
        return;
      }

      if (key === 'a') {
        e.preventDefault();
        setAppMode('agent');
        return;
      }

      // Seta esquerda/direita -> navegar na timeline (mesmo que os botões de seta)
      if (viewMode === 'timeline') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setScrollLeftTrigger((n) => n + 1);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setScrollRightTrigger((n) => n + 1);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, filteredCampaigns]);

  const handleEmptySpaceClick = (date: Date) => {
    const bids = generateMockBids(['Produto patrocinado']);
    setEditingCampaign({
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      status: CampaignStatus.DRAFT,
      publisher: '',
      startDate: date,
      endDate: new Date(date.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days default (Ghost Card matches this)
      budget: 0,
      spend: 0,
      mediaTypes: [], // Começa vazio
      products: [],
      bidStrength: calculateOverallStrength(bids),
      bids: bids,
impressions: 0, clicks: 0, conversions: 0, revenue: 0,
    ntbConversions: 0, ntbRevenue: 0, units: 0, ntbUnits: 0, impressionShare: 0,
    imageUrl: DEFAULT_APPLE_IMAGE
  });
  };

  const handleDuplicateCampaign = (campaign: Campaign) => {
    const newCampaign = ensureNoSpendForFutureCampaigns({
      ...campaign,
      id: Math.random().toString(36).substr(2, 9),
      title: `${campaign.title} (Cópia)`,
      status: CampaignStatus.DRAFT
    });
    setCampaigns(prev => [...prev, newCampaign]);
  };

  const handleDeleteCampaign = (id: string) => {
    if (window.confirm('Tem certeza que deseja apagar esta campanha?')) {
      setCampaigns(prev => prev.filter(c => c.id !== id));
    }
  };

  const resetFilters = () => {
    setSelectedPublisher('Todos');
    setSelectedStatus('Todos');
    setSelectedMediaType('Todas');
    setSelectedObjective('Todos');
    setSelectedBidStrength('Todas');
    setSelectedSpendingPace('Todos');
  };

  const getColumnSelector = () => {
    if (viewMode === 'list') {
      return (
        <ColumnSelector 
          columns={orderedListColumns}
          visibleColumns={visibleListColumns} 
          onVisibilityChange={setVisibleListColumns}
          onReorder={setOrderedListColumns}
          onReset={() => {
            setOrderedListColumns(COLUMNS);
            setVisibleListColumns(new Set(COLUMNS.map(c => c.id)));
          }}
        />
      );
    } 
    if (viewMode === 'performance') {
      return (
        <ColumnSelector 
          columns={orderedPerfColumns}
          visibleColumns={visiblePerfColumns} 
          onVisibilityChange={setVisiblePerfColumns}
          onReorder={setOrderedPerfColumns}
          onReset={() => {
            setOrderedPerfColumns(PERFORMANCE_COLUMNS);
            setVisiblePerfColumns(new Set(PERFORMANCE_COLUMNS.map(c => c.id)));
          }}
        />
      );
    }
    return undefined;
  };

  const getExportButton = () => {
    if (viewMode === 'performance') {
      return (
        <Tooltip text="Exportar CSV (Shift + E)" position="bottom">
          <button
            onClick={downloadCSV}
            className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-gray-100 touch-manipulation"
          >
            <span className="material-symbols-outlined">download</span>
          </button>
        </Tooltip>
      );
    }
    return undefined;
  };

  const getFilterButton = () => (
    <Tooltip text={hasActiveFilters ? `${activeFiltersCount} filtros ativos` : "Filtrar (F)"} position="bottom">
      <button 
        onClick={() => setIsFilterDrawerOpen(true)}
        className={`relative min-w-[44px] min-h-[44px] w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 touch-manipulation ${
          hasActiveFilters ? 'bg-blue-50 text-[color:var(--sl-fg-base-soft)]' : 'text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-gray-100'
        }`}
      >
        <span className="material-symbols-outlined">filter_list</span>
        {hasActiveFilters && (
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500 border-2 border-white"></span>
          </span>
        )}
      </button>
    </Tooltip>
  );

  return (
    <div className="app-root relative h-screen bg-white text-[color:var(--sl-fg-base)] safe-top safe-bottom overflow-hidden">
      <div
        className={`absolute inset-0 flex flex-col transition-all duration-500 ease-in-out ${
          appMode === 'agent'
            ? 'opacity-100 translate-y-0 z-10'
            : 'opacity-0 translate-y-[3%] z-0 pointer-events-none'
        }`}
      >
        <AgentLayout
          campaigns={campaigns}
          suggestedCampaignIds={suggestedCampaignIds}
          onSuggestedIdsChange={setSuggestedCampaignIds}
          onCampaignUpdate={handleCampaignUpdate}
          onCampaignClick={setEditingCampaign}
          onEmptySpaceClick={handleEmptySpaceClick}
          editingCampaign={editingCampaign}
          onEditingCampaignClose={() => setEditingCampaign(null)}
          onSaveCampaign={handleDocumentSave}
          allProducts={ALL_PRODUCTS}
          conversationTitle="Nova conversa"
          onOpenClassicView={() => setAppMode('classic')}
        />
      </div>

      <div
        className={`absolute inset-0 flex flex-col transition-all duration-500 ease-in-out ${
          appMode === 'classic'
            ? 'opacity-100 translate-y-0 z-10'
            : 'opacity-0 -translate-y-[3%] z-0 pointer-events-none'
        }`}
      >
        <GlobalTopbar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          accountName="Apple Brasil"
          rightSlot={
            <Tooltip text="Abrir Agente (A)" position="bottom">
              <button
                type="button"
                onClick={() => setAppMode('agent')}
                className="min-w-[44px] min-h-[44px] w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-[color:var(--sl-fg-base-soft)] hover:text-[color:var(--sl-fg-base)] hover:bg-gray-100 transition-all touch-manipulation"
              >
                <span className="material-symbols-outlined">smart_toy</span>
              </button>
            </Tooltip>
          }
        />
        <div className="flex-1 flex flex-col min-h-0 bg-[#e0e0e0]">
          <ClassicToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            resultCount={filteredCampaigns.length}
            totalCount={campaigns.length}
            onNewCampaign={handleNewCampaign}
            columnSelector={getColumnSelector()}
            filterButton={getFilterButton()}
            exportButton={getExportButton()}
          />
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {viewMode === 'timeline' ? (
            <Timeline
              campaigns={filteredCampaigns}
              onCampaignUpdate={handleCampaignUpdate}
              onCampaignClick={setEditingCampaign}
              onEmptySpaceClick={handleEmptySpaceClick}
              columnWidth={zoomLevel}
              onZoomChange={setZoomLevel}
              scrollToTodayTrigger={scrollToTodayTrigger}
              scrollLeftTrigger={scrollLeftTrigger}
              scrollRightTrigger={scrollRightTrigger}
            />
          ) : viewMode === 'list' ? (
            <ListView
              campaigns={filteredCampaigns}
              columns={orderedListColumns}
              visibleColumns={visibleListColumns}
              onCampaignClick={setEditingCampaign}
              onDuplicateCampaign={handleDuplicateCampaign}
              onDeleteCampaign={handleDeleteCampaign}
              onBidClick={setBidEditingCampaign}
              onCampaignStatusChange={handleCampaignStatusChange}
              onBudgetReportClick={setBudgetReportCampaign}
            />
          ) : (
            <PerformanceView
              campaigns={filteredCampaigns}
              columns={orderedPerfColumns}
              visibleColumns={visiblePerfColumns}
              onCampaignClick={setEditingCampaign}
              onCampaignStatusChange={handleCampaignStatusChange}
            />
          )}
          </div>
        </div>
        <FilterDrawer
          isOpen={isFilterDrawerOpen}
          onClose={() => setIsFilterDrawerOpen(false)}
          publishers={publishers}
          selectedPublisher={selectedPublisher}
          onPublisherChange={setSelectedPublisher}
          statuses={statuses}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          mediaTypes={mediaTypes}
          selectedMediaType={selectedMediaType}
          onMediaTypeChange={setSelectedMediaType}
          objectives={objectives}
          selectedObjective={selectedObjective}
          onObjectiveChange={setSelectedObjective}
          bidStrengths={bidStrengths}
          selectedBidStrength={selectedBidStrength}
          onBidStrengthChange={setSelectedBidStrength}
          spendingPaces={spendingPaces}
          selectedSpendingPace={selectedSpendingPace}
          onSpendingPaceChange={setSelectedSpendingPace}
          onReset={resetFilters}
        />
        {editingCampaign && appMode === 'classic' && (
          <FormErrorBoundary onClose={() => setEditingCampaign(null)}>
            <CampaignForm
              key={editingCampaign.id}
              campaign={editingCampaign}
              allCampaigns={campaigns}
              onClose={() => setEditingCampaign(null)}
              onSave={handleSaveCampaign}
            />
          </FormErrorBoundary>
        )}
        {bidEditingCampaign && (
          <BidAdjustmentModal
            campaign={bidEditingCampaign}
            onClose={() => setBidEditingCampaign(null)}
            onSave={handleSaveBids}
          />
        )}
        {budgetReportCampaign && (
          <BudgetReportModal
            campaign={budgetReportCampaign}
            onClose={() => setBudgetReportCampaign(null)}
            onOpenCampaign={(c) => {
              setBudgetReportCampaign(null);
              setEditingCampaign(c);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default App;
