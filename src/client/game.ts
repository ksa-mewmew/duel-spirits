import { CARD_ATTRIBUTES, CARDS } from '../shared/cards'
import {
  DECK_SCHEMA_VERSION,
  getAttributeDistribution,
  getAverageCost,
  getCostDistribution,
  isDeckCompatibleWithFormat,
  validateDeck,
} from '../shared/decks'
import { getFormat } from '../content/formats'
import { createRulebookDocument } from '../content/rulebook'
import { CARD_SETS } from '../content/sets'
import { createMatchConfig } from '../shared/match-config'
import { LIFE_SIZE } from '../shared/rules'
import {
  parseRoomFormatId,
  parseDraftLimitSeconds,
  parseSeatExpirySeconds,
  parseSelectedSetIds,
  parseTurnLimitSeconds,
} from '../shared/room-settings'
import { renderCard, renderCardBack } from '../components/card-renderer'
import { bindCardKeywordTooltips } from '../components/keyword-tooltip'
import { getPublicAssetUrl } from '../config/public-asset-url'

import type { CardAttributeId, CardId } from '../shared/cards'
import type { CardPlaySelection, GameAction } from '../shared/actions'
import type { PublicDeckStates } from '../shared/messages'
import type { RoomPhase } from '../shared/room-lifecycle'
import type { RoomSettings } from '../shared/room-settings'
import type { DraftPlayerView } from '../shared/room-draft'
import type { SeatExpiryState } from '../shared/room-timing'
import type { CardInstance, PlayerId, SofChoiceEffect, UnitInstance } from '../shared/types'
import type { GameView, PlayerView } from '../shared/views'
import type { LoggedAction } from '../shared/match-log'

import { getActiveDeck, loadDecks, setActiveDeckId } from './deck-storage'
import {
  connectToRoom,
  sendDeck,
  sendDeckReady,
  sendDraftConfirm,
  sendDraftSelection,
  sendLeaveRoom,
  sendPlayerAction,
  sendRematchReady,
} from './network'
import { updateFixedStageScale } from './stage-scale'

interface PlayDraft {
  cardInstanceId: string
  manaIds: string[]
  unitId?: string
  lifeIndex?: number
  effectManaId?: string
  discardId?: string
  fieldSlot?: number
  evolutionUnitId?: string
}

const appQuery = document.querySelector<HTMLDivElement>('#app')
if (!appQuery) throw new Error('App element was not found.')
const appElement: HTMLDivElement = appQuery
const BATTLEFIELD_BACKGROUND_URL = getPublicAssetUrl('ui/battlefield/battlefield.webp')
const BATTLEFIELD_SOF_EFFECTS = new Set<SofChoiceEffect>([
  'BOMB_MOUSE_DAMAGE',
  'ICE_MIRROR_FREEZE',
  'WAVE_FIN_BOUNCE',
  'CRYSTAL_TSUNAMI_BOUNCE',
  'MASS_BURIAL_ENEMY_FIRST',
  'MASS_BURIAL_SELF',
  'MASS_BURIAL_ENEMY_SECOND',
  'MOURNER_SACRIFICE',
  'MOURNER_DESTROY',
  'SKY_KNIGHT_READY',
])

const pageUrl = new URL(window.location.href)
const isTutorial = pageUrl.searchParams.get('tutorial') === '1'
const roomIdParam = pageUrl.searchParams.get('room')
const roomKeyParam = pageUrl.searchParams.get('key')
if ((!roomIdParam || !roomKeyParam) && !isTutorial) throw new Error('Room id and key are required.')
const roomId = roomIdParam ?? 'TUTORIAL'
const roomKey = roomKeyParam ?? 'LOCAL'

const requestedFormatId = parseRoomFormatId(pageUrl.searchParams.get('format'))
const requestedSettings: RoomSettings = {
  turnLimitSeconds: parseTurnLimitSeconds(pageUrl.searchParams.get('turn')),
  draftLimitSeconds: parseDraftLimitSeconds(pageUrl.searchParams.get('draft')),
  seatExpirySeconds: parseSeatExpirySeconds(pageUrl.searchParams.get('seatExpiry')),
  formatId: requestedFormatId,
  selectedSetIds: parseSelectedSetIds(pageUrl.searchParams.get('sets'), requestedFormatId),
}

const seatStorageKey = `card-duel:seat:${roomId}:${roomKey}`
let seatToken = window.localStorage.getItem(seatStorageKey)
let game: GameView | null = null
let assignedPlayerId: PlayerId | null = null
let connectedPlayers: PlayerId[] = []
let reservedPlayers: PlayerId[] = []
let roomPhase: RoomPhase = 'waiting'
let roomSettings: RoomSettings = requestedSettings
let turnDeadlineAt: number | null = null
let seatExpiresAt: SeatExpiryState = { P1: null, P2: null }
let deckStates: PublicDeckStates = {
  P1: { submitted: false, ready: false, name: null },
  P2: { submitted: false, ready: false, name: null },
}
let draftView: DraftPlayerView | null = null
let draftSearchQuery = ''
let draftAttributeFilter: CardAttributeId | 'all' = 'all'
let draftTypeFilter: 'all' | 'unit' | 'spell' = 'all'
let draftCostFilter: number | 'all' = 'all'
let draftSetFilter: import('../content/schema').SetId | 'all' = 'all'
let selectedAttackerId: string | null = null
let selectedAttackLifeSlotIndices: number[] = []
let playDraft: PlayDraft | null = null
let summonFromManaDraftId: string | null = null
let pendingChoiceIds: string[] = []
let gameNotice: string | null = null
let message = '서버에 연결하는 중입니다.'
let networkStatus = '연결 중'
let awaitingServer = false
let hasLeftRoom = false
let joinRejectedMessage: string | null = null
let selectedDeckId = getActiveDeck().id
let openDiscardPlayerId: PlayerId | null = null
let openManaPlayerId: PlayerId | null = null
let pinnedPreviewCardId: CardId | null = null
let pinnedPreviewInstanceId: string | null = null
let roomMenuOpen = false
let rulebookOpen = false
let matchLogOpen = false
let matchLog: LoggedAction[] = []
let turnAnnouncementKey: string | null = null
let lastObservedTurnKey: string | null = null
let turnAnnouncementTimer: number | null = null
let decisionPanelCollapsed = false
let decisionPanelKey: string | null = null
let handScrollLeft = 0
let lastCenteredHandCardId: string | null = null
let tutorialStep = 0

const tutorialCard = (instanceId: string, cardId: CardId): CardInstance => ({
  instanceId,
  cardId,
  ownerId: instanceId.startsWith('enemy') ? 'P2' : 'P1',
  controllerId: instanceId.startsWith('enemy') ? 'P2' : 'P1',
})

const tutorialUnit = (instanceId: string, cardId: CardId, slotIndex = 0): UnitInstance => ({
  ...tutorialCard(instanceId, cardId),
  slotIndex,
  battlefieldEntrySeq: slotIndex + 1,
  damage: 0,
  exhausted: false,
  summonedThisTurn: false,
  attacksThisTurn: 0,
  temporaryAttackModifier: 0,
  temporaryHealthModifier: 0,
})

function createTutorialView(step: number): GameView {
  const turnNumber = step <= 1 ? 3 : step <= 3 ? 4 : step <= 5 ? 5 : 6
  const firstSummoned = step >= 3
  const enemyDefeated = step >= 5
  const lifeBroken = step >= 7
  const evolved = step >= 8
  const won = step >= 9
  const manaCount = step === 0 ? 2 : 3
  const hand = [
    ...(step < 1 ? [tutorialCard('mana-source', 'volcano_mouse')] : []),
    ...(step >= 2 && step < 3 ? [tutorialCard('summon-card', 'flame_javelin_soldier')] : []),
    ...(step >= 7 && step < 8 ? [tutorialCard('evolution-card', 'flame_mane_captain')] : []),
  ]
  const mana = Array.from({ length: manaCount }, (_, index) => ({
    ...tutorialCard(`tutorial-mana-${index}`, index === 0 ? 'volcano_mouse' : 'living_flame'),
    exhausted: step === 3,
  }))
  const player = (playerId: PlayerId, isViewer: boolean): PlayerView => ({
    playerId,
    isViewer,
    deckCount: 12,
    handCount: isViewer ? hand.length : 2,
    hand: isViewer ? hand : [],
    lifeCount: playerId === 'P1' ? lifeBroken ? 1 : 2 : lifeBroken ? 0 : 1,
    lifeSlotIndices: playerId === 'P1' ? lifeBroken ? [1] : [0, 1] : lifeBroken ? [] : [0],
    mana: isViewer ? mana : [],
    field: playerId === 'P1'
      ? firstSummoned ? [{
          ...tutorialUnit(
            'tutorial-unit',
            evolved ? 'flame_mane_captain' : 'flame_javelin_soldier',
          ),
          damage: enemyDefeated && !evolved ? 2 : 0,
          attacksThisTurn: step === 5 ? 1 : 0,
          evolutionStack: evolved ? [tutorialCard('evolution-base', 'flame_javelin_soldier')] : undefined,
          evolvedThisTurn: evolved,
        }] : []
      : enemyDefeated ? [] : [tutorialUnit('enemy-unit', 'unexploded_bomb_mouse')],
    discard: playerId === 'P2' && enemyDefeated
      ? [
          tutorialCard('enemy-unit', 'unexploded_bomb_mouse'),
          ...(lifeBroken ? [tutorialCard('enemy-awakened-life', 'holy_mirror_wall')] : []),
        ]
      : [],
    manaPlacedThisTurn: step === 1,
    extraLifeLossOnDirectAttack: false,
    attacksThisTurn: 0,
    darkCardsDiscardedThisTurn: 0,
    burningProcessionActive: false,
  })
  return {
    matchConfig: createMatchConfig({ randomSeed: 'tutorial', createdAt: 1 }),
    actionSequence: step,
    status: won ? 'finished' : 'playing',
    currentPlayer: 'P1',
    turnNumber,
    winner: won ? 'P1' : null,
    viewer: 'P1',
    players: { P1: player('P1', true), P2: player('P2', false) },
    pendingChoice: null,
  }
}

const TUTORIAL_MESSAGES = [
  '1/6 · 손의 「화산쥐」에서 마나 버튼을 눌러 마나로 놓으세요. 마나는 매 턴 1장만 놓을 수 있습니다.',
  '턴 종료를 눌러 현재 턴을 마치세요. 상대 턴은 자동으로 진행되고 다음 내 턴에 사용한 마나가 다시 준비됩니다.',
  '2/6 · 「화염 투창병」을 소환하세요. 이번 훈련에서는 반드시 가장 왼쪽의 1번 필드에 놓습니다. 소환한 턴에는 특별한 능력이 없는 한 공격할 수 없습니다.',
  '소환을 마쳤습니다. 턴 종료를 눌러 다음 턴으로 진행하세요.',
  '3/6 · 화염 투창병을 선택한 뒤 상대의 「터지지 않은 폭탄쥐」를 공격하세요.',
  '유언 발동! 화염 투창병이 전투 전에 피해 1을 주어 폭탄쥐를 먼저 무덤으로 보냈으므로 일반 전투는 일어나지 않았습니다. 폭탄쥐는 무덤으로 갈 때 유언으로 투창병에게 피해 2를 주었고, 투창병은 체력 2로 생존했습니다. 이번 턴의 공격은 끝났습니다. 턴 종료를 누르세요.',
  '4/6 · 다음 내 턴입니다. 준비된 화염 투창병을 선택하고 상대 라이프를 공격하세요.',
  '각성이란 공격받은 라이프가 손으로 들어올 때, 각성 문구가 있는 카드가 비용 없이 즉시 효과를 발동하는 능력입니다. 일반 카드는 손으로만 가지만 각성 카드는 효과부터 처리합니다. 「성스러운 거울의 벽」은 내 라이프 하나를 추가로 무덤에 보냈습니다. 5/6 · 이제 「화염갈기 대장」으로 1번 필드의 몬스터를 진화시키세요.',
  '6/6 · 진화 몬스터는 소환한 턴에도 공격할 수 있습니다. 몬스터를 선택하고 상대를 직접 공격해 승리하세요.',
]

function setTutorialStep(step: number): void {
  tutorialStep = step
  game = createTutorialView(step)
  roomPhase = 'playing'
  assignedPlayerId = 'P1'
  connectedPlayers = ['P1', 'P2']
  networkStatus = '로컬 튜토리얼'
  awaitingServer = false
  selectedAttackerId = null
  selectedAttackLifeSlotIndices = []
  playDraft = null
  gameNotice = step < TUTORIAL_MESSAGES.length ? TUTORIAL_MESSAGES[step]! : null
}

if (isTutorial) setTutorialStep(0)

interface ManaDrawerScrollState {
  groupScrollTops: number[]
}

function captureManaDrawerScrollState(): ManaDrawerScrollState | null {
  if (!openManaPlayerId) return null
  const grids = appElement.querySelectorAll<HTMLElement>('.mana-drawer__grid')
  if (grids.length === 0) return null
  return {
    groupScrollTops: Array.from(grids, (grid) => grid.scrollTop),
  }
}

