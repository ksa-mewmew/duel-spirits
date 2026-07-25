import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_SAMPLE_DECK_TOURNAMENT_OPTIONS,
  runSampleDeckTournament,
} from './sample-decks'

import type { BotProfileId } from './types'

const AVAILABLE_BOTS: readonly BotProfileId[] = ['random', 'aggressive', 'value', 'control']

function argumentValue(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] ?? null : null
}

function positiveIntegerArgument(name: string, fallback: number): number {
  const raw = argumentValue(name)
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`)
  }
  return value
}

function botProfilesArgument(): BotProfileId[] {
  const raw = argumentValue('--bots')
  if (!raw) return [...DEFAULT_SAMPLE_DECK_TOURNAMENT_OPTIONS.botProfiles]
  const values = [...new Set(raw.split(',').map((value) => value.trim()))]
  const invalid = values.filter((value) => !AVAILABLE_BOTS.includes(value as BotProfileId))
  if (invalid.length > 0 || values.length === 0) {
    throw new Error(`--bots accepts: ${AVAILABLE_BOTS.join(', ')}`)
  }
  return values as BotProfileId[]
}

function markdownTable(report: ReturnType<typeof runSampleDeckTournament>): string {
  const names = new Map(report.decks.map((deck) => [deck.id, deck.name]))
  const standings = report.standings.map((standing, index) => (
    `| ${index + 1} | ${standing.deckName} | ${standing.games} | ${standing.wins} | `
    + `${standing.losses} | ${standing.draws} | ${(standing.winRate * 100).toFixed(1)}% |`
  ))
  const matchups = report.matchups.map((matchup) => (
    `| ${names.get(matchup.deckAId) ?? matchup.deckAId} | `
    + `${names.get(matchup.deckBId) ?? matchup.deckBId} | ${matchup.games} | `
    + `${matchup.deckAWins} | ${matchup.deckBWins} | ${matchup.draws} |`
  ))
  return [
    '# Sample deck tournament',
    '',
    '| Rank | Deck | Games | Wins | Losses | Draws | Win rate |',
    '| ---: | --- | ---: | ---: | ---: | ---: | ---: |',
    ...standings,
    '',
    '## Matchups',
    '',
    '| Deck A | Deck B | Games | A wins | B wins | Draws |',
    '| --- | --- | ---: | ---: | ---: | ---: |',
    ...matchups,
    '',
  ].join('\n')
}

function main(): void {
  const defaults = DEFAULT_SAMPLE_DECK_TOURNAMENT_OPTIONS
  const options = {
    seed: argumentValue('--seed') ?? defaults.seed,
    gamesPerPair: positiveIntegerArgument('--games', defaults.gamesPerPair),
    botProfiles: botProfilesArgument(),
    maxTurns: positiveIntegerArgument('--max-turns', defaults.maxTurns),
    maxActions: positiveIntegerArgument('--max-actions', defaults.maxActions),
  }
  const outputDirectory = resolve(
    process.cwd(),
    argumentValue('--out') ?? 'simulation-results/sample-decks',
  )
  console.log(
    `[samples] ${options.gamesPerPair} games per matchup; bots=${options.botProfiles.join(',')}`,
  )
  const report = runSampleDeckTournament(options)
  mkdirSync(outputDirectory, { recursive: true })
  writeFileSync(resolve(outputDirectory, 'report.json'), JSON.stringify({
    createdAt: new Date().toISOString(),
    options,
    ...report,
  }, null, 2), 'utf8')
  writeFileSync(resolve(outputDirectory, 'summary.md'), markdownTable(report), 'utf8')

  for (const [index, standing] of report.standings.entries()) {
    console.log(
      `[samples] ${index + 1}. ${standing.deckName}: `
      + `${standing.wins}-${standing.losses}-${standing.draws} `
      + `(${(standing.winRate * 100).toFixed(1)}%)`,
    )
  }
  console.log(`[samples] Results: ${outputDirectory}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
}
