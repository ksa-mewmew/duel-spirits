import { describe, expect, test } from 'vitest'
import {
  MANUAL_SIGNAL_PREFIX,
  MAX_MANUAL_SIGNAL_LENGTH,
  decodeManualSignal,
  encodeManualSignal,
} from './manual-signal'

const description = (type: 'offer' | 'answer'): RTCSessionDescriptionInit => ({
  type,
  sdp: `v=0\r\na=${type}`,
})

describe('manual signaling payload', () => {
  test.each(['offer', 'answer'] as const)('round-trips a valid %s', async (kind) => {
    const encoded = await encodeManualSignal({ version: 1, kind, description: description(kind), createdAt: 123 })
    expect(encoded.startsWith(MANUAL_SIGNAL_PREFIX)).toBe(true)
    await expect(decodeManualSignal(encoded, kind)).resolves.toEqual({
      version: 1,
      kind,
      description: description(kind),
      createdAt: 123,
    })
  })

  test('rejects an invalid prefix', async () => {
    await expect(decodeManualSignal('OTHER:abc')).rejects.toThrow('올바른 Duel Spirits')
  })

  test('rejects invalid base64 and JSON', async () => {
    await expect(decodeManualSignal(`${MANUAL_SIGNAL_PREFIX}J%%%`)).rejects.toThrow('손상')
    await expect(decodeManualSignal(`${MANUAL_SIGNAL_PREFIX}J${btoa('not json')}`)).rejects.toThrow('손상')
  })

  test('rejects unsupported versions', async () => {
    const value = `${MANUAL_SIGNAL_PREFIX}J${btoa(JSON.stringify({
      version: 2, kind: 'offer', description: description('offer'), createdAt: 1,
    }))}`
    await expect(decodeManualSignal(value)).rejects.toThrow('지원하지 않는')
  })

  test('rejects kind mismatches', async () => {
    const answer = await encodeManualSignal({ version: 1, kind: 'answer', description: description('answer'), createdAt: 1 })
    await expect(decodeManualSignal(answer, 'offer')).rejects.toThrow('초대 정보 대신 응답')
  })

  test('rejects an empty SDP', async () => {
    const value = await encodeManualSignal({
      version: 1,
      kind: 'offer',
      description: { type: 'offer', sdp: '' },
      createdAt: 1,
    })
    await expect(decodeManualSignal(value)).rejects.toThrow('SDP')
  })

  test('rejects oversized payloads', async () => {
    await expect(decodeManualSignal(`${MANUAL_SIGNAL_PREFIX}J${'a'.repeat(MAX_MANUAL_SIGNAL_LENGTH)}`))
      .rejects.toThrow('지나치게')
  })
})
