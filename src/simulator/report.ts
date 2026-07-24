import { CARDS } from '../shared/cards'
import { HEURISTIC_WEIGHT_KEYS } from './behavior-evolution'
import { analyzeDeckProfile } from './deck-intelligence'

import type { CardId } from '../shared/cards'
import type { DeckCandidate, MetaSimulationReport } from './types'

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCsv(rows: Array<Array<string | number>>): string {
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

function percentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function deckList(deck: DeckCandidate): string {
  const counts = new Map<CardId, number>()
  for (const cardId of deck.cardIds) counts.set(cardId, (counts.get(cardId) ?? 0) + 1)
  return [...counts.entries()]
    .sort(([left], [right]) => (
      CARDS[left].cost - CARDS[right].cost || CARDS[left].name.localeCompare(CARDS[right].name)
    ))
    .map(([cardId, count]) => `${CARDS[cardId].name}×${count}`)
    .join(' / ')
}


export function createBotsCsv(report: MetaSimulationReport): string {
  const standingById = new Map(report.finalBehaviorStandings.map((standing) => [standing.botId, standing]))
  return toCsv([
    [
      'rank',
      'bot_id',
      'bot_name',
      'generation',
      'games',
      'wins',
      'losses',
      'draws',
      'win_rate',
      'fitness',
      'normal_finish_rate',
      ...HEURISTIC_WEIGHT_KEYS,
    ],
    ...report.finalBehaviors.map((bot, index) => {
      const standing = standingById.get(bot.id)
      return [
        index + 1,
        bot.id,
        bot.name,
        bot.generation,
        standing?.games ?? 0,
        standing?.wins ?? 0,
        standing?.losses ?? 0,
        standing?.draws ?? 0,
        (standing?.winRate ?? 0).toFixed(6),
        (standing?.fitness ?? 0).toFixed(6),
        (standing?.normalFinishRate ?? 0).toFixed(6),
        ...HEURISTIC_WEIGHT_KEYS.map((key) => bot.weights[key].toFixed(4)),
      ]
    }),
  ])
}

export function createDecksCsv(report: MetaSimulationReport): string {
  const deckById = new Map(report.finalDecks.map((deck) => [deck.id, deck]))
  return toCsv([
    [
      'rank', 'deck_id', 'deck_name', 'archetype', 'strategy', 'source',
      'games', 'wins', 'losses', 'draws', 'win_rate', 'first_win_rate', 'second_win_rate',
      'avg_turns', 'confidence_low', 'confidence_high',
      'distinct_cards', 'singletons', 'doubletons', 'tripletons', 'units', 'spells', 'average_cost', 'top_packages', 'cards',
    ],
    ...report.finalStandings.map((standing, index) => {
      const deck = deckById.get(standing.deckId)!
      const profile = analyzeDeckProfile(deck.cardIds)
      return [
        index + 1,
        standing.deckId,
        standing.deckName,
        deck.archetypeName ?? '',
        deck.strategy ?? profile.strategy,
        deck.source ?? '',
        standing.games,
        standing.wins,
        standing.losses,
        standing.draws,
        standing.winRate.toFixed(6),
        standing.firstGames > 0 ? (standing.firstWins / standing.firstGames).toFixed(6) : '0',
        standing.secondGames > 0 ? (standing.secondWins / standing.secondGames).toFixed(6) : '0',
        standing.averageTurns.toFixed(3),
        standing.confidenceLow.toFixed(6),
        standing.confidenceHigh.toFixed(6),
        profile.distinctCards,
        profile.singletonCount,
        profile.doubletonCount,
        profile.tripletonCount,
        profile.unitCount,
        profile.spellCount,
        profile.averageCost.toFixed(3),
        profile.topPackages.join(' / '),
        deckList(deck),
      ]
    }),
  ])
}

export function createCardsCsv(report: MetaSimulationReport): string {
  return toCsv([
    ['rank', 'card_id', 'card_name', 'deck_count', 'top_deck_count', 'avg_copies', 'inclusion_games', 'inclusion_win_rate', 'seen_games', 'seen_win_rate', 'played_games', 'played_win_rate', 'top_deck_rate', 'suspicion_score'],
    ...report.cardStandings.map((card, index) => [
      index + 1,
      card.cardId,
      card.cardName,
      card.deckCount,
      card.topDeckCount,
      card.averageCopiesWhenIncluded.toFixed(3),
      card.games,
      card.inclusionWinRate.toFixed(6),
      card.seenGames,
      card.seenWinRate.toFixed(6),
      card.playedGames,
      card.playedWinRate.toFixed(6),
      card.topDeckRate.toFixed(6),
      card.suspicionScore.toFixed(3),
    ]),
  ])
}

export function createMatchupsCsv(report: MetaSimulationReport): string {
  return toCsv([
    ['deck_a_id', 'deck_b_id', 'games', 'deck_a_wins', 'deck_b_wins', 'draws', 'deck_a_win_rate'],
    ...report.finalMatchups.map((matchup) => [
      matchup.deckAId,
      matchup.deckBId,
      matchup.games,
      matchup.deckAWins,
      matchup.deckBWins,
      matchup.draws,
      matchup.deckAWinRate.toFixed(6),
    ]),
  ])
}

export function createSummaryMarkdown(report: MetaSimulationReport): string {
  const deckById = new Map(report.finalDecks.map((deck) => [deck.id, deck]))
  const topDecks = report.finalStandings.slice(0, 10)
  const suspiciousCards = report.cardStandings.slice(0, 15)
  const finalMatches = report.generations[report.generations.length - 1]?.matches ?? []
  const completed = finalMatches.filter((match) => match.termination === 'win').length
  const stalled = finalMatches.length - completed

  const lines = [
    '# Duel Spirits 메타 시뮬레이션',
    '',
    `- 시드: \`${report.seed}\``,
    `- 포맷: \`${report.selection.formatId}\``,
    `- 카드 풀: ${report.cardPool.length}종`,
    `- 세대: ${report.generations.length}`,
    `- 덱 생성: 아키타입 기반 ${Math.round(report.config.deckGeneration.humanDeckRatio * 100)}%, 카드 종류 ${report.config.deckGeneration.minDistinctCards}~${report.config.deckGeneration.maxDistinctCards}종 유도`,
    `- 최종 세대 경기: ${finalMatches.length}회`,
    `- 정상 종료: ${completed}회 / 제한 종료: ${stalled}회`,
    `- 행동 가중치 진화: ${report.config.behaviorEvolution.enabled ? `${report.behaviorGenerations.length}세대` : '사용 안 함'}`,
    '',
    ...(report.finalBehaviors.length > 0 ? [
      '## 최종 행동 봇',
      '',
      '| 순위 | 봇 | 적합도 | 승률 | 정상 종료 | 평가 경기 |',
      '|---:|---|---:|---:|---:|---:|',
      ...report.finalBehaviors.map((bot, index) => {
        const standing = report.finalBehaviorStandings.find((candidate) => candidate.botId === bot.id)
        return `| ${index + 1} | ${bot.name} | ${(standing?.fitness ?? 0).toFixed(3)} | ${percentage(standing?.winRate ?? 0)} | ${percentage(standing?.normalFinishRate ?? 0)} | ${standing?.games ?? 0} |`
      }),
      '',
      '> 행동 봇은 여러 속성의 동일 덱 미러전으로 평가됩니다. 같은 덱을 쥔 봇끼리 겨루므로 덱 자체의 강함이 행동 가중치 적합도에 섞이는 정도를 줄였습니다.',
      '',
    ] : []),
    '## 상위 덱',
    '',
    '| 순위 | 덱 | 승률 | 선공 | 후공 | 평균 턴 | 95% 구간 |',
    '|---:|---|---:|---:|---:|---:|---:|',
    ...topDecks.map((standing, index) => (
      `| ${index + 1} | ${standing.deckName} | ${percentage(standing.winRate)} | ${percentage(standing.firstGames > 0 ? standing.firstWins / standing.firstGames : 0)} | ${percentage(standing.secondGames > 0 ? standing.secondWins / standing.secondGames : 0)} | ${standing.averageTurns.toFixed(1)} | ${percentage(standing.confidenceLow)}–${percentage(standing.confidenceHigh)} |`
    )),
    '',
  ]

  for (const standing of topDecks.slice(0, 5)) {
    const deck = deckById.get(standing.deckId)
    if (!deck) continue
    const profile = analyzeDeckProfile(deck.cardIds)
    lines.push(
      `### ${standing.deckName}`,
      '',
      `- 원형: ${deck.archetypeName ?? '자동 추정'} / 전략: ${deck.strategy ?? profile.strategy} / 생성: ${deck.source ?? 'unknown'}`,
      `- 구성: ${profile.distinctCards}종 · 1장 ${profile.singletonCount}종 · 2장 ${profile.doubletonCount}종 · 3장 ${profile.tripletonCount}종 · 평균 비용 ${profile.averageCost.toFixed(2)}`,
      `- 역할 패키지: ${profile.topPackages.join(', ') || '없음'}`,
      '',
      deckList(deck),
      '',
    )
  }

  lines.push(
    '## 우선 검토 카드',
    '',
    '> 아래 점수는 너프 판정이 아니라 검토 순서입니다. 채용 덱 자체의 강함과 카드의 인과 효과가 섞여 있으므로 실제 수정 전에는 한 장 교체 실험이나 사람 플레이를 함께 확인해야 합니다.',
    '',
    '| 순위 | 카드 | 의심 점수 | 상위 덱 채용 | 포함 덱 승률 | 본 게임 승률 | 사용 게임 승률 | 평균 매수 |',
    '|---:|---|---:|---:|---:|---:|---:|---:|',
    ...suspiciousCards.map((card, index) => (
      `| ${index + 1} | ${card.cardName} | ${card.suspicionScore.toFixed(1)} | ${percentage(card.topDeckRate)} | ${percentage(card.inclusionWinRate)} | ${percentage(card.seenWinRate)} | ${percentage(card.playedWinRate)} | ${card.averageCopiesWhenIncluded.toFixed(2)} |`
    )),
    '',
    '## 해석 주의',
    '',
    '- 봇은 상대 손·덱·라이프 정체를 받지 않으며, 공개 정보와 합법 행동만으로 결정합니다.',
    '- `inclusion_win_rate`는 카드 자체의 순수 영향이 아니라 그 카드를 채용한 덱의 성적입니다.',
    '- 표본이 적은 카드의 승률은 크게 흔들릴 수 있습니다. `games`, `seen_games`, `played_games`를 함께 보십시오.',
    '- 행동 진화의 적합도는 승리 점수에서 제한 종료 비율을 감점한 값입니다. 한 번의 실행에서 나온 최종 봇 하나만 절대 기준으로 보지 말고 여러 시드의 결과를 비교하십시오.',
    '- 덱의 3·2·1장 매수 구조와 역할 패키지는 후보 생성과 변이 방향만 유도합니다. 최종 생존 점수에는 ‘인간다운 모양’ 보너스를 넣지 않았습니다.',
    '- 제한 종료가 많으면 봇 평가 함수나 최대 턴 수를 조정한 뒤 다시 실행하는 편이 좋습니다.',
    '',
  )

  return `${lines.join('\n')}\n`
}
