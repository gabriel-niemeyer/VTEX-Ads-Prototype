import { ColumnConfig, MediaType, Bid, BidStrength } from './types';

/** Avatar do utilizador logado (asset em `public/user-avatar.png`). */
export const CURRENT_USER_AVATAR_SRC = '/user-avatar.png';

export const DAY_COLUMN_WIDTH = 48; // px
export const ROW_HEIGHT = 80; // px
export const TIMELINE_START_DATE = new Date(2026, 0, 1); // Jan 1st, 2026
export const TOTAL_DAYS = 365; // Full year

/** Primeiro dia das campanhas sugeridas — a timeline abre com este dia visível (scroll inicial). */
export const TIMELINE_INITIAL_SCROLL_DATE = new Date(TIMELINE_START_DATE.getFullYear(), 3, 15);

/** Espera o fim da animação de largura do canvas no agente antes de reforçar o scroll (ms). */
export const TIMELINE_SCROLL_AFTER_CANVAS_REVEAL_MS = 1100;

export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const ALL_MEDIA_TYPES: MediaType[] = [
  'Produto patrocinado',
  'Banner patrocinado',
  'Marca patrocinada',
  'Video',
  'Banner Patrocinado Offsite',
  'Instore display'
];

export const getIndividualBidStrength = (current: number, suggested: number): BidStrength => {
  if (suggested === 0) return 'Forte';
  const ratio = current / suggested;
  if (ratio >= 0.95) return 'Forte';
  if (ratio >= 0.7) return 'Intermediário';
  return 'Fraco';
};

export const calculateOverallStrength = (bids: Bid[]): BidStrength => {
  if (!bids || bids.length === 0) return 'Fraco'; // Default safe
  
  let scoreSum = 0;
  bids.forEach(b => {
    const strength = getIndividualBidStrength(b.currentBid, b.suggestedBid);
    if (strength === 'Forte') scoreSum += 3;
    else if (strength === 'Intermediário') scoreSum += 2;
    else scoreSum += 1;
  });
  
  const average = scoreSum / bids.length;
  if (average >= 2.6) return 'Forte';
  if (average >= 1.6) return 'Intermediário';
  return 'Fraco';
};
export const COLUMNS: ColumnConfig[] = [
  { id: 'title', label: 'Campanha', defaultWidth: 'w-[320px]', locked: true },
  { id: 'publisher', label: 'Publisher', defaultWidth: 'w-[180px]' },
  { id: 'mediaTypes', label: 'Mídias', defaultWidth: 'w-[180px]' },
  { id: 'bidStrength', label: 'Força do Lance', defaultWidth: 'w-[150px]' },
  { id: 'budget', label: 'Total Gasto', defaultWidth: 'w-[180px]' },
  { id: 'status', label: 'Status', defaultWidth: 'w-[120px]' },
  { id: 'startDate', label: 'Período', defaultWidth: 'w-[200px]' },
  { id: 'duration', label: 'Duração', defaultWidth: 'w-[100px]', align: 'right' },
];

export const PERFORMANCE_COLUMNS: ColumnConfig[] = [
  { id: 'title', label: 'Campanha', defaultWidth: 'w-[300px]', locked: true },
  { id: 'status', label: 'Status', defaultWidth: 'w-[100px]' },
  { id: 'mediaTypes', label: 'Mídias', defaultWidth: 'w-[140px]' },
  
  // Tráfego
  { 
    id: 'impressions', 
    label: 'Impressões', 
    defaultWidth: 'w-[120px]', 
    align: 'right',
    description: 'Quantidade total de vezes que o anúncio foi exibido.'
  },
  { 
    id: 'impressionShare', 
    label: 'Impression Share', 
    defaultWidth: 'w-[120px]', 
    align: 'right',
    description: 'Porcentagem de impressões ganhas em relação ao total disponível no mercado.'
  },
  { 
    id: 'clicks', 
    label: 'Clicks', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Número total de cliques recebidos no anúncio.'
  },
  { 
    id: 'ctr', 
    label: 'CTR', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Click-Through Rate: A porcentagem de impressões que resultaram em um clique.'
  },
  
  // Eficiência de Custo
  { 
    id: 'cpc', 
    label: 'CPC', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Custo Por Clique: O valor médio pago por cada clique no anúncio.'
  },
  { 
    id: 'cpm', 
    label: 'CPM', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Custo Por Mil: O custo médio para cada 1.000 impressões do anúncio.'
  },
  
  // Conversão e Vendas
  { 
    id: 'conversions', 
    label: 'Pedidos', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Número total de pedidos ou conversões atribuídas à campanha.'
  },
  { 
    id: 'cvr', 
    label: 'CVR (Taxa)', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Taxa de Conversão: A porcentagem de cliques que resultaram em um pedido.'
  },
  { 
    id: 'revenue', 
    label: 'Receita (GMV)', 
    defaultWidth: 'w-[140px]', 
    align: 'right',
    description: 'Gross Merchandise Value: Receita total de vendas gerada pelos anúncios.'
  },
  { 
    id: 'aov', 
    label: 'AOV (Ticket)', 
    defaultWidth: 'w-[120px]', 
    align: 'right',
    description: 'Average Order Value: O valor médio gasto por pedido.'
  },
  
  // Retorno
  { 
    id: 'roas', 
    label: 'ROAS', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Return on Ad Spend: Receita gerada para cada R$1,00 gasto em publicidade.'
  },
  { 
    id: 'acos', 
    label: 'ACOS', 
    defaultWidth: 'w-[100px]', 
    align: 'right',
    description: 'Advertising Cost of Sales: A porcentagem da receita gasta em publicidade (inverso do ROAS).'
  },
  
  // New To Brand (NTB)
  { 
    id: 'ntbConversions', 
    label: 'Pedidos NTB', 
    defaultWidth: 'w-[120px]', 
    align: 'right',
    description: 'Número de pedidos atribuídos a clientes New-to-Brand (NTB), ou seja, que não compraram da marca nos últimos 12 meses. Indica aquisição de novos clientes.'
  },
  { 
    id: 'ntbPercent', 
    label: '% Pedidos NTB', 
    defaultWidth: 'w-[120px]', 
    align: 'right',
    description: 'Porcentagem do total de pedidos da campanha que vieram de clientes New-to-Brand. Mostra o peso da aquisição em relação às vendas totais.'
  },
  { 
    id: 'ntbRevenue', 
    label: 'Vendas NTB', 
    defaultWidth: 'w-[140px]', 
    align: 'right',
    description: 'Receita (GMV) gerada exclusivamente por clientes New-to-Brand. Reflete o valor em R$ das vendas vindas de novos clientes.'
  },
  { 
    id: 'ntbRevenuePercent', 
    label: '% Vendas NTB', 
    defaultWidth: 'w-[120px]', 
    align: 'right',
    description: 'Porcentagem da receita total da campanha originada de clientes New-to-Brand. Ajuda a avaliar a dependência da campanha de aquisição versus remarketing.'
  },
  { 
    id: 'ntbUnits', 
    label: 'Unid. vendidas NTB', 
    defaultWidth: 'w-[140px]', 
    align: 'right',
    description: 'Quantidade de unidades (itens) vendidas a clientes New-to-Brand. Diferente de pedidos: um pedido pode conter várias unidades.'
  },
  { 
    id: 'ntbUnitsPercent', 
    label: '% Unid. vendidas NTB', 
    defaultWidth: 'w-[140px]', 
    align: 'right',
    description: 'Porcentagem do total de unidades vendidas que foram para clientes New-to-Brand. Útil para categorias com múltiplos itens por pedido.'
  },
];

