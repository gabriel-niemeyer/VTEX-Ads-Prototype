import React from 'react';
import { Campaign, Product } from '../types';

interface NestleBannerCreativeProps {
  campaign: Campaign;
  label: string;
  dimensions: string;
}

type LayoutMode = 'superwide' | 'wide' | 'square' | 'vertical' | 'supervertical';
type CreativeFamily = 'infant' | 'nutrition' | 'dairy' | 'default';

type CreativeTheme = {
  background: string;
  paper: string;
  paperEdge: string;
  text: string;
  textSoft: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  stickerBg: string;
  stickerFg: string;
  ctaBg: string;
  ctaFg: string;
  chipBg: string;
  chipFg: string;
  halo: string;
};

type CreativeContent = {
  eyebrow: string;
  kicker: string;
  headline: string;
  body: string;
  sticker: string;
  tags: string[];
};

const PUBLISHER_STYLES: Record<string, { bg: string; fg: string }> = {
  Carrefour: { bg: '#005aa9', fg: '#ffffff' },
  Extra: { bg: '#d91f26', fg: '#ffffff' },
  'Pão de Açúcar': { bg: '#165c3d', fg: '#ffffff' },
  Assaí: { bg: '#f47b20', fg: '#ffffff' },
  Atacadão: { bg: '#cf102d', fg: '#ffffff' },
  'Amazon Brasil': { bg: '#131921', fg: '#ff9900' },
  'Mercado Livre': { bg: '#ffe600', fg: '#243f90' },
  Rappi: { bg: '#ff4f5e', fg: '#ffffff' },
  iFood: { bg: '#ea1d2c', fg: '#ffffff' },
  Magalu: { bg: '#0086ff', fg: '#ffffff' },
  Americanas: { bg: '#eb1f27', fg: '#ffffff' },
  'Drogarias São Paulo': { bg: '#d71920', fg: '#ffffff' },
};

const defaultPublisherStyle = { bg: '#005aa9', fg: '#ffffff' };

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const parseDimensions = (dimensions: string) => {
  const match = dimensions.match(/(\d+)\s*x\s*(\d+)/i);
  if (!match) return { width: 1200, height: 628 };
  return { width: Number(match[1]), height: Number(match[2]) };
};

const compactProductName = (name: string) =>
  name
    .replace(/\s+\d[\d.,]*\s?(g|kg|ml|l|litros?|unidades?|meses?).*$/i, '')
    .replace(/\s+-\s+.*$/i, '')
    .replace(/\b(nestle|nestlé)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const shortenBadgeName = (name: string) => {
  const compact = compactProductName(name);
  const words = compact.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.min(words.length, 3)).join(' ');
};

const getLayoutMode = (width: number, height: number): LayoutMode => {
  const ratio = width / height;
  if (ratio >= 4) return 'superwide';
  if (ratio >= 1.4) return 'wide';
  if (ratio >= 0.9) return 'square';
  if (ratio >= 0.42) return 'vertical';
  return 'supervertical';
};

const pickProducts = (products: Product[], layoutMode: LayoutMode) => {
  const targetCount =
    layoutMode === 'superwide'
      ? 3
      : layoutMode === 'wide'
        ? 3
        : layoutMode === 'square'
          ? 2
          : layoutMode === 'vertical'
            ? 2
            : 1;

  return products.slice(0, targetCount);
};

const getPreviewFrame = (width: number, height: number, layoutMode: LayoutMode) => {
  const maxWidth =
    layoutMode === 'superwide'
      ? 700
      : layoutMode === 'wide'
        ? 560
        : layoutMode === 'square'
          ? 300
          : layoutMode === 'vertical'
            ? 236
            : 176;

  const maxHeight =
    layoutMode === 'superwide'
      ? 148
      : layoutMode === 'wide'
        ? 210
        : layoutMode === 'square'
          ? 300
          : layoutMode === 'vertical'
            ? 350
            : 420;

  const scale = Math.min(maxWidth / width, maxHeight / height);
  return {
    width: Math.max(88, Math.round(width * scale)),
    height: Math.max(88, Math.round(height * scale)),
  };
};

