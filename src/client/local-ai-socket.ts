import { SAMPLE_DECK_LIST } from '../content/sample-decks'
import { createMatchConfig } from '../shared/match-config'
import { LocalMatchAuthorityAdapter } from '../shared/match-authority-adapters'
import { createGameView } from '../shared/views'
import { enumerateLegalActions, getActingPlayer } from '../simulator/legal-actions'
import { getBotPolicy } from '../simulator/bots'

import type { ClientMessage, PublicDeckStates, ServerMessage } from '../shared/messages'
import type { SubmittedDeck } from '../shared/decks'
import type { RoomSettings } from '../shared/room-settings'
import type { MatchHostSnapshot } from '../shared/match-host'
import type { MessageSocket, RoomConnectionHandlers } from './network'

const AI_PLAYER = 'P2' as const
const LOCAL_PLAYER = 'P1' as const
const AI_THINK_DELAY_MS = 420

/**
 * Implements the same message contract as the online room server while keeping
 * an AI match entirely on this device. The game screen therefore exercises the
 * exact same rules, views, action log, deck picker, surrender, and rematch UI.
 */
export class LocalAiSocket implements MessageSocket {
  private authority: LocalMatchAuthorityAdapter | null = null
  private localDeck: SubmittedDeck | null = null
  private localReady = false
  private botDeckCardIds: SubmittedDeck['cardIds'] = []
  private closed = false
  private botTimer: number | null = null
  private readonly bot = getBotPolicy('value')
  private readonly roomId: string
  private readonly settings: RoomSettings
  private readonly handlers: RoomConnectionHandlers

  constructor(
    roomId: string,
    settings: RoomSettings,
    handlers: RoomConnectionHandlers,
  ) {
    this.roomId = roomId
    this.settings = settings
    this.handlers = handlers
    queueMicrotask(() => {
      if (this.closed) return
      this.handlers.onOpen?.()
      this.emit({
        type: 'ASSIGNED_PLAYER',
        roomId: this.roomId,
        playerId: LOCAL_PLAYER,
        seatToken: 'local-ai',
        reconnected: false,
      })
      this.emitRoomState()
    })
  }

  send(rawMessage: string): void {
    if (this.closed) return
    try {
      const message = JSON.parse(rawMessage) as ClientMessage
      this.handleMessage(message)
    } catch (error) {
      this.emit({
        type: 'ACTION_ERROR',
        message: error instanceof Error ? error.message : 'AI 대전 요청을 처리하지 못했습니다.',
      })
    }
  }

  close(): void {
    this.closed = true
    if (this.botTimer !== null) window.clearTimeout(this.botTimer)
  }

  private emit(message: ServerMessage): void {
    if (!this.closed) this.handlers.onMessage(message)
  }

  private deckStates(): PublicDeckStates {
    return {
      P1: {
        submitted: this.localDeck !== null,
        ready: this.localReady,
        name: this.localDeck?.name ?? null,
      },
      P2: {
        submitted: true,
        ready: true,
        name: 'AI · 가치형',
      },
    }
  }

  private emitRoomState(): void {
    const status = this.authority?.getSnapshot().game.status
    this.emit({
      type: 'ROOM_STATE',
      phase: status === 'finished' ? 'finished' : status === 'playing' ? 'playing' : 'waiting',
      connectedPlayers: [LOCAL_PLAYER, AI_PLAYER],
      reservedPlayers: [LOCAL_PLAYER, AI_PLAYER],
      rematchReadyPlayers: [],
      deckStates: this.deckStates(),
      settings: this.settings,
      turnDeadlineAt: null,
      seatExpiresAt: { P1: null, P2: null },
    })
  }

  private handleMessage(message: ClientMessage): void {
    switch (message.type) {
      case 'SUBMIT_DECK':
        this.localDeck = structuredClone(message.deck)
        this.localReady = false
        this.authority = null
        this.emit({ type: 'DECK_ACCEPTED', deckId: message.deck.deckId, deckName: message.deck.name })
        this.emitRoomState()
        return
      case 'SET_DECK_READY':
        this.localReady = message.ready
        if (this.localReady) this.startMatch()
        else this.emitRoomState()
        return
      case 'PLAYER_ACTION':
        this.dispatchLocal(message.action)
        return
      case 'SET_REMATCH_READY':
        if (message.ready) {
          this.authority = null
          this.localReady = false
          this.emit({ type: 'GAME_CLEARED' })
          this.emitRoomState()
        }
        return
      case 'LEAVE_ROOM':
        this.emit({ type: 'LEFT_ROOM' })
        this.close()
        return
      case 'SET_DRAFT_SELECTION':
      case 'CONFIRM_DRAFT':
        this.emit({ type: 'ACTION_ERROR', message: 'AI 대전은 현재 일반 덱 포맷을 지원합니다.' })
    }
  }

