import { describe, expect, it } from 'vitest'
import {
  LocalMatchAuthorityAdapter,
  RoomHostMatchAuthorityAdapter,
  WorkerMatchAuthorityAdapter,
} from './match-authority-adapters'
import { createMatchConfig } from './match-config'

function createIdSource() {
  let sequence = 0
  return () => `authority-card-${sequence++}`
}

function createOptions() {
  return {
    matchConfig: createMatchConfig({
      randomSeed: 'authority-adapter-test',
      createdAt: 1_000,
    }),
    idSource: createIdSource(),
    startingPlayer: 'P1' as const,
  }
}

describe('match authority adapters', () => {
  it('runs a local player action without transport or platform APIs', () => {
    const authority = LocalMatchAuthorityAdapter.create('P1', createOptions())

    authority.dispatchLocal({ type: 'END_TURN' }, { createdAt: 2_000 })

    expect(authority.mode).toBe('local')
    expect(authority.getLocalView().currentPlayer).toBe('P2')
    expect(authority.getSnapshot().actionLog).toHaveLength(1)
  })

  it('maps host and guest actions to fixed seats', () => {
    const authority = RoomHostMatchAuthorityAdapter.create('P1', createOptions())

    authority.dispatchHostAction({ type: 'END_TURN' }, { createdAt: 2_000 })
    authority.dispatchGuestAction({ type: 'END_TURN' }, { createdAt: 3_000 })

    expect(authority.mode).toBe('room-host')
    expect(authority.hostPlayerId).toBe('P1')
    expect(authority.guestPlayerId).toBe('P2')
    expect(authority.getSnapshot().actionLog.map((entry) => entry.playerId))
      .toEqual(['P1', 'P2'])
  })

  it('gives host and guest separate hidden-information views', () => {
    const authority = RoomHostMatchAuthorityAdapter.create('P2', createOptions())

    const hostView = authority.getHostView()
    const guestView = authority.getGuestView()

    expect(hostView.viewer).toBe('P2')
    expect(hostView.players.P2.hand).toHaveLength(4)
    expect(hostView.players.P1.hand).toEqual([])
    expect(guestView.viewer).toBe('P1')
    expect(guestView.players.P1.hand).toHaveLength(4)
    expect(guestView.players.P2.hand).toEqual([])
  })

  it('restores Worker authority from the persisted match shape', () => {
    const first = WorkerMatchAuthorityAdapter.create(createOptions())
    first.dispatch('P1', { type: 'END_TURN' }, { createdAt: 2_000 })

    const restored = WorkerMatchAuthorityAdapter.restore(first.getSnapshot())

    expect(restored.mode).toBe('worker')
    expect(restored.getSnapshot()).toEqual(first.getSnapshot())
    expect(restored.getView('P2').currentPlayer).toBe('P2')
  })
})