function restoreManaDrawerScrollState(state: ManaDrawerScrollState | null): void {
  if (!state) return
  const grids = appElement.querySelectorAll<HTMLElement>('.mana-drawer__grid')
  grids.forEach((grid, index) => {
    grid.scrollTop = state.groupScrollTops[index] ?? 0
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getSelectedDeck() {
  const decks = loadDecks()
  return decks.find((deck) => deck.id === selectedDeckId) ?? getActiveDeck()
}

function submitSelectedDeck(): void {
  const deck = getSelectedDeck()
  const validation = validateDeck(deck.cardIds, deck)
  if (!validation.valid) {
    message = validation.errors.join(' ')
    render()
    return
  }
  if (!isDeckCompatibleWithFormat(
    deck,
    roomSettings.formatId,
    roomSettings.selectedSetIds,
  )) {
    message = `이 방은 ${getFormat(roomSettings.formatId).name} 포맷입니다. 같은 포맷의 덱을 선택해 주세요.`
    render()
    return
  }

  setActiveDeckId(deck.id)
  awaitingServer = true
  sendDeck(socket, {
    schemaVersion: DECK_SCHEMA_VERSION,
    deckId: deck.id,
    name: deck.name,
    cardIds: [...deck.cardIds],
    formatId: deck.formatId,
    selectedSetIds: [...deck.selectedSetIds],
    draftPool: deck.draftPool ? structuredClone(deck.draftPool) : null,
  })
  render()
}

const socket = connectToRoom(
  roomId,
  {
    roomKey,
    getSeatToken: () => seatToken,
    requestedSettings,
  },
  {
    onOpen: () => {
      if (isTutorial) return
      networkStatus = '서버 연결됨'
      render()
    },
    onClose: (event) => {
      if (isTutorial) return
      awaitingServer = false
      if (event.code === 4001) {
        joinRejectedMessage = '같은 자리가 다른 창에서 연결되었습니다.'
      } else if (event.code === 4002) {
        hasLeftRoom = true
        game = null
        assignedPlayerId = null
        window.localStorage.removeItem(seatStorageKey)
      } else if (!joinRejectedMessage && !hasLeftRoom) {
        networkStatus = '연결 끊김 · 재접속 시도 중'
      }
      render()
    },
    onError: () => {
      if (isTutorial) return
      networkStatus = '연결 오류'
      awaitingServer = false
      render()
    },
    onMessage: (serverMessage) => {
      if (isTutorial) return
      switch (serverMessage.type) {
        case 'ASSIGNED_PLAYER':
          seatToken = serverMessage.seatToken
          window.localStorage.setItem(seatStorageKey, seatToken)
          assignedPlayerId = serverMessage.playerId
          networkStatus = serverMessage.reconnected
            ? `${serverMessage.playerId} 재접속`
            : `${serverMessage.playerId} 배정`
          break

        case 'ROOM_STATE':
          roomPhase = serverMessage.phase
          connectedPlayers = serverMessage.connectedPlayers
          reservedPlayers = serverMessage.reservedPlayers
          deckStates = serverMessage.deckStates
          roomSettings = serverMessage.settings
          turnDeadlineAt = serverMessage.turnDeadlineAt
          seatExpiresAt = serverMessage.seatExpiresAt
          awaitingServer = false
          if (
            roomPhase === 'waiting'
            && assignedPlayerId
            && roomSettings.formatId !== 'draft-v1'
            && !deckStates[assignedPlayerId].submitted
          ) {
            const compatibleDeck = loadDecks().find((deck) =>
              isDeckCompatibleWithFormat(
                deck,
                roomSettings.formatId,
                roomSettings.selectedSetIds,
              ),
            )
            if (compatibleDeck) selectedDeckId = compatibleDeck.id
            queueMicrotask(submitSelectedDeck)
          }
          break

        case 'DRAFT_STATE':
          draftView = serverMessage.draft
          roomPhase = 'drafting'
          awaitingServer = false
          message = draftView.confirmed
            ? '덱을 확정했습니다. 상대의 선택을 기다립니다.'
            : `${draftView.poolSize}장 중 ${draftView.deckSize}장을 선택하세요.`
          break

        case 'DECK_ACCEPTED':
          awaitingServer = false
          message = `${serverMessage.deckName} 덱을 제출했습니다. 준비 완료 버튼을 눌러 확정해 주세요.`
          break

        case 'GAME_VIEW':
          game = serverMessage.game
          matchLog = serverMessage.actionLog
          {
            const nextTurnKey = `${game.turnNumber}:${game.currentPlayer}`
            if (
              nextTurnKey !== lastObservedTurnKey
              && game.status === 'playing'
              && game.currentPlayer === game.viewer
            ) {
              turnAnnouncementKey = nextTurnKey
              if (turnAnnouncementTimer !== null) window.clearTimeout(turnAnnouncementTimer)
              turnAnnouncementTimer = window.setTimeout(() => {
                if (turnAnnouncementKey === nextTurnKey) {
                  turnAnnouncementKey = null
                  render()
                }
              }, 1500)
            }
            lastObservedTurnKey = nextTurnKey
          }
          draftView = null
          assignedPlayerId ??= game.viewer
          selectedAttackerId = null
          selectedAttackLifeSlotIndices = []
          playDraft = null
          summonFromManaDraftId = null
          openManaPlayerId = null
          pendingChoiceIds = []
          awaitingServer = false
          message = game.status === 'finished'
            ? game.winner === game.viewer ? '승리!' : '패배...'
            : game.pendingChoice
              ? game.pendingChoice.playerId === game.viewer
                ? '각성 또는 카드 효과를 선택해야 합니다.'
                : `${game.pendingChoice.playerId}이(가) 카드 효과를 선택하고 있습니다.`
              : game.currentPlayer === game.viewer
                ? '내 턴입니다.'
                : '상대 턴입니다.'
          gameNotice = null
          break

        case 'ACTION_ERROR':
          awaitingServer = false
          message = serverMessage.message
          break

        case 'TURN_TIMED_OUT':
          awaitingServer = false
          message = `${serverMessage.playerId}의 제한 시간이 끝나 턴이 넘어갔습니다.`
          break

        case 'SEAT_EXPIRED':
          message = `${serverMessage.playerId}의 자리가 만료되었습니다.`
          break

        case 'LEFT_ROOM':
          hasLeftRoom = true
          game = null
          assignedPlayerId = null
          window.localStorage.removeItem(seatStorageKey)
          openDiscardPlayerId = null
          openManaPlayerId = null
          pinnedPreviewCardId = null
          pinnedPreviewInstanceId = null
          roomMenuOpen = false
          rulebookOpen = false
          matchLogOpen = false
          socket.close()
          break

        case 'GAME_CLEARED':
          game = null
          draftView = null
          selectedAttackerId = null
          selectedAttackLifeSlotIndices = []
          playDraft = null
          summonFromManaDraftId = null
          pendingChoiceIds = []
          openDiscardPlayerId = null
          openManaPlayerId = null
          pinnedPreviewCardId = null
          pinnedPreviewInstanceId = null
          roomMenuOpen = false
          rulebookOpen = false
          matchLogOpen = false
          matchLog = []
          lastObservedTurnKey = null
          turnAnnouncementKey = null
          message = '방으로 돌아왔습니다. 덱을 선택한 뒤 준비 완료를 눌러 주세요.'
          break

        case 'REMATCH_REQUESTED':
          gameNotice = `${serverMessage.playerId} 플레이어가 재대전을 요청했습니다. 덱을 변경한 뒤 다시 준비해 주세요.`
          break

        case 'JOIN_REJECTED':
          joinRejectedMessage = serverMessage.message
          networkStatus = serverMessage.message
          socket.close()
          break
      }
      render()
    },
  },
)

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function updateClock(): void {
  const timer = document.querySelector<HTMLElement>('#turn-timer')
  if (timer) {
    if (roomSettings.turnLimitSeconds === null) timer.textContent = '∞'
    else if (turnDeadlineAt === null) {
      timer.textContent = roomPhase === 'disconnected'
        ? '일시 정지'
        : `${roomSettings.turnLimitSeconds}초`
    } else timer.textContent = formatDuration(turnDeadlineAt - Date.now())
  }

  const draftTimer = document.querySelector<HTMLElement>('#draft-timer')
  if (draftTimer && draftView) {
    draftTimer.textContent = formatDuration(draftView.deadlineAt - Date.now())
    draftTimer.classList.toggle(
      'is-urgent',
      draftView.deadlineAt - Date.now() <= 30_000,
    )
  }

  for (const playerId of ['P1', 'P2'] as const) {
    const element = document.querySelector<HTMLElement>(`#seat-expiry-${playerId}`)
    const expiry = seatExpiresAt[playerId]
    if (element) {
      element.textContent = expiry === null
        ? ''
        : `${formatDuration(expiry - Date.now())} 후 만료`
    }
  }
}

function actionButton(
  label: string,
  action: string,
  valueName?: string,
  value?: string,
  disabled = false,
): string {
  const tone = action.startsWith('confirm-') || action === 'attack-unit'
    ? 'primary'
    : action.startsWith('cancel-') || action.startsWith('close-')
      ? 'secondary'
      : 'choice'
  return `<button type="button" class="action-button action-button--${tone}" data-action="${action}" ${valueName && value !== undefined ? `data-${valueName}="${escapeHtml(value)}"` : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>`
}

function effectiveCost(card: CardInstance): number {
  const definition = CARDS[card.cardId]
  const self = game?.players[game.viewer]
  const isInCurrentHand = self?.hand.some((candidate) => candidate.instanceId === card.instanceId) ?? false
  if (
    card.cardId === 'coffin_warrior'
    && isInCurrentHand
    && (self?.darkCardsDiscardedThisTurn ?? 0) >= 2
  ) return 0
  return Math.max(0, definition.cost - (card.costReduction ?? 0))
}

function findVisibleCardInstance(instanceId: string | null): CardInstance | undefined {
  if (!game || !instanceId) return undefined

  for (const player of Object.values(game.players)) {
    const card = [
      ...player.hand,
      ...player.mana,
      ...player.field,
      ...player.discard,
    ].find((candidate) => candidate.instanceId === instanceId)
    if (card) return card
  }
  return undefined
}

function findVisibleUnitView(instanceId: string | null): { player: PlayerView; unit: UnitInstance } | undefined {
  if (!game || !instanceId) return undefined

  for (const player of Object.values(game.players)) {
    const unit = player.field.find((candidate) => candidate.instanceId === instanceId)
    if (unit) return { player, unit }
  }

  return undefined
}

function unitTargetMode(cardId: CardId): 'any' | 'exhausted' | 'highest-health' | null {
  if (cardId === 'desertification') return 'any'
  if (cardId === 'ebb' || cardId === 'reverse_current') return 'exhausted'
  if (cardId === 'demon_breath') return 'highest-health'
  if (cardId === 'lava_gardener' || cardId === 'crematory_smoke') return 'any'
  return null
}

function needsLifeTarget(cardId: CardId): boolean {
  return cardId === 'holy_mirror_wall'
}

function hasRushView(unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  return definition.type === 'unit'
    && (definition.keywords?.includes('rush') || unit.temporaryRush === true)
}

function hasChargeView(player: PlayerView, unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return false
  if (definition.keywords?.includes('charge') || unit.temporaryCharge === true) return true
  return unit.cardId === 'last_ember' && player.field.length === 1
}

function isEffectivelyExhaustedView(player: PlayerView, unit: UnitInstance): boolean {
  if (unit.exhausted) return true
  return unit.summonedThisTurn
    && !unit.evolvedThisTurn
    && !hasRushView(unit)
    && !hasChargeView(player, unit)
}

function hasWindfuryView(_player: PlayerView, unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  return definition.type === 'unit' && definition.keywords?.includes('windfury') === true
}

function hasFlyingView(player: PlayerView, unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return false
  if (definition.keywords?.includes('flying') || unit.temporaryFlying === true) return true
  return unit.cardId === 'carrion_crow' && player.field.length === 1
}

function hasStealthView(player: PlayerView, unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return false
  if (definition.keywords?.includes('stealth')) return true
  if (unit.cardId === 'corpse_cat' && player.field.length > 1) return true
  return unit.cardId === 'funeral_inviter' && player.discard.length >= 4
}

function hasAssassinationView(player: PlayerView, unit: UnitInstance): boolean {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return false
  if (definition.keywords?.includes('assassination')) return true
  return unit.cardId === 'nameless_shadow' && player.discard.length >= 3
}

function attackValueView(player: PlayerView, unit: UnitInstance): number {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return 0
  return definition.attack
    + (unit.attackModifier ?? 0)
    + unit.temporaryAttackModifier
    + (
      unit.cardId === 'hard_seed_bug'
      && player.mana.filter((mana) => CARDS[mana.cardId].attributes.includes('earth')).length >= 5
        ? 1
        : 0
    )
    + (unit.cardId === 'salvation_lancer' && player.lifeCount <= 2 ? 1 : 0)
}

function attackingUnitValueView(
  player: PlayerView,
  unit: UnitInstance,
  targetKind: 'unit' | 'player',
): number {
  return attackValueView(player, unit)
    + (unit.cardId === 'living_smoke' ? 2 : 0)
    + (unit.cardId === 'spark_chasing_lizard' ? 3 : 0)
    + (unit.cardId === 'cliff_hunter' && targetKind === 'unit' ? 2 : 0)
}

function healthValueView(player: PlayerView, unit: UnitInstance): number {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return 0
  return definition.health
    + unit.temporaryHealthModifier
    + (
      unit.cardId === 'hard_seed_bug'
      && player.mana.filter((mana) => CARDS[mana.cardId].attributes.includes('earth')).length >= 5
        ? 1
        : 0
    )
}

function battlefieldAttackLimitView(): number {
  if (!game) return Number.POSITIVE_INFINITY
  const units = game.players.P1.field.concat(game.players.P2.field)
  if (units.some((unit) => unit.cardId === 'apostle_pigeon')) return 1
  if (units.some((unit) => unit.cardId === 'spirit_agent')) return 2
  return Number.POSITIVE_INFINITY
}

function cannotDirectAttackView(unit: UnitInstance): boolean {
  return ['blue_black_hound', 'iron_horn_boar', 'weakened_giant']
    .includes(unit.cardId)
}

function canUnitAttackView(
  player: PlayerView,
  unit: UnitInstance,
  targetKind: 'unit' | 'player',
): boolean {
  if (unit.cardId === 'silent_shield_soldier' || unit.cardId === 'boulder_carrier') return false
  if (unit.exhausted) return false
  if (targetKind === 'player' && cannotDirectAttackView(unit)) return false
  if (
    unit.summonedThisTurn
    && !unit.evolvedThisTurn
    && !hasRushView(unit)
    && !(targetKind === 'unit' && hasChargeView(player, unit))
  ) return false
  const maxAttacks = hasWindfuryView(player, unit) ? 2 : 1
  if (unit.attacksThisTurn >= maxAttacks) return false
  if (player.attacksThisTurn >= battlefieldAttackLimitView()) return false
  return true
}

function selectedPlayCard(): CardInstance | null {
  if (!game || !playDraft) return null
  return game.players[game.viewer].hand.find(
    (card) => card.instanceId === playDraft?.cardInstanceId,
  ) ?? null
}

function selectedPaidAttributes(): Set<string> {
  if (!game || !playDraft) return new Set()
  const self = game.players[game.viewer]
  return new Set(self.mana.flatMap((mana) => CARDS[mana.cardId].attributes))
}

function playDraftNeedsUnitTarget(card: CardInstance): boolean {
  if (!game || !playDraft) return false
  const enemyId: PlayerId = game.viewer === 'P1' ? 'P2' : 'P1'
  const enemy = game.players[enemyId]
  if (['desertification', 'ebb', 'reverse_current', 'demon_breath'].includes(card.cardId)) return true
  const attributes = selectedPaidAttributes()
  if (card.cardId === 'lava_gardener') return attributes.has('fire') && enemy.field.length > 0
  if (card.cardId === 'crematory_smoke') return attributes.has('fire') && !attributes.has('dark') && enemy.field.length > 0
  return false
}

function playDraftNeedsEffectMana(card: CardInstance): boolean {
  if (!game || !playDraft) return false
  const self = game.players[game.viewer]
  if (card.cardId === 'grave_digging' || card.cardId === 'rising_earth') return true
  if (card.cardId === 'lava_gardener' && selectedPaidAttributes().has('earth')) {
    return self.mana.some((mana) => mana.exhausted || playDraft!.manaIds.includes(mana.instanceId))
  }
  return false
}

function canAttackUnitView(
  attackerPlayer: PlayerView,
  attacker: UnitInstance,
  defenderPlayer: PlayerView,
  defender: UnitInstance,
  ignoreSkyKnight = false,
): boolean {
  if (hasStealthView(defenderPlayer, defender)) return false
  if (defender.cardId === 'scale_diver' && attackingUnitValueView(attackerPlayer, attacker, 'unit') >= 3) return false
  if (defender.cardId === 'little_judge' && CARDS[attacker.cardId].cost <= 1) return false
  if (!ignoreSkyKnight && defender.cardId !== 'sky_white_horse_knight') {
    const sky = defenderPlayer.field.some((unit) => unit.cardId === 'sky_white_horse_knight'
      && canAttackUnitView(attackerPlayer, attacker, defenderPlayer, unit, true))
    if (sky) return false
  }
  return true
}

function canSelectedAttackerDirectAttack(opponentPlayer: PlayerView): boolean {
  if (!game || !selectedAttackerId) return false
  const self = game.players[game.viewer]
  const attacker = self.field.find((unit) => unit.instanceId === selectedAttackerId)
  if (!attacker || !canUnitAttackView(self, attacker, 'player')) return false
  if (
    opponentPlayer.field.some((unit) => unit.cardId === 'cathedral_guard' && !unit.exhausted)
    && CARDS[attacker.cardId].cost <= 1
  ) return false
  const attackableSky = opponentPlayer.field.some((unit) => unit.cardId === 'sky_white_horse_knight'
    && canAttackUnitView(self, attacker, opponentPlayer, unit, true))
  if (attackableSky) return false
  const attackableEnemy = opponentPlayer.field.some(
    (unit) => canAttackUnitView(self, attacker, opponentPlayer, unit),
  )
  return hasFlyingView(self, attacker) || !attackableEnemy
}

function requiredAttackLifeCount(opponentPlayer: PlayerView): number {
  if (!game || !selectedAttackerId) return 0
  const self = game.players[game.viewer]
  const attacker = self.field.find((unit) => unit.instanceId === selectedAttackerId)
  if (!attacker) return 0
  return Math.min(self.extraLifeLossOnDirectAttack ? 2 : 1, opponentPlayer.lifeCount)
}

function renderCardBacks(count: number, className: string): string {
  return Array.from({ length: count }, () => renderCardBack([className])).join('')
}

function getOpenFieldSlotsView(player: PlayerView): number[] {
  const occupied = new Set(player.field.map((unit) => unit.slotIndex))
  const fieldSlots = currentFieldLimit()
  return Array.from({ length: fieldSlots }, (_, index) => index)
    .filter((index) => !occupied.has(index))
}

function currentFieldLimit(): number {
  return game ? getFormat(game.matchConfig.formatId).fieldSlots : 4
}

function isSlotSelectionActive(isSelf: boolean): boolean {
  if (!game || !isSelf) return false
  const draftCard = selectedPlayCard()
  if (draftCard) {
    const definition = CARDS[draftCard.cardId]
    if (definition.type === 'unit' && !definition.evolutionAttribute) return true
    if (draftCard.cardId === 'rising_earth') return true
  }
  if (summonFromManaDraftId) return true
  return game.pendingChoice?.playerId === game.viewer
    && game.pendingChoice.type === 'AWAKEN_SUMMON_SLOT'
}

function renderLife(playerId: PlayerId, owner: 'self' | 'opponent'): string {
  if (!game) return ''
  const player = game.players[playerId]
  const pending = game.pendingChoice
  const canAttackLife = owner === 'opponent'
    && pending === null
    && playDraft === null
    && canSelectedAttackerDirectAttack(player)

  const lifeSlotIndices = player.lifeSlotIndices
    ?? Array.from({ length: player.lifeCount }, (_, index) => index)
  const lifeIndexBySlot = new Map<number, number>()
  lifeSlotIndices.forEach((slotIndex, lifeIndex) => {
    lifeIndexBySlot.set(slotIndex, lifeIndex)
  })
  const highestOccupiedSlot = lifeSlotIndices.length > 0
    ? Math.max(...lifeSlotIndices) + 1
    : 0
  const visibleSlots = Math.max(LIFE_SIZE, highestOccupiedSlot)

  return Array.from({ length: visibleSlots }, (_, slotIndex) => {
    const lifeIndex = lifeIndexBySlot.get(slotIndex)
    if (lifeIndex === undefined) {
      return `<div class="life-card-frame is-empty" aria-hidden="true"><div class="life-slot is-empty"></div></div>`
    }

    let action: string | null = null
    let selected = false
    if (playDraft && owner === 'opponent' && needsLifeTarget(selectedPlayCard()?.cardId ?? 'living_flame')) {
      action = 'select-spell-life'
      selected = playDraft.lifeIndex === lifeIndex
    } else if (canAttackLife) {
      action = 'select-attack-life'
      selected = selectedAttackLifeSlotIndices.includes(slotIndex)
    }

    const directAttackTarget = action === 'select-attack-life'
    const cardBack = renderCardBack([
      'life-card',
      `life-card--${owner}`,
      action ? 'is-targetable' : '',
      directAttackTarget ? 'is-direct-attack-target' : '',
      selected ? 'is-selected' : '',
    ].filter(Boolean))
    const content = action
      ? `<button type="button" class="life-choice-button" data-action="${action}" data-life-index="${lifeIndex}" data-life-slot="${slotIndex}">${cardBack}</button>`
      : cardBack
    const frameClasses = [
      'life-card-frame',
      action ? 'is-targetable' : '',
      directAttackTarget ? 'is-direct-attack-target' : '',
      selected ? 'is-selected' : '',
    ].filter(Boolean).join(' ')
    return `<div class="${frameClasses}" data-life-slot="${slotIndex}" aria-label="라이프 카드"><div class="life-card-rotator">${content}</div></div>`
  }).join('')
}

type ManaDisplayMode = 'rail' | 'drawer'

type ManaCardView = PlayerView['mana'][number]

interface ManaAbilityPresentation {
  title: string
  description: string
  status: string
  actionLabel: string
  action: 'begin-summon-from-mana' | 'cancel-summon-from-mana'
  enabled: boolean
  active: boolean
}

function canTakeNormalAction(isSelf: boolean): boolean {
  return Boolean(
    game
    && isSelf
    && game.viewer === game.currentPlayer
    && game.status === 'playing'
    && roomPhase === 'playing'
    && game.pendingChoice === null
    && playDraft === null
    && summonFromManaDraftId === null
    && !awaitingServer,
  )
}

function getManaAbilityPresentation(
  player: PlayerView,
  mana: ManaCardView,
  isSelf: boolean,
): ManaAbilityPresentation | null {
  if (mana.cardId !== 'heavy_seed') return null

  const earthMana = player.mana.filter((candidate) =>
    CARDS[candidate.cardId].attributes.includes('earth'),
  ).length
  const openSlots = getOpenFieldSlotsView(player).length
  const active = summonFromManaDraftId === mana.instanceId
  const requirementsMet = earthMana >= 4 && openSlots > 0
  const canAct = canTakeNormalAction(isSelf)
  const status = earthMana < 4
    ? `땅 마나 ${earthMana}/4`
    : openSlots < 1
      ? '빈 전장 슬롯 없음'
      : '발동 가능'

  return {
    title: CARDS[mana.cardId].name,
    description: '마나에서 자신의 전장으로 소환합니다.',
    status: active ? '소환 위치 선택 중' : status,
    actionLabel: active ? '선택 취소' : '마나에서 소환',
    action: active ? 'cancel-summon-from-mana' : 'begin-summon-from-mana',
    enabled: active || (canAct && requirementsMet),
    active,
  }
}

function renderManaAbilityButtons(player: PlayerView, isSelf: boolean): string {
  if (!isSelf) return ''

  const abilityCards = player.mana.flatMap((mana) => {
    const presentation = getManaAbilityPresentation(player, mana, isSelf)
    return presentation ? [{ mana, presentation }] : []
  })
  if (abilityCards.length === 0) return ''

  return `<div class="mana-ability-list" aria-label="마나에서 발동하는 능력">
    ${abilityCards.map(({ mana, presentation }) => `<button
      type="button"
      class="mana-ability-button ${presentation.enabled ? 'is-ready' : ''} ${presentation.active ? 'is-active' : ''}"
      title="${escapeHtml(presentation.description)}"
      data-action="${presentation.action}"
      ${presentation.action === 'begin-summon-from-mana' ? `data-mana-id="${escapeHtml(mana.instanceId)}"` : ''}
      ${presentation.enabled ? '' : 'disabled'}
    >
      <span class="mana-ability-button__mark" aria-hidden="true">◆</span>
      <span class="mana-ability-button__copy">
        <strong>${escapeHtml(presentation.title)}</strong>
        <small>${escapeHtml(presentation.status)}</small>
      </span>
      <span class="mana-ability-button__action">${escapeHtml(presentation.actionLabel)}</span>
    </button>`).join('')}
  </div>`
}

function renderMana(
  player: PlayerView,
  isSelf: boolean,
  mode: ManaDisplayMode = 'rail',
  manaCards: ManaCardView[] = player.mana,
): string {
  if (!game) return ''
  const expanded = mode === 'drawer'

  return manaCards.map((mana) => {
    const selectedAsCost = playDraft?.manaIds.includes(mana.instanceId) ?? false
    const selectedAsEffect = playDraft?.effectManaId === mana.instanceId
    const selectedForSummon = summonFromManaDraftId === mana.instanceId
    const ability = getManaAbilityPresentation(player, mana, isSelf)
    const actions: string[] = []
    const draftCard = isSelf && playDraft ? selectedPlayCard() : null
    const definition = CARDS[mana.cardId]
    const canSelectForGrave = draftCard?.cardId === 'grave_digging' && !mana.exhausted && !selectedAsCost
    const canSelectForRising = draftCard?.cardId === 'rising_earth'
      && definition.type === 'unit'
      && definition.cost <= 5
      && !definition.evolutionAttribute
      && meetsSummonConditionView(player, mana.cardId)
      && !selectedAsCost
    const canSelectForGardener = draftCard?.cardId === 'lava_gardener'
      && selectedPaidAttributes().has('earth')
      && Boolean(mana)
    const canSelectAsEffect = canSelectForGrave || canSelectForRising || canSelectForGardener || selectedAsEffect
    const manaSelectionAction = isSelf && playDraft
      ? canSelectAsEffect ? 'select-effect-mana' : null
      : null

    if (!playDraft && expanded && ability) {
      actions.push(actionButton(
        ability.actionLabel,
        ability.action,
        ability.action === 'begin-summon-from-mana' ? 'mana-id' : undefined,
        ability.action === 'begin-summon-from-mana' ? mana.instanceId : undefined,
        !ability.enabled,
      ))
    } else if (selectedForSummon) {
      actions.push(actionButton('취소', 'cancel-summon-from-mana'))
    }

    const cardMarkup = renderCard(mana.cardId, {
      instanceId: mana.instanceId,
      compact: !expanded,
      nameOnly: !expanded,
      exhausted: mana.exhausted,
      selected: selectedAsCost || selectedAsEffect || selectedForSummon,
      targetable: manaSelectionAction !== null,
      displayCost: effectiveCost(mana),
      classNames: [
        'mana-card',
        expanded ? 'mana-card--expanded' : 'mana-card--rail',
        expanded ? 'hand-card' : '',
        expanded ? 'game-card--center-name' : '',
        ability ? 'has-mana-ability' : '',
        ability?.enabled ? 'has-ready-mana-ability' : '',
      ].filter(Boolean),
      actionsHtml: expanded ? '' : actions.join(''),
      dataAttributes: {
        ...(manaSelectionAction ? {
          action: manaSelectionAction,
          'mana-id': mana.instanceId,
          'card-selectable': 'true',
          role: 'button',
          tabindex: '0',
          'aria-label': selectedAsCost || selectedAsEffect
            ? `${definition.name} 선택 해제`
            : `${definition.name} ${manaSelectionAction === 'select-effect-mana' ? '효과 대상으로 선택' : '비용으로 선택'}`,
        } : {}),
        'mana-attribute': CARDS[mana.cardId].attributes
          .map((attributeId) => CARD_ATTRIBUTES[attributeId].shortName)
          .join('·'),
        ...(ability ? { 'mana-ability': ability.status } : {}),
      },
    })

    if (!expanded) return cardMarkup

    return `<div class="mana-card-control">
      ${cardMarkup}
      ${actions.length > 0 ? `<div class="mana-card-control__actions">${actions.join('')}</div>` : ''}
    </div>`
  }).join('') || '<div class="zone-empty">마나 없음</div>'
}

function meetsSummonConditionView(player: PlayerView, cardId: CardId): boolean {
  if (cardId !== 'volcano_mouse') return true
  return player.mana.filter((mana) => CARDS[mana.cardId].attributes.includes('fire')).length >= 2
}

function isPlayDraftReady(): boolean {
  if (!game || !playDraft) return false
  const card = selectedPlayCard()
  if (!card) return false
  const definition = CARDS[card.cardId]
  if (!meetsSummonConditionView(game.players[game.viewer], card.cardId)) return false
  if (game.players[game.viewer].mana.filter((mana) => !mana.exhausted).length < effectiveCost(card)) return false
  if (definition.type === 'unit') {
    if (definition.evolutionAttribute) {
      if (!playDraft.evolutionUnitId) return false
    } else if (playDraft.fieldSlot === undefined) return false
  }
  if (card.cardId === 'rising_earth') {
    if (playDraft.fieldSlot === undefined) return false
    const effectManaId = playDraft.effectManaId
    const selectedMana = game.players[game.viewer].mana.find((mana) => mana.instanceId === effectManaId)
    if (!selectedMana || !meetsSummonConditionView(game.players[game.viewer], selectedMana.cardId)) return false
  }
  if (playDraftNeedsUnitTarget(card) && !playDraft.unitId) return false
  if (needsLifeTarget(card.cardId) && playDraft.lifeIndex === undefined) return false
  if (playDraftNeedsEffectMana(card) && !playDraft.effectManaId) return false
  return true
}

function renderManaSelectionToolbar(): string {
  if (!playDraft) return ''
  const card = selectedPlayCard()
  if (!card) return ''
  const definition = CARDS[card.cardId]
  const cost = effectiveCost(card)
  const ready = isPlayDraftReady()
  return `<div class="mana-selection-toolbar ${ready ? 'is-ready' : ''}" aria-live="polite">
    <div class="mana-selection-toolbar__copy">
      <span>사용할 카드</span>
      <strong>${escapeHtml(definition.name)}</strong>
    </div>
    <div class="mana-selection-toolbar__progress">
      <span>비용 마나</span>
      <strong>자동 ${cost}</strong>
    </div>
    <div class="mana-selection-toolbar__hint">${ready ? '비용 마나는 자동으로 소진됩니다.' : '필요한 대상만 선택하세요. 비용 마나는 자동으로 소진됩니다.'}</div>
    <div class="mana-selection-toolbar__actions">
      ${actionButton(ready ? '이 카드 사용' : '선택을 완료하세요', 'confirm-play-card', undefined, undefined, !ready)}
      ${actionButton('사용 취소', 'cancel-play-card')}
    </div>
  </div>`
}

function renderManaDrawer(): string {
  if (!game || !openManaPlayerId) return ''
  const player = game.players[openManaPlayerId]
  const isSelf = player.isViewer
  const readyMana = player.mana.filter((mana) => !mana.exhausted)
  const exhaustedMana = player.mana.filter((mana) => mana.exhausted)
  const title = isSelf ? '내 마나' : '상대 마나'

  return `<div class="modal-backdrop mana-drawer-backdrop" data-modal="mana-drawer">
    <section class="mana-drawer" role="dialog" aria-modal="true" aria-labelledby="mana-drawer-title">
      <header class="mana-drawer__header">
        <div>
          <p class="eyebrow">MANA ZONE</p>
          <h2 id="mana-drawer-title">${title}</h2>
          <p>카드를 직접 선택해 비용을 지불하거나, 마나에서 발동하는 능력을 사용합니다.</p>
        </div>
        <button type="button" data-action="close-mana-drawer" aria-label="마나 닫기">닫기</button>
      </header>
      <div class="mana-drawer__commands">
        ${isSelf ? renderManaSelectionToolbar() : ''}
        ${isSelf ? renderManaAbilityButtons(player, true) : ''}
      </div>
      <div class="mana-drawer__body">
        <section class="mana-drawer__group">
          <header><strong>준비</strong><span>${readyMana.length}</span></header>
          <div class="mana-drawer__grid">${renderMana(player, isSelf, 'drawer', readyMana)}</div>
        </section>
        <section class="mana-drawer__group is-exhausted-group">
          <header><strong>소진</strong><span>${exhaustedMana.length}</span></header>
          <div class="mana-drawer__grid">${renderMana(player, isSelf, 'drawer', exhaustedMana)}</div>
        </section>
      </div>
      <footer class="mana-drawer__footer">
        <span>${playDraft ? '비용 마나는 자동으로 소진됩니다. 카드 효과가 요구하는 대상만 선택하세요.' : '발동 가능한 마나 능력은 항상 위쪽에 표시됩니다.'}</span>
        <div class="mana-drawer__footer-actions">
          ${playDraft ? actionButton(isPlayDraftReady() ? '이 카드 사용' : '선택 미완료', 'confirm-play-card', undefined, undefined, !isPlayDraftReady()) : ''}
          <button type="button" class="action-button action-button--secondary" data-action="close-mana-drawer">전장으로 돌아가기</button>
        </div>
      </footer>
    </section>
  </div>`
}

function hasLegalPlayTarget(card: CardInstance, self: PlayerView, enemy: PlayerView): boolean {
  const definition = CARDS[card.cardId]
  if (!meetsSummonConditionView(self, card.cardId)) return false
  const targetMode = unitTargetMode(card.cardId)
  if (targetMode !== null && !['lava_gardener', 'crematory_smoke'].includes(card.cardId) && enemy.field.length === 0) return false
  if (
    targetMode === 'exhausted'
    && !enemy.field.some((unit) => isEffectivelyExhaustedView(enemy, unit))
  ) return false
  if (needsLifeTarget(card.cardId) && enemy.lifeCount === 0) return false
  if (card.cardId === 'grave_digging'
    && self.mana.filter((mana) => !mana.exhausted).length < effectiveCost(card) + 1) return false
  if (card.cardId === 'rising_earth') {
    const validMana = self.mana.some((mana) => {
      const manaDefinition = CARDS[mana.cardId]
      return manaDefinition.type === 'unit'
        && manaDefinition.cost <= 5
        && !manaDefinition.evolutionAttribute
        && meetsSummonConditionView(self, mana.cardId)
    })
    if (!validMana || getOpenFieldSlotsView(self).length === 0) return false
  }
  if (card.cardId === 'last_prayer' && self.lifeCount > 2) return false
  if (definition.type === 'unit' && definition.evolutionAttribute) {
    return self.field.some((unit) => CARDS[unit.cardId].attributes.includes(definition.evolutionAttribute!))
  }
  return true
}

function renderHand(player: PlayerView, isSelf: boolean): string {
  if (!isSelf) return renderCardBacks(player.handCount, 'hand-card hand-card--hidden')
  if (!game) return ''
  const currentGame = game

  const enemyId: PlayerId = currentGame.viewer === 'P1' ? 'P2' : 'P1'
  const enemy = currentGame.players[enemyId]
  const isMyTurn = currentGame.viewer === currentGame.currentPlayer
  const readyMana = player.mana.filter((mana) => !mana.exhausted).length
  const pending = currentGame.pendingChoice

  return player.hand.map((card) => {
    const definition = CARDS[card.cardId]
    const selected = playDraft?.cardInstanceId === card.instanceId
    const canAct = currentGame.status === 'playing'
      && roomPhase === 'playing'
      && isMyTurn
      && !awaitingServer
      && pending === null
      && playDraft === null
    const actions: string[] = []

    if (pending?.playerId === currentGame.viewer && pending.type === 'TEMPLE_PROSPECT_HAND') {
      actions.push(actionButton('라이프로', 'resolve-hand-choice', 'card-instance-id', card.instanceId))
    } else if (pending?.playerId === currentGame.viewer && pending.type === 'DEMON_FINGER_DISCARD') {
      actions.push(actionButton('묘지로', 'resolve-hand-discard-choice', 'card-instance-id', card.instanceId))
    } else if (canAct) {
      actions.push(actionButton(
        '마나',
        'place-mana',
        'card-instance-id',
        card.instanceId,
        player.manaPlacedThisTurn,
      ))
      actions.push(actionButton(
        definition.type === 'unit' ? '소환' : '사용',
        'begin-play-card',
        'card-instance-id',
        card.instanceId,
        readyMana < effectiveCost(card)
          || (player.burningProcessionActive && definition.cost > 2)
          || (
            definition.type === 'unit'
            && !definition.evolutionAttribute
            && player.field.length >= currentFieldLimit()
          )
          || !hasLegalPlayTarget(card, player, enemy),
      ))
    }

    return renderCard(card.cardId, {
      instanceId: card.instanceId,
      selected,
      displayCost: effectiveCost(card),
      classNames: ['hand-card', 'game-card--center-name'],
      actionsHtml: actions.join(''),
    })
  }).join('') || '<div class="zone-empty">손이 비었습니다.</div>'
}

function getUnitStatusBadges(
  player: PlayerView,
  unit: UnitInstance,
): Array<{ label: string; tone?: 'active' | 'inactive' | 'warning'; keyword?: string }> {
  const definition = CARDS[unit.cardId]
  if (definition.type !== 'unit') return []

  const badges: Array<{ label: string; tone?: 'active' | 'inactive' | 'warning'; keyword?: string }> = []
  const isolated = player.field.length === 1

  if ((unit.evolutionStack?.length ?? 0) > 0) badges.push({ label: `진화 ${unit.evolutionStack!.length}`, tone: 'warning' })
  if (unit.skipNextReady) badges.push({ label: '다음 준비 안 됨', tone: 'inactive' })
  if (unit.cardId === 'last_ember' || unit.cardId === 'carrion_crow') {
    badges.push({
      label: isolated ? '고립' : '고립 해제',
      tone: isolated ? 'active' : 'inactive',
    })
  }
  if (unit.cardId === 'living_smoke') badges.push({ label: '전투 공격 +2' })
  if (unit.cardId === 'spark_chasing_lizard') badges.push({ label: '공격 중 +3' })
  if (unit.cardId === 'cliff_hunter') badges.push({ label: '대 몬스터 +2' })
  if (unit.cardId === 'hard_seed_bug' && healthValueView(player, unit) > (CARDS[unit.cardId] as any).health) badges.push({ label: '+1/+1', tone: 'warning' })
  if (unit.cardId === 'salvation_lancer' && player.lifeCount <= 2) badges.push({ label: '공격 +1', tone: 'warning' })
  if (hasRushView(unit)) badges.push({ label: '기습', keyword: 'rush' })
  if (hasChargeView(player, unit)) badges.push({ label: '돌진', tone: 'warning', keyword: 'charge' })
  if (hasWindfuryView(player, unit)) badges.push({ label: '질풍', keyword: 'windfury' })
  if (hasFlyingView(player, unit)) badges.push({ label: '비행', keyword: 'flying' })
  if (hasStealthView(player, unit)) badges.push({ label: '잠행', keyword: 'stealth' })
  if (definition.keywords?.includes('last_words')) badges.push({ label: '유언', keyword: 'last-words' })
  if (unit.cardId === 'nameless_shadow') {
    const discardCount = Math.min(3, player.discard.length)
    badges.push({
      label: discardCount >= 3 ? '암살' : `암살 ${discardCount}/3`,
      tone: discardCount >= 3 ? 'warning' : 'inactive',
      keyword: discardCount >= 3 ? 'assassination' : undefined,
    })
  } else if (hasAssassinationView(player, unit)) badges.push({ label: '암살', tone: 'warning', keyword: 'assassination' })
  return badges
}

function renderField(player: PlayerView, isSelf: boolean): string {
  if (!game) return ''
  const currentGame = game
  const isMyTurn = currentGame.viewer === currentGame.currentPlayer
  const draftCard = selectedPlayCard()
  const targetMode = draftCard ? unitTargetMode(draftCard.cardId) : null
  const opponentId: PlayerId = currentGame.viewer === 'P1' ? 'P2' : 'P1'
  const opponentPlayer = currentGame.players[opponentId]
  const selectedAttacker = currentGame.players[currentGame.viewer].field.find(
    (candidate) => candidate.instanceId === selectedAttackerId,
  )
  const unitsBySlot = new Map(player.field.map((unit) => [unit.slotIndex, unit]))
  const slotSelectionActive = isSlotSelectionActive(isSelf)
  const maxRemainingHealth = Math.max(...player.field.map((candidate) => (
    healthValueView(player, candidate) - candidate.damage
  )), -1)

  return Array.from(
    { length: currentFieldLimit() },
    (_, slotIndex) => {
    const unit = unitsBySlot.get(slotIndex)
    if (!unit) {
      if (slotSelectionActive) {
        if (isTutorial && slotIndex !== 0) {
          return `<div class="field-slot is-empty" data-field-slot="${slotIndex}"></div>`
        }
        const selected = playDraft?.fieldSlot === slotIndex
        return `<button type="button" class="field-slot field-slot--selectable is-empty ${selected ? 'is-selected' : ''}" data-action="select-summon-slot" data-field-slot="${slotIndex}"><strong>${selected ? '선택됨' : '여기에 소환'}</strong></button>`
      }
      return `<div class="field-slot is-empty" data-field-slot="${slotIndex}"></div>`
    }

    const definition = CARDS[unit.cardId]
    if (definition.type !== 'unit') return ''
    const selectedForAttack = unit.instanceId === selectedAttackerId
    const selectedForSpell = unit.instanceId === playDraft?.unitId
    const selectedForEvolution = unit.instanceId === playDraft?.evolutionUnitId
    const normalAttackMode = playDraft === null && currentGame.pendingChoice === null && summonFromManaDraftId === null
    const canSelectAttacker = isSelf
      && isMyTurn
      && normalAttackMode
      && roomPhase === 'playing'
      && currentGame.status === 'playing'
      && !awaitingServer
      && !(
        opponentPlayer.field.some((guard) => guard.cardId === 'cathedral_guard' && !guard.exhausted)
        && definition.cost <= 1
      )
      && (
        canUnitAttackView(player, unit, 'player')
        || (
          canUnitAttackView(player, unit, 'unit')
          && opponentPlayer.field.some((target) => canAttackUnitView(player, unit, opponentPlayer, target))
        )
      )
    const canSpellTarget = !isSelf
      && isMyTurn
      && targetMode !== null
      && draftCard !== null
      && playDraftNeedsUnitTarget(draftCard)
      && currentGame.pendingChoice === null
      && !awaitingServer
      && (
        targetMode === 'any'
        || (targetMode === 'exhausted' && isEffectivelyExhaustedView(player, unit))
        || (targetMode === 'highest-health' && healthValueView(player, unit) - unit.damage === maxRemainingHealth)
      )
    const canAttackTarget = !isSelf
      && isMyTurn
      && normalAttackMode
      && selectedAttacker !== undefined
      && canUnitAttackView(currentGame.players[currentGame.viewer], selectedAttacker, 'unit')
      && !(
        player.field.some((guard) => guard.cardId === 'cathedral_guard' && !guard.exhausted)
        && CARDS[selectedAttacker.cardId].cost <= 1
      )
      && canAttackUnitView(currentGame.players[currentGame.viewer], selectedAttacker, player, unit)
      && roomPhase === 'playing'
      && !awaitingServer

    const canEvolutionTarget = isSelf
      && isMyTurn
      && draftCard !== null
      && CARDS[draftCard.cardId].type === 'unit'
      && Boolean((CARDS[draftCard.cardId] as import('../shared/cards').UnitCard).evolutionAttribute)
      && currentGame.pendingChoice === null
      && !awaitingServer
      && CARDS[unit.cardId].attributes.includes((CARDS[draftCard.cardId] as import('../shared/cards').UnitCard).evolutionAttribute!)

    const canPendingDemonBreathTarget = !isSelf
      && currentGame.pendingChoice?.playerId === currentGame.viewer
      && currentGame.pendingChoice.type === 'DEMON_BREATH_TARGET'
      && currentGame.pendingChoice.candidateUnitIds.includes(unit.instanceId)
    const canPendingSofUnitTarget = currentGame.pendingChoice?.playerId === currentGame.viewer
      && currentGame.pendingChoice?.type === 'SOF_CHOICE'
      && BATTLEFIELD_SOF_EFFECTS.has(currentGame.pendingChoice.effect)
      && currentGame.pendingChoice.candidateIds.includes(unit.instanceId)

    const statusBadges = getUnitStatusBadges(player, unit)
    const statusMarkup = statusBadges.length > 0
      ? `<div class="field-card-status" aria-label="현재 상태">${statusBadges.map((badge) => `<span class="field-card-status__badge field-card-status__badge--${badge.tone ?? 'active'}${badge.keyword ? ` field-card-status__badge--${badge.keyword}` : ''}">${escapeHtml(badge.label)}</span>`).join('')}</div>`
      : ''
    const keywordClasses = statusBadges
      .filter((badge) => badge.keyword)
      .map((badge) => ` has-keyword-${badge.keyword}`)
      .join('')

    const cardSelectionAction = canPendingDemonBreathTarget || canPendingSofUnitTarget
      ? `data-action="resolve-simple-choice" data-choice-id="${escapeHtml(unit.instanceId)}"`
      : canSpellTarget
        ? `data-action="select-spell-unit" data-unit-id="${escapeHtml(unit.instanceId)}"`
      : canEvolutionTarget
        ? `data-action="select-evolution-unit" data-unit-id="${escapeHtml(unit.instanceId)}"`
      : isSelf && canSelectAttacker
        ? `data-action="select-attacker" data-unit-id="${escapeHtml(unit.instanceId)}"`
      : canAttackTarget && selectedAttackerId
        ? `data-action="attack-unit" data-attacker-id="${escapeHtml(selectedAttackerId)}" data-defender-id="${escapeHtml(unit.instanceId)}"`
        : ''
    const cardSelectionAccessibility = cardSelectionAction
      ? `role="button" tabindex="0" aria-label="${canPendingDemonBreathTarget ? `악마의 숨결 대상으로 ${definition.name} 선택` : canPendingSofUnitTarget ? `${definition.name}을 효과 대상으로 선택` : selectedForSpell ? '주문 대상 선택 취소' : canSpellTarget ? `${definition.name}을 주문 대상으로 선택` : selectedForEvolution ? '진화 대상 선택 취소' : canEvolutionTarget ? `${definition.name}을 진화 대상으로 선택` : selectedForAttack ? '공격 선택 취소' : canAttackTarget ? `${definition.name} 공격` : `${definition.name} 공격 선택`}"`
      : ''
    const cardSelectionClass = cardSelectionAction ? ' is-card-actionable' : ''

    return `<div class="field-slot-frame${cardSelectionClass}${keywordClasses}" data-field-slot="${slotIndex}" ${cardSelectionAction} ${cardSelectionAccessibility}>${renderCard(unit.cardId, {
      instanceId: unit.instanceId,
      selected: selectedForAttack || selectedForSpell || selectedForEvolution,
      targetable: canPendingDemonBreathTarget || canPendingSofUnitTarget || canEvolutionTarget || canSpellTarget || canAttackTarget,
      exhausted: isEffectivelyExhaustedView(player, unit),
      // 소환된 턴이라도 기습·돌진으로 실제 공격할 수 있다면
      // 공격 불가 필터를 씌우지 않습니다.
      summonedThisTurn: false,
      remainingHealth: healthValueView(player, unit) - unit.damage,
      displayAttack: attackValueView(player, unit),
      classNames: ['field-card', 'game-card--center-name'],
      actionsHtml: '',
      dataAttributes: { 'field-slot': String(slotIndex) },
    })}${statusMarkup}</div>`
    },
  ).join('')
}

function renderCardPile(playerId: PlayerId, kind: 'deck' | 'discard'): string {
  if (!game) return ''
  const player = game.players[playerId]

  if (kind === 'deck') {
    return `<div class="card-pile card-pile--deck" aria-label="${playerId}의 덱 ${player.deckCount}장">
      <div class="card-pile__back" aria-hidden="true"><span class="card-back-mark"></span></div>
      <span class="card-pile__label">덱</span>
      <strong class="card-pile__count">${player.deckCount}</strong>
    </div>`
  }

  const topCard = player.discard.at(-1)
  const topDefinition = topCard ? CARDS[topCard.cardId] : null
  return `<button
    type="button"
    class="card-pile card-pile--discard ${topCard ? '' : 'is-empty'}"
    data-action="open-discard"
    data-player-id="${playerId}"
    ${topCard ? `data-preview-card-id="${topCard.cardId}"` : ''}
    aria-label="${playerId}의 묘지 ${player.discard.length}장 열기"
  >
    <div class="card-pile__face card-pile__face--${topDefinition?.attributes[0] ?? 'empty'}" ${topDefinition ? '' : 'aria-hidden="true"'}>
      ${topDefinition ? `<span>${escapeHtml(topDefinition.name)}</span>` : ''}
    </div>
    <span class="card-pile__label">묘지</span>
    <strong class="card-pile__count">${player.discard.length}</strong>
  </button>`
}

function renderArenaLifeBlock(playerId: PlayerId, position: 'self' | 'opponent'): string {
  if (!game) return ''
  const player = game.players[playerId]
  const directTargeting = position === 'opponent'
    && game.pendingChoice === null
    && playDraft === null
    && canSelectedAttackerDirectAttack(player)
  const slotCount = Math.max(
    LIFE_SIZE,
    player.lifeSlotIndices?.length ? Math.max(...player.lifeSlotIndices) + 1 : player.lifeCount,
  )

  return `<section class="life-zone life-zone--rail arena-life-block arena-life-block--${position} ${directTargeting ? 'is-targetable' : ''}" aria-label="${playerId} 라이프">
    <div class="arena-life-block__stack">
      <div class="life-stack" style="--life-slot-count: ${slotCount}">${renderLife(playerId, position)}</div>
    </div>
  </section>`
}

function renderArenaResourcePanel(playerId: PlayerId, position: 'self' | 'opponent'): string {
  if (!game) return ''
  const player = game.players[playerId]
  const isSelf = player.isViewer
  const readyMana = player.mana.filter((card) => !card.exhausted).length
  return `<section class="arena-resource-panel arena-resource-panel--${position}" aria-label="${playerId} 자원">
    <section class="mana-zone mana-zone--summary ${isSelf ? 'mana-zone--self' : ''}" aria-label="${playerId} 마나">
      <div class="mana-summary">
        <span class="mana-summary__label">마나</span>
        <strong class="mana-summary__count">${readyMana}<small> / ${player.mana.length}</small></strong>
      </div>
      <button type="button" class="mana-open-button" data-action="open-mana-drawer" data-player-id="${playerId}">마나 보기</button>
    </section>
    <span class="resource-life-count game-card__health" aria-label="라이프 ${player.lifeCount}장">
      <span class="game-card__symbol-icon" aria-hidden="true"></span>
      <span class="game-card__symbol-value">${player.lifeCount}</span>
    </span>
    <div class="pile-row">
      ${renderCardPile(playerId, 'deck')}
      ${renderCardPile(playerId, 'discard')}
    </div>
  </section>`
}

function renderOpponentHandRack(handCount: number): string {
  const visibleCount = Math.min(handCount, 14)
  const midpoint = (visibleCount - 1) / 2
  const cards = Array.from({ length: visibleCount }, (_, index) => {
    const offset = index - midpoint
    const rotation = offset * 1.35
    const verticalOffset = Math.abs(offset) * .55
    return `<span
      class="opponent-hand-card"
      style="--opponent-hand-rotation: ${rotation.toFixed(2)}deg; --opponent-hand-y: ${verticalOffset.toFixed(2)}px;"
      aria-hidden="true"
    ><span class="card-back-mark"></span></span>`
  }).join('')
  const extraCount = handCount - visibleCount

  return `<div class="opponent-hand-rack" aria-label="상대 손패 ${handCount}장">
    <div class="opponent-hand-fan">${cards || '<span class="opponent-hand-empty">손패 없음</span>'}</div>
    ${extraCount > 0 ? `<span class="opponent-hand-extra">+${extraCount}</span>` : ''}
  </div>`
}

function renderPlayerBoard(playerId: PlayerId, position: 'self' | 'opponent'): string {
  if (!game) return ''
  const player = game.players[playerId]
  const isSelf = player.isViewer
  const isActivePlayer = game.currentPlayer === playerId
  const field = `<section class="field-column" aria-label="${playerId} 전장">
    <div class="field-heading">${position === 'opponent' ? '상대 전장' : '내 전장'}</div>
    <div class="field-zone">${renderField(player, isSelf)}</div>
  </section>`

  if (position === 'opponent') {
    return `<section class="player-board player-board--opponent ${isActivePlayer ? 'is-active-player' : ''}">
      ${renderOpponentHandRack(player.handCount)}
      ${field}
    </section>`
  }

  return `<section class="player-board player-board--self ${isActivePlayer ? 'is-active-player' : ''}">
    ${field}
    <section class="hand-area" aria-label="내 손패">
      <div class="hand-heading"><span>내 손패</span><strong>${player.handCount}</strong></div>
      <div class="hand-scroll-shell">
        <button type="button" class="hand-scroll-button hand-scroll-button--previous" data-action="scroll-hand" data-direction="-1" aria-label="이전 손패 보기">‹</button>
        <div class="hand-zone hand-zone--self ${player.handCount > 12 ? 'is-very-dense' : player.handCount > 8 ? 'is-dense' : ''}" style="--hand-count: ${Math.max(1, player.handCount)}" tabindex="0">${renderHand(player, true)}</div>
        <button type="button" class="hand-scroll-button hand-scroll-button--next" data-action="scroll-hand" data-direction="1" aria-label="다음 손패 보기">›</button>
      </div>
    </section>
  </section>`
}

function renderArenaLifeRail(): string {
  if (!game) return ''
  return `<aside class="arena-life-rail">
    ${renderCardInspector()}
  </aside>`
}

function renderArenaResourceRail(opponentId: PlayerId): string {
  if (!game) return ''
  return `<aside class="arena-resource-rail">
    ${renderArenaResourcePanel(opponentId, 'opponent')}
    ${renderTurnControl()}
    ${renderArenaResourcePanel(game.viewer, 'self')}
  </aside>`
}

function renderPlayDraftPanel(): string {
  if (!game || !playDraft) return ''
  const card = selectedPlayCard()
  if (!card) return ''
  const definition = CARDS[card.cardId]
  const cost = effectiveCost(card)
  const targetMode = unitTargetMode(card.cardId)
  const steps: Array<{ label: string; complete: boolean; attention?: boolean }> = [
    {
      label: `마나 자동 지불 ${cost}`,
      complete: game.players[game.viewer].mana.filter((mana) => !mana.exhausted).length >= cost,
      attention: game.players[game.viewer].mana.filter((mana) => !mana.exhausted).length < cost,
    },
  ]

  if (definition.type === 'unit') {
    if (definition.evolutionAttribute) {
      steps.push({
        label: playDraft.evolutionUnitId ? '진화할 몬스터 선택됨' : `${CARD_ATTRIBUTES[definition.evolutionAttribute].name} 몬스터 선택`,
        complete: Boolean(playDraft.evolutionUnitId),
        attention: !playDraft.evolutionUnitId,
      })
    } else {
      steps.push({
        label: playDraft.fieldSlot === undefined ? '소환 위치 선택' : `${playDraft.fieldSlot + 1}번 슬롯`,
        complete: playDraft.fieldSlot !== undefined,
        attention: playDraft.fieldSlot === undefined,
      })
    }
  }
  if (card.cardId === 'rising_earth') {
    steps.push({
      label: playDraft.fieldSlot === undefined ? '소환 위치 선택' : `${playDraft.fieldSlot + 1}번 슬롯`,
      complete: playDraft.fieldSlot !== undefined,
      attention: playDraft.fieldSlot === undefined,
    })
  }
  if (targetMode && playDraftNeedsUnitTarget(card)) {
    const targetKind = definition.type === 'unit' ? '효과' : '주문'
    steps.push({
      label: playDraft.unitId ? `${targetKind} 대상 선택됨` : `${targetKind} 대상 선택`,
      complete: Boolean(playDraft.unitId),
      attention: !playDraft.unitId,
    })
  }
  if (needsLifeTarget(card.cardId)) {
    steps.push({
      label: playDraft.lifeIndex === undefined ? '라이프 대상 선택' : `${playDraft.lifeIndex + 1}번째 라이프`,
      complete: playDraft.lifeIndex !== undefined,
      attention: playDraft.lifeIndex === undefined,
    })
  }
  if (playDraftNeedsEffectMana(card)) {
    const label = card.cardId === 'grave_digging'
      ? '묘지로 보낼 마나'
      : card.cardId === 'rising_earth'
        ? '효과로 소환할 마나'
        : '효과로 준비할 마나'
    steps.push({
      label: playDraft.effectManaId ? `${label} 선택됨` : `${label} 선택`,
      complete: Boolean(playDraft.effectManaId),
      attention: !playDraft.effectManaId,
    })
  }

  const stepMarkup = steps.map((step) => `<span class="selection-step ${step.complete ? 'is-complete' : ''} ${step.attention ? 'needs-attention' : ''}">${step.complete ? '✓' : '○'} ${escapeHtml(step.label)}</span>`).join('')
  const ready = isPlayDraftReady()
  const confirmLabel = definition.type === 'unit'
    ? definition.evolutionAttribute ? '진화 소환 확정' : '소환 확정'
    : '주문 사용 확정'
  const lifeTargetPlayerId = game.viewer === 'P1' ? 'P2' : 'P1'
  const lifeChoices = needsLifeTarget(card.cardId)
    ? renderLargeLifeChoices(lifeTargetPlayerId, 'select-spell-life', playDraft.lifeIndex)
    : ''

  return `<div class="selection-panel selection-panel--play ${lifeChoices ? 'has-life-target' : ''} ${ready ? 'is-ready' : ''}">
    <div class="selection-panel__title"><span>${definition.type === 'unit' ? '몬스터 소환' : '주문 사용'}</span><h3>${escapeHtml(definition.name)}</h3></div>
    <div class="selection-steps">${stepMarkup}</div>
    ${lifeChoices}
    <div class="choice-actions">${actionButton(confirmLabel, 'confirm-play-card', undefined, undefined, !ready)}${actionButton('취소', 'cancel-play-card')}</div>
  </div>`
}

function renderSofCandidateCard(
  instanceId: string,
  action = 'resolve-simple-choice',
  actionLabel = '선택',
): string {
  const card = findVisibleCardInstance(instanceId)
  if (!card) {
    return `<button type="button" class="choice-life-card" data-action="${action}" data-choice-id="${escapeHtml(instanceId)}">${renderCardBack(['choice-card'])}<span>${escapeHtml(actionLabel)}</span></button>`
  }
  return renderCard(card.cardId, {
    instanceId: card.instanceId,
    compact: true,
    selected: pendingChoiceIds.includes(instanceId),
    classNames: ['choice-card'],
    actionsHtml: actionButton(actionLabel, action, 'choice-id', instanceId),
  })
}

function renderSofCandidateGrid(
  candidateIds: readonly string[],
  actionLabel = '선택',
): string {
  return `<div class="choice-card-grid">${candidateIds.map((id) => renderSofCandidateCard(id, 'resolve-simple-choice', actionLabel)).join('')}</div>`
}

function renderRevealedCard(card: CardInstance, location: string): string {
  return `<div class="revealed-card"><span class="revealed-card__location">${escapeHtml(location)}</span>${renderCard(card.cardId, { compact: true, classNames: ['choice-card'] })}</div>`
}

function deckPositionLabel(index: number): string {
  if (index === 0) return '덱 맨 위'
  if (index === 1) return '덱 위에서 두 번째'
  return `덱 위에서 ${index + 1}번째`
}

function lifePositionLabel(playerId: PlayerId, lifeIndex: number): string {
  const slotIndex = game?.players[playerId].lifeSlotIndices[lifeIndex] ?? lifeIndex
  return `라이프 ${slotIndex + 1}`
}

function sofChoicePanel(
  title: string,
  description: string,
  content: string,
  actions = '',
): string {
  return `<div class="selection-panel selection-panel--urgent selection-panel--sof"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p>${content}${actions ? `<div class="choice-actions">${actions}</div>` : ''}</div>`
}

function renderSofChoicePanel(pending: Extract<NonNullable<GameView['pendingChoice']>, { type: 'SOF_CHOICE' }>): string {
  const candidates = pending.candidateIds
  const openSlots = game ? getOpenFieldSlotsView(game.players[game.viewer]) : []
  const optionalSkip = actionButton('건너뛰기', 'resolve-sof-empty')

  switch (pending.effect) {
    case 'BOMB_MOUSE_DAMAGE':
      return sofChoicePanel('터지지 않은 폭탄쥐', '전장 보기를 누른 뒤 피해 2를 줄 상대 몬스터를 직접 선택하세요.', '')
    case 'UNDERWATER_OBSERVER_TOP': {
      const cards = pending.revealedCards
      const content = `<div class="choice-card-grid">${cards.map((card, index) => renderRevealedCard(card, deckPositionLabel(index))).join('')}</div>`
      const actions = [
        actionButton('현재 순서로 위에 둔다', 'resolve-simple-choice', 'choice-id', 'keep:normal'),
        actionButton('순서를 뒤집어 위에 둔다', 'resolve-simple-choice', 'choice-id', 'keep:reverse', cards.length < 2),
        ...cards.map((card) => actionButton(`${CARDS[card.cardId].name} 묘지`, 'resolve-simple-choice', 'choice-id', `discard:${card.instanceId}`)),
      ].join('')
      return sofChoicePanel('물밑을 살피는 자', '확인한 카드의 순서를 정하거나 한 장을 묘지로 보냅니다.', content, actions)
    }
    case 'ICE_MIRROR_FREEZE':
      return sofChoicePanel('얼음거울 정령', '전장 보기를 누른 뒤 다음 준비 단계에 준비되지 않을 상대 몬스터를 직접 선택하세요.', '')
    case 'WAVE_FIN_BOUNCE':
      return sofChoicePanel('파도의 등지느러미', '전장 보기를 누른 뒤 손으로 되돌릴 소진된 비용 2 이하 상대 몬스터를 직접 선택하세요.', '', optionalSkip)
    case 'CRYSTAL_TSUNAMI_BOUNCE':
      return sofChoicePanel('수정 해일', '전장 보기를 누른 뒤 손으로 되돌릴 소진된 상대 몬스터를 직접 선택하세요.', '', optionalSkip)
    case 'WAVE_FIN_DRAW':
      return sofChoicePanel('파도의 등지느러미', '카드 1장을 뽑은 뒤 손 카드 한 장을 덱 맨 아래에 놓겠습니까?', '', actionButton('카드를 뽑는다', 'resolve-simple-choice', 'choice-id', 'draw') + actionButton('건너뛴다', 'resolve-simple-choice', 'choice-id', 'skip'))
    case 'WAVE_FIN_BOTTOM':
      return sofChoicePanel('파도의 등지느러미', '덱 맨 아래에 놓을 손 카드 한 장을 선택하세요.', renderSofCandidateGrid(candidates, '덱 아래'))
    case 'TREE_FAIRY_HAND_MANA':
      return sofChoicePanel('나무에 사는 요정', '손에서 카드 한 장을 준비 상태로 마나에 놓을 수 있습니다.', renderSofCandidateGrid(candidates, '마나로'), optionalSkip)
    case 'MANA_FLIP_RETURN':
      return sofChoicePanel('땅을 가는 요정', '손으로 가져올 자신의 마나 한 장을 선택할 수 있습니다.', renderSofCandidateGrid(candidates, '손으로'), optionalSkip)
    case 'MANA_FLIP_PLACE':
      return sofChoicePanel('땅을 가는 요정', '소진된 상태로 마나에 놓을 손 카드 한 장을 선택하세요.', renderSofCandidateGrid(candidates, '마나로'))
    case 'EARTH_GUARDIAN_SUMMON': {
      const cards = candidates.map((id) => {
        const card = findVisibleCardInstance(id)
        if (!card) return ''
        const current = pendingChoiceIds.find((choice) => choice.startsWith(`${id}@`))
        const slots = openSlots.map((slot) => {
          const choiceId = `${id}@${slot}`
          const slotTaken = pendingChoiceIds.some((choice) => choice.endsWith(`@${slot}`) && choice !== current)
          return actionButton(`${slot + 1}번`, 'toggle-sof-slot-choice', 'choice-id', choiceId, slotTaken)
        }).join('')
        return `<div class="choice-card-with-slots">${renderCard(card.cardId, { compact: true, selected: Boolean(current), classNames: ['choice-card'] })}<div class="slot-choice-row">${slots}</div></div>`
      }).join('')
      return sofChoicePanel('대지의 수호자', `마나에서 최대 ${pending.maxChoices}장까지 출현 없이 소환할 수 있습니다.`, `<div class="choice-card-grid">${cards}</div>`, actionButton(`확정 (${pendingChoiceIds.length})`, 'confirm-sof-choices'))
    }
    case 'GRAVE_MERCHANT_RETURN':
      return sofChoicePanel('무덤 안의 상인', '손으로 가져올 비용 1 이하 몬스터를 선택하세요.', renderSofCandidateGrid(candidates, '손으로'))
    case 'BLACKWING_RETURN':
      return sofChoicePanel('검은날개 포식자', '손으로 가져올 비용 1 이하 어둠 몬스터를 선택할 수 있습니다.', renderSofCandidateGrid(candidates, '손으로'), optionalSkip)
    case 'MASS_BURIAL_ENEMY_FIRST':
      return sofChoicePanel('집단 매장', '전장 보기를 누른 뒤 자신의 전장에서 묘지로 보낼 몬스터를 직접 선택하세요.', '')
    case 'MASS_BURIAL_SELF':
      return sofChoicePanel('집단 매장', '전장 보기를 누른 뒤 추가로 묻을 내 몬스터를 직접 선택하세요.', '', optionalSkip)
    case 'MASS_BURIAL_ENEMY_SECOND':
      return sofChoicePanel('집단 매장', '전장 보기를 누른 뒤 추가로 묘지로 보낼 자신의 몬스터를 직접 선택하세요.', '')
    case 'MOURNER_SACRIFICE':
      return sofChoicePanel('장송하는 자', '전장 보기를 누른 뒤 묘지로 보낼 다른 내 몬스터를 직접 선택하세요.', '', optionalSkip)
    case 'MOURNER_DESTROY':
      return sofChoicePanel('장송하는 자', '전장 보기를 누른 뒤 묘지로 보낼 상대 몬스터를 직접 선택하세요.', '')
    case 'MOURNER_LAST_WORDS': {
      const cards = candidates.map((id) => {
        const card = findVisibleCardInstance(id)
        if (!card) return ''
        const slots = openSlots.map((slot) => actionButton(`${slot + 1}번`, 'resolve-simple-choice', 'choice-id', `${id}@${slot}`)).join('')
        return `<div class="choice-card-with-slots">${renderCard(card.cardId, { compact: true, classNames: ['choice-card'] })}<div class="slot-choice-row">${slots}</div></div>`
      }).join('')
      return sofChoicePanel('장송하는 자', '묘지의 비용 2 이하 어둠 몬스터를 출현 없이 소환할 수 있습니다.', `<div class="choice-card-grid">${cards}</div>`, optionalSkip)
    }
    case 'SKY_KNIGHT_READY':
      return sofChoicePanel('천공의 백마기사', '전장 보기를 누른 뒤 준비할 다른 소진 몬스터를 직접 선택하세요.', '', optionalSkip)
    case 'STONE_PRIEST_HAND_MANA':
      return sofChoicePanel('돌기둥의 성직자', '소진된 상태로 마나에 놓을 손 카드 한 장을 선택할 수 있습니다.', renderSofCandidateGrid(candidates, '마나로'), optionalSkip)
    case 'STONE_PRIEST_LIFE': {
      const stage = String(pending.data.stage ?? 'choose')
      if (stage === 'revealed') {
        const card = pending.revealedCards[0]
        const slot = Number(pending.data.lifeSlotIndex ?? 0)
        const content = card ? renderRevealedCard(card, `라이프 ${slot + 1}`) : ''
        const canAwaken = Boolean(pending.data.canAwaken)
        return sofChoicePanel('돌기둥의 성직자', canAwaken ? '각성 카드입니다. 손으로 가져와 각성을 발동할 수 있습니다.' : '확인한 카드는 각성 카드가 아닙니다.', content, actionButton('그대로 둔다', 'resolve-simple-choice', 'choice-id', 'keep') + actionButton('손으로 가져와 각성', 'resolve-simple-choice', 'choice-id', 'take', !canAwaken))
      }
      return sofChoicePanel('돌기둥의 성직자', '확인할 자신의 라이프 카드 한 장을 선택할 수 있습니다.', `<div class="choice-card-grid">${candidates.map((id, index) => `<button type="button" class="choice-life-card" data-action="resolve-simple-choice" data-choice-id="${escapeHtml(id)}">${renderCardBack(['choice-card'])}<span>${lifePositionLabel(pending.sourcePlayerId, index)}</span></button>`).join('')}</div>`, optionalSkip)
    }
    case 'MIRROR_LAKE_RESOLVE': {
      const stage = String(pending.data.stage ?? '')
      if (stage === 'choose-life') {
        return sofChoicePanel('거울 호수의 예언자', '확인할 자신의 라이프 카드 한 장을 선택하세요.', `<div class="choice-card-grid">${candidates.map((id, index) => `<button type="button" class="choice-life-card" data-action="resolve-simple-choice" data-choice-id="${escapeHtml(id)}">${renderCardBack(['choice-card'])}<span>${lifePositionLabel(pending.sourcePlayerId, index)}</span></button>`).join('')}</div>`)
      }
      const lifeSlot = Number(pending.data.lifeSlotIndex ?? 0)
      const content = `<div class="choice-card-grid">${pending.revealedCards.map((card, index) => {
        const location = stage === 'water-only'
          ? '덱 맨 위'
          : index === 0 ? `라이프 ${lifeSlot + 1}` : '덱 맨 위'
        return renderRevealedCard(card, location)
      }).join('')}</div>`
      if (stage === 'light-only') return sofChoicePanel('거울 호수의 예언자', '자신의 라이프 카드를 확인했습니다.', content, actionButton('확인 완료', 'resolve-simple-choice', 'choice-id', 'close'))
      const actions = actionButton('그대로 둔다', 'resolve-simple-choice', 'choice-id', 'keep')
        + actionButton('덱 위를 묘지로', 'resolve-simple-choice', 'choice-id', 'discard')
        + (stage === 'both' ? actionButton('두 카드를 교환', 'resolve-simple-choice', 'choice-id', 'swap') : '')
      return sofChoicePanel('거울 호수의 예언자', stage === 'both' ? '확인한 라이프와 덱 위 카드를 처리하세요.' : '덱 위 카드를 처리하세요.', content, actions)
    }
    case 'COFFIN_KEEPER_BOTTOM':
      return sofChoicePanel('가라앉은 관지기', '덱 맨 위에 놓을 묘지 카드 한 장을 선택할 수 있습니다.', renderSofCandidateGrid(candidates, '덱 위'), optionalSkip)
    case 'COFFIN_KEEPER_TOP': {
      const card = pending.revealedCards[0]
      return sofChoicePanel('가라앉은 관지기', '덱 맨 위 카드를 묘지로 보낼 수 있습니다.', card ? renderRevealedCard(card, '덱 맨 위') : '', actionButton('덱 위에 둔다', 'resolve-simple-choice', 'choice-id', 'keep') + actionButton('묘지로 보낸다', 'resolve-simple-choice', 'choice-id', 'discard'))
    }
  }
}

function renderLargeLifeChoices(
  playerId: PlayerId,
  action = 'resolve-life-choice',
  selectedLifeIndex?: number,
): string {
  if (!game) return ''
  const player = game.players[playerId]
  return `<div class="choice-card-grid choice-card-grid--life">${player.lifeSlotIndices.map((slotIndex, lifeIndex) => (
    `<button type="button" class="choice-life-card choice-life-card--large ${selectedLifeIndex === lifeIndex ? 'is-selected' : ''}" data-action="${action}" data-life-index="${lifeIndex}">
      ${renderCardBack(['choice-card'])}
      <span class="choice-life-card__slot">라이프 ${slotIndex + 1}</span>
    </button>`
  )).join('')}</div>`
}

function renderPendingChoicePanel(): string {
  if (!game?.pendingChoice) return ''
  const pending = game.pendingChoice
  if (pending.playerId !== game.viewer) {
    return `<div class="selection-panel"><h3>효과 처리 중</h3><p>${pending.playerId}의 선택을 기다리고 있습니다.</p></div>`
  }

  const openSlots = getOpenFieldSlotsView(game.players[game.viewer])
  switch (pending.type) {
    case 'SOF_CHOICE':
      return renderSofChoicePanel(pending)
    case 'TEMPLE_PROSPECT_LIFE':
      return `<div class="selection-panel selection-panel--urgent"><h3>신전의 유망주</h3><p>손으로 가져올 자신의 라이프를 선택하세요. 번호는 처음 놓인 라이프 슬롯을 뜻합니다.</p>${renderLargeLifeChoices(game.viewer)}</div>`
    case 'TEMPLE_PROSPECT_HAND':
      return `<div class="selection-panel selection-panel--urgent"><h3>신전의 유망주</h3><p>‘전장 보기’를 누른 뒤 손패에서 라이프로 놓을 카드 한 장을 선택하세요. 카드를 놓지 않으려면 건너뛸 수 있습니다.</p>${actionButton('건너뛰기 · 손패 선택 안 함', 'skip-hand-choice')}</div>`
    case 'HOLY_MIRROR_LIFE':
      return `<div class="selection-panel selection-panel--urgent"><h3>성스러운 거울의 벽</h3><p>묘지로 보낼 상대 라이프를 선택하세요. 번호는 처음 놓인 라이프 슬롯을 뜻합니다.</p>${renderLargeLifeChoices(game.viewer === 'P1' ? 'P2' : 'P1')}</div>`
    case 'AWAKEN_SUMMON_SLOT':
      return '<div class="selection-panel selection-panel--urgent"><h3>각성 소환</h3><p>각성한 카드를 소환할 빈 전장 슬롯을 선택하세요.</p></div>'
    case 'WAVE_READER_TOP':
      return `<div class="selection-panel selection-panel--urgent"><h3>물결을 읽는 자</h3>${pending.revealedCard ? renderRevealedCard(pending.revealedCard, '덱 맨 위') : ''}<div class="choice-actions">${actionButton('덱 위에 둔다', 'resolve-simple-choice', 'choice-id', 'keep')}${actionButton('묘지로 보낸다', 'resolve-simple-choice', 'choice-id', 'discard')}</div></div>`
    case 'SURGING_WAVE_TOP': {
      const cards = pending.revealedCards
      const summonOptions = cards.map((card, cardIndex) => {
        const definition = CARDS[card.cardId]
        const canSummon = definition.type === 'unit'
          && definition.cost <= 2
          && definition.attributes.includes('water')
          && openSlots.length > 0
        const slotButtons = openSlots.map((slot) => actionButton(
          `${slot + 1}번 슬롯`,
          'resolve-simple-choice',
          'choice-id',
          `summon:${card.instanceId}@${slot}`,
          !canSummon,
        )).join('')
        return `<div class="choice-card-with-slots"><span class="revealed-card__location">${escapeHtml(deckPositionLabel(cardIndex))}</span>${renderCard(card.cardId, { compact: true, classNames: ['choice-card'] })}<div class="slot-choice-row">${slotButtons || '<span>빈 전장 슬롯 없음</span>'}</div></div>`
      }).join('')
      return `<div class="selection-panel selection-panel--urgent"><h3>몰아치는 파도</h3><p>비용 2 이하의 물 몬스터 한 장을 출현 없이 소환하거나, 확인한 카드를 모두 덱 맨 아래에 놓습니다.</p><div class="choice-card-grid">${summonOptions}</div><div class="choice-actions">${actionButton('모두 아래 · 현재 순서', 'resolve-simple-choice', 'choice-id', 'bottom:normal')}${actionButton('모두 아래 · 순서 뒤집기', 'resolve-simple-choice', 'choice-id', 'bottom:reverse', cards.length < 2)}</div></div>`
    }

    case 'GRAVE_DIGGING_RETURN': {
      const discardCards = game.players[game.viewer].discard
      return `<div class="selection-panel selection-panel--urgent"><h3>파묘</h3><p>묘지에서 최대 ${pending.maxCards}장을 손으로 가져옵니다. 선택하지 않고 끝낼 수도 있습니다.</p><div class="choice-card-grid">${discardCards.map((card) => renderCard(card.cardId, { compact: true, selected: pendingChoiceIds.includes(card.instanceId), classNames: ['choice-card'], actionsHtml: actionButton(pendingChoiceIds.includes(card.instanceId) ? '선택 취소' : '선택', 'toggle-pending-card', 'card-instance-id', card.instanceId) })).join('')}</div><div class="choice-actions">${actionButton(`확정 (${pendingChoiceIds.length})`, 'confirm-pending-cards')}</div></div>`
    }
    case 'DEMON_FINGER_DISCARD':
      return `<div class="selection-panel selection-panel--urgent"><h3>${escapeHtml(CARDS[pending.sourceCardId].name)}</h3><p>이 효과로 손에서 묘지로 보낼 카드 한 장을 선택하세요.</p></div>`
    case 'DEMON_BREATH_TARGET':
      return '<div class="selection-panel selection-panel--urgent"><h3>악마의 숨결</h3><p>남은 체력이 가장 높은 상대 몬스터 중 한 장을 선택하세요.</p></div>'
    case 'BURNING_PROCESSION': {
      const selectable = new Set(pending.revealedCards.filter((card) => {
        const definition = CARDS[card.cardId]
        return definition.type === 'unit'
          && definition.cost <= 2
          && definition.attributes.includes('fire')
          && game !== null
          && meetsSummonConditionView(game.players[game.viewer], card.cardId)
      }).map((card) => card.instanceId))
      return `<div class="selection-panel selection-panel--urgent"><h3>불타는 행렬</h3><p>각 카드 아래에서 서로 다른 빈 슬롯을 선택하세요. 선택하지 않은 카드는 묘지로 갑니다.</p><div class="choice-card-grid">${pending.revealedCards.map((card) => {
        const current = pendingChoiceIds.find((choice) => choice.startsWith(`${card.instanceId}@`))
        const slotButtons = openSlots.map((slot) => {
          const choiceId = `${card.instanceId}@${slot}`
          const slotTaken = pendingChoiceIds.some((choice) => choice.endsWith(`@${slot}`) && choice !== current)
          return actionButton(`${slot + 1}번`, 'toggle-burning-choice', 'choice-id', choiceId, !selectable.has(card.instanceId) || slotTaken)
        }).join('')
        return `<div class="choice-card-with-slots">${renderCard(card.cardId, { compact: true, selected: current !== undefined, classNames: ['choice-card'] })}<div class="slot-choice-row">${slotButtons}</div></div>`
      }).join('')}</div><div class="choice-actions">${actionButton(`확정 (${pendingChoiceIds.length})`, 'confirm-burning-choice')}</div></div>`
    }
  }
}

function renderAttackLifePanel(opponentPlayer: PlayerView): string {
  if (!selectedAttackerId || playDraft || game?.pendingChoice) return ''
  if (!canSelectedAttackerDirectAttack(opponentPlayer)) return ''
  const required = requiredAttackLifeCount(opponentPlayer)
  const selected = selectedAttackLifeSlotIndices.length
  const ready = selected === required
  return `<div class="selection-panel selection-panel--attack ${ready ? 'is-ready' : ''}">
    <div class="selection-panel__title"><span>공격 행동</span><h3>직접 공격</h3></div>
    <div class="attack-selection-status">
      <strong>${ready ? '공격할 라이프 선택 완료' : '상대 라이프 카드를 선택하세요'}</strong>
      <span>${selected}/${required}</span>
    </div>
    <div class="choice-actions">
      ${actionButton(ready ? '직접 공격 실행' : '라이프 선택 필요', 'confirm-attack-player', undefined, undefined, !ready)}
      ${actionButton('공격 취소', 'cancel-attacker')}
    </div>
  </div>`
}

function renderCardInspectorPlaceholder(): string {
  return `<div class="card-inspector__placeholder">
    <span class="card-inspector__placeholder-mark" aria-hidden="true">◇</span>
    <strong>카드 상세</strong>
    <p>카드에 마우스를 올리면 능력과 세부 정보를 확인할 수 있습니다. 클릭하면 상세가 고정됩니다.</p>
  </div>`
}

function renderCardInspector(): string {
  const cardId = pinnedPreviewCardId
  return `<aside id="card-inspector" class="card-inspector is-visible ${cardId ? 'is-pinned' : 'is-empty'}" aria-live="polite" aria-hidden="false">
    ${cardId ? renderCardInspectorContent(cardId, pinnedPreviewInstanceId) : renderCardInspectorPlaceholder()}
  </aside>`
}

function renderCardInspectorContent(cardId: CardId, instanceId: string | null = null): string {
  const card = CARDS[cardId]
  const instance = findVisibleCardInstance(instanceId)
  const visibleUnit = instance && 'damage' in instance ? instance as UnitInstance : null
  const visibleUnitView = visibleUnit ? findVisibleUnitView(instanceId) : undefined
  const currentCost = instance?.cardId === cardId ? effectiveCost(instance) : card.cost
  const costReduced = currentCost < card.cost
  const coffinFree = cardId === 'coffin_warrior' && currentCost === 0 && card.cost > 0
  const attributes = card.attributes.map((attributeId) => CARD_ATTRIBUTES[attributeId].name).join(' · ')
  const families = card.families.length > 0 ? card.families.join(' · ') : '없음'
  const keywordNames: Record<string, string> = {
    rush: '기습', charge: '돌진', windfury: '질풍', flying: '비행', stealth: '잠행', last_words: '유언', assassination: '암살',
  }
  const keywords = card.type === 'unit'
    ? (card.keywords ?? []).map((keyword) => keywordNames[keyword]).filter(Boolean)
    : []
  const currentAttack = visibleUnit && visibleUnitView
    ? attackValueView(visibleUnitView.player, visibleUnitView.unit)
    : card.type === 'unit'
      ? card.attack
      : 0
  const currentHealth = visibleUnit && visibleUnitView
    ? healthValueView(visibleUnitView.player, visibleUnitView.unit) - visibleUnitView.unit.damage
    : card.type === 'unit'
      ? card.health
      : 0
  const attackToneClass = card.type === 'unit' && currentAttack !== card.attack
    ? currentAttack > card.attack
      ? 'is-up'
      : 'is-down'
    : ''
  const healthToneClass = card.type === 'unit' && currentHealth !== card.health
    ? currentHealth > card.health
      ? 'is-up'
      : 'is-down'
    : ''
  const inspectorCardOptions = visibleUnit && visibleUnitView
    ? {
        interactive: false,
        detailLayout: true,
        displayCost: currentCost,
        displayAttack: currentAttack,
        remainingHealth: currentHealth,
        classNames: ['card-preview-card'],
      }
    : {
        interactive: false,
        detailLayout: true,
        displayCost: currentCost,
        classNames: ['card-preview-card'],
      }
  return `<div class="card-inspector__inner">
    <button type="button" class="card-inspector__close" data-action="close-card-preview" aria-label="카드 상세 닫기">×</button>
    <div class="card-inspector__visual">${renderCard(cardId, inspectorCardOptions)}</div>
    <div class="card-inspector__copy">
      <div class="card-inspector__meta"><span>속성: ${escapeHtml(attributes)}</span><span>카드군: ${escapeHtml(families)}</span><span>${card.type === 'unit' ? '몬스터' : '주문'} · ${costReduced ? `현재 비용 ${currentCost} · 기본 ${card.cost}` : `비용 ${card.cost}`}</span></div>
      <h2>${escapeHtml(card.name)}</h2>
      ${card.type === 'unit' ? `<p class="card-inspector__stats"><span class="card-inspector__stat ${attackToneClass}">공격력 ${currentAttack}</span><span class="card-inspector__stat-separator" aria-hidden="true">·</span><span class="card-inspector__stat ${healthToneClass}">체력 ${currentHealth}</span></p>` : ''}
      ${keywords.length > 0 ? `<div class="card-inspector__keywords">${keywords.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join('')}</div>` : ''}
      ${costReduced ? `<p class="card-inspector__cost-notice"><strong>${coffinFree ? '무료 사용 조건 충족' : '비용 감소 적용 중'}</strong><span>${card.cost} → ${currentCost}</span></p>` : ''}
      <p class="card-inspector__rules">${escapeHtml(card.rulesText || '능력 없음')}</p>
      ${card.flavorText ? `<p class="card-inspector__flavor">${escapeHtml(card.flavorText)}</p>` : ''}
      <p class="card-inspector__hint">마우스를 떼면 닫히며, 카드를 클릭하면 고정됩니다.</p>
    </div>
  </div>`
}

function discardCandidates(playerId: PlayerId): CardInstance[] {
  if (!game) return []
  return [...game.players[playerId].discard]
}

function renderDiscardModal(): string {
  if (!game || !openDiscardPlayerId) return ''
  const playerId = openDiscardPlayerId
  const player = game.players[playerId]
  const selectionMode = false
  const candidates = discardCandidates(playerId)
  const cards = [...candidates].reverse()

  return `<div class="modal-backdrop discard-backdrop" data-modal="discard">
    <section class="discard-dialog" role="dialog" aria-modal="true" aria-labelledby="discard-title">
      <header class="discard-dialog__header">
        <div>
          <p class="eyebrow">공개 정보</p>
          <h2 id="discard-title">${playerId}${player.isViewer ? ' · 내' : ' · 상대'} 묘지</h2>
        </div>
        <button type="button" data-action="close-discard" aria-label="묘지 닫기">닫기</button>
      </header>
      <div class="discard-tabs" aria-label="묘지 전환">
        ${(['P1', 'P2'] as const).map((id) => `<button type="button" data-action="view-discard-player" data-player-id="${id}" class="${id === playerId ? 'is-active' : ''}">${id} 묘지 · ${game?.players[id].discard.length ?? 0}</button>`).join('')}
      </div>
      
      <div class="discard-grid">
        ${cards.map((card, index) => renderCard(card.cardId, {
          instanceId: card.instanceId,
          selected: playDraft?.discardId === card.instanceId,
          classNames: ['discard-card'],
          actionsHtml: selectionMode
            ? actionButton(
                playDraft?.discardId === card.instanceId ? '선택 취소' : '가져오기',
                'select-discard-return',
                'card-instance-id',
                card.instanceId,
              )
            : '',
          dataAttributes: index === 0 ? { recent: 'true' } : undefined,
        })).join('') || '<div class="discard-empty"><strong>묘지가 비어 있습니다.</strong><span>카드가 묘지로 보내지면 이곳에서 양쪽 플레이어가 확인할 수 있습니다.</span></div>'}
      </div>
      <footer class="discard-dialog__footer">
        <span>최근에 묘지로 간 카드부터 표시됩니다.</span>
        ${selectionMode ? `<button type="button" data-action="close-discard" ${playDraft?.discardId ? '' : 'disabled'}>선택 완료</button>` : ''}
      </footer>
    </section>
  </div>`
}

function renderDecisionDock(opponentId: PlayerId): string {
  if (!game) return ''
  const draftPanel = renderPlayDraftPanel()
  const attackPanel = renderAttackLifePanel(game.players[opponentId])
  const activePanel = draftPanel || attackPanel
  if (!activePanel) {
    return ''
  }

  const nextDecisionPanelKey = draftPanel
    ? `play:${playDraft?.cardInstanceId ?? 'draft'}`
    : `attack:${selectedAttackerId ?? 'direct'}`

  if (decisionPanelKey !== nextDecisionPanelKey) {
    decisionPanelCollapsed = false
    decisionPanelKey = nextDecisionPanelKey
  }

  const isEffectChoice = false

  if (isEffectChoice && decisionPanelCollapsed) {
    return `<aside class="decision-dock has-selection is-effect-choice is-battlefield-view" aria-live="polite">
      <button type="button" class="decision-panel-return" data-action="return-to-effect-choice">효과 선택으로 돌아가기</button>
    </aside>`
  }

  if (isEffectChoice) {
    return `<aside class="decision-dock has-selection is-effect-choice" aria-live="polite">
      <section class="effect-choice-overlay" role="dialog" aria-modal="true" aria-label="카드 효과 선택">
        <header class="effect-choice-overlay__header">
          <span>카드 효과 처리</span>
          <button type="button" class="decision-panel-battlefield" data-action="view-battlefield">전장 보기</button>
        </header>
        <div class="effect-choice-overlay__content">${activePanel}</div>
      </section>
    </aside>`
  }

  return `<aside class="decision-dock has-selection" aria-live="polite">${activePanel}</aside>`
}

function renderEffectChoiceLayer(): string {
  if (!game?.pendingChoice) return ''
  const pendingChoice = game.pendingChoice
  const isBattlefieldOnlyChoice = pendingChoice.playerId === game.viewer
    && (
      pendingChoice.type === 'DEMON_BREATH_TARGET'
      || (
        pendingChoice.type === 'SOF_CHOICE'
        && BATTLEFIELD_SOF_EFFECTS.has(pendingChoice.effect)
      )
    )
  if (isBattlefieldOnlyChoice) {
    const canSkip = pendingChoice.type === 'SOF_CHOICE' && pendingChoice.minChoices === 0
    return canSkip
      ? `<aside class="battlefield-effect-skip" aria-live="polite">
          <button type="button" data-action="resolve-sof-empty">건너뛰기</button>
        </aside>`
      : ''
  }

  const pendingPanel = renderPendingChoicePanel()
  if (!pendingPanel) return ''

  const nextDecisionPanelKey = `effect:${game.actionSequence}:${game.pendingChoice.type}`
  if (decisionPanelKey !== nextDecisionPanelKey) {
    decisionPanelCollapsed = false
    decisionPanelKey = nextDecisionPanelKey
  }

  if (decisionPanelCollapsed) {
    return `<aside class="effect-choice-dock is-battlefield-view" aria-live="polite">
      <button type="button" class="decision-panel-return" data-action="return-to-effect-choice">효과 선택으로 돌아가기</button>
    </aside>`
  }

  return `<aside class="effect-choice-dock" aria-live="polite">
    <section class="effect-choice-overlay" role="dialog" aria-modal="true" aria-label="카드 효과 선택">
      <header class="effect-choice-overlay__header">
        <span>카드 효과 처리</span>
        <button type="button" class="decision-panel-battlefield" data-action="view-battlefield">전장 보기</button>
      </header>
      <div class="effect-choice-overlay__content">${pendingPanel}</div>
    </section>
  </aside>`
}

function renderTurnControl(): string {
  if (!game) return ''
  if (game.status === 'finished') return ''
  const canEndTurn = game.status === 'playing'
    && roomPhase === 'playing'
    && game.viewer === game.currentPlayer
    && game.pendingChoice === null
    && playDraft === null
    && selectedAttackerId === null
  const endTurnHint = game.pendingChoice !== null
    ? '먼저 진행 중인 카드 효과를 선택하거나 건너뛰세요.'
    : playDraft !== null
      ? '먼저 카드 사용을 완료하거나 취소하세요.'
      : selectedAttackerId !== null
        ? '먼저 공격을 완료하거나 취소하세요.'
        : ''

  return `<aside class="turn-control" aria-label="턴 조작">
    <button id="end-turn-button" class="end-turn-button" type="button" ${endTurnHint ? `title="${escapeHtml(endTurnHint)}"` : ''} ${canEndTurn && !awaitingServer ? '' : 'disabled'}><span>내 턴</span><strong>종료</strong></button>
    ${renderTurnRibbon()}
  </aside>`
}

function renderGameResultOverlay(): string {
  if (!game || game.status !== 'finished') return ''
  const won = game.winner === game.viewer
  return `<section class="game-result-overlay game-result-overlay--${won ? 'victory' : 'defeat'}" role="dialog" aria-modal="true" aria-labelledby="game-result-title">
    <div class="game-result-panel">
      <h2 id="game-result-title">${won ? '승리했습니다' : '패배했습니다'}</h2>
      <button id="rematch-button" type="button">${isTutorial ? '로비로 가기' : '재대전'}</button>
    </div>
  </section>`
}

function renderRoomMenu(): string {
  if (!game || !roomMenuOpen) return ''
  return `<div class="room-menu" role="menu">
    <div class="room-menu__summary"><span>방 ${escapeHtml(roomId)}</span><span>턴 ${game.turnNumber}</span></div>
    <button id="copy-invite-button" type="button" role="menuitem">초대 링크 복사</button>
    <button id="surrender-button" type="button" role="menuitem" ${game.status === 'playing' ? '' : 'disabled'}>항복</button>
    <button id="leave-room-button" type="button" role="menuitem">${isTutorial ? '튜토리얼 나가기' : '자리 나가기'}</button>
  </div>`
}

function describeLoggedAction(entry: LoggedAction): string {
  const actor = entry.playerId === assignedPlayerId ? '나' : '상대'
  const source = entry.detail?.sourceCardId ? `《${CARDS[entry.detail.sourceCardId].name}》` : '카드'
  switch (entry.action.type) {
    case 'PLACE_MANA':
      return `${actor} · ${source}을(를) 마나로 배치`
    case 'PLAY_CARD':
      return `${actor} · ${source} 사용`
    case 'SUMMON_FROM_MANA':
      return `${actor} · 마나의 ${source} 소환`
    case 'ATTACK_UNIT':
      return `${actor} · ${source}으로 몬스터 공격`
    case 'ATTACK_PLAYER':
      return `${actor} · ${source}으로 플레이어 직접 공격`
    case 'RESOLVE_CHOICE':
      return `${actor} · ${entry.detail?.sourceCardId ? `${source} 효과` : '카드 효과'} 선택`
    case 'END_TURN':
      return `${actor} · 턴 종료`
    case 'SURRENDER':
      return `${actor} · 항복`
  }
}

function describeLoggedResult(entry: LoggedAction): string[] {
  const detail = entry.detail
  if (!detail) return []
  const names = (ids: CardId[] | undefined) => ids?.map((id) => CARDS[id].name).join(', ')
  const results: string[] = []
  const targets = names(detail.targetCardIds)
  const summoned = names(detail.summonedCardIds)
  const destroyed = names(detail.destroyedCardIds)
  if (targets) results.push(`대상: ${targets}`)
  if (summoned) results.push(`전장에 등장: ${summoned}`)
  if (destroyed) results.push(`전장을 떠남: ${destroyed}`)
  for (const playerId of ['P1', 'P2'] as const) {
    const label = playerId === assignedPlayerId ? '나' : '상대'
    const lost = detail.lifeLost?.[playerId]
    const drawn = detail.cardsDrawn?.[playerId]
    if (lost) results.push(`${label} 라이프 ${lost}장 상실`)
    if (drawn) results.push(`${label} 카드 ${drawn}장 획득`)
  }
  return results
}

function renderMatchLogModal(): string {
  if (!matchLogOpen) return ''
  const entries = [...matchLog].reverse().map((entry) => {
    const results = describeLoggedResult(entry)
    return `<li class="match-log-entry">
      <span class="match-log-entry__sequence">${entry.sequence}</span>
      <div class="match-log-entry__body">
        <strong>${escapeHtml(describeLoggedAction(entry))}</strong>
        ${results.length > 0 ? `<ul>${results.map((result) => `<li>${escapeHtml(result)}</li>`).join('')}</ul>` : ''}
      </div>
      <time>${new Date(entry.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
    </li>`
  }).join('')
  return `<div class="modal-backdrop match-log-backdrop" data-modal="match-log">
    <section class="match-log-dialog" role="dialog" aria-modal="true" aria-labelledby="match-log-title">
      <header>
        <div><p class="eyebrow">MATCH HISTORY</p><h2 id="match-log-title">대전 로그</h2></div>
        <button type="button" data-action="close-match-log">닫기</button>
      </header>
      <ol class="match-log-list">${entries || '<li class="match-log-empty">아직 기록된 행동이 없습니다.</li>'}</ol>
    </section>
  </div>`
}

function renderTurnAnnouncement(): string {
  if (!game || game.status !== 'playing' || turnAnnouncementKey === null) return ''
  return `<div class="turn-announcement" role="status" aria-live="assertive" aria-label="${game.turnNumber}턴, 내 턴">
    <div class="turn-announcement__panel">
      <span>YOUR TURN</span>
      <strong>내 턴</strong>
      <em><b>${game.turnNumber}</b> TURN</em>
    </div>
  </div>`
}

function renderTurnRibbon(): string {
  if (!game) return ''
  const needsMyChoice = game.pendingChoice?.playerId === game.viewer
  const isMyTurn = game.currentPlayer === game.viewer
  const stateClass = needsMyChoice
    ? 'turn-ribbon--response'
    : isMyTurn
      ? 'turn-ribbon--mine'
      : 'turn-ribbon--opponent'
  const timerLabel = needsMyChoice ? '선택 제한 시간' : '턴 제한 시간'

  return `<section class="turn-ribbon ${stateClass}" aria-label="${timerLabel}" aria-live="assertive">
    <span id="turn-timer" class="turn-timer"></span>
  </section>`
}

function renderRulebookBlock(block: ReturnType<typeof createRulebookDocument>['sections'][number]['blocks'][number]): string {
  switch (block.type) {
    case 'paragraph':
      return `<p>${escapeHtml(block.text)}</p>`
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul'
      return `<${tag}>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</${tag}>`
    }
    case 'callout':
      return `<p><strong>${escapeHtml(block.title)}</strong><br>${escapeHtml(block.text)}</p>`
    case 'terms':
      return `<dl class="keyword-list">${block.items.map((item) => `<div><dt>${escapeHtml(item.term)}</dt><dd>${escapeHtml(item.description)}</dd></div>`).join('')}</dl>`
  }
}

function renderRulebookModal(): string {
  if (!rulebookOpen) return ''
  const format = getFormat(game?.matchConfig.formatId ?? roomSettings.formatId)
  const document = createRulebookDocument(format)
  const index = document.sections
    .map((section) => `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.navLabel)}</a>`)
    .join('')
  const sections = document.sections
    .map((section) => `<section id="${escapeHtml(section.id)}"><h3>${escapeHtml(section.title)}</h3>${section.blocks.map(renderRulebookBlock).join('')}</section>`)
    .join('')

  return `<div class="modal-backdrop rulebook-backdrop" data-modal="rulebook">
    <section class="rulebook-dialog" role="dialog" aria-modal="true" aria-labelledby="rulebook-title">
      <header class="rulebook-dialog__header">
        <div><p class="eyebrow">DUEL SPIRITS</p><h2 id="rulebook-title">${escapeHtml(document.title)}</h2></div>
        <button type="button" data-action="close-rulebook" aria-label="룰북 닫기">닫기</button>
      </header>
      <nav class="rulebook-index" aria-label="룰북 목차">${index}</nav>
      <div class="rulebook-content">${sections}</div>
      <footer class="rulebook-dialog__footer"><span>규칙 ${escapeHtml(document.rulesVersion)} · ${escapeHtml(document.formatName)} · 카드 문구가 일반 규칙보다 우선합니다.</span><button type="button" data-action="close-rulebook">게임으로 돌아가기</button></footer>
    </section>
  </div>`
}

function renderDraftRoom(): string {
  if (!draftView) {
    return `<div class="waiting-stage"><section class="panel match-lobby draft-loading">
      <p class="eyebrow">SERVER DRAFT</p>
      <h2>드래프트 풀을 준비하고 있습니다.</h2>
    </section></div>`
  }

  const view = draftView
  const selected = new Set(view.selectedIndices)
  const selectedCount = view.selectedIndices.length
  const normalizedQuery = draftSearchQuery.trim().toLocaleLowerCase('ko-KR')
  const indexedPool = view.pool.cardIds
    .map((cardId, index) => ({ cardId, index }))
    .sort((left, right) => {
      const leftCard = CARDS[left.cardId]
      const rightCard = CARDS[right.cardId]
      return leftCard.cost - rightCard.cost
        || leftCard.attributes[0].localeCompare(rightCard.attributes[0])
        || leftCard.name.localeCompare(rightCard.name, 'ko-KR')
        || left.index - right.index
    })
  const filteredPool = indexedPool
    .filter(({ cardId }) => {
      const card = CARDS[cardId]
      return (!normalizedQuery
          || card.name.toLocaleLowerCase('ko-KR').includes(normalizedQuery)
          || card.rulesText.toLocaleLowerCase('ko-KR').includes(normalizedQuery))
        && (draftAttributeFilter === 'all' || card.attributes.includes(draftAttributeFilter))
        && (draftTypeFilter === 'all' || card.type === draftTypeFilter)
        && (draftCostFilter === 'all' || (draftCostFilter === 6 ? card.cost >= 6 : card.cost === draftCostFilter))
        && (draftSetFilter === 'all' || card.setId === draftSetFilter)
    })
  const groupedPool = [...filteredPool.reduce((groups, entry) => {
    const existing = groups.get(entry.cardId)
    if (existing) existing.push(entry.index)
    else groups.set(entry.cardId, [entry.index])
    return groups
  }, new Map<CardId, number[]>())]
  const cards = groupedPool.map(([cardId, indices]) => {
    const selectedIndices = indices.filter((index) => selected.has(index))
    const selectedCopies = selectedIndices.length
    const removeIndex = selectedIndices.at(-1)
    const addIndex = indices.find((index) => !selected.has(index))
    const isSelected = selectedCopies > 0
    return `<article class="card-pool-item draft-pool-card ${isSelected ? 'is-selected' : ''}" data-preview-card-id="${cardId}" tabindex="0" aria-label="${escapeHtml(CARDS[cardId].name)} 상세 보기">
      <button type="button" class="card-pool-card" data-draft-preview="${cardId}" aria-label="${escapeHtml(CARDS[cardId].name)} 상세 고정">
        ${renderCard(cardId, { interactive: false, classNames: ['builder-pool-card', 'game-card--center-name'] })}
      </button>
      <div class="card-pool-item__footer draft-quantity-footer">
        <button type="button" class="card-quantity-button" data-action="toggle-draft-card" data-draft-index="${removeIndex ?? ''}" aria-label="${escapeHtml(CARDS[cardId].name)} 한 장 빼기" ${view.confirmed || removeIndex === undefined ? 'disabled' : ''}>−</button>
        <strong class="card-copy-count">${selectedCopies} / ${indices.length}</strong>
        <button type="button" class="card-quantity-button" data-action="toggle-draft-card" data-draft-index="${addIndex ?? ''}" aria-label="${escapeHtml(CARDS[cardId].name)} 한 장 넣기" ${view.confirmed || addIndex === undefined || selectedCount >= view.deckSize ? 'disabled' : ''}>＋</button>
      </div>
    </article>`
  }).join('')
  const remaining = view.deckSize - selectedCount
  const selectedCardIds = view.selectedIndices.map((index) => view.pool.cardIds[index]).filter(Boolean)
  const attributeCounts = getAttributeDistribution(selectedCardIds)
  const costCounts = getCostDistribution(selectedCardIds)
  const distributionMax = Math.max(1, ...Object.values(attributeCounts), ...Object.values(costCounts))
  const attributeRows = (['fire', 'water', 'earth', 'dark', 'light'] as CardAttributeId[])
    .map((id) => `<div class="distribution-row"><span>${escapeHtml(CARD_ATTRIBUTES[id].name)}</span><span class="distribution-track"><span style="width:${attributeCounts[id] / distributionMax * 100}%"></span></span><strong>${attributeCounts[id]}</strong></div>`).join('')
    + `<div class="distribution-row"><span>다속성</span><span class="distribution-track"><span style="width:${attributeCounts.multi / distributionMax * 100}%"></span></span><strong>${attributeCounts.multi}</strong></div>`
  const sixPlus = Object.entries(costCounts).filter(([cost]) => Number(cost) >= 6).reduce((sum, [, count]) => sum + count, 0)
  const costRows = [0, 1, 2, 3, 4, 5]
    .map((cost) => `<div class="distribution-row"><span>비용 ${cost}</span><span class="distribution-track"><span style="width:${(costCounts[cost] ?? 0) / distributionMax * 100}%"></span></span><strong>${costCounts[cost] ?? 0}</strong></div>`).join('')
    + `<div class="distribution-row"><span>비용 6 이상</span><span class="distribution-track"><span style="width:${sixPlus / distributionMax * 100}%"></span></span><strong>${sixPlus}</strong></div>`
  const selectedGroups = [...indexedPool.reduce((groups, { cardId, index }) => {
    if (!selected.has(index)) return groups
    const existing = groups.get(cardId)
    if (existing) existing.push(index)
    else groups.set(cardId, [index])
    return groups
  }, new Map<CardId, number[]>())]
  const selectedCards = selectedGroups.map(([cardId, indices]) => {
    const card = CARDS[cardId]
    const attributes = card.attributes.map((attributeId) => CARD_ATTRIBUTES[attributeId].shortName).join('·')
    const availableIndices = indexedPool.filter((entry) => entry.cardId === cardId).map((entry) => entry.index)
    const addIndex = availableIndices.find((index) => !selected.has(index))
    const removeIndex = indices.at(-1)
    return `<li class="draft-deck-row" data-preview-card-id="${cardId}" tabindex="0">
      <button type="button" class="draft-deck-row__card" data-draft-preview="${cardId}">
        <span>${card.cost}</span><span><strong>${escapeHtml(card.name)}</strong><small>${escapeHtml(attributes)} · ${card.type === 'unit' ? '몬스터' : '주문'}</small></span>
      </button>
      <div class="draft-deck-row__quantity">
        <button type="button" data-action="toggle-draft-card" data-draft-index="${removeIndex ?? ''}" aria-label="${escapeHtml(card.name)} 한 장 빼기" ${view.confirmed ? 'disabled' : ''}>−</button>
        <strong>×${indices.length}</strong>
        <button type="button" data-action="toggle-draft-card" data-draft-index="${addIndex ?? ''}" aria-label="${escapeHtml(card.name)} 한 장 넣기" ${view.confirmed || addIndex === undefined || selectedCount >= view.deckSize ? 'disabled' : ''}>＋</button>
      </div>
    </li>`
  }).join('')
  const setTabs = [...new Set(view.pool.cardIds.map((cardId) => CARDS[cardId].setId))]
    .map((setId) => `<button type="button" class="card-set-tab ${draftSetFilter === setId ? 'is-active' : ''}" data-draft-set-filter="${setId}"><strong>${escapeHtml(CARD_SETS[setId].code)}</strong><span>${view.pool.cardIds.filter((id) => CARDS[id].setId === setId).length}</span></button>`).join('')

  return `<main class="app-shell deck-builder-screen draft-deck-builder-screen" aria-labelledby="draft-title">
    <header class="builder-header">
      <div class="builder-header__brand"><div><p class="eyebrow">SERVER DRAFT</p><h1 id="draft-title">덱 빌더</h1></div></div>
      <div class="draft-builder-header-status"><span>내 덱 <strong>${selectedCount}/${view.deckSize}</strong></span><span>상대 <strong>${view.opponentSelectedCount}/${view.deckSize}</strong></span><small>${view.opponentConfirmed ? '상대 확정 완료' : '상대 선택 중'}</small></div>
      <div class="draft-clock" aria-label="남은 드래프트 시간"><span>남은 시간</span><strong id="draft-timer">${formatDuration(view.deadlineAt - Date.now())}</strong></div>
    </header>
    <section class="deck-builder-workspace">
      <aside class="panel deck-filters">
        <div class="section-heading"><h2>카드 찾기</h2><span>${filteredPool.length}장</span></div>
        <label>검색<input id="draft-card-search" type="search" value="${escapeHtml(draftSearchQuery)}" placeholder="이름 또는 능력"></label>
        <label>속성<select id="draft-attribute-filter"><option value="all">전체 속성</option>${Object.values(CARD_ATTRIBUTES).map((attribute) => `<option value="${attribute.id}" ${draftAttributeFilter === attribute.id ? 'selected' : ''}>${escapeHtml(attribute.name)}</option>`).join('')}</select></label>
        <label>종류<select id="draft-type-filter"><option value="all">전체 종류</option><option value="unit" ${draftTypeFilter === 'unit' ? 'selected' : ''}>몬스터</option><option value="spell" ${draftTypeFilter === 'spell' ? 'selected' : ''}>주문</option></select></label>
        <label>비용<select id="draft-cost-filter"><option value="all">전체 비용</option>${[0,1,2,3,4,5,6].map((cost) => `<option value="${cost}" ${draftCostFilter === cost ? 'selected' : ''}>비용 ${cost}${cost === 6 ? ' 이상' : ''}</option>`).join('')}</select></label>
        <div class="deck-format-note"><strong>드래프트</strong>${view.poolSize}장 중 ${view.deckSize}장을 선택합니다. 같은 카드는 최대 ${getFormat(roomSettings.formatId).maxCopiesPerCard}장입니다.</div>
        <section class="deck-stats"><h3>속성 분포</h3>${attributeRows}<h3>비용 분포</h3>${costRows}<p>평균 비용: <strong>${getAverageCost(selectedCardIds).toFixed(2)}</strong></p></section>
      </aside>
      <section class="panel card-pool-panel">
        <header class="section-heading"><div><h2>카드 풀</h2><p>클릭해 상세 고정 · 버튼으로 추가</p></div><span>${view.poolSize}장 지급</span></header>
        <div class="card-pool-stage">
          <section class="card-set-tabs"><div class="card-set-tabs__label"><strong>카드 세트</strong></div><div class="card-set-tabs__buttons"><button type="button" class="card-set-tab ${draftSetFilter === 'all' ? 'is-active' : ''}" data-draft-set-filter="all"><strong>전체</strong><span>${view.poolSize}</span></button>${setTabs}</div></section>
          <div class="card-pool-grid draft-pool-grid" aria-label="드래프트 카드 풀">${cards || '<p class="empty-row">조건에 맞는 카드가 없습니다.</p>'}</div>
        </div>
      </section>
      <aside class="builder-side-rail">
        ${renderCardInspector()}
        <section class="panel current-deck-panel draft-current-deck">
          <header class="section-heading"><div><h2>현재 덱</h2><p>${view.confirmed ? '확정 완료' : remaining > 0 ? `${remaining}장 더 선택` : '확정 가능'}</p></div><strong>${selectedCount}/${view.deckSize}</strong></header>
          <ol class="deck-list">${selectedCards || '<li class="draft-deck-empty">카드 풀에서 카드를 추가해 주세요.</li>'}</ol>
          <div class="draft-current-deck__footer"><p>${escapeHtml(message)}</p><button id="confirm-draft-button" class="ready-primary" type="button" ${selectedCount === view.deckSize && !view.confirmed ? '' : 'disabled'}>${view.confirmed ? '확정 완료' : '이 덱으로 확정'}</button></div>
        </section>
      </aside>
    </section>
  </main>`
}

function renderWaitingRoom(): string {
  const waitingFormat = getFormat(roomSettings.formatId)
  const decks = loadDecks()
  const options = decks.map((deck) => {
    const compatible = isDeckCompatibleWithFormat(
      deck,
      roomSettings.formatId,
      roomSettings.selectedSetIds,
    )
    return `<option value="${escapeHtml(deck.id)}" ${deck.id === selectedDeckId ? 'selected' : ''} ${compatible ? '' : 'disabled'}>${escapeHtml(deck.name)} · ${escapeHtml(getFormat(deck.formatId).shortName)}${compatible ? '' : ' · 포맷 불일치'}</option>`
  }).join('')
  const me = assignedPlayerId
  const myDeckState = me ? deckStates[me] : null
  const ready = myDeckState?.ready ?? false
  const playerIds: PlayerId[] = me === 'P2' ? ['P1', 'P2'] : ['P2', 'P1']
  const seatCards = playerIds.map((playerId) => {
    const deckState = deckStates[playerId]
    const isMe = playerId === me
    const connected = connectedPlayers.includes(playerId)
    const reserved = reservedPlayers.includes(playerId)
    const deckLabel = isMe
      ? deckState.name ?? (deckState.submitted ? '덱 적용 완료' : '덱을 선택해 주세요')
      : deckState.submitted ? '덱 적용 완료' : '덱 정보 비공개'
    const connectionLabel = connected ? '접속 중' : reserved ? '재접속 대기' : '빈자리'
    const statusLabel = deckState.ready ? '준비 완료' : connected ? '준비 중' : '상대를 기다리는 중'
    return `<article class="seat-card ${connected ? 'is-online' : ''} ${deckState.ready ? 'is-ready' : ''}">
      <strong>${isMe ? '나' : '상대 플레이어'}</strong>
      <span>${escapeHtml(deckLabel)}</span>
      <span class="seat-status">${escapeHtml(statusLabel)}</span>
      <small>${escapeHtml(connectionLabel)} <span id="seat-expiry-${playerId}"></span></small>
    </article>`
  }).join('<div class="seat-grid__versus" aria-hidden="true">VS</div>')

  return `<div class="waiting-stage"><section class="panel match-lobby">
    <header class="match-lobby__header">
      <div><p class="eyebrow">PRIVATE DUEL ROOM</p><h2>${escapeHtml(getFormat(roomSettings.formatId).name)}</h2></div>
      <div class="match-lobby__room-meta"><span>방 코드</span><strong>${escapeHtml(roomId)}</strong><button id="copy-invite-button" type="button">초대 링크 복사</button></div>
    </header>
    <div class="seat-grid">${seatCards}</div>
    ${roomSettings.formatId === 'draft-v1'
      ? `<div class="match-deck-controls match-deck-controls--draft-waiting">
          <p class="match-lobby__message" role="status">두 번째 플레이어가 들어오면 ${roomSettings.draftLimitSeconds}초 드래프트가 자동으로 시작됩니다. 각자 ${waitingFormat.draft?.poolSize ?? 0}장 중 ${waitingFormat.draft?.deckSize ?? waitingFormat.deckSize}장을 고릅니다.</p>
        </div>`
      : `<div class="match-deck-controls">
          <label class="match-deck-picker"><span>사용할 덱</span><strong>${ready ? '준비 완료' : awaitingServer ? '덱 확인 중' : myDeckState?.submitted ? '제출 완료 · 준비 전' : '선택 시 자동 제출'}</strong><select id="room-deck-select" ${awaitingServer ? 'disabled' : ''}>${options}</select></label>
          <button id="deck-ready-button" class="ready-primary${ready ? ' is-ready' : ''}" type="button" ${awaitingServer || !myDeckState?.submitted ? 'disabled' : ''}>${ready ? '준비 취소' : '준비 완료'}</button>
          <a class="button-link" href="./#decks" target="_blank">덱 편집</a>
          <p class="match-lobby__message" role="status">${escapeHtml(message || (connectedPlayers.length < 2 ? '초대 링크를 친구에게 보내세요.' : '두 플레이어가 준비하면 대전이 시작됩니다.'))}</p>
        </div>`}
  </section></div>`
}

function render(): void {
  const manaDrawerScrollState = captureManaDrawerScrollState()
  const opponentId: PlayerId | null = game
    ? (game.viewer === 'P1' ? 'P2' : 'P1')
    : null
  let content = ''

  document.body.classList.toggle('game-active', game !== null)
  document.body.classList.toggle('draft-active', roomPhase === 'drafting')
  document.body.classList.toggle('room-waiting-active', game === null && !joinRejectedMessage && !hasLeftRoom)

  if (joinRejectedMessage || hasLeftRoom) {
    content = `<section class="panel room-ended-panel"><h2>${escapeHtml(joinRejectedMessage ?? '자리에서 나왔습니다.')}</h2><a class="button-link" href="./">첫 화면</a></section>`
  } else if (!game && roomPhase === 'drafting') content = renderDraftRoom()
  else if (!game) content = renderWaitingRoom()
  else if (opponentId) {
    content = game.status === 'finished'
      ? `<section class="game-layout game-layout--finished">
          <main
            class="battle-board battle-board--finished"
            style="--battlefield-image: url('${escapeHtml(BATTLEFIELD_BACKGROUND_URL)}');"
          >
            ${renderGameResultOverlay()}
          </main>
        </section>`
      : `<section class="game-layout">
      <main
        class="battle-board ${game.currentPlayer === game.viewer ? 'is-my-turn' : 'is-opponent-turn'} ${game.pendingChoice?.playerId === game.viewer ? 'is-my-response' : ''}"
        style="--battlefield-image: url('${escapeHtml(BATTLEFIELD_BACKGROUND_URL)}');"
      >
        ${renderArenaLifeRail()}
        <section class="arena-center">
          ${renderArenaLifeBlock(opponentId, 'opponent')}
          <div class="arena-center__main">
            ${renderPlayerBoard(opponentId, 'opponent')}
            ${renderPlayerBoard(game.viewer, 'self')}
            ${renderDecisionDock(opponentId)}
          </div>
          ${renderArenaLifeBlock(game.viewer, 'self')}
        </section>
        ${renderArenaResourceRail(opponentId)}
      </main>
      ${renderManaDrawer()}
      ${renderDiscardModal()}
      ${renderEffectChoiceLayer()}
      ${renderTurnAnnouncement()}
    </section>`
  }

  const gameTopbar = game?.status === 'finished'
    ? ''
    : game
    ? `<header class="room-topbar room-topbar--game">
        <div class="brand-cluster"><strong>Duel Spirits</strong><span class="connection-state">${escapeHtml(networkStatus)}</span></div>
        <div class="match-state"><span>${escapeHtml(getFormat(game.matchConfig.formatId).shortName)}</span><span>${game.viewer} 시점</span><span>방 ${escapeHtml(roomId)}</span></div>
        <button id="rulebook-button" class="topbar-text-button" type="button">룰북</button>
        <button id="match-log-button" class="topbar-text-button" type="button">로그 보기</button>
        <div class="room-menu-anchor">
          <button id="room-menu-button" class="icon-button" type="button" aria-expanded="${roomMenuOpen}" aria-label="방 메뉴">⋮</button>
          ${renderRoomMenu()}
        </div>
      </header>`
    : `<header class="room-topbar"><div class="brand-cluster"><strong>Duel Spirits</strong><span class="connection-state">${escapeHtml(networkStatus)}</span></div><span>친구와 대전 준비</span><button id="rulebook-button" class="topbar-text-button" type="button">룰북</button></header>`

  const notice = gameNotice
    ? `<div class="game-notice" role="alert" aria-live="assertive"><span>${escapeHtml(gameNotice)}</span><button type="button" data-action="dismiss-game-notice" aria-label="알림 닫기">×</button></div>`
    : ''
  appElement.innerHTML = `<div class="room-screen ${game ? 'room-screen--game' : ''} ${game?.status === 'finished' ? 'room-screen--finished' : ''}">${gameTopbar}${content}${notice}</div>${renderRulebookModal()}${renderMatchLogModal()}`
  updateFixedStageScale()
  bindEvents()
  restoreManaDrawerScrollState(manaDrawerScrollState)
  updateClock()
}

function sendAction(action: GameAction): void {
  if (isTutorial) {
    const expectedTypes: GameAction['type'][] = [
      'PLACE_MANA',
      'END_TURN',
      'PLAY_CARD',
      'END_TURN',
      'ATTACK_UNIT',
      'END_TURN',
      'ATTACK_PLAYER',
      'PLAY_CARD',
      'ATTACK_PLAYER',
    ]
    if (action.type !== expectedTypes[tutorialStep]) {
      gameNotice = TUTORIAL_MESSAGES[tutorialStep] ?? null
      render()
      return
    }
    if (tutorialStep === 0 && action.type === 'PLACE_MANA' && action.cardInstanceId !== 'mana-source') return
    if (tutorialStep === 2 && action.type === 'PLAY_CARD' && action.cardInstanceId !== 'summon-card') return
    if (tutorialStep === 7 && action.type === 'PLAY_CARD' && action.cardInstanceId !== 'evolution-card') return
    setTutorialStep(tutorialStep + 1)
    if (action.type === 'END_TURN' && game) {
      const key = `${game.turnNumber}:${game.viewer}`
      turnAnnouncementKey = key
      if (turnAnnouncementTimer !== null) window.clearTimeout(turnAnnouncementTimer)
      turnAnnouncementTimer = window.setTimeout(() => {
        if (turnAnnouncementKey === key) {
          turnAnnouncementKey = null
          render()
        }
      }, 1500)
    }
    render()
    return
  }
  awaitingServer = true
  sendPlayerAction(socket, action)
  render()
}

function toggleString(values: string[], value: string, max?: number): string[] {
  if (values.includes(value)) return values.filter((item) => item !== value)
  if (max !== undefined && values.length >= max) return values
  return [...values, value]
}

function confirmPlayDraft(): void {
  if (!game || !playDraft) return
  const card = selectedPlayCard()
  if (!card) return
  const definition = CARDS[card.cardId]
  const cost = effectiveCost(card)
  if (!meetsSummonConditionView(game.players[game.viewer], card.cardId)) {
    message = '화산쥐는 내 마나에 불 카드가 2장 이상 있어야 소환할 수 있습니다.'
    render()
    return
  }
  if (card.cardId === 'rising_earth' && playDraft.effectManaId) {
    const effectManaId = playDraft.effectManaId
    const selectedMana = game.players[game.viewer].mana.find((mana) => mana.instanceId === effectManaId)
    if (selectedMana && !meetsSummonConditionView(game.players[game.viewer], selectedMana.cardId)) {
      message = '화산쥐는 내 마나에 불 카드가 2장 이상 있어야 효과로 소환할 수 있습니다.'
      render()
      return
    }
  }
  if (game.players[game.viewer].mana.filter((mana) => !mana.exhausted).length < cost) {
    message = `준비된 마나가 ${cost}장 필요합니다.`
    render()
    return
  }
  if (definition.type === 'unit') {
    if (definition.evolutionAttribute && !playDraft.evolutionUnitId) {
      message = '진화시킬 내 몬스터를 선택해 주세요.'
      render()
      return
    }
    if (!definition.evolutionAttribute && playDraft.fieldSlot === undefined) {
      message = '소환할 전장 슬롯을 선택해 주세요.'
      render()
      return
    }
  }
  if (card.cardId === 'rising_earth' && playDraft.fieldSlot === undefined) {
    message = '효과로 소환할 전장 슬롯을 선택해 주세요.'
    render()
    return
  }
  if (playDraftNeedsUnitTarget(card) && !playDraft.unitId) {
    message = '대상 몬스터를 선택해 주세요.'
    render()
    return
  }
  if (needsLifeTarget(card.cardId) && playDraft.lifeIndex === undefined) {
    message = '대상 라이프를 선택해 주세요.'
    render()
    return
  }
  if (playDraftNeedsEffectMana(card) && !playDraft.effectManaId) {
    message = '카드 효과에 사용할 마나를 선택해 주세요.'
    render()
    return
  }

  const selection: CardPlaySelection = {
    unitId: playDraft.unitId,
    lifeIndex: playDraft.lifeIndex,
    effectManaId: playDraft.effectManaId,
    discardId: playDraft.discardId,
    fieldSlot: playDraft.fieldSlot,
    evolutionUnitId: playDraft.evolutionUnitId,
  }
  openDiscardPlayerId = null
  openManaPlayerId = null
  sendAction({
    type: 'PLAY_CARD',
    cardInstanceId: playDraft.cardInstanceId,
    manaIds: [...playDraft.manaIds],
    selection,
  })
}

function setCardInspector(cardId: CardId | null, pinned: boolean, instanceId: string | null = null): void {
  const inspector = document.querySelector<HTMLElement>('#card-inspector')
  if (pinned) {
    pinnedPreviewCardId = cardId
    pinnedPreviewInstanceId = instanceId
  }
  if (!inspector) return

  if (!cardId) {
    inspector.classList.add('is-visible', 'is-empty')
    inspector.classList.remove('is-pinned')
    inspector.setAttribute('aria-hidden', 'false')
    inspector.innerHTML = renderCardInspectorPlaceholder()
    return
  }

  inspector.innerHTML = renderCardInspectorContent(cardId, instanceId)
  inspector.classList.add('is-visible')
  inspector.classList.remove('is-empty')
  inspector.classList.toggle('is-pinned', pinnedPreviewCardId === cardId && pinnedPreviewInstanceId === instanceId)
  inspector.setAttribute('aria-hidden', 'false')
  inspector.querySelector<HTMLElement>('[data-action="close-card-preview"]')?.addEventListener('click', () => {
    pinnedPreviewCardId = null
    pinnedPreviewInstanceId = null
    setCardInspector(null, false)
  })
}

function closeTransientLayers(): boolean {
  if (matchLogOpen) {
    matchLogOpen = false
    render()
    return true
  }
  if (rulebookOpen) {
    rulebookOpen = false
    render()
    return true
  }
  if (openDiscardPlayerId) {
    openDiscardPlayerId = null
    render()
    return true
  }
  if (openManaPlayerId) {
    openManaPlayerId = null
    render()
    return true
  }
  if (roomMenuOpen) {
    roomMenuOpen = false
    render()
    return true
  }
  if (pinnedPreviewCardId) {
    pinnedPreviewCardId = null
    pinnedPreviewInstanceId = null
    setCardInspector(null, false)
    return true
  }
  return false
}

function bindClick<T extends HTMLElement>(
  selector: string,
  handler: (element: T, event: MouseEvent) => void,
): void {
  document.querySelector<T>(selector)?.addEventListener('click', (event) => {
    handler(event.currentTarget as T, event)
  })
}

function bindClicks<T extends HTMLElement>(
  selector: string,
  handler: (element: T, event: MouseEvent) => void,
): void {
  for (const element of document.querySelectorAll<T>(selector)) {
    element.addEventListener('click', (event) => {
      handler(event.currentTarget as T, event)
    })
  }
}

function playerIdFromDataset(element: HTMLElement): PlayerId | null {
  const playerId = element.dataset.playerId
  return playerId === 'P1' || playerId === 'P2' ? playerId : null
}

function bindRulebookEvents(): void {
  bindClick<HTMLButtonElement>('#rulebook-button', () => {
    rulebookOpen = true
    roomMenuOpen = false
    render()
  })
  bindClicks<HTMLElement>('[data-action="close-rulebook"]', () => {
    rulebookOpen = false
    render()
  })
  document.querySelector<HTMLElement>('[data-modal="rulebook"]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      rulebookOpen = false
      render()
    }
  })
}

