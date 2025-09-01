import { ScriptedGoibProvider } from './scriptedGoib.js'

export function getProvider() {
  const p = (process.env.PROVIDER || 'scripted-goib').toLowerCase()
  switch (p) {
    case 'scripted-goib':
    default:
      return new ScriptedGoibProvider()
  }
}
