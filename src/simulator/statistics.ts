import { CARDS } from '../shared/cards'
import { clamp, mean, wilsonInterval } from './utils'

import type { CardId } from '../shared/cards'
import type {
  CardStanding,
  DeckCandidate,
  DeckStanding,
  MatchupStanding,
  SimulatedMatchResult,
} from './types'

interface MutableDeckStanding {
  deck: DeckCandidate
  games: number
  wins: number
  losses: number
  draws: number
  firstGames: number
  firstWins: number
  secondGames: number
  secondWins: number
  turns: number[]
}

function winnerDeckId(match: SimulatedMatchResult): string | null {
  return match.winner ? match.participants[match.winner].deckId : null
}

export function buildDeckStandings(
  decks: readonly DeckCandidate[],
  matches: readonly SimulatedMatchResult[],
): DeckStanding[] {
  const records = new Map<string, MutableDeckStanding>(decks.map((deck) => [deck.id, {
    deck,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    firstGames: 0,
    firstWins: 0,
    secondGames: 0,
    secondWins: 0,
    turns: [],
  }]))

  for (const match of matches) {
    const winningDeckId = winnerDeckId(match)
    const firstDeckId = match.participants[match.startingPlayer].deckId
    for (const playerId of ['P1', 'P2'] as const) {
      const deckId = match.participants[playerId].deckId
      const record = records.get(deckId)
      if (!record) continue
      record.games += 1
      record.turns.push(match.turns)
      const started = deckId === firstDeckId
      if (started) record.firstGames += 1
      else record.secondGames += 1
      if (winningDeckId === deckId) {
        record.wins += 1
        if (started) record.firstWins += 1
        else record.secondWins += 1
      } else if (winningDeckId === null) {
        record.draws += 1
      } else {
        record.losses += 1
      }
    }
  }

  return [...records.values()].map((record) => {
    const [confidenceLow, confidenceHigh] = wilsonInterval(record.wins, record.games)
    return {
      deckId: record.deck.id,
      deckName: record.deck.name,
      generation: record.deck.generation,
      games: record.games,
      wins: record.wins,
      losses: record.losses,
      draws: record.draws,
      winRate: record.games > 0 ? record.wins / record.games : 0,
      firstGames: record.firstGames,
      firstWins: record.firstWins,
      secondGames: record.secondGames,
      secondWins: record.secondWins,
      averageTurns: mean(record.turns),
      confidenceLow,
      confidenceHigh,
    }
  }).sort((left, right) => (
    right.winRate - left.winRate
    || right.wins - left.wins
    || left.averageTurns - right.averageTurns
  ))
}

export function buildMatchupStandings(
  matches: readonly SimulatedMatchResult[],
): MatchupStanding[] {
  const records = new Map<string, MatchupStanding>()
  for (const match of matches) {
    const left = match.participants.P1.deckId
    const right = match.participants.P2.deckId
    const [deckAId, deckBId] = [left, right].sort()
    const key = `${deckAId}|${deckBId}`
    const record = records.get(key) ?? {
      deckAId,
      deckBId,
      games: 0,
      deckAWins: 0,
      deckBWins: 0,
      draws: 0,
      deckAWinRate: 0,
    }
    record.games += 1
    const winningDeck = winnerDeckId(match)
    if (winningDeck === deckAId) record.deckAWins += 1
    else if (winningDeck === deckBId) record.deckBWins += 1
    else record.draws += 1
    record.deckAWinRate = record.games > 0 ? record.deckAWins / record.games : 0
    records.set(key, record)
  }
  return [...records.values()].sort((left, right) => (
    left.deckAId.localeCompare(right.deckAId) || left.deckBId.localeCompare(right.deckBId)
  ))
}

interface MutableCardStanding {
  deckCount: number
  topDeckCount: number
  totalCopies: number
  games: number
  wins: number
  seenGames: number
  seenWins: number
  playedGames: number
  playedWins: number
}

export function buildCardStandings(
  cardPool: readonly CardId[],
  decks: readonly DeckCandidate[],
  deckStandings: readonly DeckStanding[],
  matches: readonly SimulatedMatchResult[],
  topDeckCount: number,
): CardStanding[] {
  const records = new Map<CardId, MutableCardStanding>(cardPool.map((cardId) => [cardId, {
    deckCount: 0,
    topDeckCount: 0,
    totalCopies: 0,
    games: 0,
    wins: 0,
    seenGames: 0,
    seenWins: 0,
    playedGames: 0,
    playedWins: 0,
  }]))
  const topIds = new Set(deckStandings.slice(0, topDeckCount).map((standing) => standing.deckId))

  for (const deck of decks) {
    const counts = new Map<CardId, number>()
    for (const cardId of deck.cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
    for (const [cardId, count] of counts) {
      const record = records.get(cardId)
      if (!record) continue
      record.deckCount += 1
      record.totalCopies += count
      if (topIds.has(deck.id)) record.topDeckCount += 1
    }
  }

  for (const match of matches) {
    const winningDeck = winnerDeckId(match)
    for (const playerId of ['P1', 'P2'] as const) {
      const participant = match.participants[playerId]
      const included = new Set(participant.cardIds)
      const seen = new Set(match.telemetry[playerId].seenCardIds)
      const played = new Set([
        ...match.telemetry[playerId].playedCardIds,
        ...match.telemetry[playerId].summonedCardIds,
      ])
      const won = winningDeck === participant.deckId

      for (const cardId of included) {
        const record = records.get(cardId)
        if (!record) continue
        record.games += 1
        if (won) record.wins += 1
      }
      for (const cardId of seen) {
        const record = records.get(cardId)
        if (!record) continue
        record.seenGames += 1
        if (won) record.seenWins += 1
      }
      for (const cardId of played) {
        const record = records.get(cardId)
        if (!record) continue
        record.playedGames += 1
        if (won) record.playedWins += 1
      }
    }
  }

  return cardPool.map((cardId) => {
    const record = records.get(cardId)!
    const inclusionWinRate = record.games > 0 ? record.wins / record.games : 0
    const seenWinRate = record.seenGames > 0 ? record.seenWins / record.seenGames : 0
    const playedWinRate = record.playedGames > 0 ? record.playedWins / record.playedGames : 0
    const topDeckRate = topDeckCount > 0 ? record.topDeckCount / topDeckCount : 0
    const averageCopiesWhenIncluded = record.deckCount > 0 ? record.totalCopies / record.deckCount : 0
    const sampleConfidence = Math.min(1, record.games / 60)
    const suspicionScore = clamp(
      50
      + (inclusionWinRate - 0.5) * 55 * sampleConfidence
      + (playedWinRate - 0.5) * 25 * Math.min(1, record.playedGames / 30)
      + topDeckRate * 18
      + Math.min(3, averageCopiesWhenIncluded) * 3,
      0,
      100,
    )

    return {
      cardId,
      cardName: CARDS[cardId].name,
      deckCount: record.deckCount,
      topDeckCount: record.topDeckCount,
      totalCopies: record.totalCopies,
      averageCopiesWhenIncluded,
      games: record.games,
      wins: record.wins,
      inclusionWinRate,
      seenGames: record.seenGames,
      seenWins: record.seenWins,
      seenWinRate,
      playedGames: record.playedGames,
      playedWins: record.playedWins,
      playedWinRate,
      topDeckRate,
      suspicionScore,
    }
  }).sort((left, right) => (
    right.suspicionScore - left.suspicionScore
    || right.topDeckRate - left.topDeckRate
    || right.inclusionWinRate - left.inclusionWinRate
  ))
}