function bindMatchLogEvents(): void {
  bindClick<HTMLButtonElement>('#match-log-button', () => {
    matchLogOpen = true
    rulebookOpen = false
    roomMenuOpen = false
    render()
  })
  bindClicks<HTMLElement>('[data-action="close-match-log"]', () => {
    matchLogOpen = false
    render()
  })
  document.querySelector<HTMLElement>('[data-modal="match-log"]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      matchLogOpen = false
      render()
    }
  })
}

function bindRoomMenuEvents(): void {
  bindClick<HTMLButtonElement>('#room-menu-button', () => {
    roomMenuOpen = !roomMenuOpen
    render()
  })

  bindClick<HTMLElement>('[data-action="view-battlefield"]', () => {
    decisionPanelCollapsed = true
    render()
  })
  bindClick<HTMLElement>('[data-action="return-to-effect-choice"]', () => {
    decisionPanelCollapsed = false
    render()
  })
}

function bindHandScrollEvents(): void {
  const handScroller = document.querySelector<HTMLElement>('.hand-zone--self')
  const handScrollShell = handScroller?.closest<HTMLElement>('.hand-scroll-shell') ?? null
  if (handScroller && handScrollShell) {
    const previousButton = handScrollShell.querySelector<HTMLButtonElement>('.hand-scroll-button--previous')
    const nextButton = handScrollShell.querySelector<HTMLButtonElement>('.hand-scroll-button--next')
    const updateHandScrollState = () => {
      const maximum = Math.max(0, handScroller.scrollWidth - handScroller.clientWidth)
      handScrollLeft = Math.min(maximum, Math.max(0, handScroller.scrollLeft))
      handScrollShell.classList.toggle('has-overflow', maximum > 2)
      if (previousButton) previousButton.disabled = handScrollLeft <= 2
      if (nextButton) nextButton.disabled = handScrollLeft >= maximum - 2
    }
    const scrollHand = (direction: number) => {
      handScroller.scrollBy({
        left: direction * Math.max(180, handScroller.clientWidth * .65),
        behavior: 'smooth',
      })
    }

    handScroller.scrollLeft = handScrollLeft
    const selectedCard = handScroller.querySelector<HTMLElement>('.hand-card.is-selected')
    const selectedCardId = selectedCard?.dataset.instanceId ?? null
    if (selectedCard && selectedCardId !== lastCenteredHandCardId) {
      handScroller.scrollLeft = selectedCard.offsetLeft
        - (handScroller.clientWidth - selectedCard.offsetWidth) / 2
      lastCenteredHandCardId = selectedCardId
    } else if (!selectedCard) {
      lastCenteredHandCardId = null
    }

    handScroller.addEventListener('scroll', updateHandScrollState, { passive: true })
    handScroller.addEventListener('wheel', (event) => {
      if (handScroller.scrollWidth <= handScroller.clientWidth + 2) return
      const movement = Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY
      if (movement === 0) return
      event.preventDefault()
      handScroller.scrollLeft += movement
    }, { passive: false })

    let dragStartX = 0
    let dragStartScrollLeft = 0
    let dragged = false
    handScroller.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      if ((event.target as HTMLElement).closest('button')) return
      dragStartX = event.clientX
      dragStartScrollLeft = handScroller.scrollLeft
      dragged = false
      handScroller.setPointerCapture(event.pointerId)
      handScrollShell.classList.add('is-dragging')
    })
    handScroller.addEventListener('pointermove', (event) => {
      if (!handScroller.hasPointerCapture(event.pointerId)) return
      const movement = event.clientX - dragStartX
      if (Math.abs(movement) > 5) dragged = true
      if (dragged) handScroller.scrollLeft = dragStartScrollLeft - movement
    })
    const endHandDrag = (event: PointerEvent) => {
      if (handScroller.hasPointerCapture(event.pointerId)) {
        handScroller.releasePointerCapture(event.pointerId)
      }
      handScrollShell.classList.remove('is-dragging')
      if (dragged) {
        window.setTimeout(() => {
          dragged = false
        }, 0)
      }
    }
    handScroller.addEventListener('pointerup', endHandDrag)
    handScroller.addEventListener('pointercancel', endHandDrag)
    handScroller.addEventListener('click', (event) => {
      if (!dragged) return
      event.preventDefault()
      event.stopImmediatePropagation()
      dragged = false
    }, true)

    for (const button of handScrollShell.querySelectorAll<HTMLButtonElement>('[data-action="scroll-hand"]')) {
      button.addEventListener('click', () => {
        scrollHand(Number(button.dataset.direction ?? 0))
      })
    }
    requestAnimationFrame(updateHandScrollState)
  }
}

