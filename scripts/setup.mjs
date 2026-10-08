// One-time setup for a fresh clone: virtualenv, Python deps, .env, frontend deps.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const backend = join(root, 'backend')
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' })
const win = process.platform === 'win32'
const venvPython = join(backend, '.venv', win ? 'Scripts/python.exe' : 'bin/python')

if (!existsSync(venvPython)) run(`${win ? 'python' : 'python3'} -m venv .venv`, backend)
run(`"${venvPython}" -m pip install -q -r requirements.txt`, backend)
if (!existsSync(join(backend, '.env'))) {
  copyFileSync(join(backend, '.env.example'), join(backend, '.env'))
  console.log('Created backend/.env — add your ANTHROPIC_API_KEY there for AI features.')
}
run('npm install --no-fund --no-audit', join(root, 'frontend'))
console.log('\nSetup done. Start everything with: npm run dev')
