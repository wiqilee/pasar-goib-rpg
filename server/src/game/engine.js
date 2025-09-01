// server/src/game/engine.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInitialState } from './world.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const questsPath = path.join(__dirname, 'quests.json');
const npcsPath   = path.join(__dirname, 'npcs.json');

// ---------- Load quests ----------
let QUEST_DEFS = [];
try {
  if (fs.existsSync(questsPath)) {
    QUEST_DEFS = JSON.parse(fs.readFileSync(questsPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[engine] Failed to parse quests.json:', e.message);
}

// ---------- Load NPC dialogs ----------
let DIALOG_DEFS = {};
try {
  if (fs.existsSync(npcsPath)) {
    const arr = JSON.parse(fs.readFileSync(npcsPath, 'utf-8'));
    for (const n of arr) {
      if (n && n.id && Array.isArray(n.dialog)) DIALOG_DEFS[n.id] = n.dialog;
    }
  }
} catch (e) {
  console.warn('[engine] Failed to parse npcs.json:', e.message);
}

// ---------- Dice & utils ----------
export function rollD20() {
  const value = 1 + Math.floor(Math.random() * 20);
  let meaning = 'fail';
  if (value === 20) meaning = 'critical success';
  else if (value >= 15) meaning = 'success';
  else if (value >= 10) meaning = 'partial';
  return { value, meaning };
}
function rand() { return Math.random(); }

function ensureState(state) {
  state.quests     = Array.isArray(state.quests) ? state.quests : [];
  state.history    = Array.isArray(state.history) ? state.history : [];
  state.inventory  = Array.isArray(state.inventory) ? state.inventory : [];
  state.flags      = state.flags && typeof state.flags === 'object' ? state.flags : {};
  state.effects    = state.effects && typeof state.effects === 'object' ? state.effects : {}; // player statuses
  state.ui         = state.ui && typeof state.ui === 'object' ? state.ui : {};
  state.suggested  = Array.isArray(state.suggested) ? state.suggested : [];
  state.xp         = typeof state.xp === 'number' ? state.xp : 0;
  state.skillPoints= typeof state.skillPoints === 'number' ? state.skillPoints : 0;

  if (!state.player) {
    state.player = {
      name: 'Wanderer',
      health: 100,
      reputation: 0,
      level: 1,
      stats: { str: 1, dex: 1, int: 1 },
      perks: []
    };
  }
  if (!state.player.stats) state.player.stats = { str: 1, dex: 1, int: 1 };
  if (!Array.isArray(state.player.perks)) state.player.perks = [];
  if (typeof state.flags.essence_count !== 'number') state.flags.essence_count = 0;
  return state;
}

function exitsOfHere(state) {
  const loc = state.map?.[state.location];
  return Array.isArray(loc?.exits) ? loc.exits : [];
}
function nameToLocationId(state, nameLower) {
  for (const [id, loc] of Object.entries(state.map || {})) {
    if ((loc.name || '').toLowerCase() === nameLower) return id;
  }
  return null;
}

// ---------- Dialog helpers ----------
function attachDialogsToNPCs(state) {
  for (const [id, npc] of Object.entries(state.npcs || {})) {
    if (DIALOG_DEFS[id]) npc.dialog = DIALOG_DEFS[id];
  }
}
function getNpcAtHere(state, nameLower) {
  return Object.values(state.npcs || {}).find(
    n => n.location === state.location && (n.name || '').toLowerCase() === nameLower
  ) || null;
}
function findDialogNode(npc, nodeId) {
  return (npc.dialog || []).find(d => d.id === nodeId) || null;
}
function summarizeChoices(node) {
  return (node.choices || []).map(c => c.label).join(' | ');
}
function ensureDialogState(state) {
  state.ui = state.ui || {};
  state.ui.dialog = state.ui.dialog || null;
  return state;
}
function openDialog(state, npcId, nodeId = 'root', lines) {
  ensureDialogState(state);
  const npc = state.npcs[npcId];
  if (!npc?.dialog) return;
  const node = findDialogNode(npc, nodeId) || findDialogNode(npc, 'root');
  if (!node) return;
  state.ui.dialog = { npcId, nodeId: node.id };
  const choices = summarizeChoices(node);
  lines.push(`${npc.name}: ${node.text}${choices ? `\nChoices: ${choices}` : ''}`);
}
function applyDialogEffect(state, effect = {}, lines) {
  if (!effect) return;
  if (typeof effect.reputation_delta === 'number') {
    state.player.reputation = (state.player.reputation || 0) + effect.reputation_delta;
    lines.push(`Your reputation shifts by ${effect.reputation_delta}.`);
  }
  if (Array.isArray(effect.inventory_add)) {
    for (const it of effect.inventory_add) {
      if (!state.inventory.includes(it)) {
        state.inventory.push(it);
        lines.push(`You receive: ${it}.`);
      }
    }
  }
  if (effect.quest_offer) {
    const def = QUEST_DEFS.find(q => q.id === effect.quest_offer);
    if (def) {
      getOrCreateQuestEntry(state, def);
      lines.push(`Quest started: ${def.title}`);
    }
  }
  if (effect.complete_quest) {
    const def = QUEST_DEFS.find(q => q.id === effect.complete_quest);
    const entry = def ? state.quests.find(q => q.id === def.id) : null;
    if (entry && entry.status !== 'completed') {
      entry.status = 'completed';
      const lastStage = def.stages?.[def.stages.length - 1];
      applyRewards(state, lastStage?.rewards || {});
      lines.push(`Quest completed: ${def.title}`);
    }
  }
  if (effect.add_perk) {
    const p = String(effect.add_perk);
    if (!state.player.perks.includes(p)) {
      state.player.perks.push(p);
      lines.push(`You learn a perk: ${p}`);
    }
  }
}

// ---------- Quests ----------
function getQuestDef(id) {
  return QUEST_DEFS.find(q => q.id === id) || null;
}
function getOrCreateQuestEntry(state, def) {
  let entry = state.quests.find(q => q.id === def.id);
  if (!entry) {
    entry = { id: def.id, title: def.title, status: 'in_progress', stageId: def.stages?.[0]?.id || 'start' };
    state.quests.push(entry);
  }
  return entry;
}
function stageById(def, stageId) {
  return def?.stages?.find(s => s.id === stageId) || null;
}
function nextStageId(def, currentStage) {
  if (!def?.stages) return null;
  const idx = def.stages.findIndex(s => s.id === currentStage?.id);
  return idx >= 0 && idx + 1 < def.stages.length ? def.stages[idx + 1].id : null;
}
function conditionMet(state, cond) {
  if (!cond || typeof cond !== 'object') return false;
  if (cond.flag_at_least) {
    for (const [k, min] of Object.entries(cond.flag_at_least)) {
      if ((state.flags?.[k] || 0) < Number(min)) return false;
    }
  }
  if (cond.inventory_has) {
    for (const item of cond.inventory_has) {
      if (!state.inventory.includes(item)) return false;
    }
  }
  if (typeof cond.reputation_at_least === 'number') {
    if ((state.player?.reputation || 0) < cond.reputation_at_least) return false;
  }
  return true;
}
function applyRewards(state, rewards = {}) {
  if (typeof rewards.reputation_delta === 'number') {
    state.player.reputation = (state.player.reputation || 0) + rewards.reputation_delta;
  }
  if (Array.isArray(rewards.inventory_add)) {
    for (const it of rewards.inventory_add) if (!state.inventory.includes(it)) state.inventory.push(it);
  }
}
function advanceQuestByAction(state, actionLower, lines) {
  for (const def of QUEST_DEFS) {
    const firstStage = def.stages?.[0];
    if (!state.quests.find(q => q.id === def.id)) {
      const triggers = (firstStage?.start_triggers || []).map(s => String(s).toLowerCase());
      if (triggers.some(t => t && actionLower.includes(t))) {
        getOrCreateQuestEntry(state, def);
        lines.push(`Quest started: ${def.title}`);
        continue;
      }
    }
    const entry = state.quests.find(q => q.id === def.id && q.status !== 'completed');
    if (!entry) continue;
    const stage = stageById(def, entry.stageId) || firstStage;
    if (!stage) continue;

    let completed = false;
    if (Array.isArray(stage.complete_triggers) && stage.complete_triggers.length) {
      const trigs = stage.complete_triggers.map(s => String(s).toLowerCase());
      if (trigs.some(t => t && actionLower.includes(t))) completed = true;
    }
    if (!completed && stage.complete_condition) {
      completed = conditionMet(state, stage.complete_condition);
    }

    if (completed) {
      const nextId = nextStageId(def, stage);
      if (nextId) {
        entry.stageId = nextId;
        lines.push(`Quest updated: ${def.title} → stage "${nextId}"`);
      } else {
        entry.status = 'completed';
        lines.push(`Quest completed: ${def.title}`);
        applyRewards(state, stage.rewards || {});
      }
    }
  }
}

// ---------- Game completion checker (NEW) ----------
function checkGameCompletion(state, lines) {
  const hasAnyQuest = Array.isArray(state.quests) && state.quests.length > 0;
  const allDone = hasAnyQuest && state.quests.every(q => q.status === 'completed');
  if (allDone && !state.flags.game_completed) {
    state.flags.game_completed = true;
    if (lines) {
      lines.push('All quests are complete. The Night Market exhales, and your story closes.');
    }
  }
}

// ---------- Suggested actions (context-aware) ----------
function refreshSuggested(state) {
  const hereId = state.location;
  const hereName = state.map?.[hereId]?.name || '';

  // helper: cari NPC by name (lower)
  const findNpcByName = (nameLower) => {
    return Object.values(state.npcs || {}).find(
      n => (n.name || '').toLowerCase() === nameLower
    ) || null;
  };

  // 1) Prioritaskan quest yang sedang berjalan
  for (const q of state.quests) {
    if (q.status !== 'in_progress') continue;
    const def = getQuestDef(q.id);
    const st  = stageById(def, q.stageId);
    if (!st) continue;

    const tips = Array.isArray(st.suggested) ? st.suggested : [];
    const expanded = [];

    for (const tipRaw of tips) {
      const tip = String(tipRaw || '').trim();
      const tipLower = tip.toLowerCase();

      // Jika "talk to …" tapi NPC ada di lokasi lain → sisipkan "go to …" dulu
      if (tipLower.startsWith('talk to ')) {
        const npcName = tip.substring(8).trim();
        const npc = findNpcByName(npcName.toLowerCase());
        if (npc && npc.location && npc.location !== hereId) {
          const locName = state.map?.[npc.location]?.name;
          if (locName) expanded.push(`go to ${locName.toLowerCase()}`);
        }
        expanded.push(tip);
      } else {
        expanded.push(tip);
      }
    }

    if (expanded.length) {
      state.suggested = Array.from(new Set(expanded)).slice(0, 6);
      return;
    }
  }

  // 2) Fallback bila tidak ada quest aktif
  const exits = exitsOfHere(state).map(id => state.map?.[id]?.name).filter(Boolean);
  const localNpcs = Object.values(state.npcs || {})
    .filter(n => n.location === hereId)
    .map(n => n.name);

  const base = [];
  if (exits.length) base.push(`go to ${exits[0].toLowerCase()}`);
  if (localNpcs.length) base.push(`talk to ${localNpcs[0]}`);
  base.push('search for moon essence', 'attack shade');

  state.suggested = Array.from(new Set(base)).slice(0, 6);
}

// ---------- Guidance lines (sync dengan suggested) ----------
function guidanceLines(state) {
  const out = [];

  // Jika game sudah tamat, tampilkan arahan tamat
  if (state.flags?.game_completed) {
    out.push('Goal: —');
    out.push('Next: You have finished all available quests. Explore freely or start a new run.');
    return out;
  }

  const active = state.quests?.find(q => q.status === 'in_progress');
  if (active?.id === 'maskmonger_moon_essence') {
    const have = state.flags?.essence_count || 0;
    if (have < 3) {
      out.push(`Goal: Gather Moon Essence (${have}/3).`);
    } else {
      out.push(`Goal: Return the Moon Essence to the Maskmonger.`);
    }
  } else if (!active) {
    if (state.location !== 'spirit_bazaar') {
      out.push(`Goal: Find work to begin your first quest.`);
    } else {
      out.push(`Goal: Ask for work to start a quest.`);
    }
  }

  // Selalu sinkronkan "Next" dengan hasil refreshSuggested()
  if (state.suggested?.length) {
    out.push(`Next: ${state.suggested.slice(0, 3).join(' • ')}`);
  }
  return out;
}

// ---------- Player status (self) ----------
function applyPlayerStatus(state, key, { addStacks = 1, duration = 3 }) {
  state.effects[key] = state.effects[key] || { stacks: 0, duration: 0 };
  state.effects[key].stacks += addStacks;
  state.effects[key].duration = Math.max(state.effects[key].duration, duration);
}
function tickPlayerStatusesAtTurnStart(state, lines) {
  const effects = state.effects || {};
  const DOT = {
    poison: (stacks) => Math.max(1, Math.floor(stacks)),
    bleed:  (stacks) => Math.max(2, stacks * 2),
    burn:   (stacks) => stacks * 3
  };
  for (const [key, data] of Object.entries(effects)) {
    if (!data || data.duration <= 0) continue;
    let dmg = 0;
    if (key in DOT) dmg = DOT[key](data.stacks);
    if (dmg > 0) {
      state.player.health = Math.max(0, state.player.health - dmg);
      lines.push(`You suffer ${key} for ${dmg} damage.`);
    }
    const iron = (state.player.perks || []).includes('iron_will');
    data.duration -= (iron ? 2 : 1);
    if (data.duration <= 0) {
      delete effects[key];
      lines.push(`The ${key} fades.`);
    }
  }
}

// ---------- Enemy status (DOT on enemy) ----------
function applyEnemyStatus(enemy, key, { addStacks = 1, duration = 3 }) {
  enemy.effects = enemy.effects || {};
  enemy.effects[key] = enemy.effects[key] || { stacks: 0, duration: 0 };
  enemy.effects[key].stacks += addStacks;
  enemy.effects[key].duration = Math.max(enemy.effects[key].duration, duration);
}
function tickEnemyStatusesAtTurnStart(enemy, lines) {
  if (!enemy) return;
  enemy.effects = enemy.effects || {};
  const DOT = {
    poison: (stacks) => Math.max(1, Math.floor(stacks)),
    bleed:  (stacks) => Math.max(2, stacks * 2),
    burn:   (stacks) => stacks * 3
  };
  let total = 0;
  for (const [key, data] of Object.entries(enemy.effects)) {
    if (!data || data.duration <= 0) continue;
    let dmg = 0;
    if (key in DOT) dmg = DOT[key](data.stacks);
    if (dmg > 0) {
      total += dmg;
      lines.push(`The ${enemy.name} suffers ${key} for ${dmg} damage.`);
    }
    data.duration -= 1;
    if (data.duration <= 0) delete enemy.effects[key];
  }
  if (total > 0) enemy.hp = Math.max(0, enemy.hp - total);
}

// ---------- Combat helpers ----------
function calcDamage(base, attacker, defender) {
  let dmg = base;
  dmg += Math.floor((attacker?.stats?.str || 0) / 2); // STR scaling
  if (typeof defender?.armor === 'number') dmg = Math.max(0, dmg - defender.armor);
  if (defender?.resist && attacker?.damageType && defender.resist[attacker.damageType]) {
    dmg = Math.floor(dmg * (1 - defender.resist[attacker.damageType]));
  }
  return Math.max(0, dmg);
}

function playerCritChance(state) {
  const base = 0.05 + ((state.player.stats?.dex || 0) * 0.015);
  const perkBonus = (state.player.perks || []).includes('lunar_blade') ? 0.10 : 0;
  return Math.min(0.60, base + perkBonus);
}
function playerFleeBonus(state) {
  return (state.player.perks || []).includes('shadow_step') ? 3 : 0;
}
function playerBleedChanceFromWeapon(state) {
  const hasDagger = (state.inventory || []).includes('Tarnished Dagger');
  return hasDagger ? 0.25 : 0;
}

function pickEnemyAtLocation(state, targetLower) {
  const pool = state.enemies?.[state.location] || [];
  if (!pool.length) return null;
  if (targetLower) {
    const named = pool.find(e => e.id === targetLower || e.name.toLowerCase() === targetLower);
    if (named) return { ...named, hp: named.baseHp, effects: {} };
  }
  const first = pool[0];
  return { ...first, hp: first.baseHp, effects: {} };
}
function getEnemyDefById(state, id) {
  for (const arr of Object.values(state.enemies || {})) {
    const found = arr.find(e => e.id === id);
    if (found) return found;
  }
  return null;
}
function startCombat(state, enemy) {
  state.combat = { enemy: { ...enemy }, log: [], turn: 'player' };
}
function endCombat(state) {
  delete state.combat;
}
function rewardForEnemy(state, enemyId, lines) {
  const def = getEnemyDefById(state, enemyId);
  if (!def) return;
  const r = def.reward || {};
  if (typeof r.reputation === 'number') {
    state.player.reputation = (state.player.reputation || 0) + r.reputation;
    lines.push(`Reputation +${r.reputation}.`);
  }
  if (Array.isArray(r.items)) {
    for (const it of r.items) {
      if (!state.inventory.includes(it)) {
        state.inventory.push(it);
        lines.push(`You obtain: ${it}.`);
      }
    }
  }
  if (r.essence) {
    state.flags.essence_count = (state.flags.essence_count || 0) + Number(r.essence);
    if (!state.inventory.includes('Moon Essence')) state.inventory.push('Moon Essence');
    lines.push(`You gather ${r.essence} Moon Essence.`);
  }

  // XP & level up
  state.xp += typeof r.xp === 'number' ? r.xp : 5;
  const xpToLevel = (state.player.level || 1) * 10;
  if (state.xp >= xpToLevel) {
    state.xp = 0;
    state.player.level = (state.player.level || 1) + 1;
    state.skillPoints += 1;
    lines.push(`You reached level ${state.player.level}! You gained 1 skill point.`);
  }
}

// ---------- Commands: attack / flee / use ----------
export function attackCommand(state, maybeTarget) {
  ensureState(state);
  const lines = [];

  // Player turn: tick self statuses
  tickPlayerStatusesAtTurnStart(state, lines);
  if (state.player.health <= 0) {
    lines.push('You are barely conscious; you cannot fight.');
    state.history.push({ action: `attack ${maybeTarget || ''}`, narrative: lines.join('\n') });
    return state;
  }

  // Start combat if needed
  if (!state.combat) {
    const enemy = pickEnemyAtLocation(state, (maybeTarget || '').toLowerCase());
    if (!enemy) {
      state.history.push({ action: `attack ${maybeTarget || ''}`, narrative: 'There is nothing here to fight.' });
      return state;
    }
    startCombat(state, enemy);
    lines.push(`A ${enemy.name} confronts you!`);
  }

  const { enemy } = state.combat;
  state.combat.turn = 'player';

  // Player attack roll
  const roll = rollD20();
  const hitTarget = 10 + (enemy.dex || 0);
  const bonus = (state.player.stats?.str || 0);
  const total = roll.value + bonus;

  if (total >= hitTarget) {
    const attacker = { stats: state.player.stats, damageType: 'slash' };
    let dmg = calcDamage(5, attacker, enemy);

    const crit = (roll.value === 20) || (rand() < playerCritChance(state));
    if (crit) dmg = Math.floor(dmg * 2);

    enemy.hp = Math.max(0, enemy.hp - dmg);
    lines.push(`You hit the ${enemy.name} (${crit ? 'CRIT! ' : ''}${roll.meaning}). Damage: ${dmg}.`);

    if (rand() < playerBleedChanceFromWeapon(state)) {
      applyEnemyStatus(enemy, 'bleed', { addStacks: 1, duration: 3 });
      lines.push(`Your strike leaves the ${enemy.name} bleeding!`);
    }
  } else {
    lines.push(`You miss the ${enemy.name} (${roll.meaning}).`);
  }

  // Enemy dead?
  if (enemy.hp <= 0) {
    lines.push(`The ${enemy.name} dissolves into cool night.`);
    rewardForEnemy(state, enemy.id, lines);

    // Quest & completion checks can depend on flags/items from reward
    refreshSuggested(state);
    checkGameCompletion(state, lines);
    const g = guidanceLines(state);
    if (g.length) lines.push('', ...g);

    endCombat(state);
    state.history.push({ action: `attack ${maybeTarget || enemy.name}`, narrative: lines.join('\n'), roll });
    refreshSuggested(state);
    return state;
  }

  // Enemy turn starts → tick enemy DOT
  tickEnemyStatusesAtTurnStart(enemy, lines);
  if (enemy.hp <= 0) {
    lines.push(`The ${enemy.name} succumbs to wounds.`);
    rewardForEnemy(state, enemy.id, lines);

    refreshSuggested(state);
    checkGameCompletion(state, lines);
    const g = guidanceLines(state);
    if (g.length) lines.push('', ...g);

    endCombat(state);
    state.history.push({ action: `attack ${maybeTarget || enemy.name}`, narrative: lines.join('\n'), roll });
    refreshSuggested(state);
    return state;
  }

  // Enemy attacks
  const eroll = rollD20();
  const evadeTarget = 10 + (state.player.stats?.dex || 0);
  const eTotal = eroll.value + (enemy.dex || 0);

  if (eTotal >= evadeTarget) {
    const eAttacker = { damageType: enemy.damageType || 'slash' };
    let edmg = calcDamage((enemy.baseDamage || enemy.atk || 4), eAttacker, { armor: 0, resist: {} });
    state.player.health = Math.max(0, state.player.health - edmg);
    lines.push(`${enemy.name} hits you (${eroll.meaning}) for ${edmg} damage.`);

    if (enemy.status_on_hit && rand() < (enemy.status_chance || 0)) {
      applyPlayerStatus(state, enemy.status_on_hit, { addStacks: 1, duration: 2 + Math.floor(rand() * 2) });
      lines.push(`${enemy.name} inflicts ${enemy.status_on_hit.toUpperCase()}!`);
    }
  } else {
    lines.push(`${enemy.name} misses (${eroll.meaning}).`);
  }

  // KO check
  if (state.player.health <= 0) {
    lines.push('You collapse. Lanterns dim as traders carry you back to the Moon Gate.');
    state.player.health = 50;
    state.location = 'moon_gate';
    endCombat(state);
  } else {
    state.combat.turn = 'player';
  }

  // guidance (sync)
  refreshSuggested(state);
  checkGameCompletion(state, lines);
  const g = guidanceLines(state);
  if (g.length) lines.push('', ...g);

  state.history.push({ action: `attack ${maybeTarget || enemy.name}`, narrative: lines.join('\n'), roll });
  refreshSuggested(state);
  return state;
}

export function fleeCommand(state) {
  ensureState(state);
  const lines = [];

  tickPlayerStatusesAtTurnStart(state, lines);

  if (!state.combat) {
    state.history.push({ action: 'flee', narrative: 'There is nothing to flee from.' });
    return state;
  }
  const { enemy } = state.combat;

  const roll = rollD20();
  const fleeTarget = 10 + (enemy.dex || 0);
  const bonus = (state.player.stats?.dex || 0) + playerFleeBonus(state);
  if (roll.value + bonus >= fleeTarget) {
    lines.push('You slip into the crowd. The fight ends.');
    endCombat(state);
  } else {
    lines.push('You fail to escape!');
    const eroll = rollD20();
    const edmg = Math.max(1, Math.floor(eroll.value / 8) + 1);
    state.player.health = Math.max(0, state.player.health - edmg);
    lines.push(`${enemy.name} clips you as you turn. You take ${edmg} damage.`);
    if (state.player.health <= 0) {
      lines.push('You collapse. Traders carry you to the Moon Gate.');
      state.player.health = 50;
      state.location = 'moon_gate';
      endCombat(state);
    }
  }

  refreshSuggested(state);
  checkGameCompletion(state, lines);
  const g = guidanceLines(state);
  if (g.length) lines.push('', ...g);

  state.history.push({ action: 'flee', narrative: lines.join('\n'), roll });
  refreshSuggested(state);
  return state;
}

export function useItemCommand(state, item) {
  ensureState(state);
  const lines = [];
  if (!item) {
    state.history.push({ action: 'use', narrative: 'Use what?' });
    return state;
  }
  if (!state.inventory.includes(item)) {
    state.history.push({ action: `use ${item}`, narrative: `You do not have ${item}.` });
    return state;
  }
  if (item.toLowerCase().includes('potion')) {
    const heal = 18;
    state.player.health = Math.min(100, state.player.health + heal);
    lines.push(`You drink ${item}. +${heal} HP.`);
    if (rand() < 0.25 && state.effects.poison) {
      delete state.effects.poison;
      lines.push('The tonic clears the poison.');
    }
  } else if (item.toLowerCase().includes('antidote')) {
    if (state.effects.poison) {
      delete state.effects.poison;
      lines.push('You cure the poison.');
    } else {
      lines.push('No poison to cure.');
    }
  } else if (item.toLowerCase().includes('frostbomb')) {
    if (state.combat?.enemy) {
      applyEnemyStatus(state.combat.enemy, 'freeze', { addStacks: 1, duration: 2 });
      lines.push('You hurl a frostbomb — the enemy is chilled and slowed.');
    } else {
      lines.push('You throw a frostbomb into the night. It hisses out.');
    }
  } else {
    lines.push(`You use ${item}.`);
  }

  refreshSuggested(state);
  checkGameCompletion(state, lines);
  const g = guidanceLines(state);
  if (g.length) lines.push('', ...g);

  state.history.push({ action: `use ${item}`, narrative: lines.join('\n') });
  refreshSuggested(state);
  return state;
}

// ---------- Core API ----------
export function startGame(playerName = 'Wanderer', seedLore = '') {
  let state = createInitialState({ playerName, seedLore });
  ensureState(state);
  attachDialogsToNPCs(state);
  refreshSuggested(state);

  // Opening scene narrative (auto in first log)
  state.history.push({
    action: 'intro',
    narrative:
`You arrive beneath the Moon Gate. Lanterns sway; clove and night-salt cling to the air.
Two voices speak in one breath: "The market opens under debts and moonlight."
Stalls wake like eyes. Somewhere, a mask tries on your name.`,
    roll: null
  });

  return state;
}

export function applyTurn(state, turn) {
  ensureState(state);
  const action = String(turn.action || '').trim();
  const aLower = action.toLowerCase();
  const lines = [];

  // Dialog close
  if (aLower === 'leave conversation' || aLower === 'close dialog') {
    state.ui.dialog = null;
    lines.push('You step back from the conversation.');
  }

  // Movement
  if (aLower.startsWith('go to ')) {
    const destName = aLower.replace('go to ', '').trim();
    const destId = nameToLocationId(state, destName);
    const hereExits = new Set(exitsOfHere(state));
    if (destId && hereExits.has(destId)) {
      state.location = destId;
      lines.push(`You move to ${state.map[destId].name}.`);
      if (state.combat) delete state.combat;
    } else if (destId) {
      lines.push(`Hidden paths deny you: ${state.map[destId].name} is not directly reachable.`);
    } else {
      lines.push(`You wander but find no place called "${destName}".`);
    }
  }

  // Talk
  if (aLower.startsWith('talk to ')) {
    const nameLower = aLower.replace('talk to ', '').trim();
    const npc = getNpcAtHere(state, nameLower);
    if (npc) openDialog(state, npc.id, 'root', lines);
    else lines.push('No one by that name is here to talk to.');
  }

  // Essence
  if (aLower.includes('search for moon essence')) {
    state.flags.essence_count = (state.flags.essence_count || 0) + 1;
    if (!state.inventory.includes('Moon Essence')) state.inventory.push('Moon Essence');
    lines.push('You distill a thread of pale Moon Essence from warm night air.');
  }

  // Combat shortcuts
  if (aLower.startsWith('attack')) {
    const t = aLower.replace('attack', '').trim();
    return attackCommand(state, t);
  }
  if (aLower === 'flee') {
    return fleeCommand(state);
  }
  if (aLower.startsWith('use ')) {
    const it = action.slice(4).trim();
    return useItemCommand(state, it);
  }

  // Quests
  advanceQuestByAction(state, aLower, lines);
  checkGameCompletion(state, lines);

  // Sinkronkan saran & guidance
  refreshSuggested(state);
  const g = guidanceLines(state);
  if (g.length) lines.push('', ...g);

  // Narrative
  const roll = rollD20();
  const preface = roll.value === 20 ? 'Fate smiles: ' : (roll.value === 1 ? 'Fate falters: ' : '');
  const narrative = [preface + (lines[0] || 'You consider your options...')].concat(lines.slice(1)).join('\n');

  state.history.push({ action, narrative, roll });
  if (state.history.length > 80) state.history.shift();

  refreshSuggested(state);
  return state;
}

// Dialog choice
export function chooseDialog(state, npcId, choiceId) {
  ensureState(state);
  attachDialogsToNPCs(state);
  const lines = [];

  const npc = state.npcs?.[npcId];
  if (!npc?.dialog) {
    state.history.push({ action: `dialog:${npcId}/${choiceId}`, narrative: `No words find you.` });
    return state;
  }

  const currentNodeId = state.ui?.dialog?.nodeId || 'root';
  const node = findDialogNode(npc, currentNodeId) || findDialogNode(npc, 'root');
  const choice = (node?.choices || []).find(c => c.id === choiceId);

  if (!choice) {
    state.history.push({ action: `dialog:${npcId}/${choiceId}`, narrative: `Silence answers your choice.` });
    return state;
  }

  applyDialogEffect(state, choice.effect, lines);
  checkGameCompletion(state, lines);

  if (choice.end) {
    state.ui.dialog = null;
    lines.push(`${npc.name}: (the conversation ends)`);
  } else {
    const nextId = choice.next || node.next || 'root';
    openDialog(state, npcId, nextId, lines);
  }

  refreshSuggested(state);
  const narrative = (lines.join('\n') || `${npc.name} watches your choice.`) +
    (state.suggested?.length ? `\n\nNext: ${state.suggested.slice(0,3).join(' • ')}` : '');
  state.history.push({ action: `dialog:${npcId}/${choiceId}`, narrative, roll: rollD20() });
  if (state.history.length > 80) state.history.shift();

  refreshSuggested(state);
  return state;
}

// Inventory helpers
export function buyItem(state, item) {
  ensureState(state);
  if (item && !state.inventory.includes(item)) state.inventory.push(item);
  return state;
}
export function sellItem(state, item) {
  ensureState(state);
  if (item) state.inventory = state.inventory.filter(i => i !== item);
  return state;
}
export function useItem(state, item) {
  return useItemCommand(state, item);
}

// Skill point spending
export function spendSkillPoint(state, stat) {
  ensureState(state);
  if (state.skillPoints <= 0) return state;
  if (!['str', 'dex', 'int'].includes(stat)) return state;
  state.player.stats[stat] += 1;
  state.skillPoints -= 1;
  return state;
}