function bindZoneModalEvents(): void {
  bindClicks<HTMLElement>('[data-action="open-discard"]', (control) => {
    const playerId = playerIdFromDataset(control)
    if (!playerId) return
    openDiscardPlayerId = playerId
    roomMenuOpen = false
    render()
  })
  bindClicks<HTMLElement>('[data-action="close-discard"]', () => {
    openDiscardPlayerId = null
    render()
  })
  bindClicks<HTMLElement>('[data-action="view-discard-player"]', (control) => {
    const playerId = playerIdFromDataset(control)
    if (!playerId) return
    openDiscardPlayerId = playerId
    render()
  })
  document.querySelector<HTMLElement>('[data-modal="discard"]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      openDiscardPlayerId = null
      render()
    }
  })

  bindClicks<HTMLElement>('[data-action="open-mana-drawer"]', (control) => {
    const playerId = playerIdFromDataset(control)
    if (!playerId) return
    openManaPlayerId = playerId
    pinnedPreviewCardId = null
    pinnedPreviewInstanceId = null
    render()
  })
  bindClicks<HTMLElement>('[data-action="close-mana-drawer"]', () => {
    openManaPlayerId = null
    render()
  })
  document.querySelector<HTMLElement>('[data-modal="mana-drawer"]')?.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      openManaPlayerId = null
      render()
    }
  })
}

