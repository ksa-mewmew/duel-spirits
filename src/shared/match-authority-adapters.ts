import type { GameAction } from './actions'
import {
  MatchHost,
} from './match-host'
import type {
  MatchAuthority,
  MatchDispatchOptions,
  MatchHostSnapshot,
} from './match-host'
import type { CreateGameOptions } from './rules'
import type { GameState, PlayerId } from './types'
import type { GameView } from './views'

export type MatchAuthorityMode = 'worker' | 'room-host' | 'local'

export interface MatchAuthorityAdapter extends MatchAuthority {
  readonly mode: MatchAuthorityMode
}

abstract class MatchHostAdapter implements MatchAuthorityAdapter {
  abstract readonly mode: MatchAuthorityMode
  protected readonly matchHost: MatchHost

  protected constructor(matchHost: MatchHost) {
    this.matchHost = matchHost
  }

  dispatch(
    playerId: PlayerId,
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState {
    return this.matchHost.dispatch(playerId, action, options)
  }

  getView(playerId: PlayerId): GameView {
    return this.matchHost.getView(playerId)
  }

  getSnapshot(): MatchHostSnapshot {
    return this.matchHost.getSnapshot()
  }
}

/**
 * Server-side adapter. The Worker supplies trusted player identity and time,
 * while MatchHost remains unaware of Cloudflare APIs and persistence.
 */
export class WorkerMatchAuthorityAdapter extends MatchHostAdapter {
  readonly mode = 'worker' as const

  static create(options: CreateGameOptions = {}): WorkerMatchAuthorityAdapter {
    return new WorkerMatchAuthorityAdapter(MatchHost.create(options))
  }

  static restore(snapshot: MatchHostSnapshot): WorkerMatchAuthorityAdapter {
    return new WorkerMatchAuthorityAdapter(MatchHost.restore(snapshot))
  }
}

/**
 * Single-device adapter for tutorials, AI matches, and Electron offline play.
 */
export class LocalMatchAuthorityAdapter extends MatchHostAdapter {
  readonly mode = 'local' as const
  readonly localPlayerId: PlayerId

  private constructor(
    matchHost: MatchHost,
    localPlayerId: PlayerId,
  ) {
    super(matchHost)
    this.localPlayerId = localPlayerId
  }

  static create(
    localPlayerId: PlayerId,
    options: CreateGameOptions = {},
  ): LocalMatchAuthorityAdapter {
    return new LocalMatchAuthorityAdapter(
      MatchHost.create(options),
      localPlayerId,
    )
  }

  static restore(
    localPlayerId: PlayerId,
    snapshot: MatchHostSnapshot,
  ): LocalMatchAuthorityAdapter {
    return new LocalMatchAuthorityAdapter(
      MatchHost.restore(snapshot),
      localPlayerId,
    )
  }

  dispatchLocal(
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState {
    return this.dispatch(this.localPlayerId, action, options)
  }

  getLocalView(): GameView {
    return this.getView(this.localPlayerId)
  }
}

/**
 * Authority owned by the player who opened a room.
 *
 * A WebRTC, Steam P2P, LAN, or relay transport only has to authenticate which
 * peer sent an action and then call dispatchHostAction or dispatchGuestAction.
 * The guest never sends a player id, so it cannot impersonate the room host.
 */
export class RoomHostMatchAuthorityAdapter extends MatchHostAdapter {
  readonly mode = 'room-host' as const
  readonly hostPlayerId: PlayerId
  readonly guestPlayerId: PlayerId

  private constructor(
    matchHost: MatchHost,
    hostPlayerId: PlayerId,
  ) {
    super(matchHost)
    this.hostPlayerId = hostPlayerId
    this.guestPlayerId = hostPlayerId === 'P1' ? 'P2' : 'P1'
  }

  static create(
    hostPlayerId: PlayerId,
    options: CreateGameOptions = {},
  ): RoomHostMatchAuthorityAdapter {
    return new RoomHostMatchAuthorityAdapter(
      MatchHost.create(options),
      hostPlayerId,
    )
  }

  static restore(
    hostPlayerId: PlayerId,
    snapshot: MatchHostSnapshot,
  ): RoomHostMatchAuthorityAdapter {
    return new RoomHostMatchAuthorityAdapter(
      MatchHost.restore(snapshot),
      hostPlayerId,
    )
  }

  dispatchHostAction(
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState {
    return this.dispatch(this.hostPlayerId, action, options)
  }

  dispatchGuestAction(
    action: GameAction,
    options: MatchDispatchOptions,
  ): GameState {
    return this.dispatch(this.guestPlayerId, action, options)
  }

  getHostView(): GameView {
    return this.getView(this.hostPlayerId)
  }

  getGuestView(): GameView {
    return this.getView(this.guestPlayerId)
  }
}
