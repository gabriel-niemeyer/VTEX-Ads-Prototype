import React, { useState } from 'react';
import { AgentLayout } from './components/AgentLayout';
import { Campaign, CampaignStatus } from './types';
import { calculateOverallStrength } from './constants';
import {
  INITIAL_CAMPAIGNS,
  ALL_PRODUCTS,
  generateMockBids,
  ensureNoSpendForFutureCampaigns,
  DEFAULT_NESTLE_IMAGE,
} from './campaignData';

const App: React.FC = () => {
  const [suggestedCampaignIds, setSuggestedCampaignIds] = useState<string[]>([]);
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

  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const handleCampaignUpdate = (id: string, startDate: Date, endDate: Date) => {
    setCampaigns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        return ensureNoSpendForFutureCampaigns({ ...c, startDate, endDate });
      })
    );
  };

  const handleDocumentSave = (updated: Campaign) => {
    const normalized = ensureNoSpendForFutureCampaigns(updated);
    const exists = campaigns.some((c) => c.id === normalized.id);

    if (exists) {
      setCampaigns((prev) => prev.map((c) => (c.id === normalized.id ? normalized : c)));
      return;
    }

    setCampaigns((prev) => [...prev, normalized]);
    setSuggestedCampaignIds((prev) => (prev.includes(normalized.id) ? prev : [...prev, normalized.id]));
  };

  const handleEmptySpaceClick = (date: Date) => {
    const bids = generateMockBids(['Produto patrocinado']);
    setEditingCampaign({
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      status: CampaignStatus.DRAFT,
      publisher: '',
      startDate: date,
      endDate: new Date(date.getTime() + 5 * 24 * 60 * 60 * 1000),
      budget: 0,
      spend: 0,
      mediaTypes: [],
      products: [],
      bidStrength: calculateOverallStrength(bids),
      bids,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      ntbConversions: 0,
      ntbRevenue: 0,
      units: 0,
      ntbUnits: 0,
      impressionShare: 0,
      imageUrl: DEFAULT_NESTLE_IMAGE,
    });
  };

  return (
    <div className="app-root relative h-screen bg-white text-[color:var(--sl-fg-base)] safe-top safe-bottom overflow-hidden">
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
      />
    </div>
  );
};

export default App;