function bindCardPreviewEvents(): void {
  bindClicks<HTMLElement>('[data-action="close-card-preview"]', () => {
    pinnedPreviewCardId = null
    pinnedPreviewInstanceId = null
    setCardInspector(null, false)
  })

  for (const element of document.querySelectorAll<HTMLElement>('[data-card-id], [data-preview-card-id]')) {
    if (element.closest('.card-inspector')) continue
    const rawCardId = element.dataset.previewCardId ?? element.dataset.cardId
    if (!rawCardId || !(rawCardId in CARDS)) continue
    const cardId = rawCardId as CardId

    const instanceId = element.dataset.instanceId ?? null
    element.addEventListener('pointerenter', () => {
      if (!pinnedPreviewCardId) setCardInspector(cardId, false, instanceId)
    })
    element.addEventListener('pointerleave', () => {
      if (!pinnedPreviewCardId) setCardInspector(null, false)
    })
    element.addEventListener('focus', () => {
      if (!pinnedPreviewCardId) setCardInspector(cardId, false, instanceId)
    })
    element.addEventListener('blur', () => {
      if (!pinnedPreviewCardId) setCardInspector(null, false)
    })
    element.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button, [data-action]')) return
      const samePinnedCard = pinnedPreviewCardId === cardId
        && pinnedPreviewInstanceId === instanceId
      if (samePinnedCard) {
        pinnedPreviewCardId = null
        pinnedPreviewInstanceId = null
        setCardInspector(null, false)
      } else {
        setCardInspector(cardId, true, instanceId)
      }
    })
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      if ((event.target as HTMLElement).closest('button')) return
      event.preventDefault()
      const samePinnedCard = pinnedPreviewCardId === cardId
        && pinnedPreviewInstanceId === instanceId
      if (samePinnedCard) {
        pinnedPreviewCardId = null
        pinnedPreviewInstanceId = null
        setCardInspector(null, false)
      } else {
        setCardInspector(cardId, true, instanceId)
      }
    })
  }
}

