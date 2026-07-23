import { describe, expect, test } from 'vitest'

import { getFormat } from './formats'
import { createRulebookDocument } from './rulebook'
import { RULES_VERSION } from './sets'

describe('종합 규칙 문서', () => {
  test('현재 포맷 수치를 동적으로 반영한다', () => {
    const document = createRulebookDocument(getFormat('open-v1'))

    expect(document.rulesVersion).toBe(RULES_VERSION)
    expect(document.formatSummary).toContain('덱 20장')
    expect(document.formatSummary).toContain('시작 라이프 4장')
    expect(document.formatSummary).toContain('시작 손 4장')
    expect(document.formatSummary).toContain('시작 덱 12장')
    expect(document.formatSummary).toContain('전장 4슬롯')
    expect(JSON.stringify(document)).toContain('같은 카드는 최대 3장')
  })

  test('목차 id와 핵심 키워드가 빠짐없이 존재한다', () => {
    const document = createRulebookDocument(getFormat('open-v1'))
    const ids = document.sections.map((section) => section.id)
    const text = JSON.stringify(document)

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('rules-life')
    expect(ids).toContain('rules-damage')
    for (const keyword of ['출현', '각성', '공명', '고립', '기습', '돌진', '질풍', '비행', '잠행', '암살', '유언']) {
      expect(text).toContain(keyword)
    }
  })

  test('라이프 0에서 받는 다음 직접 공격을 패배 조건으로 명시한다', () => {
    const document = createRulebookDocument(getFormat('open-v1'))
    const text = JSON.stringify(document)

    expect(text).toContain('라이프가 공격 시작 시점에 0장이면')
    expect(text).toContain('라이프가 1장일 때 라이프 2장을 잃게 하는 공격')
    expect(text).toContain('서로 다른 공격이어야 합니다')
  })
})
