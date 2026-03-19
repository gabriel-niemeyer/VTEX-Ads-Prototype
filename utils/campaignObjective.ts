import type { Campaign } from '../types';

export type CampaignObjective = 'Conversão' | 'Consideração' | 'Alcance';

/** Mesma regra do relatório de orçamento: derivado dos tipos de mídia. */
export function inferCampaignObjective(campaign: Campaign): CampaignObjective {
  const mediaTypes = campaign.mediaTypes ?? [];
  if (mediaTypes.some((type) => type === 'Produto patrocinado' || type === 'Instore display')) {
    return 'Conversão';
  }
  if (mediaTypes.some((type) => type === 'Marca patrocinada' || type === 'Video')) {
    return 'Consideração';
  }
  return 'Alcance';
}
