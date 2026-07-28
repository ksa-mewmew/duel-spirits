import {
  decodeManualSignal,
  encodeManualSignal,
  waitForIceGatheringComplete,
} from './manual-signal'
import type { RoomSettings } from '../shared/room-settings'

export interface PeerConnectionHandlers {
  onOpen: () => void
  onClose: () => void
  onMessage: (message: string) => void
  onFailure?: (message: string) => void
}

export interface HostPeerConnection {
  createInviteCode(): Promise<string>
  acceptResponseCode(code: string): Promise<void>
  send(message: string): void
  close(): void
}

export interface GuestPeerConnection {
  createResponseCode(inviteCode: string): Promise<string>
  send(message: string): void
  close(): void
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

function bindChannel(channel: RTCDataChannel, handlers: PeerConnectionHandlers): void {
  channel.addEventListener('open', handlers.onOpen)
  channel.addEventListener('close', handlers.onClose)
  channel.addEventListener('message', (event) => {
    if (typeof event.data === 'string') handlers.onMessage(event.data)
  })
}

export function createHostPeerConnection(handlers: PeerConnectionHandlers, roomSettings?: RoomSettings): HostPeerConnection {
  const peer = new RTCPeerConnection(RTC_CONFIG)
  const channel = peer.createDataChannel('duel-spirits', { ordered: true })
  bindChannel(channel, handlers)
  peer.addEventListener('connectionstatechange', () => {
    if (peer.connectionState === 'failed') {
      handlers.onFailure?.('상대와 직접 연결하지 못했습니다. 회사·학교·공용 네트워크 또는 일부 통신사 환경에서는 직접 연결이 제한될 수 있습니다. 두 플레이어가 다른 네트워크에서 다시 시도해 주세요.')
    }
  })
  return {
    async createInviteCode() {
      await peer.setLocalDescription(await peer.createOffer())
      await waitForIceGatheringComplete(peer)
      if (!peer.localDescription) throw new Error('초대 코드를 만들지 못했습니다.')
      return await encodeManualSignal({
        version: 1,
        kind: 'offer',
        description: peer.localDescription.toJSON(),
        createdAt: Date.now(),
        roomSettings,
      })
    },
    async acceptResponseCode(code) {
      const payload = await decodeManualSignal(code, 'answer')
      try {
        await peer.setRemoteDescription(payload.description)
      } catch {
        throw new Error('원격 응답 정보를 적용하지 못했습니다.')
      }
    },
    send(message) {
      if (channel.readyState !== 'open') throw new Error('상대와 아직 연결되지 않았습니다.')
      channel.send(message)
    },
    close() {
      channel.close()
      peer.close()
    },
  }
}

export function createGuestPeerConnection(handlers: PeerConnectionHandlers): GuestPeerConnection {
  const peer = new RTCPeerConnection(RTC_CONFIG)
  let channel: RTCDataChannel | null = null
  peer.addEventListener('datachannel', (event) => {
    channel = event.channel
    bindChannel(channel, handlers)
  })
  peer.addEventListener('connectionstatechange', () => {
    if (peer.connectionState === 'failed') {
      handlers.onFailure?.('상대와 직접 연결하지 못했습니다. 회사·학교·공용 네트워크 또는 일부 통신사 환경에서는 직접 연결이 제한될 수 있습니다. 두 플레이어가 다른 네트워크에서 다시 시도해 주세요.')
    }
  })
  return {
    async createResponseCode(inviteCode) {
      const payload = await decodeManualSignal(inviteCode, 'offer')
      try {
        await peer.setRemoteDescription(payload.description)
      } catch {
        throw new Error('원격 초대 정보를 적용하지 못했습니다.')
      }
      await peer.setLocalDescription(await peer.createAnswer())
      await waitForIceGatheringComplete(peer)
      if (!peer.localDescription) throw new Error('응답 코드를 만들지 못했습니다.')
      return await encodeManualSignal({
        version: 1,
        kind: 'answer',
        description: peer.localDescription.toJSON(),
        createdAt: Date.now(),
      })
    },
    send(message) {
      if (!channel || channel.readyState !== 'open') throw new Error('방장과 아직 연결되지 않았습니다.')
      channel.send(message)
    },
    close() {
      channel?.close()
      peer.close()
    },
  }
}
