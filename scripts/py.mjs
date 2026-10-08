// Runs a command with the backend virtualenv's Python, on Windows/macOS/Linux.
// Usage: node scripts/py.mjs <args passed to python...>   (cwd = backend/)
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backend = join(dirname(fileURLToPath(import.meta.url)), '..', 'backend')
const python = join(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')

if (!existsSync(python)) {
  console.error('Backend virtualenv not found. Run "npm run setup" first.')
  process.exit(1)
}
spawn(python, process.argv.slice(2), { cwd: backend, stdio: 'inherit' }).on('exit', (code) =>
  process.exit(code ?? 1),
)
