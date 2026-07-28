import type { CardId } from './cards'
import { DEFAULT_TURN_DRAW_COUNT } from './schema'
import type { GameFormat, GameFormatId } from './schema'

export const DEFAULT_FORMAT_ID: GameFormatId = 'open-v1'
export const DRAFT_POOL_SIZE = 60
export const DRAFT_DECK_SIZE = 20

export const GAME_FORMATS: Record<GameFormatId, GameFormat<CardId>> = {
  'campaign-prologue-v1': {
    id: 'campaign-prologue-v1',
    name: '캠페인 · 서막',
    shortName: '캠페인',
    description: 'AI 시나리오와 캠페인 진행 데이터를 위한 전용 포맷입니다. 현재는 덱 구성 기반만 제공합니다.',
    kind: 'campaign',
    mode: 'campaign',
    deckSource: 'campaign',
    deckSize: 20,
    maxCopiesPerCard: 3,
    startingLife: 4,
    startingHand: 4,
    turnDrawCount: DEFAULT_TURN_DRAW_COUNT,
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
    description: '선택한 하나 이상의 세트에 속한 카드만 사용하는 구축 포맷',
    kind: 'set-constructed',
    mode: 'pvp',
    deckSource: 'constructed',
    deckSize: 20,
    maxCopiesPerCard: 3,
    startingLife: 4,
    startingHand: 4,
    turnDrawCount: DEFAULT_TURN_DRAW_COUNT,
    fieldSlots: 4,
    cardPool: {
      type: 'selected-sets',
      defaultSetIds: ['foundations-001', 'evolution-begins-001'],
    },
    bannedCardIds: [],
    restrictedCardLimits: {},
    selectableInDeckBuilder: true,
    selectableInLobby: true,
  },
  'open-v1': {
    id: 'open-v1',
    name: '전체 카드전',
    shortName: '전체 카드',
    description: '현재 공개된 모든 카드를 사용하는 기본 PvP 포맷',
    kind: 'open',
    mode: 'pvp',
    deckSource: 'constructed',
    deckSize: 20,
    maxCopiesPerCard: 3,
    startingLife: 4,
    startingHand: 4,
    turnDrawCount: DEFAULT_TURN_DRAW_COUNT,
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
    description: `두 플레이어가 매칭된 뒤 제한 시간 안에 서버가 발급한 ${DRAFT_POOL_SIZE}장 카드 풀에서 ${DRAFT_DECK_SIZE}장 덱을 구성하는 포맷`,
    kind: 'draft',
    mode: 'pvp',
    deckSource: 'draft',
    deckSize: DRAFT_DECK_SIZE,
    maxCopiesPerCard: 3,
    startingLife: 4,
    startingHand: 4,
    turnDrawCount: DEFAULT_TURN_DRAW_COUNT,
    fieldSlots: 4,
    cardPool: { type: 'draft-pool' },
    bannedCardIds: [],
    restrictedCardLimits: {},
    selectableInDeckBuilder: false,
    selectableInLobby: true,
    draft: {
      poolSize: DRAFT_POOL_SIZE,
      deckSize: DRAFT_DECK_SIZE,
      packCount: DRAFT_POOL_SIZE / 10,
      cardsPerPack: 10,
    },
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