function bindGlobalKeyboardEvents(): void {
  document.onkeydown = (event) => {
    if (event.key === 'Escape') closeTransientLayers()
  }
}

function bindWaitingRoomEvents(): void {
  document.querySelector<HTMLSelectElement>('#room-deck-select')?.addEventListener('change', (event) => {
    selectedDeckId = (event.currentTarget as HTMLSelectElement).value
    setActiveDeckId(selectedDeckId)
    submitSelectedDeck()
  })
  document.querySelector<HTMLButtonElement>('#deck-ready-button')?.addEventListener('click', () => {
    if (!assignedPlayerId || awaitingServer || !deckStates[assignedPlayerId].submitted) return
    const nextReady = !deckStates[assignedPlayerId].ready
    awaitingServer = true
    message = nextReady ? '준비 상태를 확정하고 있습니다.' : '준비를 취소하고 있습니다.'
    sendDeckReady(socket, nextReady)
    render()
  })
  const renderDraftFilters = (focusSearch = false): void => {
    const scrollTop = document.querySelector<HTMLElement>('.draft-pool-grid')?.scrollTop ?? 0
    const cursor = document.querySelector<HTMLInputElement>('#draft-card-search')?.selectionStart ?? draftSearchQuery.length
    render()
    const pool = document.querySelector<HTMLElement>('.draft-pool-grid')
    if (pool) pool.scrollTop = scrollTop
    if (focusSearch) {
      const input = document.querySelector<HTMLInputElement>('#draft-card-search')
      input?.focus({ preventScroll: true })
      input?.setSelectionRange(cursor, cursor)
    }
  }
  document.querySelector<HTMLInputElement>('#draft-card-search')?.addEventListener('input', (event) => {
    draftSearchQuery = (event.currentTarget as HTMLInputElement).value
    renderDraftFilters(true)
  })
  document.querySelector<HTMLSelectElement>('#draft-attribute-filter')?.addEventListener('change', (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value
    draftAttributeFilter = value === 'all' ? 'all' : value as CardAttributeId
    renderDraftFilters()
  })
  document.querySelector<HTMLSelectElement>('#draft-type-filter')?.addEventListener('change', (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value
    draftTypeFilter = value === 'unit' || value === 'spell' ? value : 'all'
    renderDraftFilters()
  })
  document.querySelector<HTMLSelectElement>('#draft-cost-filter')?.addEventListener('change', (event) => {
    const value = (event.currentTarget as HTMLSelectElement).value
    draftCostFilter = value === 'all' ? 'all' : Number(value)
    renderDraftFilters()
  })
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-draft-set-filter]')) {
    button.addEventListener('click', () => {
      const value = button.dataset.draftSetFilter
      draftSetFilter = value === 'all' || !value ? 'all' : value as import('../content/schema').SetId
      renderDraftFilters()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-draft-preview]')) {
    button.addEventListener('click', () => {
      const cardId = button.dataset.draftPreview as CardId | undefined
      if (cardId) setCardInspector(cardId, true)
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-draft-card"]')) {
    button.addEventListener('click', () => {
      if (!draftView || draftView.confirmed) return
      const index = Number(button.dataset.draftIndex)
      if (!Number.isInteger(index) || !draftView.pool.cardIds[index]) return
      const selected = new Set(draftView.selectedIndices)
      if (selected.has(index)) {
        selected.delete(index)
      } else {
        if (selected.size >= draftView.deckSize) {
          message = `드래프트 덱은 ${draftView.deckSize}장입니다.`
          renderDraftFilters()
          return
        }
        const cardId = draftView.pool.cardIds[index]
        const copyCount = [...selected].filter(
          (selectedIndex) => draftView?.pool.cardIds[selectedIndex] === cardId,
        ).length
        const copyLimit = getFormat(roomSettings.formatId).maxCopiesPerCard
        if (copyCount >= copyLimit) {
          message = `같은 카드는 최대 ${copyLimit}장까지 선택할 수 있습니다.`
          renderDraftFilters()
          return
        }
        selected.add(index)
      }
      draftView = {
        ...draftView,
        selectedIndices: [...selected].sort((left, right) => left - right),
      }
      sendDraftSelection(socket, draftView.selectedIndices)
      renderDraftFilters()
    })
  }
  document.querySelector<HTMLButtonElement>('#confirm-draft-button')?.addEventListener('click', () => {
    if (!draftView || draftView.confirmed || draftView.selectedIndices.length !== draftView.deckSize) return
    awaitingServer = true
    sendDraftConfirm(socket)
    message = '드래프트 덱을 서버에서 확인하고 있습니다.'
    render()
  })
}

function bindPlayDraftEvents(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="place-mana"]')) {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const id = button.dataset.cardInstanceId
      if (id) sendAction({ type: 'PLACE_MANA', cardInstanceId: id })
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="begin-play-card"]')) {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const id = button.dataset.cardInstanceId
      if (!id) return
      playDraft = { cardInstanceId: id, manaIds: [] }
      const draftCard = selectedPlayCard()
      openManaPlayerId = draftCard && playDraftNeedsEffectMana(draftCard)
        ? game?.viewer ?? null
        : null
      summonFromManaDraftId = null
      selectedAttackerId = null
      selectedAttackLifeSlotIndices = []
      message = '비용 마나는 자동으로 소진됩니다. 필요한 대상만 선택해 주세요.'
      render()
    })
  }
  for (const cardElement of document.querySelectorAll<HTMLElement>('.mana-card[data-action="select-cost-mana"]')) {
    cardElement.addEventListener('click', () => {
      if (!playDraft) return
      const manaId = cardElement.dataset.manaId
      const card = selectedPlayCard()
      if (!manaId || !card) return
      if (playDraft.effectManaId === manaId && card.cardId !== 'lava_gardener') return
      const cost = effectiveCost(card)
      const next = toggleString(playDraft.manaIds, manaId, cost)
      if (next.length === playDraft.manaIds.length && !playDraft.manaIds.includes(manaId)) {
        message = `비용 마나는 ${cost}장까지만 선택할 수 있습니다.`
      }
      playDraft.manaIds = next
      render()
    })
    cardElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      cardElement.click()
    })
  }
  for (const cardElement of document.querySelectorAll<HTMLElement>('.mana-card[data-action="select-effect-mana"]')) {
    cardElement.addEventListener('click', () => {
      if (!playDraft) return
      const manaId = cardElement.dataset.manaId
      if (!manaId) return
      const draftCard = selectedPlayCard()
      if (playDraft.manaIds.includes(manaId) && draftCard?.cardId !== 'lava_gardener') return
      if (playDraft.effectManaId === manaId && playDraft.manaIds.includes(manaId)) {
        playDraft.effectManaId = undefined
        playDraft.manaIds = playDraft.manaIds.filter((id) => id !== manaId)
        render()
        return
      }
      playDraft.effectManaId = playDraft.effectManaId === manaId ? undefined : manaId
      render()
    })
    cardElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      cardElement.click()
    })
  }
  for (const cardElement of document.querySelectorAll<HTMLElement>('.field-slot-frame[data-action="select-spell-unit"]')) {
    cardElement.addEventListener('click', () => {
      if (!playDraft) return
      const unitId = cardElement.dataset.unitId
      if (!unitId) return
      playDraft.unitId = playDraft.unitId === unitId ? undefined : unitId
      render()
    })
    cardElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      cardElement.click()
    })
  }
  for (const cardElement of document.querySelectorAll<HTMLElement>('.field-slot-frame[data-action="select-evolution-unit"]')) {
    cardElement.addEventListener('click', () => {
      if (!playDraft) return
      const unitId = cardElement.dataset.unitId
      if (!unitId) return
      playDraft.evolutionUnitId = playDraft.evolutionUnitId === unitId ? undefined : unitId
      render()
    })
    cardElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      cardElement.click()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-spell-life"]')) {
    button.addEventListener('click', () => {
      if (!playDraft) return
      const index = Number(button.dataset.lifeIndex)
      if (!Number.isInteger(index)) return
      playDraft.lifeIndex = playDraft.lifeIndex === index ? undefined : index
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-discard-return"]')) {
    button.addEventListener('click', () => {
      if (!playDraft) return
      const id = button.dataset.cardInstanceId
      if (!id) return
      playDraft.discardId = playDraft.discardId === id ? undefined : id
      render()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="confirm-play-card"]')) {
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      confirmPlayDraft()
    })
    button.addEventListener('click', confirmPlayDraft)
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="cancel-play-card"]')) {
    button.addEventListener('click', () => {
      playDraft = null
      summonFromManaDraftId = null
      openDiscardPlayerId = null
      openManaPlayerId = null
      message = '카드 사용 선택을 취소했습니다.'
      render()
    })
  }
}

