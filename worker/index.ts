import {
  routePartykitRequest,
  Server,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from 'partyserver'

import type { GameAction } from '../src/shared/actions'
import { getFormat } from '../src/content/formats'
import {
  DECK_SCHEMA_VERSION,
  createDraftPool,
  isDeckCompatibleWithFormat,
  parseSubmittedDeck,
  validateDeck,
} from '../src/shared/decks'
import type { SubmittedDeck } from '../src/shared/decks'
import type {
  ClientMessage,
  JoinRejectReason,
  PublicDeckStates,
  ServerMessage,
} from '../src/shared/messages'
import {
  areBothPlayersReady,
  createEmptyRematchReadiness,
  getRematchReadyPlayers,
  getRoomPhase,
  setRematchReady,
} from '../src/shared/room-lifecycle'
import type { RematchReadiness } from '../src/shared/room-lifecycle'
import {
  canStartMatch,
  createEmptyDeckReadiness,
  createEmptySubmittedDecks,
  setDeckReady,
  setSubmittedDeck,
} from '../src/shared/room-decks'
import type {
  DeckReadiness,
  SubmittedDecks,
} from '../src/shared/room-decks'
import {
  areBothDraftsConfirmed,
  autoCompleteDraftSelection,
  confirmDraftSelection,
  createDraftPlayerView,
  createRoomDraftState,
  setDraftSelection,
} from '../src/shared/room-draft'
import type { RoomDraftState } from '../src/shared/room-draft'
import {
  createDefaultRoomSettings,
  normalizeRoomSettings,
  parseRoomFormatId,
  parseDraftLimitSeconds,
  parseSeatExpirySeconds,
  parseSelectedSetIds,
  parseTurnLimitSeconds,
} from '../src/shared/room-settings'
import type { RoomSettings } from '../src/shared/room-settings'
import { createMatchConfig } from '../src/shared/match-config'
import type { LoggedAction } from '../src/shared/match-log'
import {
  createEmptySeatExpiryState,
  createStoppedTurnClock,
  getExpiredPlayers,
  getNextAlarmAt,
  pauseTurnClock,
  resumeTurnClock,
  setSeatExpiry,
  startTurnClock,
} from '../src/shared/room-timing'
import type {
  SeatExpiryState,
  TurnClockState,
} from '../src/shared/room-timing'
import {
  createEmptySeats,
  findOpenSeat,
  findPlayerBySeatToken,
  getReservedPlayers,
  releaseSeat,
  reserveSeat,
} from '../src/shared/room-session'
import type { SeatReservations } from '../src/shared/room-session'
import { WorkerMatchAuthorityAdapter } from '../src/shared/match-authority-adapters'
import { GameRuleError } from '../src/shared/rules'
import type {
  GameState,
  PlayerId,
} from '../src/shared/types'

interface Env extends Cloudflare.Env {
  Main: DurableObjectNamespace<Main>
}

type GameConnection = Connection<ConnectionState>

interface ConnectionState {
  playerId: PlayerId
}

interface PersistedRoomState {
  roomKey: string
  seats: SeatReservations
  game: GameState | null
  rematchReady?: RematchReadiness
  settings?: RoomSettings
  turnClock?: TurnClockState
  seatExpiresAt?: SeatExpiryState
  submittedDecks?: SubmittedDecks
  deckReady?: DeckReadiness
  actionLog?: LoggedAction[]
  draft?: RoomDraftState | null
}

interface StoredRoomState {
  roomKey: string
  seats: SeatReservations
  game: GameState | null
  rematchReady: RematchReadiness
  settings: RoomSettings
  turnClock: TurnClockState
  seatExpiresAt: SeatExpiryState
  submittedDecks: SubmittedDecks
  deckReady: DeckReadiness
  actionLog: LoggedAction[]
  draft: RoomDraftState | null
}

const STORAGE_KEY = 'card-duel-room-state'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
}

function hasString(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return typeof value[key] === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((item) => Number.isInteger(item))
}

function isCardPlaySelection(value: unknown): boolean {
  if (value === undefined) return true
  if (!isRecord(value)) return false

  return (value.unitId === undefined || typeof value.unitId === 'string')
    && (value.lifeIndex === undefined || Number.isInteger(value.lifeIndex))
    && (value.effectManaId === undefined || typeof value.effectManaId === 'string')
    && (value.discardId === undefined || typeof value.discardId === 'string')
    && (value.fieldSlot === undefined || Number.isInteger(value.fieldSlot))
}

