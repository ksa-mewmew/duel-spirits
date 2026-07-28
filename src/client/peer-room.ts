import type { GameAction } from '../shared/actions'
import type { SubmittedDeck } from '../shared/decks'
import { DECK_SCHEMA_VERSION, createDraftPool, validateDeck } from '../shared/decks'
import { getFormat } from '../content/formats'
import {
  areBothDraftsConfirmed,
  autoCompleteDraftSelection,
  confirmDraftSelection,
  createDraftPlayerView,
  createRoomDraftState,
  setDraftSelection,
} from '../shared/room-draft'
import type { RoomDraftState } from '../shared/room-draft'
import { createMatchConfig } from '../shared/match-config'
import { RoomHostMatchAuthorityAdapter } from '../shared/match-authority-adapters'
import type { PublicDeckStates, ServerMessage } from '../shared/messages'
import type { RoomSettings } from '../shared/room-settings'
import {
  areBothPlayersReady,
  createEmptyRematchReadiness,
  getRematchReadyPlayers,
  setRematchReady,
} from '../shared/room-lifecycle'
import type { RematchReadiness } from '../shared/room-lifecycle'
import type { PlayerId } from '../shared/types'
import {
  createPeerHandshake,
  parsePeerHandshake,
  validatePeerHandshake,
} from '../shared/version'
import {
  createGuestPeerConnection,
  createHostPeerConnection,
} from './peer-connection'

export interface MessageSocket {
  send(message: string): void
  close(): void
}

export interface PeerRoomSetupHandlers {
  onServerMessage(message: ServerMessage): void
  onOpen(): void
  onClose(): void
  onError(message: string): void
}

export interface HostRoomConnection {
  socket: MessageSocket
  inviteCode: Promise<string>
  acceptResponseCode(code: string): Promise<void>
}

export interface GuestRoomConnection {
  socket: MessageSocket
  responseCode: Promise<string>
}

type PeerClientMessage =
  | { type: 'SUBMIT_DECK'; deck: SubmittedDeck }
  | { type: 'SET_DECK_READY'; ready: boolean }
  | { type: 'SET_REMATCH_READY'; ready: boolean }
  | { type: 'PLAYER_ACTION'; action: GameAction }
  | { type: 'SET_DRAFT_SELECTION'; selectedIndices: number[] }
  | { type: 'CONFIRM_DRAFT' }
  | { type: 'LEAVE_ROOM' }

function parsePeerMessage(raw: string): PeerClientMessage | null {
  try {
    const value = JSON.parse(raw) as PeerClientMessage
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null
    return value
  } catch {
    return null
  }
}

class HostRoomSession {
  private readonly settings: RoomSettings
  private readonly sendHost: (message: ServerMessage) => void
  private readonly sendGuest: (message: ServerMessage) => void
  private guestConnected = false
  private decks: Partial<Record<PlayerId, SubmittedDeck>> = {}
  private ready: Record<PlayerId, boolean> = { P1: false, P2: false }
  private rematchReady: RematchReadiness = createEmptyRematchReadiness()
  private authority: RoomHostMatchAuthorityAdapter | null = null
  private draft: RoomDraftState | null = null
  private draftTimer: number | null = null

  constructor(
    settings: RoomSettings,
    sendHost: (message: ServerMessage) => void,
    sendGuest: (message: ServerMessage) => void,
  ) {
    this.settings = settings
    this.sendHost = sendHost
    this.sendGuest = sendGuest
  }

  initializeHost(): void {
    this.sendHost({
      type: 'ASSIGNED_PLAYER',
      roomId: 'HOST',
      playerId: 'P1',
      seatToken: 'host',
      reconnected: false,
    })
    this.broadcastRoom()
  }

  connectGuest(): void {
    this.guestConnected = true
    this.sendGuest({
      type: 'ASSIGNED_PLAYER',
      roomId: 'HOST',
      playerId: 'P2',
      seatToken: 'guest',
      reconnected: false,
    })
    this.broadcastRoom()
    if (this.settings.formatId === 'draft-v1') this.startDraft()
  }

  disconnectGuest(): void {
    this.guestConnected = false
    this.broadcastRoom()
  }

