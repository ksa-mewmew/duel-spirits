declare const __APP_VERSION__: string | undefined

export function getAppVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown'
}