function isGameAction(value: unknown): value is GameAction {
  if (!isRecord(value)) return false

  switch (value.type) {
    case 'PLACE_MANA':
      return hasString(value, 'cardInstanceId')
    case 'SUMMON_FROM_MANA':
      return hasString(value, 'cardInstanceId')
        && Number.isInteger(value.fieldSlot)
    case 'PLAY_CARD':
      return hasString(value, 'cardInstanceId')
        && isStringArray(value.manaIds)
        && isCardPlaySelection(value.selection)
    case 'RESOLVE_CHOICE':
      return isStringArray(value.choiceIds)
    case 'ATTACK_UNIT':
      return hasString(value, 'attackerId')
        && hasString(value, 'defenderId')
    case 'ATTACK_PLAYER': {
      const hasLifeSlotIndices = value.lifeSlotIndices !== undefined
      const hasLifeIndices = value.lifeIndices !== undefined

      return hasString(value, 'attackerId')
        && (hasLifeSlotIndices || hasLifeIndices)
        && (!hasLifeSlotIndices || isIntegerArray(value.lifeSlotIndices))
        && (!hasLifeIndices || isIntegerArray(value.lifeIndices))
    }
    case 'END_TURN':
    case 'SURRENDER':
      return true
    default:
      return false
  }
}

function parseClientMessage(
  rawMessage: WSMessage,
): ClientMessage | null {
  if (typeof rawMessage !== 'string') return null

  try {
    const parsed: unknown = JSON.parse(rawMessage)
    if (!isRecord(parsed)) return null

    switch (parsed.type) {
      case 'PLAYER_ACTION':
        return isGameAction(parsed.action)
          ? { type: 'PLAYER_ACTION', action: parsed.action }
          : null

      case 'SUBMIT_DECK': {
        const deck = parseSubmittedDeck(parsed.deck)
        return deck ? { type: 'SUBMIT_DECK', deck } : null
      }

      case 'SET_DECK_READY':
        return typeof parsed.ready === 'boolean'
          ? { type: 'SET_DECK_READY', ready: parsed.ready }
          : null

      case 'SET_REMATCH_READY':
        return typeof parsed.ready === 'boolean'
          ? { type: 'SET_REMATCH_READY', ready: parsed.ready }
          : null

      case 'SET_DRAFT_SELECTION':
        return isIntegerArray(parsed.selectedIndices)
          ? { type: 'SET_DRAFT_SELECTION', selectedIndices: parsed.selectedIndices }
          : null

      case 'CONFIRM_DRAFT':
        return { type: 'CONFIRM_DRAFT' }

      case 'LEAVE_ROOM':
        return { type: 'LEAVE_ROOM' }

      default:
        return null
    }
  } catch {
    return null
  }
}

function createSeatToken(): string {
  return crypto.randomUUID()
}

function normalizePersistedGame(
  value: GameState | null,
  settings: RoomSettings,
): GameState | null {
  if (!value) return null
  const legacy = value as GameState & {
    matchConfig?: GameState['matchConfig']
    actionSequence?: number
  }

  const players = Object.fromEntries(
    (['P1', 'P2'] as const).map((playerId) => {
      const player = value.players[playerId]
      return [playerId, {
        ...player,
        field: player.field.map((unit, index) => ({
          ...unit,
          slotIndex: Number.isInteger(unit.slotIndex) ? unit.slotIndex : index,
        })),
      }]
    }),
  ) as GameState['players']

  return {
    ...value,
    players,
    matchConfig: legacy.matchConfig ?? createMatchConfig({
      formatId: settings.formatId,
      selectedSetIds: settings.selectedSetIds,
      createdAt: Date.now(),
    }),
    actionSequence: legacy.actionSequence ?? 0,
  }
}

function normalizePersistedDecks(
  value: SubmittedDecks | undefined,
): SubmittedDecks {
  if (!value) return createEmptySubmittedDecks()
  return {
    P1: parseSubmittedDeck(value.P1),
    P2: parseSubmittedDeck(value.P2),
  }
}

export class Main extends Server<Env> {
  static options = { hibernate: true }

  private roomState: StoredRoomState | null = null

  async onStart(): Promise<void> {
    const persisted =
      await this.ctx.storage.get<PersistedRoomState>(STORAGE_KEY)

    if (!persisted) {
      await this.scheduleNextAlarm()
      return
    }

    const settings = normalizeRoomSettings(persisted.settings)
    this.roomState = {
      roomKey: persisted.roomKey,
      seats: persisted.seats,
      game: normalizePersistedGame(persisted.game, settings),
      rematchReady:
        persisted.rematchReady ?? createEmptyRematchReadiness(),
      settings,
      turnClock:
        persisted.turnClock ?? createStoppedTurnClock(),
      seatExpiresAt:
        persisted.seatExpiresAt ?? createEmptySeatExpiryState(),
      submittedDecks: normalizePersistedDecks(persisted.submittedDecks),
      deckReady:
        persisted.deckReady ?? createEmptyDeckReadiness(),
      actionLog: persisted.actionLog ?? [],
      draft: persisted.draft ?? null,
    }

    await this.scheduleNextAlarm()
  }

