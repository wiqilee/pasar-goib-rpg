// server/src/game/world.js
export function createInitialState({ playerName = 'Wanderer', seedLore = '' } = {}) {
  const map = {
    moon_gate:      { name: 'Moon Gate',      exits: ['spirit_bazaar', 'exit_road'] },
    spirit_bazaar:  { name: 'Spirit Bazaar',  exits: ['mask_stalls', 'shadow_lane', 'oracle_tent', 'moon_gate'] },
    mask_stalls:    { name: 'Mask Stalls',    exits: ['spirit_bazaar'] },
    shadow_lane:    { name: 'Shadow Lane',    exits: ['spirit_bazaar'] },
    oracle_tent:    { name: 'Oracle Tent',    exits: ['spirit_bazaar'] },
    exit_road:      { name: 'Old Road',       exits: ['moon_gate'] }
  };

  const npcs = {
    gate_twins:     { id: 'gate_twins', name: 'Gate Twins', location: 'moon_gate', affinity: 0 },
    maskmonger:     { id: 'maskmonger', name: 'Maskmonger', location: 'mask_stalls', affinity: 0 },
    shadow_broker:  { id: 'shadow_broker', name: 'The Shadow Broker', location: 'shadow_lane', affinity: 0 },
    candle_scribe:  { id: 'candle_scribe', name: 'Candle Scribe', location: 'oracle_tent', affinity: 0 }
  };

  // Enemies (with simple on-hit statuses)
  // status_on_hit: 'poison' | 'bleed' (optional), status_chance: 0..1
  const enemies = {
    moon_gate: [
      { id: 'gate_wisp', name: 'Gate Wisp', baseHp: 10, atk: 2, dex: 2, reward: { reputation: 1 }, status_on_hit: 'poison', status_chance: 0.2 }
    ],
    spirit_bazaar: [
      { id: 'lantern_moth', name: 'Lantern Moth', baseHp: 12, atk: 3, dex: 3, reward: { reputation: 1, essence: 1 }, status_on_hit: 'poison', status_chance: 0.25 }
    ],
    mask_stalls: [
      { id: 'mask_thief', name: 'Mask Thief', baseHp: 14, atk: 4, dex: 3, reward: { reputation: 2, items: ['Coin of Echoes'] } }
    ],
    shadow_lane: [
      { id: 'shade', name: 'Street Shade', baseHp: 16, atk: 5, dex: 4, reward: { reputation: 2, essence: 1 }, status_on_hit: 'bleed', status_chance: 0.35 }
    ],
    oracle_tent: [
      { id: 'oracle_echo', name: 'Oracle Echo', baseHp: 18, atk: 4, dex: 2, reward: { reputation: 2 } }
    ],
    exit_road: [
      { id: 'road_bandit', name: 'Road Bandit', baseHp: 15, atk: 5, dex: 3, reward: { reputation: 2, items: ['Tarnished Dagger'] }, status_on_hit: 'bleed', status_chance: 0.3 }
    ]
  };

  // Atmospheric horror-flavored intro lore
  const introLore = `
Under a swollen moon the market unthreads itself from the alleys—canvas groaning, incense bitter,
lanterns humming like trapped bees. Traders sell what shouldn't be sold: second names, cleaned
memories, masks that bite back if you lie. Debts are counted in shadows.

People here speak softly about a thing that stirs near the Moon Gate. Some call it a tax, others
a hunger. The Twins smile when they mention it. The crowd pretends not to hear.

${seedLore ? String(seedLore).trim() + '\n' : ''}What you carry is worth more than coin. Choose what you lose, and whom you owe.
  `.trim();

  return {
    player: {
      name: playerName,
      health: 100,
      reputation: 0,
      stats: { str: 1, dex: 1, int: 1, points: 0 },
      perks: [] // e.g. ['lunar_blade', 'iron_will', 'shadow_step']
    },
    location: 'moon_gate',
    map,
    npcs,
    enemies,
    inventory: [],
    quests: [],
    flags: {
      essence_count: 0 // used by early quests
    },
    effects: {}, // status map: { poison: { stacks, duration }, bleed: {...} }
    history: [],
    // This lore is shown on the Lore page and can be echoed in UI as the world primer
    lore: introLore,
    // A few starter suggestions to guide first steps
    suggested: [
      'talk to gate twins',
      'go to spirit bazaar',
      'search for moon essence',
      'attack shade'
    ],
    ui: { dialog: null }
  };
}
