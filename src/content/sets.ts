import type { CardSet, SetId } from './schema'

export const CONTENT_VERSION = '2026.07.24.2'
export const RULES_VERSION = '2026.07.24.2'

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
  'evolution-begins-001': {
    id: 'evolution-begins-001',
    code: 'SOF',
    name: '진화의 시작',
    description: '기존 몬스터 위에 겹쳐 사용하는 진화 몬스터와 다섯 속성의 새로운 전술을 담은 두 번째 카드 세트입니다.',
    releaseType: 'expansion',
    contentVersion: CONTENT_VERSION,
    unlockedByDefault: true,
  },
}