  async onConnect(
    connection: GameConnection,
    context: ConnectionContext,
  ): Promise<void> {
    const requestUrl = new URL(context.request.url)
    const roomKey = requestUrl.searchParams.get('roomKey') ?? ''
    const suppliedSeatToken =
      requestUrl.searchParams.get('seatToken') ?? ''
    const requestedFormatId = parseRoomFormatId(
      requestUrl.searchParams.get('formatId'),
    )
    const requestedSettings: RoomSettings = {
      turnLimitSeconds: parseTurnLimitSeconds(
        requestUrl.searchParams.get('turnLimitSeconds'),
      ),
      draftLimitSeconds: parseDraftLimitSeconds(
        requestUrl.searchParams.get('draftLimitSeconds'),
      ),
      seatExpirySeconds: parseSeatExpirySeconds(
        requestUrl.searchParams.get('seatExpirySeconds'),
      ),
      formatId: requestedFormatId,
      selectedSetIds: parseSelectedSetIds(
        requestUrl.searchParams.get('selectedSetIds'),
        requestedFormatId,
      ),
    }

    if (!roomKey) {
      this.rejectConnection(
        connection,
        'MISSING_ROOM_KEY',
        '초대 키가 없는 주소로는 방에 참가할 수 없습니다.',
      )
      return
    }

    if (!this.roomState) {
      this.roomState = {
        roomKey,
        seats: createEmptySeats(),
        game: null,
        rematchReady: createEmptyRematchReadiness(),
        settings: requestedSettings,
        turnClock: createStoppedTurnClock(),
        seatExpiresAt: createEmptySeatExpiryState(),
        submittedDecks: createEmptySubmittedDecks(),
        deckReady: createEmptyDeckReadiness(),
        actionLog: [],
        draft: null,
      }
    } else if (this.roomState.roomKey !== roomKey) {
      this.rejectConnection(
        connection,
        'INVALID_ROOM_KEY',
        '이 방의 초대 키가 올바르지 않습니다.',
      )
      return
    }

    let playerId: PlayerId | null = null
    let seatToken = suppliedSeatToken
    let reconnected = false

    if (suppliedSeatToken) {
      playerId = findPlayerBySeatToken(
        this.roomState.seats,
        suppliedSeatToken,
      )

      if (!playerId) {
        this.rejectConnection(
          connection,
          'INVALID_SEAT_TOKEN',
          '저장된 자리 정보가 만료되었거나 일치하지 않습니다.',
        )
        return
      }

      reconnected = true
    } else {
      playerId = findOpenSeat(this.roomState.seats)

      if (!playerId) {
        this.rejectConnection(
          connection,
          'ROOM_FULL',
          '두 플레이어의 자리가 이미 예약되어 있습니다.',
        )
        return
      }

      seatToken = createSeatToken()
      this.roomState.seats = reserveSeat(
        this.roomState.seats,
        playerId,
        seatToken,
      )
    }

    for (const existing of this.getConnections<ConnectionState>()) {
      if (existing === connection) continue
      const state = existing.state as ConnectionState | null
      if (state?.playerId === playerId) {
        existing.close(4001, 'seat-reconnected')
      }
    }

    connection.setState({ playerId } satisfies ConnectionState)
    this.roomState.seatExpiresAt = setSeatExpiry(
      this.roomState.seatExpiresAt,
      playerId,
      null,
    )

    this.send(connection, {
      type: 'ASSIGNED_PLAYER',
      roomId: this.name,
      playerId,
      seatToken,
      reconnected,
    })

    const connectedPlayers = this.getConnectedPlayers()
    const now = Date.now()

    if (
      this.roomState.game?.status === 'playing'
      && connectedPlayers.length === 2
      && this.roomState.turnClock.deadlineAt === null
    ) {
      this.roomState.turnClock = resumeTurnClock(
        this.roomState.turnClock,
        this.roomState.settings.turnLimitSeconds,
        now,
      )
    }

    if (
      !this.roomState.game
      && !this.roomState.draft
      && this.roomState.settings.formatId === 'draft-v1'
      && connectedPlayers.length === 2
    ) {
      this.startDraft(now)
    }

    await this.persistAndSchedule()
    this.broadcastRoomState()
    this.broadcastDraftViews()
    this.broadcastGameViews()
  }

