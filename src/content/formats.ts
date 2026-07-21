import type { CardId } from './cards'
import type { GameFormat, GameFormatId } from './schema'

export const DEFAULT_FORMAT_ID: GameFormatId = 'open-v1'

export const GAME_FORMATS: Record<GameFormatId, GameFormat<CardId>> = {
  'campaign-prologue-v1': {
    id: 'campaign-prologue-v1',
    name: '캠페인 · 서막',
    shortName: '캠페인',
    description: 'AI 시나리오와 캠페인 진행 데이터를 위한 전용 포맷입니다. 현재는 덱 구성 기반만 제공합니다.',
    kind: 'campaign',
    mode: 'campaign',
    deckSource: 'campaign',
    deckSize: 12,
    maxCopiesPerCard: 2,
    startingLife: 4,
    startingHand: 4,
    fieldSlots: 4,
    cardPool: { type: 'all' },
    bannedCardIds: [],
    restrictedCardLimits: {},
    selectableInDeckBuilder: true,
    selectableInLobby: false,
    scenarioId: 'prologue-placeholder',
  },
  'set-constructed-v1': {
    id: 'set-constructed-v1',
    name: '세트 한정전',
    shortName: '세트 한정',
    description: '선택한 하나 이상의 세트에 속한 카드만 사용하는 구축 포맷입니다.',
    kind: 'set-constructed',
    mode: 'pvp',
    deckSource: 'constructed',
    deckSize: 12,
    maxCopiesPerCard: 3,
    startingLife: 4,
    startingHand: 4,
    fieldSlots: 4,
    cardPool: { type: 'selected-sets', defaultSetIds: ['foundations-001'] },
    bannedCardIds: [],
    restrictedCardLimits: {},
    selectableInDeckBuilder: true,
    selectableInLobby: true,
  },
  'open-v1': {
    id: 'open-v1',
    name: '전체 카드전',
    shortName: '전체 카드',
    description: '현재 공개된 모든 카드를 사용하는 기본 PvP 포맷입니다.',
    kind: 'open',
    mode: 'pvp',
    deckSource: 'constructed',
    deckSize: 12,
    maxCopiesPerCard: 2,
    startingLife: 4,
    startingHand: 4,
    fieldSlots: 4,
    cardPool: { type: 'all' },
    bannedCardIds: [],
    restrictedCardLimits: {},
    selectableInDeckBuilder: true,
    selectableInLobby: true,
  },
  'draft-v1': {
    id: 'draft-v1',
    name: '드래프트',
    shortName: '드래프트',
    description: '생성된 제한 카드 풀 안에서만 덱을 구성하는 포맷입니다. 현재는 로컬 풀 생성 방식입니다.',
    kind: 'draft',
    mode: 'pvp',
    deckSource: 'draft',
    deckSize: 12,
    maxCopiesPerCard: 99,
    startingLife: 4,
    startingHand: 4,
    fieldSlots: 4,
    cardPool: { type: 'draft-pool' },
    bannedCardIds: [],
    restrictedCardLimits: {},
    selectableInDeckBuilder: true,
    selectableInLobby: true,
    draft: {
      poolSize:36,
      deckSize: 12,
      packCount: 3,
      cardsPerPack: 8,
    },
  },
  'restricted-v1': {
    id: 'restricted-v1',
    name: '금지·제한전',
    shortName: '금지·제한',
    description: '전체 카드풀에 시즌별 금지·제한 목록을 적용하는 경쟁 포맷입니다.',
    kind: 'restricted',
    mode: 'pvp',
    deckSource: 'constructed',
    deckSize: 12,
    maxCopiesPerCard: 2,
    startingLife: 4,
    startingHand: 4,
    fieldSlots: 4,
    cardPool: { type: 'all' },
    bannedCardIds: [],
    restrictedCardLimits: {
      floating_mountains: 1,
      holy_mirror_wall: 1,
    },
    selectableInDeckBuilder: true,
    selectableInLobby: true,
  },
}

export const getFormat = (formatId: GameFormatId) => GAME_FORMATS[formatId]

export function isGameFormatId(value: unknown): value is GameFormatId {
  return typeof value === 'string' && value in GAME_FORMATS
}

export const DECK_BUILDER_FORMATS = Object.values(GAME_FORMATS)
  .filter((format) => format.selectableInDeckBuilder)

export const LOBBY_FORMATS = Object.values(GAME_FORMATS)
  .filter((format) => format.selectableInLobby)
