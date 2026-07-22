import type {
  CardInstance,
  GameState,
  ManaCardInstance,
  PendingChoice,
  PlayerId,
  UnitInstance,
} from './types'

/**
 * 한 브라우저에 공개해도 되는 플레이어 상태입니다.
 *
 * hand에는 보는 사람 자신의 손만 들어갑니다.
 * 상대의 손은 handCount만 공개하고 hand는 빈 배열로 둡니다.
 * 덱과 라이프는 소유자 자신에게도 카드 내용과 순서를 공개하지 않습니다.
 */
export interface PlayerView {
  playerId: PlayerId
  isViewer: boolean
  deckCount: number
  handCount: number
  hand: CardInstance[]
  lifeCount: number
  /** life 배열의 각 카드가 차지하는 고정 라이프 슬롯 번호입니다. */
  lifeSlotIndices: number[]
  mana: ManaCardInstance[]
  field: UnitInstance[]
  discard: CardInstance[]
  manaPlacedThisTurn: boolean
  extraLifeLossOnDirectAttack: boolean
  attacksThisTurn: number
}

export type PendingChoiceView =
  | {
      type: 'TEMPLE_PROSPECT_LIFE'
      playerId: PlayerId
    }
  | {
      type: 'TEMPLE_PROSPECT_HAND'
      playerId: PlayerId
    }
  | {
      type: 'WAVE_READER_TOP'
      playerId: PlayerId
      revealedCard: CardInstance | null
    }
  | {
      type: 'SURGING_WAVE_TOP'
      playerId: PlayerId
      revealedCards: CardInstance[]
    }
  | {
      type: 'BURNING_PROCESSION'
      playerId: PlayerId
      revealedCards: CardInstance[]
      maxSummons: number
    }
  | {
      type: 'GRAVE_DIGGING_RETURN'
      playerId: PlayerId
      maxCards: number
    }
  | {
      type: 'DEMON_FINGER_DISCARD'
      playerId: PlayerId
    }
  | {
      type: 'DEMON_BREATH_TARGET'
      playerId: PlayerId
      candidateUnitIds: string[]
    }
  | {
      type: 'HOLY_MIRROR_LIFE'
      playerId: PlayerId
    }
  | {
      type: 'AWAKEN_SUMMON_SLOT'
      playerId: PlayerId
      cardInstanceId: string
    }

/** 특정 플레이어 한 명을 위해 만든 게임 화면 상태입니다. */
export interface GameView {
  matchConfig: GameState['matchConfig']
  actionSequence: number
  status: GameState['status']
  currentPlayer: PlayerId
  turnNumber: number
  winner: PlayerId | null
  viewer: PlayerId
  players: Record<PlayerId, PlayerView>
  pendingChoice: PendingChoiceView | null
}

function cloneCard(card: CardInstance): CardInstance {
  return { ...card }
}

function cloneManaCard(card: ManaCardInstance): ManaCardInstance {
  return { ...card }
}

function cloneUnit(unit: UnitInstance): UnitInstance {
  return { ...unit }
}

function createPlayerView(
  game: GameState,
  playerId: PlayerId,
  viewer: PlayerId,
): PlayerView {
  const player = game.players[playerId]
  const isViewer = playerId === viewer

  return {
    playerId,
    isViewer,
    deckCount: player.deck.length,
    handCount: player.hand.length,
    hand: isViewer ? player.hand.map(cloneCard) : [],
    lifeCount: player.life.length,
    lifeSlotIndices: player.life.map((card, index) => card.lifeSlotIndex ?? index),
    mana: player.mana.map(cloneManaCard),
    field: player.field.map(cloneUnit),
    discard: player.discard.map(cloneCard),
    manaPlacedThisTurn: player.manaPlacedThisTurn,
    extraLifeLossOnDirectAttack: player.extraLifeLossOnDirectAttack,
    attacksThisTurn: player.attacksThisTurn,
  }
}

function createPendingChoiceView(
  pending: PendingChoice | undefined,
  viewer: PlayerId,
): PendingChoiceView | null {
  if (!pending) return null
  const isChooser = pending.playerId === viewer

  switch (pending.type) {
    case 'TEMPLE_PROSPECT_LIFE':
    case 'TEMPLE_PROSPECT_HAND':
    case 'HOLY_MIRROR_LIFE':
    case 'DEMON_FINGER_DISCARD':
      return {
        type: pending.type,
        playerId: pending.playerId,
      }

    case 'AWAKEN_SUMMON_SLOT':
      return {
        type: pending.type,
        playerId: pending.playerId,
        cardInstanceId: pending.cardInstanceId,
      }

    case 'WAVE_READER_TOP':
      return {
        type: pending.type,
        playerId: pending.playerId,
        revealedCard: isChooser ? cloneCard(pending.revealedCard) : null,
      }

    case 'SURGING_WAVE_TOP':
      return {
        type: pending.type,
        playerId: pending.playerId,
        revealedCards: isChooser ? pending.revealedCards.map(cloneCard) : [],
      }

    case 'GRAVE_DIGGING_RETURN':
      return {
        type: pending.type,
        playerId: pending.playerId,
        maxCards: isChooser ? pending.maxCards : 0,
      }

    case 'DEMON_BREATH_TARGET':
      return {
        type: pending.type,
        playerId: pending.playerId,
        candidateUnitIds: isChooser ? [...pending.candidateUnitIds] : [],
      }

    case 'BURNING_PROCESSION':
      return {
        type: pending.type,
        playerId: pending.playerId,
        revealedCards: isChooser
          ? pending.revealedCards.map(cloneCard)
          : [],
        maxSummons: isChooser ? pending.maxSummons : 0,
      }
  }
}

export function createGameView(
  game: GameState,
  viewer: PlayerId,
): GameView {
  return {
    matchConfig: structuredClone(game.matchConfig),
    actionSequence: game.actionSequence,
    status: game.status,
    currentPlayer: game.currentPlayer,
    turnNumber: game.turnNumber,
    winner: game.winner,
    viewer,
    players: {
      P1: createPlayerView(game, 'P1', viewer),
      P2: createPlayerView(game, 'P2', viewer),
    },
    pendingChoice: createPendingChoiceView(game.pendingChoices?.[0], viewer),
  }
}

export function countPlayerCardsInView(player: PlayerView): number {
  return player.deckCount
    + player.handCount
    + player.lifeCount
    + player.mana.length
    + player.field.length
    + player.discard.length
}