  async onMessage(
    sender: GameConnection,
    rawMessage: WSMessage,
  ): Promise<void> {
    const state = sender.state as ConnectionState | null

    if (!state?.playerId) {
      this.sendError(sender, '플레이어 자리가 배정되지 않았습니다.')
      return
    }

    const message = parseClientMessage(rawMessage)

    if (!message) {
      this.sendError(sender, '올바르지 않은 요청 메시지입니다.')
      return
    }

    switch (message.type) {
      case 'PLAYER_ACTION':
        await this.handlePlayerAction(sender, state.playerId, message.action)
        return
      case 'SUBMIT_DECK':
        await this.handleDeckSubmit(sender, state.playerId, message.deck)
        return
      case 'SET_DECK_READY':
        await this.handleDeckReady(sender, state.playerId, message.ready)
        return
      case 'SET_REMATCH_READY':
        await this.handleRematchReady(sender, state.playerId, message.ready)
        return
      case 'SET_DRAFT_SELECTION':
        await this.handleDraftSelection(sender, state.playerId, message.selectedIndices)
        return
      case 'CONFIRM_DRAFT':
        await this.handleDraftConfirm(sender, state.playerId)
        return
      case 'LEAVE_ROOM':
        await this.handleLeaveRoom(sender, state.playerId)
    }
  }

  async onClose(): Promise<void> {
    if (!this.roomState) return
    this.reconcileConnections(Date.now())
    await this.persistAndSchedule()
    this.broadcastRoomState()
  }

  async onAlarm(): Promise<void> {
    if (!this.roomState) {
      await this.scheduleNextAlarm()
      return
    }

    const now = Date.now()
    this.reconcileConnections(now)
    const expiredPlayers = getExpiredPlayers(
      this.roomState.seatExpiresAt,
      now,
    )

    if (expiredPlayers.length > 0) {
      for (const playerId of expiredPlayers) {
        this.releasePlayerData(playerId)
        this.broadcast(JSON.stringify({
          type: 'SEAT_EXPIRED',
          playerId,
        } satisfies ServerMessage))
      }

      this.clearCurrentGame()
      this.broadcast(JSON.stringify({
        type: 'GAME_CLEARED',
      } satisfies ServerMessage))
    }

    if (
      this.roomState.draft
      && this.roomState.draft.deadlineAt <= now
    ) {
      this.completeDraftAtDeadline()
    }

    const deadline = this.roomState.turnClock.deadlineAt
    let timedOutPlayer: PlayerId | null = null

    if (
      deadline !== null
      && deadline <= now
      && this.roomState.game?.status === 'playing'
      && (this.roomState.game.pendingChoices?.length ?? 0) === 0
      && this.getConnectedPlayers().length === 2
    ) {
      timedOutPlayer = this.roomState.game.currentPlayer
      const timeoutAction = { type: 'END_TURN' } as const
      const authority = this.getMatchAuthority()
      authority.dispatch(
        timedOutPlayer,
        timeoutAction,
        { createdAt: now },
      )
      this.storeMatchAuthority(authority)
      this.roomState.turnClock = startTurnClock(
        this.roomState.settings.turnLimitSeconds,
        now,
      )
    }

    if (getReservedPlayers(this.roomState.seats).length === 0) {
      await this.ctx.storage.delete(STORAGE_KEY)
      await this.ctx.storage.deleteAlarm()
      this.roomState = null
      return
    }

    await this.persistAndSchedule()
    this.broadcastRoomState()
    this.broadcastDraftViews()
    this.broadcastGameViews()

    if (timedOutPlayer) {
      this.broadcast(JSON.stringify({
        type: 'TURN_TIMED_OUT',
        playerId: timedOutPlayer,
      } satisfies ServerMessage))
    }
  }

  private async handleDeckSubmit(
    sender: GameConnection,
    playerId: PlayerId,
    deck: SubmittedDeck,
  ): Promise<void> {
    if (!this.roomState) return

    if (this.roomState.settings.formatId === 'draft-v1') {
      this.sendError(sender, '드래프트 덱은 매칭 후 서버에서 구성합니다.')
      return
    }

    if (this.roomState.game?.status === 'playing') {
      this.sendError(sender, '진행 중인 게임에서는 덱을 바꿀 수 없습니다.')
      return
    }

    const validation = validateDeck(deck.cardIds, deck)

    if (!isDeckCompatibleWithFormat(
      deck,
      this.roomState.settings.formatId,
      this.roomState.settings.selectedSetIds,
    )) {
      this.sendError(sender, '제출한 덱의 포맷이 이 방의 포맷과 일치하지 않습니다.')
      return
    }

    if (!validation.valid) {
      this.sendError(sender, validation.errors.join(' '))
      return
    }

    this.roomState.submittedDecks = setSubmittedDeck(
      this.roomState.submittedDecks,
      playerId,
      {
        ...deck,
        cardIds: [...deck.cardIds],
      },
    )
    this.roomState.deckReady = setDeckReady(
      this.roomState.deckReady,
      playerId,
      false,
    )
    this.roomState.rematchReady = createEmptyRematchReadiness()

    this.send(sender, {
      type: 'DECK_ACCEPTED',
      deckId: deck.deckId,
      deckName: deck.name,
    })

    await this.persistAndSchedule()
    this.broadcastRoomState()
  }

