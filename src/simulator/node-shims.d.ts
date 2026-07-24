declare module 'node:fs' {
  export function existsSync(path: string): boolean
  export function readFileSync(path: string, encoding: 'utf8'): string
  export function writeFileSync(path: string, data: string, encoding?: 'utf8'): void
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined
}

declare module 'node:path' {
  export function resolve(...paths: string[]): string
  export function join(...paths: string[]): string
}

declare const process: {
  argv: string[]
  cwd(): string
  exitCode?: number
}
