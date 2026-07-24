export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

export function sampleOne<T>(values: readonly T[], random: () => number): T {
  if (values.length === 0) throw new Error('비어 있는 목록에서는 항목을 고를 수 없습니다.')
  return values[Math.min(values.length - 1, Math.floor(random() * values.length))]!
}

export function weightedSample<T>(
  values: readonly T[],
  weight: (value: T) => number,
  random: () => number,
): T {
  if (values.length === 0) throw new Error('비어 있는 목록에서는 항목을 고를 수 없습니다.')
  const weights = values.map((value) => Math.max(0, weight(value)))
  const total = weights.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return sampleOne(values, random)
  let cursor = random() * total
  for (let index = 0; index < values.length; index += 1) {
    cursor -= weights[index]!
    if (cursor <= 0) return values[index]!
  }
  return values[values.length - 1]!
}

export function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[result[index], result[target]] = [result[target]!, result[index]!]
  }
  return result
}

export function combinations<T>(
  values: readonly T[],
  count: number,
  limit = Number.POSITIVE_INFINITY,
): T[][] {
  if (count < 0 || count > values.length || limit <= 0) return []
  if (count === 0) return [[]]
  const output: T[][] = []
  const chosen: T[] = []

  const visit = (start: number): void => {
    if (output.length >= limit) return
    if (chosen.length === count) {
      output.push([...chosen])
      return
    }
    const remaining = count - chosen.length
    for (let index = start; index <= values.length - remaining; index += 1) {
      chosen.push(values[index]!)
      visit(index + 1)
      chosen.pop()
      if (output.length >= limit) return
    }
  }

  visit(0)
  return output
}

export function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>()
  const output: T[] = []
  for (const value of values) {
    const marker = key(value)
    if (seen.has(marker)) continue
    seen.add(marker)
    output.push(value)
  }
  return output
}

export function actionKey(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize)
    if (typeof item !== 'object' || item === null) return item
    return Object.fromEntries(
      Object.entries(item as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]),
    )
  }
  return JSON.stringify(normalize(value))
}

export function wilsonInterval(wins: number, games: number, z = 1.96): [number, number] {
  if (games <= 0) return [0, 1]
  const p = wins / games
  const z2 = z * z
  const denominator = 1 + z2 / games
  const center = (p + z2 / (2 * games)) / denominator
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * games)) / games) / denominator
  return [clamp(center - margin, 0, 1), clamp(center + margin, 0, 1)]
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}