  private async handleDeckReady(
    sender: GameConnection,
    playerId: PlayerId,
    ready: boolean,
  ): Promise<void> {
    if (!this.roomState) return

    if (this.roomState.settings.formatId === 'draft-v1') {
      this.sendError(sender, '드래프트는 두 플레이어가 연결되면 자동으로 시작합니다.')
      return
    }

    if (this.roomState.game) {
      this.sendError(sender, '게임이 시작된 뒤에는 준비 상태를 바꿀 수 없습니다.')
      return
    }

    if (!this.roomState.submittedDecks[playerId]) {
      this.sendError(sender, '먼저 사용할 덱을 제출해 주세요.')
      return
    }

    this.roomState.deckReady = setDeckReady(
      this.roomState.deckReady,
      playerId,
      ready,
    )

    if (
      canStartMatch(
        this.roomState.submittedDecks,
        this.roomState.deckReady,
      )
      && this.getConnectedPlayers().length === 2
    ) {
      this.startMatch()
    }

    await this.persistAndSchedule()
    this.broadcastRoomState()
    this.broadcastGameViews()
  }

  private async handleDraftSelection(
    sender: GameConnection,
    playerId: PlayerId,
    selectedIndices: number[],
  ): Promise<void> {
    if (!this.roomState?.draft) {
      this.sendError(sender, '진행 중인 드래프트가 없습니다.')
      return
    }
    if (this.roomState.draft.deadlineAt <= Date.now()) {
      this.completeDraftAtDeadline()
      await this.persistAndSchedule()
      this.broadcastRoomState()
      this.broadcastGameViews()
      return
    }

    const format = getFormat(this.roomState.settings.formatId)
    if (!format.draft) {
      this.sendError(sender, '드래프트 포맷이 아닙니다.')
      return
    }

    try {
      const next = setDraftSelection(
        this.roomState.draft,
        playerId,
        selectedIndices,
        format.draft.deckSize,
      )
      const counts = new Map<string, number>()
      for (const index of next.selectedIndices[playerId]) {
        const cardId = next.pools[playerId].cardIds[index]
        if (!cardId) continue
        const count = (counts.get(cardId) ?? 0) + 1
        if (count > format.maxCopiesPerCard) {
          throw new Error(`같은 카드는 최대 ${format.maxCopiesPerCard}장까지 선택할 수 있습니다.`)
        }
        counts.set(cardId, count)
      }
      this.roomState.draft = next
      await this.persistAndSchedule()
      this.broadcastRoomState()
      this.broadcastDraftViews()
    } catch (error) {
      this.sendError(
        sender,
        error instanceof Error ? error.message : '드래프트 선택을 저장하지 못했습니다.',
      )
    }
  }

  private async handleDraftConfirm(
    sender: GameConnection,
    playerId: PlayerId,
  ): Promise<void> {
    if (!this.roomState?.draft) {
      this.sendError(sender, '진행 중인 드래프트가 없습니다.')
      return
    }
    if (this.roomState.draft.deadlineAt <= Date.now()) {
      this.completeDraftAtDeadline()
      await this.persistAndSchedule()
      this.broadcastRoomState()
      this.broadcastGameViews()
      return
    }
    const format = getFormat(this.roomState.settings.formatId)
    if (!format.draft) return

    try {
      if (this.roomState.draft.selectedIndices[playerId].length !== format.draft.deckSize) {
        throw new Error(`드래프트 덱 ${format.draft.deckSize}장을 모두 선택해야 합니다.`)
      }
      this.assertDraftDeckValid(playerId)
      this.roomState.draft = confirmDraftSelection(
        this.roomState.draft,
        playerId,
        format.draft.deckSize,
      )
      if (areBothDraftsConfirmed(this.roomState.draft)) {
        this.finishDraftAndStartMatch()
      }
      await this.persistAndSchedule()
      this.broadcastRoomState()
      this.broadcastDraftViews()
      this.broadcastGameViews()
    } catch (error) {
      this.sendError(
        sender,
        error instanceof Error ? error.message : '드래프트 덱을 확정하지 못했습니다.',
      )
    }
  }