const getCreativeFamily = (campaign: Campaign): CreativeFamily => {
  const fingerprint = normalizeText(
    `${campaign.title} ${campaign.products.map((product) => product.name).join(' ')}`
  );

  if (
    fingerprint.includes('nan') ||
    fingerprint.includes('neslac') ||
    fingerprint.includes('nestogeno') ||
    fingerprint.includes('infantil')
  ) {
    return 'infant';
  }

  if (
    fingerprint.includes('nutren') ||
    fingerprint.includes('molico') ||
    fingerprint.includes('50+')
  ) {
    return 'nutrition';
  }

  if (
    fingerprint.includes('iogurte') ||
    fingerprint.includes('chandelle') ||
    fingerprint.includes('lactose') ||
    fingerprint.includes('petit suisse')
  ) {
    return 'dairy';
  }

  return 'default';
};

const getTheme = (family: CreativeFamily): CreativeTheme => {
  switch (family) {
    case 'infant':
      return {
        background: 'linear-gradient(130deg, #0a3273 0%, #155cb2 50%, #f8c55d 100%)',
        paper: 'rgba(255, 250, 241, 0.96)',
        paperEdge: 'rgba(255, 255, 255, 0.78)',
        text: '#0e326d',
        textSoft: '#214f93',
        textMuted: 'rgba(14, 50, 109, 0.72)',
        accent: '#f4b53f',
        accentSoft: 'rgba(255, 207, 116, 0.72)',
        stickerBg: '#fbd669',
        stickerFg: '#183e7e',
        ctaBg: '#d71820',
        ctaFg: '#fffdf8',
        chipBg: 'rgba(18, 79, 151, 0.1)',
        chipFg: '#144b8c',
        halo: 'rgba(255, 232, 176, 0.78)',
      };
    case 'nutrition':
      return {
        background: 'linear-gradient(135deg, #082c67 0%, #0d4f9f 45%, #f0b35a 100%)',
        paper: 'rgba(255, 248, 240, 0.96)',
        paperEdge: 'rgba(255, 255, 255, 0.74)',
        text: '#0a316d',
        textSoft: '#27538d',
        textMuted: 'rgba(10, 49, 109, 0.72)',
        accent: '#ff8b53',
        accentSoft: 'rgba(255, 180, 123, 0.62)',
        stickerBg: '#ffffff',
        stickerFg: '#0f4f9f',
        ctaBg: '#d71920',
        ctaFg: '#fffdf8',
        chipBg: 'rgba(19, 79, 150, 0.1)',
        chipFg: '#114b92',
        halo: 'rgba(255, 214, 146, 0.76)',
      };
    case 'dairy':
      return {
        background: 'linear-gradient(135deg, #0a3778 0%, #1883d0 48%, #f7c7c3 100%)',
        paper: 'rgba(255, 250, 247, 0.96)',
        paperEdge: 'rgba(255, 255, 255, 0.78)',
        text: '#113771',
        textSoft: '#2a5b95',
        textMuted: 'rgba(17, 55, 113, 0.72)',
        accent: '#ef5b73',
        accentSoft: 'rgba(255, 184, 192, 0.68)',
        stickerBg: '#ffe7e1',
        stickerFg: '#c63f57',
        ctaBg: '#d71920',
        ctaFg: '#fffdf8',
        chipBg: 'rgba(24, 120, 196, 0.1)',
        chipFg: '#175391',
        halo: 'rgba(255, 231, 211, 0.78)',
      };
    default:
      return {
        background: 'linear-gradient(135deg, #09306d 0%, #1260b7 50%, #efc070 100%)',
        paper: 'rgba(255, 250, 243, 0.96)',
        paperEdge: 'rgba(255, 255, 255, 0.76)',
        text: '#0f3470',
        textSoft: '#2a5893',
        textMuted: 'rgba(15, 52, 112, 0.72)',
        accent: '#eb5a66',
        accentSoft: 'rgba(255, 205, 146, 0.68)',
        stickerBg: '#ffffff',
        stickerFg: '#0f4f9f',
        ctaBg: '#d71920',
        ctaFg: '#fffdf8',
        chipBg: 'rgba(21, 86, 166, 0.1)',
        chipFg: '#145095',
        halo: 'rgba(255, 227, 179, 0.74)',
      };
  }
};

