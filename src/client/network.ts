import PartySocket from 'partysocket'

import type { GameAction } from '../shared/actions'
import type { SubmittedDeck } from '../shared/decks'
import type {
  ClientMessage,
  ServerMessage,
} from '../shared/messages'
import type { RoomSettings } from '../shared/room-settings'

export interface RoomConnectionHandlers {
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
  onMessage: (message: ServerMessage) => void
  onError?: () => void
}

export interface RoomCredentials {
  roomKey: string
  getSeatToken: () => string | null
  requestedSettings: RoomSettings
}

function normalizeGameServerHost(rawHost: string): string {
  const trimmed = rawHost.trim()
  if (!trimmed) {
    throw new Error('Game server host is empty.')
  }

  const url = new URL(
    /^(?:https?|wss?):\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`,
  )

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(
      'VITE_GAME_SERVER_HOST에는 도메인과 선택적 포트만 입력해야 합니다.',
    )
  }

  return url.host
}

function getGameServerHost(): string {
  const configuredHost =
    import.meta.env.VITE_GAME_SERVER_HOST
    ?? import.meta.env.VITE_PARTYKIT_HOST

  if (configuredHost) {
    return normalizeGameServerHost(configuredHost)
  }

  if (
    window.location.hostname === 'localhost'
    || window.location.hostname === '127.0.0.1'
  ) {
    return 'localhost:8787'
  }

  throw new Error(
    '배포용 게임 서버 주소가 없습니다. VITE_GAME_SERVER_HOST를 설정해 주세요.',
  )
}

export function connectToRoom(
  roomId: string,
  credentials: RoomCredentials,
  handlers: RoomConnectionHandlers,
): PartySocket {
  const socket = new PartySocket({
    host: getGameServerHost(),
    party: 'main',
    room: roomId,
    query: () => ({
      roomKey: credentials.roomKey,
      seatToken: credentials.getSeatToken() ?? '',
      turnLimitSeconds:
        credentials.requestedSettings.turnLimitSeconds === null
          ? 'none'
          : String(credentials.requestedSettings.turnLimitSeconds),
      seatExpirySeconds: String(
        credentials.requestedSettings.seatExpirySeconds,
      ),
      formatId: credentials.requestedSettings.formatId,
      selectedSetIds: credentials.requestedSettings.selectedSetIds.join(','),
    }),
  })

  socket.addEventListener('open', () => {
    handlers.onOpen?.()
  })

  socket.addEventListener('close', (event) => {
    handlers.onClose?.(event)
  })

  socket.addEventListener('error', () => {
    handlers.onError?.()
  })

  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') {
      return
    }

    try {
      handlers.onMessage(
        JSON.parse(event.data) as ServerMessage,
      )
    } catch (error) {
      console.error('서버 메시지를 해석하지 못했습니다.', error)
    }
  })

  return socket
}

function sendClientMessage(
  socket: PartySocket,
  message: ClientMessage,
): void {
  socket.send(JSON.stringify(message))
}

export function sendPlayerAction(
  socket: PartySocket,
  action: GameAction,
): void {
  sendClientMessage(socket, {
    type: 'PLAYER_ACTION',
    action,
  })
}

export function sendDeck(
  socket: PartySocket,
  deck: SubmittedDeck,
): void {
  sendClientMessage(socket, {
    type: 'SUBMIT_DECK',
    deck,
  })
}

export function sendDeckReady(
  socket: PartySocket,
  ready: boolean,
): void {
  sendClientMessage(socket, {
    type: 'SET_DECK_READY',
    ready,
  })
}

export function sendRematchReady(
  socket: PartySocket,
  ready: boolean,
): void {
  sendClientMessage(socket, {
    type: 'SET_REMATCH_READY',
    ready,
  })
}

export function sendLeaveRoom(
  socket: PartySocket,
): void {
  sendClientMessage(socket, {
    type: 'LEAVE_ROOM',
  })
}
