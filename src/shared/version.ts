import { CONTENT_VERSION } from '../content/sets'

declare const __APP_VERSION__: string | undefined

export const P2P_PROTOCOL_VERSION = 1
export const CARD_DATA_VERSION = CONTENT_VERSION

export function getAppVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
}

export interface PeerHandshakeMessage {
  type: 'HANDSHAKE'
  appVersion: string
  protocolVersion: number
  cardDataVersion: string
}

export function createPeerHandshake(appVersion = getAppVersion()): PeerHandshakeMessage {
  return {
    type: 'HANDSHAKE',
    appVersion,
    protocolVersion: P2P_PROTOCOL_VERSION,
    cardDataVersion: CARD_DATA_VERSION,
  }
}

export function parsePeerHandshake(value: unknown): PeerHandshakeMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const message = value as Partial<PeerHandshakeMessage>
  return message.type === 'HANDSHAKE'
    && typeof message.appVersion === 'string'
    && message.appVersion.length > 0
    && typeof message.protocolVersion === 'number'
    && Number.isInteger(message.protocolVersion)
    && typeof message.cardDataVersion === 'string'
    && message.cardDataVersion.length > 0
    ? message as PeerHandshakeMessage
    : null
}

export function validatePeerHandshake(
  remote: PeerHandshakeMessage,
  local = createPeerHandshake(),
): string | null {
  if (remote.protocolVersion !== local.protocolVersion) {
    return '서로 다른 통신 규격을 사용하고 있어 대전을 시작할 수 없습니다. 두 플레이어 모두 최신 버전으로 업데이트해 주세요.'
  }
  if (remote.cardDataVersion !== local.cardDataVersion) {
    return '두 플레이어의 카드 데이터가 다릅니다. 같은 버전으로 업데이트한 뒤 다시 연결해 주세요.'
  }
  if (remote.appVersion !== local.appVersion) {
    return `두 플레이어의 게임 버전이 다릅니다.\n\n내 버전: ${local.appVersion}\n상대 버전: ${remote.appVersion}\n\n같은 버전으로 업데이트한 뒤 다시 연결해 주세요.`
  }
  return null
}
