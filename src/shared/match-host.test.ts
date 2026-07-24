import { describe, expect, it } from 'vitest'
import { createMatchConfig } from './match-config'
import { MatchHost } from './match-host'
import { GameRuleError } from './rules'

function createIdSource() {
  let sequence = 0
  return () => `card-${sequence++}`
}

function createTestHost() {
  return MatchHost.create({
    matchConfig: createMatchConfig({
      randomSeed: 'match-host-test',
      createdAt: 1_000,
    }),
    idSource: createIdSource(),
    startingPlayer: 'P1',
  })
}

describe('MatchHost', () => {
  it('applies an action and records it with the caller-provided timestamp', () => {
    const host = createTestHost()

    const game = host.dispatch('P1', { type: 'END_TURN' }, { createdAt: 2_000 })

    expect(game.currentPlayer).toBe('P2')
    expect(game.actionSequence).toBe(1)
    expect(host.getActionLog()).toEqual([
      {
        sequence: 1,
        playerId: 'P1',
        action: { type: 'END_TURN' },
        createdAt: 2_000,
      },
    ])
  })

  it('does not mutate the match or log when the rules reject an action', () => {
    const host = createTestHost()
    const before = host.getSnapshot()

    expect(() => {
      host.dispatch('P2', { type: 'END_TURN' }, { createdAt: 2_000 })
    }).toThrow(GameRuleError)
    expect(host.getSnapshot()).toEqual(before)
  })

  it('creates player-specific views without exposing the opponent hand', () => {
    const host = createTestHost()

    const p1View = host.getView('P1')
    const p2View = host.getView('P2')

    expect(p1View.players.P1.hand).toHaveLength(4)
    expect(p1View.players.P2.hand).toEqual([])
    expect(p2View.players.P2.hand).toHaveLength(4)
    expect(p2View.players.P1.hand).toEqual([])
  })

  it('restores snapshots without sharing mutable references', () => {
    const original = createTestHost()
    original.dispatch('P1', { type: 'END_TURN' }, { createdAt: 2_000 })
    const snapshot = original.getSnapshot()
    const restored = MatchHost.restore(snapshot)

    snapshot.game.currentPlayer = 'P1'
    snapshot.actionLog.length = 0

    expect(restored.getState().currentPlayer).toBe('P2')
    expect(restored.getActionLog()).toHaveLength(1)
  })

  it('reproduces the same state from the same seed and actions', () => {
    const first = createTestHost()
    const second = createTestHost()

    first.dispatch('P1', { type: 'END_TURN' }, { createdAt: 2_000 })
    second.dispatch('P1', { type: 'END_TURN' }, { createdAt: 2_000 })

    expect(second.getSnapshot()).toEqual(first.getSnapshot())
  })

  it('exports replay metadata with the authoritative action log', () => {
    const host = createTestHost()
    host.dispatch('P1', { type: 'END_TURN' }, { createdAt: 2_000 })

    const record = host.getRecord()

    expect(record).toMatchObject({
      randomSeed: 'match-host-test',
      actions: [
        {
          sequence: 1,
          playerId: 'P1',
          action: { type: 'END_TURN' },
          createdAt: 2_000,
        },
      ],
    })
    expect(record.rulesVersion).toBeTruthy()
    expect(record.contentVersion).toBeTruthy()
  })
})
