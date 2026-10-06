/**
 * Aggregate a frozen HearthstoneJSON export; never treat client records as a
 * Standard legality list or ladder statistics. No network access, rule-text
 * redistribution, or changes to either game's content.
 *
 * node scripts/research/hearthstone-catalogue.mjs --input cards.json \
 *   --imperivm imperivm-snapshot.json --headers response-headers.txt \
 *   --as-of 2026-10-06 --output docs/research/hearthstone-catalogue-20261006.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const allowed = new Set(['--input', '--imperivm', '--headers', '--as-of', '--output']);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!allowed.has(args[i]) || !args[i + 1] || options[args[i]]) {
    throw new Error(`Invalid or repeated option: ${args[i]}`);
  }
  options[args[i]] = args[i + 1];
}
for (const name of ['--input', '--as-of', '--output']) {
  if (!options[name]) throw new Error(`Required option: ${name}`);
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(options['--as-of'])) throw new Error('Invalid as-of date');
const bytes = readFileSync(options['--input']);
const cards = JSON.parse(bytes);
if (!Array.isArray(cards)) throw new Error('Expected an array of card records');
const ids = cards.map(c => c.id);
if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length) {
  throw new Error('Expected unique string card IDs');
}
const countBy = (records, get) => {
  const counts = {};
  for (const record of records) {
    const key = get(record) ?? 'UNSPECIFIED';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en')));
};
const playableTypes = ['MINION', 'SPELL', 'WEAPON', 'LOCATION', 'HERO'];
const excludedSets = ['HERO_SKINS', 'BATTLEGROUNDS', 'LETTUCE', 'TB', 'MISSIONS', 'CREDITS', 'TUTORIAL', 'PET'];
const collectible = cards.filter(c => c.collectible === true);
const pool = collectible.filter(c => playableTypes.includes(c.type) && !excludedSets.includes(c.set));
const classesOf = c => c.classes?.length ? [...c.classes].sort() : c.cardClass ? [c.cardClass] : ['UNSPECIFIED'];
const tagRows = pool.flatMap(c => [...new Set(c.mechanics ?? [])]);
const classRows = pool.flatMap(classesOf);
const recentLabels = ['Prepare', 'Kindred', 'Shatter', 'Herald', 'Rewind', 'Fabled', 'Imbue', 'Dark Gift', 'Finale', 'Tourist'];
const labelCount = Object.fromEntries(recentLabels.map(label => {
  const pattern = new RegExp(`<b>${label}s?[:]?<\\/b>`, 'i');
  return [label, pool.filter(c => pattern.test(c.text ?? '')).length];
}));
const headers = options['--headers'] ? readFileSync(options['--headers'], 'utf8') : '';
const lastModified = headers.match(/^last-modified:\s*(.*)$/im)?.[1].trim() ?? null;
const audit = {
  schema: 1,
  asOf: options['--as-of'],
  provenance: {
    provider: 'HearthSim / HearthstoneJSON, automatically extracted client card data; not Blizzard ladder telemetry',
    sourceUrl: 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json',
    documentationUrl: 'https://hearthstonejson.com/',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    httpLastModified: lastModified,
    buildNumber: null,
    buildNote: 'The captured response did not expose a resolved build number; the SHA-256 pins this particular latest export.',
  },
  scope: {
    include: 'collectible === true AND type in playableTypes AND set not in excludedSets',
    playableTypes,
    excludedSets,
    deduplication: 'Unique client IDs only. Core, VANILLA, legacy and variant records are not merged by name.',
    limitation: 'These are catalogue records across sets and formats, not a count of unique cards legal in current Standard. Tags include internal implementation flags and do not enumerate every rules mechanic.',
  },
  allRecords: cards.length,
  allTypes: countBy(cards, c => c.type),
  collectibleRecords: collectible.length,
  collectibleTypes: countBy(collectible, c => c.type),
  excludedCollectibleRecords: collectible.length - pool.length,
  excludedCollectibleSets: countBy(collectible.filter(c => !pool.includes(c)), c => c.set),
  analysedCollectibleGameRecords: pool.length,
  analysedTypes: countBy(pool, c => c.type),
  analysedSets: countBy(pool, c => c.set),
  classCombinations: countBy(pool, c => classesOf(c).join('+')),
  classMembership: countBy(classRows, c => c),
  multiClassRecords: pool.filter(c => classesOf(c).length > 1).length,
  recordsWithoutClass: pool.filter(c => classesOf(c).includes('UNSPECIFIED')).length,
  mechanicsTagFrequency: countBy(tagRows, c => c),
  mechanicsTagNote: 'Counts are records carrying each tag. TRIGGER_VISUAL and similar flags are not independent gameplay keywords. A missing tag does not establish that a card lacks an effect.',
  recentBoldTextLabelFrequency: labelCount,
  textLabelNote: 'Case-insensitive bold HTML labels only, not a complete semantic rules parser. Labels can vary or be implicit; these counts must not be used as mechanic legality/coverage claims.',
};
if (options['--imperivm']) {
  const ownBytes = readFileSync(options['--imperivm']);
  const own = JSON.parse(ownBytes);
  const definitions = Object.values(own.cards);
  const vanilla = c => c.type === 'minion' && !c.battlecry && !c.halvingPeriod && !c.priority && !c.taunt && !c.rush && !c.lifesteal;
  audit.imperivm = {
    snapshotSha256: createHash('sha256').update(ownBytes).digest('hex'),
    cards: definitions.length,
    types: countBy(definitions, c => c.type),
    factions: countBy(definitions, c => c.faction),
    effects: countBy(definitions.filter(c => c.spell || c.battlecry), c => c.spell?.kind ?? c.battlecry.kind),
    vanillaMinionIds: definitions.filter(vanilla).map(c => c.id).sort(),
    keywordCounts: Object.fromEntries(['taunt', 'rush', 'lifesteal', 'priority', 'halvingPeriod'].map(k => [k, definitions.filter(c => c[k]).length])),
    heroIds: Object.keys(own.heroes).sort(),
    starterDecks: Object.fromEntries(Object.entries(own.decks).map(([hero, deck]) => [hero, { size: deck.length, uniqueCards: new Set(deck).size }])),
    cardIds: definitions.map(c => c.id).sort(),
  };
}
writeFileSync(options['--output'], `${JSON.stringify(audit, null, 2)}\n`);
console.log(JSON.stringify({allRecords: audit.allRecords, collectibleRecords: audit.collectibleRecords, analysedCollectibleGameRecords: pool.length, sha256: audit.provenance.sha256, imperivmCards: audit.imperivm?.cards}));