  private startMatch(): void {
    if (!this.localDeck) return
    const sampleAiDeck = SAMPLE_DECK_LIST.find((deck) => deck.formatId === this.localDeck?.formatId)
      ?? SAMPLE_DECK_LIST[0]
    if (!sampleAiDeck) throw new Error('AI 기본 덱을 찾지 못했습니다.')
    // Draft pools are private to one room, so an offline AI uses a mirror of
    // the player's legal draft deck. Constructed formats use a curated sample.
    const mirrorLocalDeck = this.localDeck.formatId === 'draft-v1'
    const aiCardIds = mirrorLocalDeck ? this.localDeck.cardIds : sampleAiDeck.cardIds
    this.botDeckCardIds = [...aiCardIds]

    const matchConfig = createMatchConfig({
      formatId: this.localDeck.formatId,
      selectedSetIds: this.localDeck.selectedSetIds,
    })
    this.authority = LocalMatchAuthorityAdapter.create(LOCAL_PLAYER, {
      matchConfig,
      decks: {
        P1: [...this.localDeck.cardIds],
        P2: [...aiCardIds],
      },
      deckSelections: {
        P1: {
          formatId: this.localDeck.formatId,
          selectedSetIds: [...this.localDeck.selectedSetIds],
          draftPool: this.localDeck.draftPool ? structuredClone(this.localDeck.draftPool) : null,
        },
        P2: {
          formatId: this.localDeck.formatId,
          selectedSetIds: [...this.localDeck.selectedSetIds],
          draftPool: mirrorLocalDeck && this.localDeck.draftPool
            ? structuredClone(this.localDeck.draftPool)
            : null,
        },
      },
    })
    this.emitRoomState()
    this.emitGame()
    this.scheduleBot()
  }

  private dispatchLocal(action: Parameters<LocalMatchAuthorityAdapter['dispatchLocal']>[0]): void {
    if (!this.authority) return
    try {
      this.authority.dispatchLocal(action, { createdAt: Date.now() })
      this.emitGame()
      this.scheduleBot()
    } catch (error) {
      this.emit({
        type: 'ACTION_ERROR',
        message: error instanceof Error ? error.message : '행동을 실행할 수 없습니다.',
      })
    }
  }

  private emitGame(): void {
    if (!this.authority) return
    const snapshot = this.authority.getSnapshot()
    this.emit({
      type: 'GAME_VIEW',
      game: this.authority.getLocalView(),
      actionLog: snapshot.actionLog,
    })
    if (snapshot.game.status === 'finished') this.emitRoomState()
  }

  private scheduleBot(): void {
    if (!this.authority || this.closed || this.botTimer !== null) return
    const snapshot = this.authority.getSnapshot()
    if (snapshot.game.status !== 'playing' || getActingPlayer(snapshot.game) !== AI_PLAYER) return

    this.botTimer = window.setTimeout(() => {
      this.botTimer = null
      this.playBotAction()
    }, AI_THINK_DELAY_MS)
  }

  private playBotAction(): void {
    if (!this.authority || this.closed) return
    const snapshot: MatchHostSnapshot = this.authority.getSnapshot()
    const actor = getActingPlayer(snapshot.game)
    if (snapshot.game.status !== 'playing' || actor !== AI_PLAYER) return
    const options = enumerateLegalActions(snapshot.game, actor)
    if (options.length === 0) return
    const action = this.bot.chooseAction({
      actor,
      view: createGameView(snapshot.game, actor),
      legalActions: options.map((option) => option.action),
      legalOptions: options.map((option) => ({
        action: option.action,
        nextView: createGameView(option.nextState, actor),
      })),
      deckCardIds: this.botDeckCardIds,
      random: Math.random,
    })
    this.authority.dispatch(AI_PLAYER, action, { createdAt: Date.now() })
    this.emitGame()
    this.scheduleBot()
  }
}
