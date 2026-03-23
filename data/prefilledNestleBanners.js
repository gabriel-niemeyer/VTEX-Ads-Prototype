const BANNER_FORMATS = [
  { label: 'Super wide', dimensions: '1920 x 120', framing: 'ultra panoramic masthead' },
  { label: 'Square', dimensions: '400 x 400', framing: 'square ecommerce tile' },
  { label: 'Super vertical', dimensions: '200 x 768', framing: 'tall slim skyscraper' },
  { label: 'Banner horizontal', dimensions: '1200 x 300', framing: 'wide hero banner' },
  { label: 'Leaderboard', dimensions: '728 x 90', framing: 'lean horizontal leaderboard' },
  { label: 'Medium rectangle', dimensions: '300 x 250', framing: 'editorial display rectangle' },
  { label: 'Wide skyscraper', dimensions: '160 x 600', framing: 'tall narrow skyscraper' },
  { label: 'Half page', dimensions: '300 x 600', framing: 'half-page vertical display' },
  { label: 'Quadrado HD', dimensions: '1200 x 1200', framing: 'premium square social tile' },
  { label: 'Retângulo feed', dimensions: '1200 x 628', framing: 'feed-native landscape card' },
];

const CAMPAIGNS = [
  {
    campaignId: '1',
    slug: '01-primeira-infancia-formulas',
    family: 'infant',
    publisher: 'Drogarias São Paulo',
    products: ['Nanlac Comfor', 'Nan Supreme Pro', 'Nestogeno', 'Neslac Supreme'],
    promptFocus:
      'Nestlé infant nutrition campaign for Brazil with premium formula tins and gentle family-care atmosphere',
    artDirection:
      'deep Nestlé blue base, creamy paper panel, golden highlights, premium shelf-lighting, clean negative space, modern retail media layout',
  },
  {
    campaignId: '2',
    slug: '02-nutricao-50-plus',
    family: 'nutrition',
    publisher: 'Drogarias São Paulo',
    products: ['Nutren Senior', 'Nutren Active', 'Molico'],
    promptFocus:
      'Nestlé adult nutrition campaign for Brazil with active-lifestyle cues and strong product presence',
    artDirection:
      'bold cobalt blue, warm amber glow, premium wellness aesthetic, energetic but trustworthy, modern pharmacy ecommerce banner',
  },
  {
    campaignId: '3',
    slug: '03-lacteos-e-digestao',
    family: 'dairy',
    publisher: 'Drogarias São Paulo',
    products: ['Iogurtes Nestlé', 'Chandelle', 'Molico Zero Lactose', 'Chambinho'],
    promptFocus:
      'Nestlé dairy and digestive comfort campaign for Brazil with creamy textures and indulgent freshness',
    artDirection:
      'Nestlé blue with soft milk tones, creamy highlights, appetizing freshness, premium editorial composition, modern retail display ad',
  },
];

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseDimensions = (dimensions) => {
  const match = dimensions.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return { width: 1200, height: 628 };
  return { width: Number(match[1]), height: Number(match[2]) };
};

export const PREFILLED_NESTLE_BANNER_CAMPAIGNS = CAMPAIGNS.map((campaign) => ({
  ...campaign,
  formats: BANNER_FORMATS.map((format) => ({
    ...format,
    fileName: `${slugify(`${format.label}-${format.dimensions}`)}.png`,
  })),
}));

export const PREFILLED_NESTLE_BANNER_FORMATS = BANNER_FORMATS;

export function getPrefilledNestleBannerCampaign(campaignId) {
  return PREFILLED_NESTLE_BANNER_CAMPAIGNS.find((campaign) => campaign.campaignId === String(campaignId));
}

export function hasPrefilledNestleBannerCampaign(campaignId) {
  return Boolean(getPrefilledNestleBannerCampaign(campaignId));
}

export function getPrefilledNestleBannerAsset(campaignId, label, dimensions) {
  const campaign = getPrefilledNestleBannerCampaign(campaignId);
  if (!campaign) return null;

  const format = campaign.formats.find(
    (entry) => entry.label === label && entry.dimensions === dimensions
  );

  if (!format) return null;
  return `/generated-banners/${campaign.slug}/${format.fileName}`;
}

export function getPrefilledNestleBannerGenerationSpec(campaignId, label, dimensions) {
  const campaign = getPrefilledNestleBannerCampaign(campaignId);
  if (!campaign) return null;

  const format =
    campaign.formats.find((entry) => entry.label === label && entry.dimensions === dimensions) ??
    campaign.formats.find((entry) => entry.label === label);

  if (!format) return null;

  const { width, height } = parseDimensions(format.dimensions);

  return {
    ...campaign,
    ...format,
    width,
    height,
  };
}

export function buildPrefilledNestleBannerPrompt(campaignId, label, dimensions) {
  const spec = getPrefilledNestleBannerGenerationSpec(campaignId, label, dimensions);
  if (!spec) return null;

  const ratio = spec.width / spec.height;
  const orientationInstruction =
    ratio >= 1.2
      ? 'Compose for a landscape advertising surface with products anchored clearly and a strong readable hierarchy.'
      : ratio <= 0.83
        ? 'Compose for a vertical advertising surface with a clear top-to-bottom hierarchy and hero products stacked elegantly.'
        : 'Compose for a square retail media placement with centered balance and premium visual weight.';

  return [
    `Create a premium ${spec.framing} for a Nestlé Brazil sponsored retail media campaign inside ${spec.publisher}.`,
    spec.promptFocus + '.',
    `Featured products: ${spec.products.join(', ')}.`,
    `Art direction: ${spec.artDirection}.`,
    orientationInstruction,
    'Use photorealistic product-packaging imagery, crisp commercial lighting, elegant layered depth, and contemporary Brazilian ecommerce banner styling.',
    'Keep the Nestlé identity recognizable through color, composition and packaging cues used in Brazil, without adding extra brand logos beyond what appears naturally on product packs.',
    'Design it as a polished finished banner, attractive and current-market, suitable for paid media.',
    'Avoid watermarking, avoid distorted packaging, avoid duplicated products, avoid unreadable fake typography, avoid cluttered layouts, avoid purple neon aesthetics.',
  ].join(' ');
}