const getCreativeContent = (
  family: CreativeFamily,
  campaign: Campaign,
  selectedProducts: Product[],
  layoutMode: LayoutMode
): CreativeContent => {
  const shortNames = selectedProducts.map((product) => shortenBadgeName(product.name));
  const compactHeadline = layoutMode === 'supervertical' || layoutMode === 'vertical';

  switch (family) {
    case 'infant':
      return {
        eyebrow: 'Primeiros cuidados',
        kicker: 'Nan, Nestogeno e Neslac',
        headline: compactHeadline
          ? 'Fórmulas e compostos para a rotina dos pequenos'
          : 'Fórmulas e compostos em destaque para a rotina dos pequenos',
        body: 'Seleção com visibilidade premium para apoiar a jornada das famílias desde os primeiros meses.',
        sticker: 'Cuidado diário',
        tags: shortNames.length > 0 ? shortNames : ['Nan Supreme', 'Nestogeno', 'Neslac'],
      };
    case 'nutrition':
      return {
        eyebrow: 'Nutrição 50+',
        kicker: 'Nutren Senior, Active e Molico',
        headline: compactHeadline
          ? 'Proteína, energia e praticidade no mesmo mix'
          : 'Proteína, energia e praticidade em um mix de alta recorrência',
        body: 'Portfólio pensado para rotina ativa, reposição frequente e maior valor por cesta na farmácia.',
        sticker: 'Top sellers',
        tags: shortNames.length > 0 ? shortNames : ['Nutren Senior', 'Nutren Active', 'Molico'],
      };
    case 'dairy':
      return {
        eyebrow: 'Lácteos em alta',
        kicker: 'Iogurtes, Chandelle e zero lactose',
        headline: compactHeadline
          ? 'Mais cremosidade para todas as ocasiões'
          : 'Mais cremosidade e conveniência para todas as ocasiões',
        body: 'Da indulgência ao consumo leve, a campanha destaca produtos que ampliam a cesta e a frequência.',
        sticker: 'Mix indulgente',
        tags: shortNames.length > 0 ? shortNames : ['Chandelle', 'Iogurtes', 'Zero lactose'],
      };
    default:
      return {
        eyebrow: 'Seleção Nestlé',
        kicker: campaign.publisher,
        headline: compactHeadline
          ? 'Destaque patrocinado com produtos em evidência'
          : 'Destaque patrocinado com produtos em evidência no varejo',
        body: 'Peças prontas para ampliar alcance, reforçar lembrança e mover a decisão de compra.',
        sticker: 'Campanha ativa',
        tags: shortNames,
      };
  }
};

const NestleLockup = () => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 80,
      height: 30,
      padding: '0 12px',
      borderRadius: 999,
      background: '#ffffff',
      color: '#0b2f6b',
      fontWeight: 800,
      fontSize: 12,
      letterSpacing: 0.4,
      boxShadow: '0 10px 24px rgba(8, 33, 74, 0.18)',
    }}
  >
    Nestlé
  </div>
);

