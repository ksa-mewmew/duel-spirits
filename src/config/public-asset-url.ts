export function getPublicAssetUrl(relativePath: string): string {
  const normalizedPath = relativePath.replace(/^\/+/, '')
  if (typeof window === 'undefined') return `/${normalizedPath}`
  const documentDirectory = new URL('.', window.location.href)
  return new URL(normalizedPath, documentDirectory).href
}
