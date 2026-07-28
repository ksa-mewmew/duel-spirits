const UPDATE_CONFIG = Object.freeze({
  owner: 'ksa-mewmew',
  repo: 'duel-spirits',
  releasesUrl: 'https://github.com/ksa-mewmew/duel-spirits/releases',
})

const MAX_NOTES_LENGTH = 4000
const CACHE_MS = 5 * 60 * 1000
let cached = null

function parseVersion(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim())
  return match ? match.slice(1).map(Number) : null
}

function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  if (!a || !b) return null
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1
  }
  return 0
}

function parseRelease(value) {
  if (!value || typeof value !== 'object' || value.draft || value.prerelease) return null
  if (typeof value.tag_name !== 'string' || !value.tag_name.trim()) return null
  if (typeof value.html_url !== 'string' || !value.html_url.startsWith(`${UPDATE_CONFIG.releasesUrl}/`)) return null
  if (typeof value.published_at !== 'string') return null
  return {
    latestVersion: value.tag_name.replace(/^v/, ''),
    title: typeof value.name === 'string' && value.name.trim() ? value.name.slice(0, 200) : value.tag_name,
    notes: typeof value.body === 'string' ? value.body.slice(0, MAX_NOTES_LENGTH) : '',
    publishedAt: value.published_at,
    downloadPageUrl: value.html_url,
  }
}

async function checkForUpdates(currentVersion, fetchImpl = fetch) {
  if (cached && Date.now() - cached.createdAt < CACHE_MS && cached.currentVersion === currentVersion) {
    return cached.result
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  let result
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${UPDATE_CONFIG.owner}/${UPDATE_CONFIG.repo}/releases/latest`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Duel-Spirits/${currentVersion}`,
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal: controller.signal,
      },
    )
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`)
    const release = parseRelease(await response.json())
    if (!release) throw new Error('최신 공개 릴리스 정보가 올바르지 않습니다.')
    const comparison = compareVersions(currentVersion, release.latestVersion)
    if (comparison === null) throw new Error('릴리스 버전 형식을 확인할 수 없습니다.')
    result = comparison < 0
      ? { status: 'available', currentVersion, ...release }
      : { status: 'up-to-date', currentVersion }
  } catch (error) {
    result = {
      status: 'unavailable',
      currentVersion,
      reason: error instanceof Error && error.name === 'AbortError'
        ? '업데이트 확인 시간이 초과되었습니다.'
        : error instanceof Error ? error.message : '업데이트 정보를 확인하지 못했습니다.',
    }
  } finally {
    clearTimeout(timeout)
  }
  cached = { currentVersion, createdAt: Date.now(), result }
  return result
}

function clearUpdateCache() {
  cached = null
}

module.exports = {
  UPDATE_CONFIG,
  compareVersions,
  parseRelease,
  checkForUpdates,
  clearUpdateCache,
}