function bindSummonFromManaEvents(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="begin-summon-from-mana"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.manaId
      if (!id) return
      summonFromManaDraftId = id
      openManaPlayerId = null
      playDraft = null
      selectedAttackerId = null
      message = '너무 무거운 씨앗을 소환할 빈 슬롯을 선택하세요.'
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="cancel-summon-from-mana"]')?.addEventListener('click', () => {
    summonFromManaDraftId = null
    render()
  })
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-summon-slot"]')) {
    button.addEventListener('click', () => {
      const slot = Number(button.dataset.fieldSlot)
      if (!Number.isInteger(slot) || !game) return
      if (game.pendingChoice?.playerId === game.viewer && game.pendingChoice.type === 'AWAKEN_SUMMON_SLOT') {
        sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [`slot:${slot}`] })
        return
      }
      if (summonFromManaDraftId) {
        const cardInstanceId = summonFromManaDraftId
        summonFromManaDraftId = null
        sendAction({ type: 'SUMMON_FROM_MANA', cardInstanceId, fieldSlot: slot })
        return
      }
      if (playDraft) {
        const card = selectedPlayCard()
        if (card && CARDS[card.cardId].type === 'unit') {
          playDraft.fieldSlot = playDraft.fieldSlot === slot ? undefined : slot
          render()
        }
      }
    })
  }
}

