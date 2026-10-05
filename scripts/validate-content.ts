/* Content validation for IMPERIVM cards/heroes/decks. Run with tsx. */
import { CARDS } from '../lib/cards';
import { HEROES } from '../lib/heroes';
import { DECKS } from '../lib/decks';
import type { EffectKind } from '../lib/engine/types';

const EFFECT_KINDS: EffectKind[] = [
  'damage-all-enemy-minions',
  'damage-random-enemy',
  'damage-enemy-treasury',
  'heal-treasury',
  'heal-own-minions',
  'weaken-random-enemy',
  'draw',
  'buff-own',
  'gain-gas',
  'counter-mempool',
  'rugpull',
  'summon',
];

const errors: string[] = [];
const fail = (m: string) => errors.push(m);

const ids = Object.keys(CARDS);
failIf(ids.length < 40, `only ${ids.length} cards (< 40)`);
function failIf(cond: boolean, m: string) { if (cond) fail(m); }

// unique kebab-case ids
const seen = new Set<string>();
for (const id of ids) {
  failIf(seen.has(id), `duplicate id ${id}`);
  seen.add(id);
  failIf(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id), `id not kebab-case: ${id}`);
  failIf(CARDS[id].id !== id, `key/id mismatch: ${id}`);
}

// faction counts
const factions = ['DeFi', 'NFT', 'DePIN', 'Meme'] as const;
for (const f of factions) {
  const n = ids.filter((id) => CARDS[id].faction === f).length;
  console.log(`faction ${f}: ${n} cards`);
  failIf(n < 8, `faction ${f} has only ${n} cards`);
}

// per-card invariants
for (const id of ids) {
  const c = CARDS[id];
  failIf(c.cost < 0 || c.cost > 10, `${id}: cost ${c.cost} out of 0..10`);
  failIf(!['common', 'rare', 'epic', 'legendary'].includes(c.rarity), `${id}: bad rarity`);
  failIf(!c.text || !/^[A-Z]/.test(c.name), `${id}: name/text issue`);
  if (c.type === 'minion') {
    failIf(c.attack === undefined || c.health === undefined, `${id}: minion missing stats`);
    failIf(c.spell !== undefined, `${id}: minion has spell field`);
  } else if (c.type === 'spell') {
    failIf(!c.spell, `${id}: spell missing effect`);
    failIf(c.attack !== undefined || c.health !== undefined, `${id}: spell has stats`);
  } else fail(`${id}: bad type`);
  for (const e of [c.battlecry, c.spell]) {
    if (e) failIf(!EFFECT_KINDS.includes(e.kind), `${id}: unknown effect kind ${e.kind}`);
  }
  if (c.spell && c.spell.kind === 'summon' || c.battlecry?.kind === 'summon') {
    const cid = (c.spell?.kind === 'summon' ? c.spell : c.battlecry)!.cardId;
    failIf(!cid || !CARDS[cid], `${id}: summon target ${cid} missing from CARDS`);
  }
}

// required content
const rug = CARDS['rug-pull'];
failIf(!rug || rug.rarity !== 'legendary' || rug.cost !== 8 || rug.type !== 'spell' || rug.spell?.kind !== 'rugpull', 'RUG PULL contract broken');
const priority = ids.filter((id) => CARDS[id].priority);
console.log('priority cards:', priority.join(', '));
failIf(priority.length < 3, 'fewer than 3 priority cards');
const halving = ids.filter((id) => (CARDS[id].halvingPeriod ?? 0) >= 3);
console.log('halving minions:', halving.map((id) => `${id}(${CARDS[id].halvingPeriod})`).join(', '));
failIf(halving.length < 3, 'fewer than 3 halving minions');
failIf(!CARDS['staking-pool'], 'missing staking-pool');

// heroes
const heroIds = Object.keys(HEROES);
for (const hid of ['whale', 'builder', 'degen', 'validator']) {
  failIf(!HEROES[hid], `missing hero ${hid}`);
}
const expected: Record<string, [string, string, string]> = {
  whale: ['Whale', 'The Market Mover', 'damage-random-enemy'],
  builder: ['Builder', 'The Shipwright', 'heal-treasury'],
  degen: ['Degen', 'The Aped', 'draw-burn'],
  validator: ['Validator', 'The Block Keeper', 'gain-gas'],
};
for (const [hid, [name, title, power]] of Object.entries(expected)) {
  const h = HEROES[hid];
  if (!h) continue;
  failIf(h.name !== name || h.title !== title || h.power !== power, `${hid}: identity mismatch`);
  failIf(h.powerCost !== 2, `${hid}: powerCost != 2`);
  failIf(!h.powerName || !h.powerText, `${hid}: missing power text`);
}

// decks
for (const hid of heroIds) {
  const deck = DECKS[hid];
  failIf(!deck, `missing deck for ${hid}`);
  if (!deck) continue;
  failIf(deck.length !== 30, `${hid} deck has ${deck.length} cards (need 30)`);
  const counts: Record<string, number> = {};
  for (const cid of deck) {
    failIf(!CARDS[cid], `${hid} deck references unknown card ${cid}`);
    counts[cid] = (counts[cid] ?? 0) + 1;
  }
  for (const cid of Object.keys(counts)) {
    const n = counts[cid];
    const max = CARDS[cid]?.rarity === 'legendary' ? 1 : 2;
    failIf(n > max, `${hid} deck: ${cid} x${n} exceeds limit ${max}`);
  }
}

if (errors.length) {
  console.error('\nFAILURES:');
  for (const e of errors) console.error(' -', e);
  process.exit(1);
}
console.log('\nAll content checks passed.');