  handle(playerId: PlayerId, raw: string): void {
    const message = parsePeerMessage(raw)
    if (!message) {
      this.send(playerId, { type: 'ACTION_ERROR', message: '잘못된 P2P 메시지입니다.' })
      return
    }
    try {
      switch (message.type) {
        case 'SET_DRAFT_SELECTION':
          this.updateDraftSelection(playerId, message.selectedIndices)
          return
        case 'CONFIRM_DRAFT':
          this.confirmDraft(playerId)
          return
        case 'SUBMIT_DECK': {
          const validation = validateDeck(message.deck.cardIds, message.deck)
          if (!validation.valid) throw new Error(validation.errors[0] ?? '사용할 수 없는 덱입니다.')
          this.decks[playerId] = structuredClone(message.deck)
          this.ready[playerId] = false
          this.send(playerId, {
            type: 'DECK_ACCEPTED',
            deckId: message.deck.deckId,
            deckName: message.deck.name,
          })
          this.broadcastRoom()
          return
        }
        case 'SET_DECK_READY':
          if (!this.decks[playerId]) throw new Error('먼저 덱을 제출해 주세요.')
          this.ready[playerId] = message.ready
          this.broadcastRoom()
          if (this.ready.P1 && this.ready.P2) this.startMatch()
          return
        case 'PLAYER_ACTION':
          if (!this.authority) throw new Error('대전이 아직 시작되지 않았습니다.')
          if (playerId === 'P1') {
            this.authority.dispatchHostAction(message.action, { createdAt: Date.now() })
          } else {
            this.authority.dispatchGuestAction(message.action, { createdAt: Date.now() })
          }
          this.broadcastGame()
          return
        case 'SET_REMATCH_READY':
          if (!this.authority || this.authority.getSnapshot().game.status !== 'finished') {
            return
          }
          this.rematchReady = setRematchReady(
            this.rematchReady,
            playerId,
            message.ready,
          )
          if (message.ready) {
            this.send(playerId === 'P1' ? 'P2' : 'P1', {
              type: 'REMATCH_REQUESTED',
              playerId,
            })
          }
          if (!areBothPlayersReady(this.rematchReady)) {
            this.broadcastRoom()
            return
          }
          this.authority = null
          this.ready = { P1: false, P2: false }
          this.rematchReady = createEmptyRematchReadiness()
          this.sendHost({ type: 'GAME_CLEARED' })
          if (this.guestConnected) this.sendGuest({ type: 'GAME_CLEARED' })
          this.broadcastRoom()
          return
        case 'LEAVE_ROOM':
          if (playerId === 'P2') this.disconnectGuest()
          return
      }
    } catch (error) {
      this.send(playerId, {
        type: 'ACTION_ERROR',
        message: error instanceof Error ? error.message : '요청을 처리하지 못했습니다.',
      })
    }
  }

  private startMatch(): void {
    const hostDeck = this.decks.P1
    const guestDeck = this.decks.P2
    if (!hostDeck || !guestDeck) return
    const matchConfig = createMatchConfig({
      formatId: this.settings.formatId,
      selectedSetIds: this.settings.selectedSetIds,
      createdAt: Date.now(),
    })
    this.authority = RoomHostMatchAuthorityAdapter.create('P1', {
      matchConfig,
      decks: { P1: hostDeck.cardIds, P2: guestDeck.cardIds },
      deckSelections: {
        P1: {
          formatId: hostDeck.formatId,
          selectedSetIds: hostDeck.selectedSetIds,
          draftPool: hostDeck.draftPool,
        },
        P2: {
          formatId: guestDeck.formatId,
          selectedSetIds: guestDeck.selectedSetIds,
          draftPool: guestDeck.draftPool,
        },
      },
    })
    this.broadcastGame()
    this.broadcastRoom()
  }

  private startDraft(): void {
    const format = getFormat(this.settings.formatId)
    if (!format.draft || this.draft || this.authority) return
    const now = Date.now()
    this.decks = {}
    this.ready = { P1: false, P2: false }
    this.draft = createRoomDraftState({
      P1: createDraftPool(`peer:P1:${crypto.randomUUID()}`, format.id, now, this.settings.selectedSetIds),
      P2: createDraftPool(`peer:P2:${crypto.randomUUID()}`, format.id, now, this.settings.selectedSetIds),
    }, this.settings.draftLimitSeconds, now)
    this.draftTimer = window.setTimeout(() => this.completeDraft(), this.settings.draftLimitSeconds * 1000)
    this.broadcastRoom()
    this.broadcastDraft()
  }

  private updateDraftSelection(playerId: PlayerId, indices: number[]): void {
    const format = getFormat(this.settings.formatId)
    if (!this.draft || !format.draft) throw new Error('진행 중인 드래프트가 없습니다.')
    this.draft = setDraftSelection(this.draft, playerId, indices, format.draft.deckSize)
    const counts = new Map<string, number>()
    for (const index of this.draft.selectedIndices[playerId]) {
      const cardId = this.draft.pools[playerId].cardIds[index]
      const count = (counts.get(cardId) ?? 0) + 1
      if (count > format.maxCopiesPerCard) throw new Error(`같은 카드는 최대 ${format.maxCopiesPerCard}장까지 선택할 수 있습니다.`)
      counts.set(cardId, count)
    }
    this.broadcastDraft()
  }

