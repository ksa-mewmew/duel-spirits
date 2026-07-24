import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const sourcePath = resolve('src/content/cards.ts')
const source = readFileSync(sourcePath, 'utf8')
const match = source.match(/export const CARD_IDS = \[([\s\S]*?)\] as const/)

if (!match) {
  console.error('CARD_IDS 목록을 읽지 못했습니다.')
  process.exit(1)
}

const cardIds = [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1])
const missing = cardIds.filter((cardId) => !existsSync(resolve('public/card-art', `${cardId}.webp`)))
const present = cardIds.length - missing.length

console.log(`카드 아트: ${present}/${cardIds.length}장 준비됨`)
if (missing.length > 0) {
  console.log('\n없는 파일:')
  for (const cardId of missing) console.log(`- public/card-art/${cardId}.webp`)
}

process.exitCode = missing.length > 0 ? 1 : 0
