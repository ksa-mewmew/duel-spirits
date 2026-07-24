import type { GameAction } from './actions'
import type { LoggedAction, MatchRecord } from './match-log'
import { applyAction, createGame } from './rules'
import type { CreateGameOptions } from './rules'
import type { GameState, PlayerId } from './types'
import { createGameView } from './views'
import type { GameView } from './views'

export interface MatchHostSnapshot {
  game: GameState
  actionLog: LoggedAction[]
}

export interface MatchDispatchOptions {
  createdAt: number
}

/**
 * A transport-independent authority boundary for one match.
 *
 * A Worker, a local game, or a future room-host adapter can own this contract
 * without moving game rules into the transport layer.
 */
export interface MatchAuthority {
  dispatch(
    playerId: PlayerId,
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState
  getView(playerId: PlayerId): GameView
  getSnapshot(): MatchHostSnapshot
}

export class MatchHost implements MatchAuthority {
  private game: GameState
  private actionLog: LoggedAction[]

  private constructor(snapshot: MatchHostSnapshot) {
    this.game = structuredClone(snapshot.game)
    this.actionLog = structuredClone(snapshot.actionLog)
  }

  static create(options: CreateGameOptions = {}): MatchHost {
    return new MatchHost({
      game: createGame(options),
      actionLog: [],
    })
  }

  static restore(snapshot: MatchHostSnapshot): MatchHost {
    return new MatchHost(snapshot)
  }

  dispatch(
    playerId: PlayerId,
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState {
    const nextGame = applyAction(this.game, playerId, action)

    this.game = nextGame
    this.actionLog.push({
      sequence: nextGame.actionSequence,
      playerId,
      action: structuredClone(action),
      createdAt: options.createdAt,
    })

    return structuredClone(nextGame)
  }

  getState(): GameState {
    return structuredClone(this.game)
  }

  getView(playerId: PlayerId): GameView {
    return createGameView(this.game, playerId)
  }

  getActionLog(): LoggedAction[] {
    return structuredClone(this.actionLog)
  }

  getSnapshot(): MatchHostSnapshot {
    return {
      game: this.getState(),
      actionLog: this.getActionLog(),
    }
  }

  getRecord(): MatchRecord {
    return {
      randomSeed: this.game.matchConfig.randomSeed,
      rulesVersion: this.game.matchConfig.rulesVersion,
      contentVersion: this.game.matchConfig.contentVersion,
      actions: this.getActionLog(),
    }
  }
}