  private confirmDraft(playerId: PlayerId): void {
    const format = getFormat(this.settings.formatId)
    if (!this.draft || !format.draft) throw new Error('진행 중인 드래프트가 없습니다.')
    this.draft = confirmDraftSelection(this.draft, playerId, format.draft.deckSize)
    if (areBothDraftsConfirmed(this.draft)) this.finishDraft()
    else this.broadcastDraft()
  }

  private createDraftDeck(playerId: PlayerId): SubmittedDeck {
    const format = getFormat(this.settings.formatId)
    if (!this.draft || !format.draft) throw new Error('진행 중인 드래프트가 없습니다.')
    const pool = this.draft.pools[playerId]
    return {
      schemaVersion: DECK_SCHEMA_VERSION,
      deckId: `peer-draft-${playerId}-${pool.seed}`,
      name: `${playerId} 드래프트 덱`,
      cardIds: this.draft.selectedIndices[playerId].map((index) => pool.cardIds[index]),
      formatId: format.id,
      selectedSetIds: [...this.settings.selectedSetIds],
      draftPool: structuredClone(pool),
    }
  }

  private completeDraft(): void {
    const format = getFormat(this.settings.formatId)
    if (!this.draft || !format.draft) return
    for (const playerId of ['P1', 'P2'] as const) {
      this.draft.selectedIndices[playerId] = autoCompleteDraftSelection(
        this.draft.pools[playerId],
        this.draft.selectedIndices[playerId],
        format.draft.deckSize,
        format.maxCopiesPerCard,
      )
      this.draft.confirmed[playerId] = true
    }
    this.finishDraft()
  }

  private finishDraft(): void {
    if (this.draftTimer !== null) window.clearTimeout(this.draftTimer)
    this.decks = { P1: this.createDraftDeck('P1'), P2: this.createDraftDeck('P2') }
    this.ready = { P1: true, P2: true }
    this.startMatch()
    this.draft = null
  }

  private broadcastDraft(): void {
    const format = getFormat(this.settings.formatId)
    if (!this.draft || !format.draft) return
    this.sendHost({ type: 'DRAFT_STATE', draft: createDraftPlayerView(this.draft, 'P1', format.draft.deckSize) })
    if (this.guestConnected) this.sendGuest({ type: 'DRAFT_STATE', draft: createDraftPlayerView(this.draft, 'P2', format.draft.deckSize) })
  }

  private deckStates(): PublicDeckStates {
    return {
      P1: {
        submitted: Boolean(this.decks.P1),
        ready: this.ready.P1,
        name: this.decks.P1?.name ?? null,
      },
      P2: {
        submitted: Boolean(this.decks.P2),
        ready: this.ready.P2,
        name: this.decks.P2?.name ?? null,
      },
    }
  }

  private broadcastRoom(): void {
    const message: ServerMessage = {
      type: 'ROOM_STATE',
      phase: this.authority ? 'playing' : this.draft ? 'drafting' : 'waiting',
      connectedPlayers: this.guestConnected ? ['P1', 'P2'] : ['P1'],
      reservedPlayers: [],
      rematchReadyPlayers: getRematchReadyPlayers(this.rematchReady),
      deckStates: this.deckStates(),
      settings: this.settings,
      turnDeadlineAt: null,
      seatExpiresAt: { P1: null, P2: null },
    }
    this.sendHost(message)
    if (this.guestConnected) this.sendGuest(message)
  }

  private broadcastGame(): void {
    if (!this.authority) return
    const snapshot = this.authority.getSnapshot()
    this.sendHost({
      type: 'GAME_VIEW',
      game: this.authority.getHostView(),
      actionLog: snapshot.actionLog,
    })
    if (this.guestConnected) {
      this.sendGuest({
        type: 'GAME_VIEW',
        game: this.authority.getGuestView(),
        actionLog: snapshot.actionLog,
      })
    }
  }

  private send(playerId: PlayerId, message: ServerMessage): void {
    if (playerId === 'P1') this.sendHost(message)
    else if (this.guestConnected) this.sendGuest(message)
  }
}

