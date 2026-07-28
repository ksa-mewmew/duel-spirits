import { describe, expect, test } from 'vitest'
import {
  createPeerHandshake,
  parsePeerHandshake,
  validatePeerHandshake,
} from './version'

describe('P2P version handshake', () => {
  const local = createPeerHandshake('0.1.0')

  test('accepts matching versions', () => {
    expect(validatePeerHandshake({ ...local }, local)).toBeNull()
  })

  test('rejects app version mismatches', () => {
    expect(validatePeerHandshake({ ...local, appVersion: '0.2.0' }, local)).toContain('게임 버전')
  })

  test('rejects protocol version mismatches', () => {
    expect(validatePeerHandshake({ ...local, protocolVersion: 2 }, local)).toContain('통신 규격')
  })

  test('rejects card data version mismatches', () => {
    expect(validatePeerHandshake({ ...local, cardDataVersion: 'other' }, local)).toContain('카드 데이터')
  })

  test('rejects malformed handshake payloads', () => {
    expect(parsePeerHandshake({ type: 'HANDSHAKE' })).toBeNull()
    expect(parsePeerHandshake({ ...local, protocolVersion: '1' })).toBeNull()
  })
})
