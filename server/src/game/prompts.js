export const TurnSchema = {
  narrative: 'string',
  state_changes: {
    health_delta: 'number?',
    reputation_delta: 'number?',
    location: 'string|null?',
    inventory_add: 'string[]?',
    inventory_remove: 'string[]?',
    quest_updates: 'Array<{id:string,status:string,desc?:string}>?',
    flags: 'Record<string, boolean|number|string>?'
  },
  npc_changes: 'Array<{id:string,affinity_delta?:number,persona_override?:string,location?:string}>?',
  suggested_commands: 'string[]'
};

// a compact text summary still useful for scripted narrators
function summarize(state) {
  const here = state.location;
  const loc = state.map[here]?.name || here;
  const exits = state.map[here]?.exits || [];
  const npcsHere = Object.values(state.npcs).filter(n => n.location === here).map(n => n.name);
  const flags = state.flags && Object.keys(state.flags).length ? JSON.stringify(state.flags) : 'none';
  return [
    `Player: ${state.player.name} (HP ${state.player.health}, REP ${state.player.reputation})`,
    `Location: ${loc}; exits: ${exits.join(', ')}`,
    `Inventory: ${state.inventory.join(', ') || 'empty'}`,
    `Quests: ${state.quests.map(q => q.id+':'+q.status).join(', ') || 'none'}`,
    `NPCs here: ${npcsHere.join(', ') || 'none'}`,
    `Flags: ${flags}`
  ].join('\n');
}

export function buildIntroPrompt(state) {
  const system = `You are the NARRATOR for a surreal night market called Pasar Goib.
Return only strict JSON per schema. Keep narration evocative but concise (<= 2 paragraphs).`;

  const user = `Start a new session with this world:
---
${summarize(state)}
---
Initialize a gentle hook and offer 2–4 suggested commands.`;

  // IMPORTANT: inject raw JSON state so providers can parse quests/flags reliably
  const stateJson = JSON.stringify(state);

  return {
    schema: TurnSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'system', name: 'state', content: stateJson },
      { role: 'user', content: user }
    ]
  };
}

export function buildTurnPrompt(state, action, roll) {
  const system = `You are the NARRATOR for Pasar Goib.
Return only strict JSON. Use the provided d20 roll to shape outcomes. Keep responses grounded in the map, items, and active quests.`;

  const user = `World summary:
---
${summarize(state)}
---
Last action: "${action}"
d20 roll: ${roll.value} (${roll.meaning})
Allowed locations: ${Object.keys(state.map).join(', ')}.`;

  const stateJson = JSON.stringify(state);

  return {
    schema: TurnSchema,
    messages: [
      { role: 'system', content: system },
      { role: 'system', name: 'state', content: stateJson },
      { role: 'user', content: user }
    ]
  };
}
