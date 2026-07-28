import PartySocket from 'partysocket'

import type { GameAction } from '../shared/actions'
import type { SubmittedDeck } from '../shared/decks'
import type {
  ClientMessage,
  ServerMessage,
} from '../shared/messages'
import type { RoomSettings } from '../shared/room-settings'
import {
  createGuestRoomConnection,
  createHostRoomConnection,
} from './peer-room'
import type {
  GuestRoomConnection,
  HostRoomConnection,
  PeerRoomSetupHandlers,
} from './peer-room'
import { createClipboardAdapter } from './clipboard'

export interface MessageSocket {
  send(message: string): void
  close(): void
}

export interface PeerSetupState {
  role: 'host' | 'guest'
  stage: ManualConnectionStage
  connected: boolean
  error: string
  status: string
}

export type ManualConnectionStage =
  | 'idle'
  | 'creating-offer'
  | 'waiting-for-answer'
  | 'reading-offer'
  | 'creating-answer'
  | 'answer-ready'
  | 'applying-answer'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'closed'

let peerSetupState: PeerSetupState | null = null
let activeHostConnection: HostRoomConnection | null = null
let activeGuestConnection: GuestRoomConnection | null = null
let activePeerSocket: MessageSocket | null = null
let preparedInvite = ''
let preparedResponse = ''
let peerSettings: RoomSettings | null = null
let peerHandlers: RoomConnectionHandlers | null = null
const clipboard = createClipboardAdapter()

export function getPeerSetupState(): PeerSetupState | null {
  return peerSetupState ? { ...peerSetupState } : null
}

function setPeerStage(stage: ManualConnectionStage, status: string, error = ''): void {
  if (!peerSetupState) return
  peerSetupState = {
    ...peerSetupState,
    stage,
    connected: stage === 'connected',
    status,
    error,
  }
  peerHandlers?.onOpen?.()
}

function setupHandlers(): PeerRoomSetupHandlers {
  if (!peerHandlers) throw new Error('P2P 연결 화면이 준비되지 않았습니다.')
  return {
    onServerMessage: peerHandlers.onMessage,
    onOpen: () => {
      setPeerStage('connected', '친구와 연결되었습니다.')
      peerHandlers?.onOpen?.()
    },
    onClose: () => {
      setPeerStage('closed', '연결이 종료되었습니다.')
      peerHandlers?.onClose?.(new CloseEvent('close'))
    },
    onError: (message) => {
      setPeerStage('failed', '', message)
      peerHandlers?.onError?.()
    },
  }
}

function requirePeerSettings(): RoomSettings {
  if (!peerSettings) throw new Error('P2P 연결 설정이 준비되지 않았습니다.')
  return peerSettings
}

export async function copyHostInviteInformation(): Promise<void> {
  if (!peerSetupState || peerSetupState.role !== 'host') throw new Error('방장 연결 화면이 아닙니다.')
  if (['creating-offer', 'applying-answer', 'connecting'].includes(peerSetupState.stage)) return
  try {
    if (!activeHostConnection) {
      setPeerStage('creating-offer', '초대 정보를 준비하고 있습니다.')
      activeHostConnection = createHostRoomConnection(requirePeerSettings(), setupHandlers())
      activePeerSocket = activeHostConnection.socket
      preparedInvite = await activeHostConnection.inviteCode
    }
    await clipboard.writeText(preparedInvite)
    setPeerStage('waiting-for-answer', '초대 정보를 복사했습니다. 친구에게 메신저로 보내세요.')
  } catch (error) {
    setPeerStage('failed', '', error instanceof Error ? error.message : '초대 정보를 복사하지 못했습니다.')
  }
}

export async function importHostResponseInformation(): Promise<void> {
  if (!activeHostConnection) throw new Error('먼저 초대 정보를 복사해 주세요.')
  if (peerSetupState?.stage === 'applying-answer') return
  try {
    setPeerStage('applying-answer', '응답 정보를 확인하고 있습니다.')
    const value = await clipboard.readText()
    await activeHostConnection.acceptResponseCode(value)
    setPeerStage('connecting', '응답 정보를 확인했습니다. 상대와 연결하는 중입니다.')
  } catch (error) {
    setPeerStage('failed', '', error instanceof Error ? error.message : '응답 정보를 가져오지 못했습니다.')
  }
}

