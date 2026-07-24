import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const root = process.cwd()
const buildDirectory = resolve(root, '.sim-build')
const localTsc = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc')
const compiler = existsSync(localTsc) ? process.execPath : 'tsc'
const compilerArgs = existsSync(localTsc)
  ? [localTsc, '-p', 'tsconfig.simulator.json', '--ignoreDeprecations', '6.0']
  : ['-p', 'tsconfig.simulator.json']

const compiled = spawnSync(compiler, compilerArgs, { cwd: root, stdio: 'inherit' })
if (compiled.status !== 0) process.exit(compiled.status ?? 1)

mkdirSync(buildDirectory, { recursive: true })
writeFileSync(resolve(buildDirectory, 'package.json'), '{"type":"commonjs"}\n', 'utf8')

const entry = process.argv[2] === 'self-test' ? 'self-test' : 'cli'
const args = process.argv.slice(3)
const executed = spawnSync(process.execPath, [resolve(buildDirectory, 'simulator', `${entry}.js`), ...args], {
  cwd: root,
  stdio: 'inherit',
})
process.exit(executed.status ?? 1)
