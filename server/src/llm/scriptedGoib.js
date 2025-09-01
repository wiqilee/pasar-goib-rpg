import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// load quest defs (id, title, desc, start_trigger, complete_trigger)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const questsPath = path.join(__dirname, '..', 'game', 'quests.json')
let questDefs = []
try {
  questDefs = JSON.parse(fs.readFileSync(questsPath, 'utf-8'))
} catch {
  console.warn('[scriptedGoib] quests.json not found or invalid')
}

function lc(s) { return (s || '').toLowerCase() }
function includes(haystack, needle) { return lc(haystack).includes(lc(needle)) }

function questStatusMap(questsArr = []) {
  const map = new Map()
  questsArr.forEach(q => map.set(q.id, q.status))
  return map
}

function autoSuggestFromQuests(state) {
  const out = new Set()
  const status = questStatusMap(state.quests)

  for (const q of questDefs) {
    const st = status.get(q.id)
    // not started: surface the start trigger as a potential discovery
    if (!st && q.start_trigger) out.add(q.start_trigger)
    // started but not completed: surface the complete trigger
    if (st === 'started' && q.complete_trigger) out.add(q.complete_trigger)
  }
  return Array.from(out)
}

export class ScriptedGoibProvider {
  async generateJSON(schema, messages) {
    const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content || ''
    const stateMsg = messages.find(m => m.role === 'system' && m.name === 'state')?.content
    let state = {}
    try { state = JSON.parse(stateMsg || '{}') } catch { state = {} }

    const hereId = state.location
    const hereName = state.map?.[hereId]?.name || 'Somewhere'
    const rep = state.player?.reputation ?? 0

    // --- base narrative + suggestions by location/context
    let narrative = `You stand in ${hereName}. The night market hums with strange bargains.`
    let suggested = ["look around", "enter the bazaar", "talk to the nearest vendor"]

    if (hereName === 'Spirit Bazaar' || includes(lastUser, 'bazaar')) {
      narrative = "Strings of green lanterns sway over the Spirit Bazaar; resin and clove sweeten the air."
      suggested = ["go to the mask stalls", "walk down the shadow lane", "visit the oracle tent", "look around"]
    } else if (hereName === 'Mask Stalls' || includes(lastUser, 'mask')) {
      narrative = "Rows of wooden faces watch you breathe. The Maskmonger’s blade sings against living grain."
      suggested = ["talk to the Maskmonger", "inspect masks", "buy mask", "return to the bazaar"]
    } else if (hereName === 'Shadow Lane' || includes(lastUser, 'shadow')) {
      narrative = "Light feels taxed here. The Shadow Broker weighs silhouettes like coin."
      suggested = ["talk to the Shadow Broker", "offer your shadow", "borrow a shadow", "buy a shadow cloak"]
    } else if (hereName === 'Oracle Tent' || includes(lastUser, 'oracle')) {
      narrative = "An indigo tent exhales candle smoke that writes and rewrites itself midair."
      suggested = ["talk to the Candle Scribe", "ask about an exit ritual", "restore a memory", "return to the bazaar"]
    } else if (hereName === 'Moon Gate') {
      suggested = ["enter the bazaar", "talk to the Gate Twins", "look around"]
      narrative = rep >= 2
        ? "At the Moon Gate, the twins share a secret smile—they’ve heard your name in kind tones."
        : "The Moon Gate yawns like a patient mouth. The twins watch, owlish and patient."
    }

    // --- quest-aware narrative & suggestions
    const active = (state.quests || []).filter(q => q.status === 'started')
    for (const q of active) {
      if (q.id === 'mask_trial') {
        narrative = "The Whispering Mask trembles in your hands, eager to test your resolve."
      }
      if (q.id === 'exit_ritual') {
        narrative = "Candles gutter as your breath disturbs the script of fate—tonight demands a ritual."
      }
    }

    // merge auto-suggest from quests.json (start/complete triggers)
    const questBased = autoSuggestFromQuests(state)
    // keep result tidy & unique, prefer quest triggers on top
    const merged = Array.from(new Set([...questBased, ...suggested])).slice(0, 6)

    // small reputation seasoning
    if (rep >= 3) {
      narrative += " Traders seem to recognize you; a few nods carry a quiet respect."
    } else if (rep <= -2) {
      narrative += " Some shutters close as you pass; reputation is a currency, and yours is in debt."
    }

    return {
      narrative,
      state_changes: {},
      npc_changes: [],
      suggested_commands: merged
    }
  }
}
