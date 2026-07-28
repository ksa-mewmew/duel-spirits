import { describe, expect, test, beforeEach } from 'vitest'
import service from './update-service.cjs'

const release = (overrides = {}) => ({
  tag_name: 'v0.1.3',
  name: 'Release 0.1.3',
  body: 'notes',
  html_url: 'https://github.com/ksa-mewmew/duel-spirits/releases/tag/v0.1.3',
  published_at: '2026-07-27T00:00:00Z',
  draft: false,
  prerelease: false,
  ...overrides,
})

describe('desktop update service', () => {
  beforeEach(() => service.clearUpdateCache())

  test.each([
    ['0.1.2', '0.1.3', -1],
    ['0.1.9', '0.1.10', -1],
    ['v0.1.2', '0.1.2', 0],
    ['1.0.0', '1.0.0', 0],
    ['bad', '1.0.0', null],
  ])('compares %s and %s', (left, right, expected) => {
    expect(service.compareVersions(left, right)).toBe(expected)
  })

  test('parses a public stable release and truncates notes', () => {
    const parsed = service.parseRelease(release({ body: 'x'.repeat(5000) }))
    expect(parsed.latestVersion).toBe('0.1.3')
    expect(parsed.notes).toHaveLength(4000)
  })

  test('ignores draft, prerelease, and malformed releases', () => {
    expect(service.parseRelease(release({ draft: true }))).toBeNull()
    expect(service.parseRelease(release({ prerelease: true }))).toBeNull()
    expect(service.parseRelease(release({ tag_name: '' }))).toBeNull()
  })

  test('returns available and up-to-date states', async () => {
    const fetchRelease = async () => ({ ok: true, json: async () => release() })
    await expect(service.checkForUpdates('0.1.0', fetchRelease)).resolves.toMatchObject({ status: 'available' })
    service.clearUpdateCache()
    await expect(service.checkForUpdates('0.1.3', fetchRelease)).resolves.toEqual({
      status: 'up-to-date',
      currentVersion: '0.1.3',
    })
  })

  test('turns HTTP and JSON failures into unavailable state', async () => {
    await expect(service.checkForUpdates('0.1.0', async () => ({ ok: false, status: 500 })))
      .resolves.toMatchObject({ status: 'unavailable' })
    service.clearUpdateCache()
    await expect(service.checkForUpdates('0.1.0', async () => ({ ok: true, json: async () => { throw new Error('json') } })))
      .resolves.toMatchObject({ status: 'unavailable' })
  })
})
