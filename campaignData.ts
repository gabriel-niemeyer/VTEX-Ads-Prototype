import { Campaign, CampaignStatus, MediaType, Product, Bid } from './types';
import { NESTLE_PRODUCTS } from './data/nestleProducts';

export const ALL_PRODUCTS: Product[] = NESTLE_PRODUCTS;
export const DEFAULT_NESTLE_IMAGE = ALL_PRODUCTS[0]?.imageUrl ?? '';

export const generateMockBids = (mediaTypes: MediaType[]): Bid[] => {
  return mediaTypes.map((type) => {
    const suggested = Number((Math.random() * 3 + 1).toFixed(2));
    const match = Math.random() > 0.42;
    const current = match
      ? suggested * (0.94 + Math.random() * 0.12)
      : suggested * (0.45 + Math.random() * 0.45);

    return {
      mediaType: type,
      currentBid: Number(current.toFixed(2)),
      suggestedBid: suggested,
    };
  });
};

function todayMidnight(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export function ensureNoSpendForFutureCampaigns(c: Campaign): Campaign {
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

const CURRENT_YEAR = 2026;

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const uniqueProducts = (products: Product[]) =>
  Array.from(new Map(products.map((product) => [product.id, product])).values());

const filterProducts = (keywords: string[]) => {
  const normalizedKeywords = keywords.map(normalizeText);
  return ALL_PRODUCTS.filter((product) => {
    const normalizedName = normalizeText(product.name);
    return normalizedKeywords.some((keyword) => normalizedName.includes(keyword));
  });
};

const cycleProducts = (products: Product[], count: number, seed: number) => {
  if (products.length === 0) return ALL_PRODUCTS.slice(0, count);
  if (products.length <= count) return products;

  const result: Product[] = [];
  const start = seed % products.length;

  for (let index = 0; index < count; index += 1) {
    result.push(products[(start + index) % products.length]);
  }

  return result;
};

const mergeCollections = (...collections: Product[][]) => uniqueProducts(collections.flat());

const BASE_COLLECTIONS = {
  pascoa: filterProducts(['páscoa', 'pascoa', 'ovo', 'alpino', 'kitkat', 'talento', 'garoto', 'caribe']),
  chocolates: filterProducts([
    'chocolate',
    'bombom',
    'kitkat',
    'kit kat',
    'prestigio',
    'alpino',
    'galak',
    'garoto',
    'talento',
    'caribe',
    'sensacao',
    'crunch',
    'chokito',
  ]),
  biscoitos: filterProducts(['biscoito', 'cookie', 'wafer', 'chocobiscuit', 'chococookies', 'nesfit', 'surpresa']),
  breakfast: filterProducts(['cereal', 'snow flakes', 'aveia', 'farinha lactea', 'neston']),
  beverages: filterProducts(['nescafe', 'cafe', 'cappuccino', 'capsula', 'achocolatado', 'bebida', 'mochaccino']),
  dairy: filterProducts(['iogurte', 'chandelle', 'chambinho', 'petit suisse', 'sobremesa']),
  culinary: filterProducts(['creme de leite', 'leite condensado', 'moca']),
  infant: filterProducts(['formula infantil', 'nan', 'nestogeno', 'neslac', 'papinha']),
  nutricao: filterProducts(['nutren', 'proteinada', 'molico']),
  sorvetes: filterProducts(['sorvete']),
};

const PRODUCT_COLLECTIONS = {
  ...BASE_COLLECTIONS,
  rotina: mergeCollections(BASE_COLLECTIONS.breakfast, BASE_COLLECTIONS.beverages, BASE_COLLECTIONS.dairy, BASE_COLLECTIONS.culinary),
  lancheira: mergeCollections(BASE_COLLECTIONS.breakfast, BASE_COLLECTIONS.biscoitos, BASE_COLLECTIONS.beverages),
  sobremesas: mergeCollections(BASE_COLLECTIONS.culinary, BASE_COLLECTIONS.dairy, BASE_COLLECTIONS.chocolates),
};

type CollectionKey = keyof typeof PRODUCT_COLLECTIONS;

const COLLECTION_PROFILES: Record<
  CollectionKey,
  {
    ctr: number;
    cvr: number;
    orderValue: number;
    ntbShare: number;
    unitsPerOrder: number;
    baseImpressionShare: number;
    impressionsPerReal: number;
  }
> = {
  pascoa: { ctr: 0.018, cvr: 0.039, orderValue: 42, ntbShare: 0.33, unitsPerOrder: 1.9, baseImpressionShare: 72, impressionsPerReal: 25 },
  chocolates: { ctr: 0.017, cvr: 0.034, orderValue: 28, ntbShare: 0.29, unitsPerOrder: 2.3, baseImpressionShare: 68, impressionsPerReal: 26 },
  biscoitos: { ctr: 0.016, cvr: 0.031, orderValue: 18, ntbShare: 0.26, unitsPerOrder: 2.2, baseImpressionShare: 62, impressionsPerReal: 27 },
  breakfast: { ctr: 0.015, cvr: 0.028, orderValue: 24, ntbShare: 0.24, unitsPerOrder: 2.0, baseImpressionShare: 60, impressionsPerReal: 24 },
  beverages: { ctr: 0.015, cvr: 0.026, orderValue: 34, ntbShare: 0.27, unitsPerOrder: 1.7, baseImpressionShare: 58, impressionsPerReal: 23 },
  dairy: { ctr: 0.016, cvr: 0.032, orderValue: 21, ntbShare: 0.23, unitsPerOrder: 2.1, baseImpressionShare: 61, impressionsPerReal: 25 },
  culinary: { ctr: 0.014, cvr: 0.029, orderValue: 30, ntbShare: 0.21, unitsPerOrder: 2.4, baseImpressionShare: 57, impressionsPerReal: 22 },
  infant: { ctr: 0.012, cvr: 0.021, orderValue: 86, ntbShare: 0.18, unitsPerOrder: 1.3, baseImpressionShare: 54, impressionsPerReal: 19 },
  nutricao: { ctr: 0.013, cvr: 0.024, orderValue: 68, ntbShare: 0.2, unitsPerOrder: 1.4, baseImpressionShare: 56, impressionsPerReal: 20 },
  sorvetes: { ctr: 0.017, cvr: 0.035, orderValue: 26, ntbShare: 0.31, unitsPerOrder: 2.0, baseImpressionShare: 63, impressionsPerReal: 24 },
  rotina: { ctr: 0.014, cvr: 0.027, orderValue: 32, ntbShare: 0.22, unitsPerOrder: 1.9, baseImpressionShare: 59, impressionsPerReal: 23 },
  lancheira: { ctr: 0.016, cvr: 0.033, orderValue: 22, ntbShare: 0.28, unitsPerOrder: 2.1, baseImpressionShare: 64, impressionsPerReal: 26 },
  sobremesas: { ctr: 0.015, cvr: 0.03, orderValue: 29, ntbShare: 0.25, unitsPerOrder: 2.0, baseImpressionShare: 60, impressionsPerReal: 24 },
};

type CampaignSpec = {
  month: number;
  startDay: number;
  duration: number;
  title: string;
  collection: CollectionKey;
  publisher: string;
  budget: number;
  mediaTypes: MediaType[];
  productCount?: number;
  status?: CampaignStatus;
};

const spec = (
  month: number,
  startDay: number,
  duration: number,
  title: string,
  collection: CollectionKey,
  publisher: string,
  budget: number,
  mediaTypes: MediaType[],
  productCount = 6,
  status?: CampaignStatus
): CampaignSpec => ({
  month,
  startDay,
  duration,
  title,
  collection,
  publisher,
  budget,
  mediaTypes,
  productCount,
  status,
});

/** Todas as campanhas começam em 15/04 ou depois; títulos alinhados ao calendário comercial BR (2026). */
const CAMPAIGN_SPECS: CampaignSpec[] = [
  // Abril — pós-Páscoa (05/04), esquenta Dia das Mães (10/05)
  spec(3, 15, 12, 'Pós-Páscoa: recompra de chocolates e bombons', 'chocolates', 'Carrefour', 32000, ['Produto patrocinado', 'Banner patrocinado'], 7),
  spec(3, 18, 11, 'Esquenta Dia das Mães: café da manhã com Nescafé e cereais', 'breakfast', 'Extra', 30000, ['Produto patrocinado', 'Marca patrocinada'], 6),
  spec(3, 22, 10, 'Presentes doces: KitKat, Alpino e Talento para surpreender', 'chocolates', 'Mercado Livre', 28000, ['Banner patrocinado', 'Video'], 7),
  spec(3, 26, 9, 'Receitas com Moça e Leite Moça para o Dia das Mães', 'culinary', 'Pão de Açúcar', 26000, ['Produto patrocinado', 'Video'], 5),

  // Maio — Dia do Trabalho (01/05), Dia das Mães (10/05)
  spec(4, 1, 10, 'Dia do Trabalho: pausa para café com Nescafé e cappuccino', 'beverages', 'Carrefour', 24000, ['Produto patrocinado', 'Marca patrocinada', 'Instore display'], 6),
  spec(4, 4, 8, 'Semana do Dia das Mães: iogurtes, Chandelle e sobremesas', 'dairy', 'Extra', 35000, ['Produto patrocinado', 'Banner patrocinado'], 6),
  spec(4, 8, 7, 'Dia das Mães: mix café da manhã e chocolates premium', 'rotina', 'Amazon Brasil', 42000, ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada'], 8),
  spec(4, 12, 10, 'Pós-Dia das Mães: biscoitos e achocolatado para a família', 'lancheira', 'Rappi', 27000, ['Produto patrocinado', 'Banner patrocinado'], 7),
  spec(4, 18, 11, 'Maio em família: fórmulas infantis e compostos lácteos', 'infant', 'Magalu', 33000, ['Produto patrocinado', 'Marca patrocinada'], 5),
  spec(4, 25, 10, 'Nutrição no outono: Nutren, aveia Neston e rotina', 'nutricao', 'Pão de Açúcar', 29000, ['Produto patrocinado', 'Video'], 6),

  // Junho — Festa Junina e Dia dos Namorados (12/06)
  spec(5, 2, 14, 'Esquenta Festa Junina: achocolatado, biscoitos e pipoca', 'lancheira', 'Carrefour', 31000, ['Produto patrocinado', 'Banner patrocinado', 'Instore display'], 7),
  spec(5, 8, 12, 'Festa Junina: chocolates quentes e wafer para a quadrilha', 'chocolates', 'Extra', 28000, ['Banner patrocinado', 'Video'], 6),
  spec(5, 12, 9, 'Dia dos Namorados: presentes com Talento, Garoto e bombons', 'chocolates', 'Mercado Livre', 38000, ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada'], 8),
  spec(5, 16, 11, 'Inverno: Nescafé Dolce Gusto e bebidas quentes', 'beverages', 'Amazon Brasil', 26000, ['Produto patrocinado', 'Marca patrocinada'], 5),
  spec(5, 22, 10, 'Sobremesas de festa: Moça, creme de leite e leite condensado', 'sobremesas', 'Rappi', 25000, ['Produto patrocinado', 'Banner patrocinado'], 6),

  // Julho — férias escolares (inverno no BR)
  spec(6, 1, 14, 'Férias de julho: sorvetes Nestlé e momentos gelados', 'sorvetes', 'Carrefour', 27000, ['Banner patrocinado', 'Video'], 6),
  spec(6, 8, 12, 'Lanche de férias: cookies, Nesfit e Nescau', 'biscoitos', 'Extra', 26000, ['Produto patrocinado', 'Banner patrocinado'], 7),
  spec(6, 14, 11, 'Café da tarde em casa: Nescafé e Chocobiscuit', 'beverages', 'Pão de Açúcar', 22000, ['Produto patrocinado', 'Marca patrocinada'], 5),
  spec(6, 20, 12, 'Meio do ano: linha infantil Nan, Neslac e rotina', 'infant', 'Amazon Brasil', 32000, ['Produto patrocinado', 'Banner patrocinado'], 5),

  // Agosto — Dia dos Pais (09/08/2026)
  spec(7, 1, 12, 'Pré-Dia dos Pais: cafés especiais e cappuccinos', 'beverages', 'Carrefour', 26000, ['Produto patrocinado', 'Marca patrocinada', 'Instore display'], 5),
  spec(7, 7, 8, 'Dia dos Pais: chocolates premium e kits para presentear', 'chocolates', 'Mercado Livre', 36000, ['Produto patrocinado', 'Banner patrocinado', 'Video'], 7),
  spec(7, 12, 10, 'Pós-Dia dos Pais: cereais e café da manhã completo', 'breakfast', 'Extra', 23000, ['Produto patrocinado', 'Banner patrocinado'], 6),
  spec(7, 18, 11, 'Agosto saudável: Nutren, aveia e rotina 50+', 'nutricao', 'Rappi', 28000, ['Produto patrocinado', 'Video'], 5),
  spec(7, 25, 10, 'Despensa Nestlé: Moça, creme de leite e mercearia', 'culinary', 'Pão de Açúcar', 27000, ['Produto patrocinado', 'Banner patrocinado'], 5),

  // Setembro — primavera, volta às aulas (2º semestre)
  spec(8, 2, 13, 'Primavera: lanches leves, cereais e iogurtes', 'breakfast', 'Carrefour', 24000, ['Produto patrocinado', 'Banner patrocinado'], 6, CampaignStatus.DRAFT),
  spec(8, 9, 12, 'Volta às aulas 2º semestre: lancheira com Nescau e biscoitos', 'lancheira', 'Extra', 29000, ['Produto patrocinado', 'Banner patrocinado'], 7, CampaignStatus.DRAFT),
  spec(8, 16, 11, 'Momento doce: chocolates para compartilhar na escola', 'chocolates', 'Mercado Livre', 25000, ['Banner patrocinado', 'Video'], 6, CampaignStatus.DRAFT),
  spec(8, 23, 10, 'Iogurtes e sobremesas para a rotina de setembro', 'dairy', 'Amazon Brasil', 22000, ['Produto patrocinado', 'Marca patrocinada'], 6, CampaignStatus.DRAFT),

  // Outubro — Dia das Crianças (12/10)
  spec(9, 1, 11, 'Esquenta Dia das Crianças: Chambinho, Chamyto e doces', 'dairy', 'Carrefour', 30000, ['Produto patrocinado', 'Banner patrocinado'], 7),
  spec(9, 8, 8, 'Dia das Crianças: biscoitos, cereais e surpresa Nestlé', 'lancheira', 'Extra', 36000, ['Produto patrocinado', 'Banner patrocinado', 'Instore display'], 7),
  spec(9, 12, 10, 'Outubro: sorvetes e sobremesas para a família', 'sorvetes', 'Rappi', 24000, ['Banner patrocinado', 'Video'], 6),
  spec(9, 18, 11, 'Nutrição infantil: fórmulas e papinhas Nestlé', 'infant', 'Magalu', 31000, ['Produto patrocinado', 'Marca patrocinada'], 5),
  spec(9, 25, 10, 'Esquenta Black Friday: mix despensa Nestlé', 'rotina', 'Pão de Açúcar', 38000, ['Produto patrocinado', 'Marca patrocinada'], 8),

  // Novembro — Black Friday (27/11/2026)
  spec(10, 1, 14, 'Novembro: chocolates e wafer em destaque', 'chocolates', 'Carrefour', 40000, ['Produto patrocinado', 'Banner patrocinado', 'Video'], 7, CampaignStatus.DRAFT),
  spec(10, 10, 12, 'Esquenta Black Friday: multipacks mercearia Moça e Leite Moça', 'culinary', 'Extra', 42000, ['Produto patrocinado', 'Banner patrocinado'], 6, CampaignStatus.DRAFT),
  spec(10, 18, 11, 'Black Friday: Nescafé, Nescau e bebidas', 'beverages', 'Amazon Brasil', 35000, ['Marca patrocinada', 'Video', 'Produto patrocinado'], 6, CampaignStatus.DRAFT),
  spec(10, 24, 10, 'Black Friday Nestlé: full mix patrocinado', 'rotina', 'Mercado Livre', 52000, ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada'], 8, CampaignStatus.DRAFT),

  // Dezembro — Natal e virada
  spec(11, 1, 16, 'Natal: chocolates Talento, KitKat e presentes', 'chocolates', 'Carrefour', 48000, ['Produto patrocinado', 'Banner patrocinado', 'Marca patrocinada'], 8, CampaignStatus.DRAFT),
  spec(11, 8, 14, 'Ceia de Natal: Moça, creme de leite e sobremesas', 'sobremesas', 'Extra', 40000, ['Produto patrocinado', 'Banner patrocinado', 'Video'], 7, CampaignStatus.DRAFT),
  spec(11, 15, 12, 'Natal: café da manhã com família e cereais Nestlé', 'breakfast', 'Pão de Açúcar', 32000, ['Produto patrocinado', 'Marca patrocinada'], 6, CampaignStatus.DRAFT),
  spec(11, 22, 10, 'Última semana de Natal: sorvetes e sobremesas geladas', 'sorvetes', 'Rappi', 26000, ['Banner patrocinado', 'Video'], 6, CampaignStatus.DRAFT),
  spec(11, 28, 9, 'Réveillon abastecido: mix Nestlé para começar o ano', 'rotina', 'Carrefour', 30000, ['Produto patrocinado', 'Banner patrocinado'], 7, CampaignStatus.DRAFT),
];

const inferStatus = (startDate: Date, endDate: Date, index: number) => {
  const today = todayMidnight();

  if (endDate < today) return CampaignStatus.COMPLETED;
  if (startDate > today) return index % 4 === 0 ? CampaignStatus.DRAFT : CampaignStatus.ACTIVE;
  return CampaignStatus.ACTIVE;
};

const calculateSpend = (status: CampaignStatus, budget: number, seed: number) => {
  if (status === CampaignStatus.DRAFT) return 0;
  if (status === CampaignStatus.COMPLETED) {
    return Math.round(budget * (0.9 + ((seed % 5) * 0.02)));
  }
  return Math.round(budget * (0.28 + ((seed % 6) * 0.07)));
};

const buildMetrics = (collection: CollectionKey, spend: number, mediaTypes: MediaType[], seed: number) => {
  if (spend <= 0) {
    return {
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

  const profile = COLLECTION_PROFILES[collection];
  const mediaFactor = 0.92 + mediaTypes.length * 0.16;
  const seedBump = 0.94 + ((seed % 5) * 0.04);
  const ctr = profile.ctr + ((seed % 4) * 0.0012);
  const cvr = profile.cvr + ((seed % 3) * 0.0011);
  const ntbShare = profile.ntbShare + ((seed % 3) * 0.012);
  const unitsPerOrder = profile.unitsPerOrder + ((seed % 4) * 0.08);
  const orderValue = profile.orderValue + ((seed % 5) * 1.7);

  const impressions = Math.round(spend * profile.impressionsPerReal * mediaFactor * seedBump);
  const clicks = Math.round(impressions * ctr);
  const conversions = Math.max(1, Math.round(clicks * cvr));
  const units = Math.max(conversions, Math.round(conversions * unitsPerOrder));
  const revenue = Math.round(conversions * orderValue);
  const ntbConversions = Math.round(conversions * ntbShare);
  const ntbRevenue = Math.round(revenue * ntbShare);
  const ntbUnits = Math.round(units * ntbShare);
  const impressionShare = Number((profile.baseImpressionShare + ((seed % 7) * 1.4)).toFixed(1));

  return {
    impressions,
    clicks,
    conversions,
    revenue,
    ntbConversions,
    ntbRevenue,
    units,
    ntbUnits,
    impressionShare,
  };
};

const buildCampaign = (campaignSpec: CampaignSpec, index: number): Campaign => {
  const startDate = new Date(CURRENT_YEAR, campaignSpec.month, campaignSpec.startDay);
  const endDate = new Date(CURRENT_YEAR, campaignSpec.month, campaignSpec.startDay + campaignSpec.duration - 1);
  const status = campaignSpec.status ?? inferStatus(startDate, endDate, index);
  const collectionProducts = PRODUCT_COLLECTIONS[campaignSpec.collection];
  const products = cycleProducts(collectionProducts, campaignSpec.productCount ?? 6, index * 3 + campaignSpec.month);
  const spend = calculateSpend(status, campaignSpec.budget, index);
  const metrics = buildMetrics(campaignSpec.collection, spend, campaignSpec.mediaTypes, index);

  return {
    id: String(index + 1),
    title: campaignSpec.title,
    status,
    publisher: campaignSpec.publisher,
    startDate,
    endDate,
    imageUrl: products[0]?.imageUrl ?? DEFAULT_NESTLE_IMAGE,
    budget: campaignSpec.budget,
    spend,
    mediaTypes: campaignSpec.mediaTypes,
    products,
    bidStrength: 'Intermediário',
    bids: generateMockBids(campaignSpec.mediaTypes),
    ...metrics,
  };
};

export const INITIAL_CAMPAIGNS: Campaign[] = CAMPAIGN_SPECS.map(buildCampaign);
