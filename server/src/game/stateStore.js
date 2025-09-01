import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const savesDir = path.join(__dirname, '..', '..', 'saves')

if (!fs.existsSync(savesDir)) fs.mkdirSync(savesDir, { recursive: true })

const memory = new Map()

export function setSession(id, state) {
  memory.set(id, state)
}

export function getSession(id) {
  return memory.get(id)
}

export async function saveState(id, state) {
  const file = path.join(savesDir, `${id}.json`)
  await fs.promises.writeFile(file, JSON.stringify(state, null, 2), 'utf-8')
}

export async function loadState(id) {
  const file = path.join(savesDir, `${id}.json`)
  try {
    const raw = await fs.promises.readFile(file, 'utf-8')
    const state = JSON.parse(raw)
    memory.set(id, state)
    return state
  } catch {
    return null
  }
}