  private async handlePlayerAction(
    sender: GameConnection,
    playerId: PlayerId,
    action: GameAction,
  ): Promise<void> {
    if (!this.roomState?.game) {
      this.sendError(sender, '아직 게임이 시작되지 않았습니다.')
      return
    }

    if (
      this.roomState.game.status === 'playing'
      && this.getConnectedPlayers().length < 2
    ) {
      this.sendError(sender, '상대가 재접속할 때까지 게임이 일시 중단됩니다.')
      return
    }

    try {
      const now = Date.now()
      const authority = this.getMatchAuthority()
      authority.dispatch(
        playerId,
        action,
        { createdAt: now },
      )
      this.storeMatchAuthority(authority)

      if (this.roomState.game.status === 'finished') {
        this.roomState.rematchReady = createEmptyRematchReadiness()
        this.roomState.turnClock = createStoppedTurnClock()
      } else if ((this.roomState.game.pendingChoices?.length ?? 0) > 0) {
        this.roomState.turnClock = createStoppedTurnClock()
      } else if (action.type === 'END_TURN' || action.type === 'RESOLVE_CHOICE') {
        this.roomState.turnClock = startTurnClock(
          this.roomState.settings.turnLimitSeconds,
          now,
        )
      }

      await this.persistAndSchedule()
      this.broadcastRoomState()
      this.broadcastGameViews()
    } catch (error) {
      if (error instanceof GameRuleError) {
        this.sendError(sender, error.message)
      } else {
        console.error(error)
        this.sendError(sender, '서버에서 게임 행동을 처리하지 못했습니다.')
      }
    }
  }

  private async handleRematchReady(
    sender: GameConnection,
    playerId: PlayerId,
    ready: boolean,
  ): Promise<void> {
    if (!this.roomState?.game || this.roomState.game.status !== 'finished') {
      this.sendError(sender, '게임이 끝난 뒤에 재대전을 요청할 수 있습니다.')
      return
    }

    this.roomState.rematchReady = setRematchReady(
      this.roomState.rematchReady,
      playerId,
      ready,
    )

    if (
      areBothPlayersReady(this.roomState.rematchReady)
      && this.getConnectedPlayers().length === 2
      && this.roomState.submittedDecks.P1
      && this.roomState.submittedDecks.P2
    ) {
      this.startMatch()
    }

    await this.persistAndSchedule()
    this.broadcastRoomState()
    this.broadcastGameViews()
  }

  private async handleLeaveRoom(
    sender: GameConnection,
    playerId: PlayerId,
  ): Promise<void> {
    if (!this.roomState) return

    this.releasePlayerData(playerId)
    this.clearCurrentGame()
    await this.persistAndSchedule()

    this.send(sender, { type: 'LEFT_ROOM' })
    sender.close(4002, 'left-room')

    this.broadcast(
      JSON.stringify({ type: 'GAME_CLEARED' } satisfies ServerMessage),
      [sender.id],
    )
    this.broadcastRoomState([sender.id])
  }

  private startDraft(now: number): void {
    if (!this.roomState) return
    const format = getFormat(this.roomState.settings.formatId)
    if (!format.draft) return

    this.roomState.submittedDecks = createEmptySubmittedDecks()
    this.roomState.deckReady = createEmptyDeckReadiness()
    this.roomState.draft = createRoomDraftState({
      P1: createDraftPool(
        `room:${this.name}:P1:${crypto.randomUUID()}`,
        format.id,
        now,
      ),
      P2: createDraftPool(
        `room:${this.name}:P2:${crypto.randomUUID()}`,
        format.id,
        now,
      ),
    }, this.roomState.settings.draftLimitSeconds, now)
  }

  private createSubmittedDraftDeck(playerId: PlayerId): SubmittedDeck {
    if (!this.roomState?.draft) {
      throw new Error('진행 중인 드래프트가 없습니다.')
    }
    const format = getFormat(this.roomState.settings.formatId)
    if (!format.draft) throw new Error('드래프트 포맷이 아닙니다.')
    const draft = this.roomState.draft
    const pool = draft.pools[playerId]
    const cardIds = draft.selectedIndices[playerId].map((index) => {
      const cardId = pool.cardIds[index]
      if (!cardId) throw new Error('드래프트 선택에 존재하지 않는 카드가 있습니다.')
      return cardId
    })

    return {
      schemaVersion: DECK_SCHEMA_VERSION,
      deckId: `room-draft-${this.name}-${playerId}-${pool.seed}`,
      name: `${playerId} 드래프트 덱`,
      cardIds,
      formatId: format.id,
      selectedSetIds: [],
      draftPool: structuredClone(pool),
    }
  }

  private assertDraftDeckValid(playerId: PlayerId): void {
    const deck = this.createSubmittedDraftDeck(playerId)
    const validation = validateDeck(deck.cardIds, deck)
    if (!validation.valid) throw new Error(validation.errors.join(' '))
  }

  private finishDraftAndStartMatch(): void {
    if (!this.roomState?.draft) return
    const p1Deck = this.createSubmittedDraftDeck('P1')
    const p2Deck = this.createSubmittedDraftDeck('P2')
    for (const [playerId, deck] of [['P1', p1Deck], ['P2', p2Deck]] as const) {
      const validation = validateDeck(deck.cardIds, deck)
      if (!validation.valid) throw new Error(validation.errors.join(' '))
      this.roomState.submittedDecks = setSubmittedDeck(
        this.roomState.submittedDecks,
        playerId,
        deck,
      )
    }
    this.roomState.draft = null
    this.startMatch()
  }

