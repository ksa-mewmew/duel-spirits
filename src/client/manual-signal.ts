export const MANUAL_SIGNAL_PREFIX = 'DSI1:'
export const MAX_MANUAL_SIGNAL_LENGTH = 64_000

export type ManualSignalPayload =
  | {
      version: 1
      kind: 'offer'
      description: RTCSessionDescriptionInit
      createdAt: number
      roomSettings?: import('../shared/room-settings').RoomSettings
    }
  | {
      version: 1
      kind: 'answer'
      description: RTCSessionDescriptionInit
      createdAt: number
    }

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('연결 정보가 손상되었습니다.')
  try {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/')
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4))
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    throw new Error('연결 정보가 손상되었습니다.')
  }
}

async function compress(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null
  const stream = new Blob([new Uint8Array(bytes).buffer])
    .stream()
    .pipeThrough(new CompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('이 환경에서는 압축된 연결 정보를 읽을 수 없습니다.')
  }
  try {
    const stream = new Blob([new Uint8Array(bytes).buffer])
      .stream()
      .pipeThrough(new DecompressionStream('deflate'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  } catch {
    throw new Error('연결 정보가 손상되었습니다.')
  }
}

export async function encodeManualSignal(payload: ManualSignalPayload): Promise<string> {
  const source = new TextEncoder().encode(JSON.stringify(payload))
  const compressed = await compress(source)
  if (compressed && compressed.length < source.length) {
    return `${MANUAL_SIGNAL_PREFIX}Z${bytesToBase64Url(compressed)}`
  }
  return `${MANUAL_SIGNAL_PREFIX}J${bytesToBase64Url(source)}`
}

export async function decodeManualSignal(
  value: string,
  expectedKind?: ManualSignalPayload['kind'],
): Promise<ManualSignalPayload> {
  const normalized = value.trim()
  if (!normalized) throw new Error('클립보드가 비어 있습니다.')
  if (normalized.length > MAX_MANUAL_SIGNAL_LENGTH) throw new Error('연결 정보가 지나치게 큽니다.')
  if (!normalized.startsWith(MANUAL_SIGNAL_PREFIX)) throw new Error('올바른 Duel Spirits 연결 정보가 아닙니다.')

  let parsed: unknown
  try {
    const body = normalized.slice(MANUAL_SIGNAL_PREFIX.length)
    const encoding = body[0]
    if (encoding !== 'J' && encoding !== 'Z') throw new Error('encoding')
    const encodedBytes = base64UrlToBytes(body.slice(1))
    const bytes = encoding === 'Z' ? await decompress(encodedBytes) : encodedBytes
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch (error) {
    if (
      error instanceof Error
      && (
        error.message === '연결 정보가 손상되었습니다.'
        || error.message === '이 환경에서는 압축된 연결 정보를 읽을 수 없습니다.'
      )
    ) throw error
    throw new Error('연결 정보가 손상되었습니다.')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('연결 정보가 손상되었습니다.')
  const candidate = parsed as Partial<ManualSignalPayload>
  if (candidate.version !== 1) throw new Error('지원하지 않는 연결 정보 버전입니다.')
  if (candidate.kind !== 'offer' && candidate.kind !== 'answer') throw new Error('연결 정보 종류가 올바르지 않습니다.')
  if (expectedKind && candidate.kind !== expectedKind) {
    throw new Error(expectedKind === 'offer'
      ? '초대 정보 대신 응답 정보를 가져왔습니다.'
      : '응답 정보 대신 초대 정보를 가져왔습니다.')
  }
  const description = candidate.description
  if (!description || typeof description !== 'object') throw new Error('연결 정보가 손상되었습니다.')
  if (description.type !== candidate.kind) throw new Error('연결 설명의 종류가 일치하지 않습니다.')
  if (typeof description.sdp !== 'string' || !description.sdp.trim()) throw new Error('연결 정보에 SDP가 없습니다.')
  if (typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt)) throw new Error('연결 정보의 생성 시간이 올바르지 않습니다.')
  return candidate as ManualSignalPayload
}

export async function readInviteRoomSettings(value: string): Promise<import('../shared/room-settings').RoomSettings | null> {
  const payload = await decodeManualSignal(value, 'offer')
  return payload.kind === 'offer' ? payload.roomSettings ?? null : null
}

export async function waitForIceGatheringComplete(
  peerConnection: RTCPeerConnection,
  timeoutMs = 15_000,
): Promise<void> {
  if (peerConnection.connectionState === 'closed' || peerConnection.signalingState === 'closed') {
    throw new Error('PeerConnection이 이미 닫혔습니다.')
  }
  if (peerConnection.iceGatheringState === 'complete') return
  await new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      window.clearTimeout(timeout)
      peerConnection.removeEventListener('icegatheringstatechange', handleState)
      peerConnection.removeEventListener('connectionstatechange', handleConnection)
    }
    const handleState = (): void => {
      if (peerConnection.iceGatheringState !== 'complete') return
      cleanup()
      resolve()
    }
    const handleConnection = (): void => {
      if (peerConnection.connectionState !== 'closed') return
      cleanup()
      reject(new Error('PeerConnection이 이미 닫혔습니다.'))
    }
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error('ICE 후보 수집 시간이 초과되었습니다.'))
    }, timeoutMs)
    peerConnection.addEventListener('icegatheringstatechange', handleState)
    peerConnection.addEventListener('connectionstatechange', handleConnection)
  })
}
