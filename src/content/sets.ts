import type { CardSet, SetId } from './schema'

export const CONTENT_VERSION = '2026.07.1'
export const RULES_VERSION = '2026.07.1'

export const CARD_SETS: Record<SetId, CardSet> = {
  'foundations-001': {
    id: 'foundations-001',
    code: 'DSF',
    name: '정령의 기초',
    description: '다섯 카드군의 단일 카드군 카드로 이루어진 Duel Spirits의 기본 세트입니다.',
    releaseType: 'core',
    contentVersion: CONTENT_VERSION,
    unlockedByDefault: true,
  },
  'confluence-001': {
    id: 'confluence-001',
    code: 'DSC',
    name: '합류의 징조',
    description: '두 카드군을 함께 지닌 공명 카드로 이루어진 첫 확장 세트입니다.',
    releaseType: 'expansion',
    contentVersion: CONTENT_VERSION,
    unlockedByDefault: true,
  },
}
