import { runSimulatedMatch } from './match-runner'
import { buildDeckStandings, buildMatchupStandings } from './statistics'

import type { CardId } from '../shared/cards'
import type { DeckFormatSelection } from '../content/schema'
import type { BotContestant } from './bots'
import type {
  DeckCandidate,
  GenerationReport,
  MatchParticipant,
  MatchSimulationConfig,
} from './types'

function seatPair(
  deckA: DeckCandidate,
  deckB: DeckCandidate,
  gameIndex: number,
  bot: BotContestant,
): {
  participants: Record<'P1' | 'P2', MatchParticipant>
  policies: Record<'P1' | 'P2', BotContestant['policy']>
  startingPlayer: 'P1' | 'P2'
} {
  const condition = gameIndex % 4
  const aIsP1 = condition === 0 || condition === 2
  const startingPlayer = condition === 0 || condition === 1 ? 'P1' : 'P2'
  const participant = (deck: DeckCandidate): MatchParticipant => ({
    deckId: deck.id,
    deckName: deck.name,
    cardIds: deck.cardIds,
    botId: bot.id,
    botName: bot.name,
    botProfile: bot.profile,
  })
  return {
    participants: aIsP1
      ? { P1: participant(deckA), P2: participant(deckB) }
      : { P1: participant(deckB), P2: participant(deckA) },
    policies: { P1: bot.policy, P2: bot.policy },
    startingPlayer,
  }
}

export function runGenerationTournament(
  decks: readonly DeckCandidate[],
  selection: DeckFormatSelection<CardId>,
  config: MatchSimulationConfig,
  bots: readonly BotContestant[],
  seed: string,
  generation: number,
): GenerationReport {
  if (bots.length === 0) throw new Error('덱 대전에 사용할 행동 봇이 없습니다.')
  const matches: GenerationReport['matches'] = []

  let pairIndex = 0
  for (let left = 0; left < decks.length; left += 1) {
    for (let right = left + 1; right < decks.length; right += 1) {
      const deckA = decks[left]!
      const deckB = decks[right]!
      for (let gameIndex = 0; gameIndex < config.gamesPerPair; gameIndex += 1) {
        // 대진마다 시작 봇을 회전해 gamesPerPair가 봇 수의 배수가 아니어도
        // 항상 첫 번째 정책만 한 경기 더 배정되지 않게 합니다.
        const bot = bots[(gameIndex + pairIndex) % bots.length]!
        const seats = seatPair(deckA, deckB, gameIndex, bot)
        matches.push(runSimulatedMatch({
          seed: `${seed}:g${generation}:${deckA.id}:${deckB.id}:${gameIndex}:${bot.id}`,
          startingPlayer: seats.startingPlayer,
          selection,
          participants: seats.participants,
          policies: seats.policies,
          config,
        }))
      }
      pairIndex += 1
    }
  }

  return {
    generation,
    decks: [...decks],
    standings: buildDeckStandings(decks, matches),
    matchups: buildMatchupStandings(matches),
    matches,
  }
}
