import type { CampaignScenario } from '../campaign/types'

export const CAMPAIGN_SCENARIOS: Record<string, CampaignScenario> = {
  'prologue-placeholder': {
    id: 'prologue-placeholder',
    name: '서막: 잠든 정령',
    description: '캠페인 엔진 연결을 위한 첫 시나리오 자리입니다.',
    formatId: 'campaign-prologue-v1',
    opponentDeckId: 'campaign-prologue-opponent',
    aiProfileId: 'basic-tempo-ai',
    specialRules: [],
    rewards: [
      { type: 'campaign-flag', flag: 'prologue-cleared' },
    ],
  },
}
