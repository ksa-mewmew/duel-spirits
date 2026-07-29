declare const __APP_VERSION__: string | undefined

export const FALLBACK_APP_VERSION = '0.2.0'
export const NETWORK_PROTOCOL_VERSION = '1'

export function getAppVersion(): string {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : FALLBACK_APP_VERSION
}