const renderProductCluster = (
  products: Product[],
  layoutMode: LayoutMode,
  family: CreativeFamily,
  theme: CreativeTheme
) => {
  if (layoutMode === 'supervertical') {
    const hero = products[0];
    return (
      <div
        style={{
          position: 'absolute',
          inset: '120px 18px 86px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 26,
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '72%',
            borderRadius: 999,
            background: `radial-gradient(circle, ${theme.halo} 0%, rgba(255,255,255,0) 72%)`,
            filter: 'blur(4px)',
          }}
        />
        {hero ? (
          <img
            src={hero.imageUrl}
            alt={hero.name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              filter:
                family === 'nutrition'
                  ? 'drop-shadow(0 18px 24px rgba(7, 31, 71, 0.28))'
                  : 'drop-shadow(0 16px 20px rgba(7, 31, 71, 0.24))',
            }}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        right: layoutMode === 'square' ? 14 : 18,
        bottom: layoutMode === 'square' ? 14 : 16,
        top: layoutMode === 'square' ? '40%' : 18,
        width:
          layoutMode === 'superwide'
            ? '40%'
            : layoutMode === 'wide'
              ? '43%'
              : layoutMode === 'square'
                ? '46%'
                : '48%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        gap: layoutMode === 'square' ? 6 : 10,
        zIndex: 25,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: layoutMode === 'square' ? '4%' : '10%',
          right: 0,
          bottom: layoutMode === 'square' ? 0 : 6,
          height: layoutMode === 'superwide' ? '26%' : '22%',
          borderRadius: '999px',
          background: `radial-gradient(circle at center, ${theme.halo} 0%, rgba(255,255,255,0) 74%)`,
          filter: 'blur(4px)',
          zIndex: 1,
        }}
      />
      {products.map((product, index) => {
        const lift =
          layoutMode === 'superwide'
            ? [10, 0, 12][index] ?? 0
            : layoutMode === 'wide'
              ? [8, 0, 10][index] ?? 0
              : [0, 16][index] ?? 0;
        const scale =
          layoutMode === 'square'
            ? index === 0
              ? 1
              : 0.8
            : layoutMode === 'vertical'
              ? index === 0
                ? 1
                : 0.78
              : index === 1
                ? 0.88
                : index === 2
                  ? 0.74
                  : 1;

        return (
          <div
            key={product.id}
            style={{
              position: 'relative',
              flex: 1,
              height: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              transform: `translateY(${lift}px) scale(${scale})`,
              zIndex: 20 - index,
            }}
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 18px 22px rgba(7, 31, 71, 0.24))',
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export const NestleBannerCreative: React.FC<NestleBannerCreativeProps> = ({
  campaign,
  label,
  dimensions,
}) => {
  const { width, height } = parseDimensions(dimensions);
  const layoutMode = getLayoutMode(width, height);
  const selectedProducts = pickProducts(campaign.products, layoutMode);
  const family = getCreativeFamily(campaign);
  const theme = getTheme(family);
  const content = getCreativeContent(family, campaign, selectedProducts, layoutMode);
  const publisherStyle = PUBLISHER_STYLES[campaign.publisher] ?? defaultPublisherStyle;
  const previewFrame = getPreviewFrame(width, height, layoutMode);
  const isCompact = layoutMode === 'vertical' || layoutMode === 'supervertical';
  const chipLimit =
    layoutMode === 'superwide' ? 3 : layoutMode === 'wide' ? 3 : layoutMode === 'square' ? 2 : 2;
  const visibleTags = content.tags.slice(0, chipLimit);
  const productCluster = renderProductCluster(selectedProducts, layoutMode, family, theme);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] tracking-[-0.12px] text-[color:var(--sl-fg-base-soft)]">
          Arte patrocinada pronta para Nestlé + {campaign.publisher}
        </p>
        <span className="text-[11px] tracking-[-0.12px] text-[color:var(--sl-fg-base-muted)] tabular-nums">
          {label} • {dimensions}
        </span>
      </div>

      <div className="rounded-[20px] bg-[#f3f5f9] border border-black/[0.05] p-3 sm:p-4 flex items-center justify-center min-h-[190px]">
        <div
          style={{
            width: previewFrame.width,
            height: previewFrame.height,
            borderRadius: layoutMode === 'superwide' ? 20 : 26,
            overflow: 'hidden',
            position: 'relative',
            background: theme.background,
            boxShadow: '0 22px 44px rgba(8, 31, 68, 0.18)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 12% 16%, rgba(255,255,255,0.18), transparent 20%), radial-gradient(circle at 82% 12%, rgba(255,255,255,0.14), transparent 18%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px) 0 0 / 18px 18px, linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px) 0 0 / 18px 18px',
              opacity: 0.25,
            }}
          />
          <div
            style={{
              position: 'absolute',
              width: layoutMode === 'supervertical' ? '148%' : '76%',
              height: layoutMode === 'supervertical' ? '46%' : '54%',
              left: layoutMode === 'square' ? '-10%' : layoutMode === 'supervertical' ? '-24%' : '-12%',
              bottom: layoutMode === 'supervertical' ? '-8%' : '-20%',
              borderRadius: '999px 999px 0 0',
              background: theme.accentSoft,
              transform: layoutMode === 'supervertical' ? 'rotate(-10deg)' : 'rotate(-6deg)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: layoutMode === 'supervertical' ? 12 : 14,
              top: layoutMode === 'supervertical' ? 12 : 14,
              right: layoutMode === 'supervertical' ? 12 : 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              zIndex: 30,
            }}
          >
            <NestleLockup />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {layoutMode !== 'supervertical' ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    height: 26,
                    padding: '0 10px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.16)',
                    color: '#fffaf2',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.2,
                  }}
                >
                  {campaign.products.length} SKUs
                </span>
              ) : null}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 999,
                  background: publisherStyle.bg,
                  color: publisherStyle.fg,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.2,
                  maxWidth: layoutMode === 'supervertical' ? 86 : 118,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {campaign.publisher}
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: layoutMode === 'square' ? 16 : layoutMode === 'supervertical' ? 12 : 18,
              top: layoutMode === 'supervertical' ? 54 : 52,
              width:
                layoutMode === 'superwide'
                  ? '48%'
                  : layoutMode === 'wide'
                    ? '50%'
                    : layoutMode === 'square'
                      ? '58%'
                      : layoutMode === 'vertical'
                        ? '54%'
                        : 'calc(100% - 24px)',
              minHeight: layoutMode === 'supervertical' ? '42%' : 'auto',
              padding:
                layoutMode === 'superwide'
                  ? '14px 14px 16px'
                  : layoutMode === 'square'
                    ? '14px'
                    : layoutMode === 'supervertical'
                      ? '12px'
                      : '16px',
              borderRadius: layoutMode === 'supervertical' ? 18 : 20,
              background: theme.paper,
              border: `1px solid ${theme.paperEdge}`,
              boxShadow: '0 16px 30px rgba(10, 37, 78, 0.12)',
              zIndex: 28,
              backdropFilter: 'blur(6px)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 22,
                padding: '0 10px',
                borderRadius: 999,
                background: theme.chipBg,
                color: theme.chipFg,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.28,
                textTransform: 'uppercase',
              }}
            >
              {content.eyebrow}
            </div>
            <p
              style={{
                margin: '10px 0 0',
                color: theme.textSoft,
                fontSize: layoutMode === 'supervertical' ? 9 : 10,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {content.kicker}
            </p>
            <h3
              style={{
                margin: layoutMode === 'superwide' ? '6px 0 0' : '8px 0 0',
                color: theme.text,
                fontWeight: 800,
                lineHeight: layoutMode === 'superwide' ? 1.04 : 1.08,
                letterSpacing: '-0.04em',
                fontSize:
                  layoutMode === 'superwide'
                    ? 16
                    : layoutMode === 'wide'
                      ? 18
                      : layoutMode === 'square'
                        ? 21
                        : layoutMode === 'vertical'
                          ? 16
                          : 14,
                display: '-webkit-box',
                WebkitLineClamp: layoutMode === 'supervertical' ? 4 : 3,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }}
            >
              {content.headline}
            </h3>
            <p
              style={{
                margin: '8px 0 0',
                color: theme.textMuted,
                fontSize: layoutMode === 'supervertical' ? 9 : 10,
                lineHeight: 1.3,
                maxWidth: isCompact ? '100%' : '92%',
                display: '-webkit-box',
                WebkitLineClamp: isCompact ? 4 : 3,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }}
            >
              {content.body}
            </p>
            {visibleTags.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {visibleTags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0 9px',
                      height: layoutMode === 'supervertical' ? 22 : 24,
                      borderRadius: 999,
                      background: '#ffffff',
                      color: theme.textSoft,
                      fontSize: layoutMode === 'supervertical' ? 8 : 9,
                      fontWeight: 700,
                      letterSpacing: 0.1,
                      boxShadow: '0 6px 16px rgba(12, 46, 95, 0.08)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div
            style={{
              position: 'absolute',
              right: layoutMode === 'square' ? 16 : layoutMode === 'supervertical' ? 12 : 18,
              top: layoutMode === 'square' ? 50 : layoutMode === 'supervertical' ? 102 : 56,
              zIndex: 29,
              transform: layoutMode === 'supervertical' ? 'rotate(0deg)' : 'rotate(5deg)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: layoutMode === 'supervertical' ? 64 : 78,
                minHeight: layoutMode === 'supervertical' ? 64 : 74,
                padding: layoutMode === 'supervertical' ? '10px 8px' : '12px 10px',
                borderRadius: '22px',
                background: theme.stickerBg,
                color: theme.stickerFg,
                fontWeight: 800,
                fontSize: layoutMode === 'supervertical' ? 9 : 10,
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                textAlign: 'center' as const,
                boxShadow: '0 14px 28px rgba(7, 31, 71, 0.16)',
              }}
            >
              {content.sticker}
            </div>
          </div>

          {productCluster}

          <div
            style={{
              position: 'absolute',
              left: layoutMode === 'supervertical' ? 12 : 18,
              bottom: layoutMode === 'supervertical' ? 12 : 16,
              zIndex: 30,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: layoutMode === 'supervertical' ? 28 : 32,
                padding: layoutMode === 'supervertical' ? '0 11px' : '0 14px',
                borderRadius: 999,
                background: theme.ctaBg,
                color: theme.ctaFg,
                fontSize: layoutMode === 'supervertical' ? 10 : 11,
                fontWeight: 800,
                letterSpacing: 0.18,
                boxShadow: '0 10px 24px rgba(9, 36, 82, 0.18)',
              }}
            >
              Compre no {campaign.publisher}
            </div>
            {layoutMode !== 'supervertical' ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: 30,
                  padding: '0 11px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.18)',
                  color: '#fffaf2',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 0.14,
                }}
              >
                Publicidade patrocinada
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
