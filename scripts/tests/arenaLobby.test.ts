import assert from 'node:assert/strict';
import { CARDS } from '../../lib/cards';
import { ARENA_RARITIES, createRoomCode, validRoomCode, normalizeRoomCode, validateLobbyTerms, type LobbyTerms } from '../../lib/ui/arenaLobby';
import type { CollectionSnapshot } from '../../lib/collection/gateway';
const collection: CollectionSnapshot = { mode: 'local', rug: 50, packsOpened: 0, owned: Object.fromEntries(Object.keys(CARDS).map(id => [id, 1])) };
const before = JSON.stringify(collection);
for (const rarity of ARENA_RARITIES) {
  const own = Object.values(CARDS).find(card => card.rarity === rarity)!;
  const equal = Object.values(CARDS).filter(card => card.rarity === rarity).at(-1)!;
  const unequal = Object.values(CARDS).find(card => card.rarity !== rarity)!;
  const terms: LobbyTerms = { mode: 'card', amount: 25, cardId: own.id, rarity };
  assert.equal(validateLobbyTerms(terms, collection, equal.id), null);
  assert.equal(validateLobbyTerms(terms, collection, unequal.id), 'rarity', 'Reject asymmetric card pairs');
  assert.equal(validateLobbyTerms({ ...terms, rarity: unequal.rarity }, collection), 'rarity');
  assert.equal(validateLobbyTerms(terms, { ...collection, owned: {} }), 'ownership');
  assert.equal(validateLobbyTerms({ ...terms, cardId: '' }, collection), 'ownership', 'No automatic card stake');
}
const rug: LobbyTerms = { mode: 'rug', amount: 50, cardId: '', rarity: 'common' };
assert.equal(validateLobbyTerms(rug, collection), null);
assert.equal(validateLobbyTerms({ ...rug, amount: 100 }, collection), 'balance');
for (const amount of [NaN, Infinity, -10, 0, 1.5, 11]) assert.equal(validateLobbyTerms({ ...rug, amount }, collection), 'amount');
assert.equal(validateLobbyTerms(rug, null), 'collection');
assert.equal(validateLobbyTerms({ ...rug, mode: 'free' }, null), null);
for (const code of ['', 'ABC12', 'ABC1234', 'АВС123', 'ABC-12', 'ABC 12', '<1234>']) assert.equal(validRoomCode(code), false);
assert.equal(normalizeRoomCode(' abc123 '), 'ABC123');
assert.equal(validRoomCode('abc123'), true);
for (let i = 0; i < 100; i++) assert.match(createRoomCode(), /^[A-Z2-9]{6}$/);
assert.equal(JSON.stringify(collection), before, 'Lobby checks must not deduct currency or cards');
console.log('PASS arena lobby: ownership, equal rarity pairs, balance, invalid stakes, six-character codes, no deductions');
