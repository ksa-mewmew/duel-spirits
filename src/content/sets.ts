import type { CardSet, SetId } from './schema'

export const CONTENT_VERSION = '2026.07.2'
export const RULES_VERSION = '2026.07.2'

export const CARD_SETS: Record<SetId, CardSet> = {
  'foundations-001': {
    id: 'foundations-001',
    code: 'DSF',
    name: '정령의 기초',
    description: '현재 공개된 단일·복수 속성 카드를 모두 포함하는 Duel Spirits의 기본 세트입니다.',
    releaseType: 'core',
    contentVersion: CONTENT_VERSION,
    unlockedByDefault: true,
  },
  'confluence-001': {
    id: 'confluence-001',
    code: 'DSC',
    name: '합류의 징조',
    description: '향후 추가될 확장 카드를 위한 빈 확장 세트 자리입니다.',
    releaseType: 'expansion',
    contentVersion: CONTENT_VERSION,
    unlockedByDefault: true,
  },
}
