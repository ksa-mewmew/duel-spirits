export interface ClipboardAdapter {
  writeText(value: string): Promise<void>
  readText(): Promise<string>
}

declare global {
  interface Window {
    duelDesktop?: {
      clipboard?: {
        writeText(value: string): Promise<void>
        readText(): Promise<string>
      }
      storage?: {
        loadDecks(): string | null
        saveDecks(serializedDecks: string): Promise<void>
      }
      app?: {
        getVersion(): Promise<string>
        getPlatform(): Promise<string>
      }
      window?: {
        getResolution(): Promise<string>
        setResolution(resolution: string): Promise<string>
        close(): Promise<void>
      }
      updates?: {
        check(): Promise<UpdateCheckResult>
        openDownloadPage(): Promise<void>
      }
    }
  }
}

export function createClipboardAdapter(target: Window = window): ClipboardAdapter {
  const desktop = target.duelDesktop?.clipboard
  if (desktop) {
    return {
      writeText: (value) => desktop.writeText(value),
      readText: () => desktop.readText(),
    }
  }
  if (target.navigator.clipboard) {
    return {
      writeText: (value) => target.navigator.clipboard.writeText(value),
      readText: () => target.navigator.clipboard.readText(),
    }
  }
  return {
    writeText: async () => { throw new Error('이 환경에서는 클립보드를 사용할 수 없습니다.') },
    readText: async () => { throw new Error('이 환경에서는 클립보드를 사용할 수 없습니다.') },
  }
}
import type { UpdateCheckResult } from '../shared/update'