  private completeDraftAtDeadline(): void {
    if (!this.roomState?.draft) return
    const format = getFormat(this.roomState.settings.formatId)
    if (!format.draft) return

    for (const playerId of ['P1', 'P2'] as const) {
      this.roomState.draft.selectedIndices[playerId] = autoCompleteDraftSelection(
        this.roomState.draft.pools[playerId],
        this.roomState.draft.selectedIndices[playerId],
        format.draft.deckSize,
        format.maxCopiesPerCard,
      )
      this.roomState.draft.confirmed[playerId] = true
    }
    this.finishDraftAndStartMatch()
  }

  private startMatch(): void {
    if (
      !this.roomState?.submittedDecks.P1
      || !this.roomState.submittedDecks.P2
    ) {
      return
    }

    const p1Deck = this.roomState.submittedDecks.P1
    const p2Deck = this.roomState.submittedDecks.P2
    const matchConfig = createMatchConfig({
      formatId: this.roomState.settings.formatId,
      selectedSetIds: this.roomState.settings.selectedSetIds,
    })

    const authority = WorkerMatchAuthorityAdapter.create({
      matchConfig,
      decks: {
        P1: [...p1Deck.cardIds],
        P2: [...p2Deck.cardIds],
      },
      deckSelections: {
        P1: {
          formatId: p1Deck.formatId,
          selectedSetIds: [...p1Deck.selectedSetIds],
          draftPool: p1Deck.draftPool ? structuredClone(p1Deck.draftPool) : null,
        },
        P2: {
          formatId: p2Deck.formatId,
          selectedSetIds: [...p2Deck.selectedSetIds],
          draftPool: p2Deck.draftPool ? structuredClone(p2Deck.draftPool) : null,
        },
      },
    })
    this.storeMatchAuthority(authority)
    this.roomState.draft = null
    this.roomState.deckReady = createEmptyDeckReadiness()
    this.roomState.rematchReady = createEmptyRematchReadiness()
    this.roomState.turnClock = startTurnClock(
      this.roomState.settings.turnLimitSeconds,
      Date.now(),
    )
  }

  private clearCurrentGame(): void {
    if (!this.roomState) return
    this.roomState.game = null
    this.roomState.actionLog = []
    this.roomState.draft = null
    this.roomState.deckReady = createEmptyDeckReadiness()
    this.roomState.rematchReady = createEmptyRematchReadiness()
    this.roomState.turnClock = createStoppedTurnClock()
  }

  private releasePlayerData(playerId: PlayerId): void {
    if (!this.roomState) return
    this.roomState.seats = releaseSeat(this.roomState.seats, playerId)
    this.roomState.seatExpiresAt = setSeatExpiry(
      this.roomState.seatExpiresAt,
      playerId,
      null,
    )
    this.roomState.submittedDecks = setSubmittedDeck(
      this.roomState.submittedDecks,
      playerId,
      null,
    )
    this.roomState.deckReady = setDeckReady(
      this.roomState.deckReady,
      playerId,
      false,
    )
  }

  private reconcileConnections(now: number): void {
    if (!this.roomState) return
    const connectedPlayers = this.getConnectedPlayers()

    for (const playerId of ['P1', 'P2'] as const) {
      const isReserved = this.roomState.seats[playerId] !== null
      const isConnected = connectedPlayers.includes(playerId)
      const currentExpiry = this.roomState.seatExpiresAt[playerId]

      if (!isReserved || isConnected) {
        this.roomState.seatExpiresAt = setSeatExpiry(
          this.roomState.seatExpiresAt,
          playerId,
          null,
        )
      } else if (currentExpiry === null) {
        this.roomState.seatExpiresAt = setSeatExpiry(
          this.roomState.seatExpiresAt,
          playerId,
          now + this.roomState.settings.seatExpirySeconds * 1000,
        )
      }
    }

    if (
      this.roomState.game?.status === 'playing'
      && connectedPlayers.length < 2
    ) {
      this.roomState.turnClock = pauseTurnClock(
        this.roomState.turnClock,
        now,
      )
    }
  }

  private getConnectedPlayers(
    excludedConnectionIds: string[] = [],
  ): PlayerId[] {
    const excluded = new Set(excludedConnectionIds)
    const players = new Set<PlayerId>()

    for (const connection of this.getConnections<ConnectionState>()) {
      if (excluded.has(connection.id)) continue
      const state = connection.state as ConnectionState | null
      if (state?.playerId) players.add(state.playerId)
    }

    return [...players].sort()
  }