function bindAttackEvents(): void {
  const bindCardAction = (element: HTMLElement, activate: () => void): void => {
    element.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      activate()
    })
    element.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      activate()
    })
  }

  for (const card of document.querySelectorAll<HTMLElement>('.field-slot-frame[data-action="select-attacker"]')) {
    bindCardAction(card, () => {
      const id = card.dataset.unitId
      if (!id) return
      selectedAttackerId = selectedAttackerId === id ? null : id
      selectedAttackLifeSlotIndices = []
      render()
    })
  }

  for (const card of document.querySelectorAll<HTMLElement>('.field-slot-frame[data-action="attack-unit"]')) {
    bindCardAction(card, () => {
      const attackerId = card.dataset.attackerId ?? selectedAttackerId
      const defenderId = card.dataset.defenderId
      if (attackerId && defenderId) {
        sendAction({ type: 'ATTACK_UNIT', attackerId, defenderId })
      }
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="select-attack-life"]')) {
    button.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      if (!game) return
      const slotIndex = Number(button.dataset.lifeSlot)
      if (!Number.isInteger(slotIndex)) return
      const enemyId: PlayerId = game.viewer === 'P1' ? 'P2' : 'P1'
      selectedAttackLifeSlotIndices = toggleString(
        selectedAttackLifeSlotIndices.map(String),
        String(slotIndex),
        requiredAttackLifeCount(game.players[enemyId]),
      ).map(Number)
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="confirm-attack-player"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    if (selectedAttackerId) {
      sendAction({
        type: 'ATTACK_PLAYER',
        attackerId: selectedAttackerId,
        lifeSlotIndices: [...selectedAttackLifeSlotIndices],
      })
    }
  })
  document.querySelector<HTMLButtonElement>('[data-action="cancel-attacker"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
    selectedAttackerId = null
    selectedAttackLifeSlotIndices = []
    render()
  })
}

function bindPendingChoiceEvents(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="resolve-life-choice"]')) {
    button.addEventListener('click', () => {
      const index = Number(button.dataset.lifeIndex)
      if (Number.isInteger(index)) sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [`life:${index}`] })
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="resolve-hand-choice"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.cardInstanceId
      if (id) sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [id] })
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="resolve-hand-discard-choice"]')) {
    button.addEventListener('click', () => {
      const id = button.dataset.cardInstanceId
      if (id) sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [id] })
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="skip-hand-choice"]')?.addEventListener('click', () => sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [] }))
  for (const control of document.querySelectorAll<HTMLElement>('[data-action="resolve-simple-choice"]')) {
    control.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const id = control.dataset.choiceId
      if (id) sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [id] })
    })
    control.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return
      event.preventDefault()
      event.stopPropagation()
      control.click()
    })
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-pending-card"]')) {
    button.addEventListener('click', () => {
      if (!game?.pendingChoice || game.pendingChoice.type !== 'GRAVE_DIGGING_RETURN') return
      const id = button.dataset.cardInstanceId
      if (!id) return
      pendingChoiceIds = toggleString(pendingChoiceIds, id, game.pendingChoice.maxCards)
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="confirm-pending-cards"]')?.addEventListener('click', () => sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [...pendingChoiceIds] }))

  document.querySelector<HTMLButtonElement>('[data-action="resolve-sof-empty"]')?.addEventListener('click', () => sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [] }))
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-sof-slot-choice"]')) {
    button.addEventListener('click', () => {
      if (!game?.pendingChoice || game.pendingChoice.type !== 'SOF_CHOICE') return
      const choiceId = button.dataset.choiceId
      if (!choiceId) return
      const [cardId] = choiceId.split('@')
      const current = pendingChoiceIds.find((choice) => choice.startsWith(`${cardId}@`))
      const withoutCard = pendingChoiceIds.filter((choice) => !choice.startsWith(`${cardId}@`))
      const withoutSlot = withoutCard.filter((choice) => choice.split('@').at(-1) !== choiceId.split('@').at(-1))
      pendingChoiceIds = current === choiceId
        ? withoutCard
        : [...withoutSlot, choiceId].slice(0, game.pendingChoice.maxChoices)
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="confirm-sof-choices"]')?.addEventListener('click', () => sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [...pendingChoiceIds] }))

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-action="toggle-burning-choice"]')) {
    button.addEventListener('click', () => {
      if (!game?.pendingChoice || game.pendingChoice.type !== 'BURNING_PROCESSION') return
      const choiceId = button.dataset.choiceId
      if (!choiceId) return
      const [cardId] = choiceId.split('@')
      const withoutCard = pendingChoiceIds.filter((choice) => !choice.startsWith(`${cardId}@`))
      pendingChoiceIds = pendingChoiceIds.includes(choiceId)
        ? withoutCard
        : [...withoutCard, choiceId].slice(0, game.pendingChoice.maxSummons)
      render()
    })
  }
  document.querySelector<HTMLButtonElement>('[data-action="confirm-burning-choice"]')?.addEventListener('click', () => sendAction({ type: 'RESOLVE_CHOICE', choiceIds: [...pendingChoiceIds] }))
}

function bindRoomActionEvents(): void {
  document.querySelector<HTMLButtonElement>('#end-turn-button')?.addEventListener('click', () => sendAction({ type: 'END_TURN' }))
  document.querySelector<HTMLButtonElement>('#surrender-button')?.addEventListener('click', () => sendAction({ type: 'SURRENDER' }))
  document.querySelector<HTMLButtonElement>('#rematch-button')?.addEventListener('click', () => {
    if (isTutorial) {
      window.location.assign(window.location.pathname)
      return
    }
    if (game) {
      gameNotice = null
      sendRematchReady(socket, true)
    }
  })
  document.querySelector<HTMLButtonElement>('[data-action="dismiss-game-notice"]')?.addEventListener('click', () => {
    gameNotice = null
    render()
  })
  document.querySelector<HTMLButtonElement>('#leave-room-button')?.addEventListener('click', () => {
    if (isTutorial) window.location.assign(window.location.pathname)
    else sendLeaveRoom(socket)
  })
  document.querySelector<HTMLButtonElement>('#copy-invite-button')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pageUrl.toString())
      message = '초대 링크를 복사했습니다.'
      roomMenuOpen = false
    } catch {
      message = '주소창의 링크를 직접 복사해 주세요.'
      roomMenuOpen = false
    }
    render()
  })
}

function bindEvents(): void {
  bindRulebookEvents()
  bindMatchLogEvents()
  bindRoomMenuEvents()
  bindHandScrollEvents()
  bindZoneModalEvents()
  bindCardPreviewEvents()
  bindCardKeywordTooltips()
  bindGlobalKeyboardEvents()
  bindWaitingRoomEvents()
  bindPlayDraftEvents()
  bindSummonFromManaEvents()
  bindAttackEvents()
  bindPendingChoiceEvents()
  bindRoomActionEvents()
}

window.setInterval(updateClock, 250)
render()