export function createHostRoomConnection(
  settings: RoomSettings,
  handlers: PeerRoomSetupHandlers,
): HostRoomConnection {
  let session: HostRoomSession
  let handshakeComplete = false
  let receivedHandshake = false
  let receivedHandshakeAck = false
  let handshakeTimer: number | null = null
  const failHandshake = (message: string): void => {
    if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
    handlers.onError(message)
    peer.close()
  }
  const peer = createHostPeerConnection({
    onOpen: () => {
      peer.send(JSON.stringify(createPeerHandshake()))
      handshakeTimer = window.setTimeout(() => {
        if (!handshakeComplete) failHandshake('버전 확인 시간이 초과되었습니다.')
      }, 10_000)
    },
    onClose: () => {
      session.disconnectGuest()
      handlers.onClose()
    },
    onMessage: (message) => {
      if (!handshakeComplete) {
        let parsed: unknown
        try { parsed = JSON.parse(message) } catch { failHandshake('잘못된 버전 확인 메시지입니다.'); return }
        if (
          parsed
          && typeof parsed === 'object'
          && !Array.isArray(parsed)
          && (parsed as { type?: unknown }).type === 'HANDSHAKE_ACK'
        ) {
          receivedHandshakeAck = true
          if (receivedHandshake && receivedHandshakeAck) {
            handshakeComplete = true
            if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
            session.connectGuest()
            handlers.onOpen()
          }
          return
        }
        const handshake = parsePeerHandshake(parsed)
        if (!handshake) { failHandshake('잘못된 버전 확인 메시지입니다.'); return }
        const error = validatePeerHandshake(handshake)
        if (error) { failHandshake(error); return }
        receivedHandshake = true
        peer.send(JSON.stringify({ type: 'HANDSHAKE_ACK' }))
        if (receivedHandshakeAck) {
          handshakeComplete = true
          if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
          session.connectGuest()
          handlers.onOpen()
        }
        return
      }
      session.handle('P2', message)
    },
    onFailure: handlers.onError,
  }, settings)
  session = new HostRoomSession(
    settings,
    handlers.onServerMessage,
    (message) => peer.send(JSON.stringify(message)),
  )
  queueMicrotask(() => session.initializeHost())
  return {
    socket: {
      send: (message) => session.handle('P1', message),
      close: () => {
        if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
        peer.close()
      },
    },
    inviteCode: peer.createInviteCode().catch((error) => {
      handlers.onError(error instanceof Error ? error.message : '초대 코드를 만들지 못했습니다.')
      throw error
    }),
    acceptResponseCode: (code) => peer.acceptResponseCode(code),
  }
}

export function createGuestRoomConnection(
  settings: RoomSettings,
  inviteCode: string,
  handlers: PeerRoomSetupHandlers,
): GuestRoomConnection {
  void settings
  let handshakeComplete = false
  let receivedHandshake = false
  let receivedHandshakeAck = false
  let handshakeTimer: number | null = null
  const pendingMessages: string[] = []
  const failHandshake = (message: string): void => {
    if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
    handlers.onError(message)
    peer.close()
  }
  const peer = createGuestPeerConnection({
    onOpen: () => {
      peer.send(JSON.stringify(createPeerHandshake()))
      handshakeTimer = window.setTimeout(() => {
        if (!handshakeComplete) failHandshake('버전 확인 시간이 초과되었습니다.')
      }, 10_000)
    },
    onClose: handlers.onClose,
    onMessage: (raw) => {
      if (!handshakeComplete) {
        let parsed: unknown
        try { parsed = JSON.parse(raw) } catch { failHandshake('잘못된 버전 확인 메시지입니다.'); return }
        if (
          parsed
          && typeof parsed === 'object'
          && !Array.isArray(parsed)
          && (parsed as { type?: unknown }).type === 'HANDSHAKE_ACK'
        ) {
          receivedHandshakeAck = true
          if (receivedHandshake && receivedHandshakeAck) {
            handshakeComplete = true
            if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
            handlers.onOpen()
            for (const message of pendingMessages.splice(0)) peer.send(message)
          }
          return
        }
        const handshake = parsePeerHandshake(parsed)
        if (!handshake) { failHandshake('잘못된 버전 확인 메시지입니다.'); return }
        const error = validatePeerHandshake(handshake)
        if (error) { failHandshake(error); return }
        receivedHandshake = true
        peer.send(JSON.stringify({ type: 'HANDSHAKE_ACK' }))
        if (receivedHandshakeAck) {
          handshakeComplete = true
          if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
          handlers.onOpen()
          for (const message of pendingMessages.splice(0)) peer.send(message)
        }
        return
      }
      try {
        handlers.onServerMessage(JSON.parse(raw) as ServerMessage)
      } catch {
        handlers.onError('방장이 보낸 메시지를 읽지 못했습니다.')
      }
    },
    onFailure: handlers.onError,
  })
  return {
    socket: {
      send: (message) => {
        if (!handshakeComplete) {
          pendingMessages.push(message)
          return
        }
        peer.send(message)
      },
      close: () => {
        if (handshakeTimer !== null) window.clearTimeout(handshakeTimer)
        pendingMessages.length = 0
        peer.close()
      },
    },
    responseCode: peer.createResponseCode(inviteCode).catch((error) => {
      handlers.onError(error instanceof Error ? error.message : '응답 코드를 만들지 못했습니다.')
      throw error
    }),
  }
}