  private getPublicDeckStates(): PublicDeckStates {
    const empty = {
      P1: { submitted: false, ready: false, name: null },
      P2: { submitted: false, ready: false, name: null },
    } satisfies PublicDeckStates

    if (!this.roomState) return empty

    return {
      P1: {
        submitted: this.roomState.submittedDecks.P1 !== null,
        ready: this.roomState.deckReady.P1,
        name: this.roomState.submittedDecks.P1?.name ?? null,
      },
      P2: {
        submitted: this.roomState.submittedDecks.P2 !== null,
        ready: this.roomState.deckReady.P2,
        name: this.roomState.submittedDecks.P2?.name ?? null,
      },
    }
  }

  private broadcastRoomState(
    excludedConnectionIds: string[] = [],
  ): void {
    const connectedPlayers = this.getConnectedPlayers(
      excludedConnectionIds,
    )
    const message: ServerMessage = {
      type: 'ROOM_STATE',
      phase: getRoomPhase(
        this.roomState?.game?.status ?? null,
        connectedPlayers,
        Boolean(this.roomState?.draft),
      ),
      connectedPlayers,
      reservedPlayers: this.roomState
        ? getReservedPlayers(this.roomState.seats)
        : [],
      rematchReadyPlayers: this.roomState
        ? getRematchReadyPlayers(this.roomState.rematchReady)
        : [],
      deckStates: this.getPublicDeckStates(),
      settings: this.roomState?.settings ?? createDefaultRoomSettings(),
      turnDeadlineAt: this.roomState?.turnClock.deadlineAt ?? null,
      seatExpiresAt:
        this.roomState?.seatExpiresAt ?? createEmptySeatExpiryState(),
    }

    this.broadcast(JSON.stringify(message), excludedConnectionIds)
  }

  private broadcastDraftViews(): void {
    if (!this.roomState?.draft) return
    const format = getFormat(this.roomState.settings.formatId)
    if (!format.draft) return

    for (const connection of this.getConnections<ConnectionState>()) {
      const state = connection.state as ConnectionState | null
      if (!state?.playerId) continue
      this.send(connection, {
        type: 'DRAFT_STATE',
        draft: createDraftPlayerView(
          this.roomState.draft,
          state.playerId,
          format.draft.deckSize,
        ),
      })
    }
  }

  private broadcastGameViews(): void {
    if (!this.roomState?.game) return
    const authority = this.getMatchAuthority()
    for (const connection of this.getConnections<ConnectionState>()) {
      const state = connection.state as ConnectionState | null
      if (!state?.playerId) continue
      this.send(connection, {
        type: 'GAME_VIEW',
        game: authority.getView(state.playerId),
      })
    }
  }

  private getMatchAuthority(): WorkerMatchAuthorityAdapter {
    if (!this.roomState?.game) {
      throw new Error('Cannot create a match host without an active game.')
    }

    return WorkerMatchAuthorityAdapter.restore({
      game: this.roomState.game,
      actionLog: this.roomState.actionLog,
    })
  }

  private storeMatchAuthority(
    authority: WorkerMatchAuthorityAdapter,
  ): void {
    if (!this.roomState) {
      throw new Error('Cannot store a match host without an active room.')
    }

    const snapshot = authority.getSnapshot()
    this.roomState.game = snapshot.game
    this.roomState.actionLog = snapshot.actionLog
  }

  private async persistAndSchedule(): Promise<void> {
    if (this.roomState) {
      await this.ctx.storage.put(STORAGE_KEY, this.roomState)
    }
    await this.scheduleNextAlarm()
  }

  private async scheduleNextAlarm(): Promise<void> {
    const roomAlarm = this.roomState
      ? getNextAlarmAt(
          this.roomState.turnClock,
          this.roomState.seatExpiresAt,
        )
      : null
    const draftAlarm = this.roomState?.draft?.deadlineAt ?? null
    const nextAlarm = roomAlarm === null
      ? draftAlarm
      : draftAlarm === null
        ? roomAlarm
        : Math.min(roomAlarm, draftAlarm)

    if (nextAlarm === null) {
      await this.ctx.storage.deleteAlarm()
    } else {
      await this.ctx.storage.setAlarm(
        Math.max(nextAlarm, Date.now() + 50),
      )
    }
  }

  private rejectConnection(
    connection: GameConnection,
    reason: JoinRejectReason,
    message: string,
  ): void {
    this.send(connection, {
      type: 'JOIN_REJECTED',
      reason,
      message,
    })
    connection.close(4003, reason)
  }

  private sendError(
    connection: GameConnection,
    message: string,
  ): void {
    this.send(connection, {
      type: 'ACTION_ERROR',
      message,
    })
  }

  private send(
    connection: GameConnection,
    message: ServerMessage,
  ): void {
    connection.send(JSON.stringify(message))
  }
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'duel-spirits-server',
      })
    }

    return (
      (await routePartykitRequest(request, env))
      ?? new Response('Not Found', { status: 404 })
    )
  },
} satisfies ExportedHandler<Env>
