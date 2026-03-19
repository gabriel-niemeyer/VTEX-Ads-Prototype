
export enum CampaignStatus {
  DRAFT = 'Rascunho',
  ACTIVE = 'Ativo',
  COMPLETED = 'Concluído'
}

export type MediaType = 
  | 'Produto patrocinado' 
  | 'Banner patrocinado' 
  | 'Marca patrocinada' 
  | 'Video' 
  | 'Banner Patrocinado Offsite'
  | 'Instore display';

export type BidStrength = 'Forte' | 'Intermediário' | 'Fraco';

export type SpendingPace = 'Conforme a demanda' | 'Distribuído igualmente';

export interface Product {
  id: string;
  name: string;
  imageUrl: string;
  price?: number;
}

export interface Bid {
  mediaType: MediaType;
  currentBid: number;
  suggestedBid: number;
}

export interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  publisher: string;
  startDate: Date;
  endDate: Date;
  imageUrl: string;
  budget: number;
  spend: number;
  mediaTypes: MediaType[];
  products: Product[];
  bidStrength: BidStrength;
  spendingPace?: SpendingPace;
  bids: Bid[]; // New field for detailed bids
  // Performance Metrics
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  // Retail Media Advanced Metrics
  ntbConversions: number; // New To Brand Orders
  ntbRevenue: number;     // New To Brand Sales
  units: number;          // Total units sold (quantity)
  ntbUnits: number;       // Units sold to New-To-Brand customers
  impressionShare: number; // 0-100 percentage
}

export interface TimelineDay {
  date: Date;
  dayNumber: string;
  isFirstOfMonth: boolean;
  monthName: string;
  year: number;
}

export type SortKey = 
  | 'title' 
  | 'publisher' 
  | 'status' 
  | 'mediaTypes'
  | 'startDate' 
  | 'duration' 
  | 'budget' 
  | 'bidStrength'
  | 'impressions' 
  | 'clicks' 
  | 'ctr' 
  | 'cpc' 
  | 'cpm'
  | 'cvr'
  | 'aov'
  | 'acos'
  | 'conversions' 
  | 'revenue' 
  | 'roas'
  | 'ntbConversions'
  | 'ntbRevenue'
  | 'ntbPercent'
  | 'ntbRevenuePercent'
  | 'ntbUnits'
  | 'ntbUnitsPercent'
  | 'impressionShare';

export interface ColumnConfig {
  id: SortKey;
  label: string;
  defaultWidth: string;
  align?: 'left' | 'right';
  locked?: boolean;
  description?: string;
}