export async function importGuestInviteInformation(): Promise<void> {
  if (!peerSetupState || peerSetupState.role !== 'guest') throw new Error('참가자 연결 화면이 아닙니다.')
  if (['reading-offer', 'creating-answer'].includes(peerSetupState.stage)) return
  try {
    setPeerStage('reading-offer', '초대 정보를 읽고 있습니다.')
    const value = await clipboard.readText()
    if (!value.trim()) throw new Error('클립보드가 비어 있습니다.')
    activeGuestConnection?.socket.close()
    setPeerStage('creating-answer', '응답 정보를 준비하고 있습니다.')
    activeGuestConnection = createGuestRoomConnection(requirePeerSettings(), value, setupHandlers())
    activePeerSocket = activeGuestConnection.socket
    preparedResponse = await activeGuestConnection.responseCode
    setPeerStage('answer-ready', '응답 정보가 준비되었습니다.')
  } catch (error) {
    setPeerStage('failed', '', error instanceof Error ? error.message : '초대 정보를 가져오지 못했습니다.')
  }
}

export async function copyGuestResponseInformation(): Promise<void> {
  if (!preparedResponse || peerSetupState?.stage !== 'answer-ready') return
  try {
    await clipboard.writeText(preparedResponse)
    setPeerStage('connecting', '응답 정보를 복사했습니다. 호스트에게 메신저로 보내세요.')
  } catch (error) {
    setPeerStage('failed', '', error instanceof Error ? error.message : '응답 정보를 복사하지 못했습니다.')
  }
}

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
): MessageSocket {
  const pageUrl = new URL(window.location.href)
  if (pageUrl.searchParams.get('tutorial') === '1') {
    return {
      send: () => {},
      close: () => {},
    }
  }
  const peerRole = pageUrl.searchParams.has('host')
    ? 'host'
    : pageUrl.searchParams.has('guest')
      ? 'guest'
      : null
  if (peerRole === 'host') {
    peerSetupState = { role: 'host', stage: 'idle', connected: false, error: '', status: '친구에게 초대 정보를 보내세요.' }
    peerSettings = credentials.requestedSettings
    peerHandlers = handlers
  }
  if (peerRole === 'guest') {
    peerSetupState = { role: 'guest', stage: 'idle', connected: false, error: '', status: '친구가 보낸 초대 정보를 클립보드에 복사한 뒤 가져오세요.' }
    peerSettings = credentials.requestedSettings
    peerHandlers = handlers
    const pendingInvite = window.sessionStorage.getItem('duel-spirits:pending-invite')
    if (pendingInvite) {
      window.sessionStorage.removeItem('duel-spirits:pending-invite')
      queueMicrotask(async () => {
        try {
          setPeerStage('reading-offer', '로비에서 확인한 초대 정보를 적용하고 있습니다.')
          activeGuestConnection = createGuestRoomConnection(requirePeerSettings(), pendingInvite, setupHandlers())
          activePeerSocket = activeGuestConnection.socket
          preparedResponse = await activeGuestConnection.responseCode
          setPeerStage('answer-ready', '응답 정보가 준비되었습니다. 방장에게 보내기 전에 복사해 주세요.')
        } catch (error) {
          setPeerStage('failed', '', error instanceof Error ? error.message : '초대 정보를 적용하지 못했습니다.')
        }
      })
    }
  }
  if (peerRole) {
    return {
      send(message) {
        if (!activePeerSocket) throw new Error('친구와 아직 연결되지 않았습니다.')
        activePeerSocket.send(message)
      },
      close() {
        activePeerSocket?.close()
        activePeerSocket = null
        preparedInvite = ''
        preparedResponse = ''
        setPeerStage('closed', '연결이 종료되었습니다.')
      },
    }
  }

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
      draftLimitSeconds: String(
        credentials.requestedSettings.draftLimitSeconds,
      ),
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
  socket: MessageSocket,
  message: ClientMessage,
): void {
  socket.send(JSON.stringify(message))
}

export function sendPlayerAction(
  socket: MessageSocket,
  action: GameAction,
): void {
  sendClientMessage(socket, {
    type: 'PLAYER_ACTION',
    action,
  })
}

export function sendDeck(
  socket: MessageSocket,
  deck: SubmittedDeck,
): void {
  sendClientMessage(socket, {
    type: 'SUBMIT_DECK',
    deck,
  })
}

export function sendDeckReady(
  socket: MessageSocket,
  ready: boolean,
): void {
  sendClientMessage(socket, {
    type: 'SET_DECK_READY',
    ready,
  })
}

export function sendRematchReady(
  socket: MessageSocket,
  ready: boolean,
): void {
  sendClientMessage(socket, {
    type: 'SET_REMATCH_READY',
    ready,
  })
}

export function sendDraftSelection(
  socket: MessageSocket,
  selectedIndices: number[],
): void {
  sendClientMessage(socket, {
    type: 'SET_DRAFT_SELECTION',
    selectedIndices,
  })
}

export function sendDraftConfirm(socket: MessageSocket): void {
  sendClientMessage(socket, { type: 'CONFIRM_DRAFT' })
}

export function sendLeaveRoom(
  socket: MessageSocket,
): void {
  sendClientMessage(socket, {
    type: 'LEAVE_ROOM',
  })
}
