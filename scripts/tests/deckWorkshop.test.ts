import assert from 'node:assert/strict';
import {completeOwnedDeck,costCurve,deckCounts,replaceDeckCard} from '../../lib/deckWorkshop';
import {FREE_DECKS} from '../../lib/collection/starterDecks';
import {freeCardCounts,deckCardCounts,PACK_CARD_IDS} from '../../lib/collection/access';
import {deckError} from '../../lib/engine/deckValidation';
import {CARDS} from '../../lib/cards';
const owned=freeCardCounts();
for(const hero of Object.keys(FREE_DECKS)){
  const result=completeOwnedDeck([],hero,owned);
  assert.equal(result.length,30);assert.equal(deckError(result,deckCardCounts(owned)),null);
  assert.ok(result.every(id=>owned[id]));
  const seed=FREE_DECKS[hero].slice(0,7), filled=completeOwnedDeck(seed,hero,owned);
  assert.deepEqual(filled.slice(0,seed.length),seed,'Chosen legal cards are preserved');
  assert.equal(costCurve(filled).reduce((a,b)=>a+b,0),30);
}
assert.equal(completeOwnedDeck([PACK_CARD_IDS[0]],'whale',owned).includes(PACK_CARD_IDS[0]),false,'Auto-fill cannot grant a paid card');
const paid=PACK_CARD_IDS.find(id=>CARDS[id].rarity==='legendary')!;
const filled=completeOwnedDeck([paid,paid,paid],'whale',{...owned,[paid]:1});
assert.equal(deckCounts(filled)[paid],1,'Legendary cap applies even to a corrupted seed');
assert.equal(deckError(filled,deckCardCounts({...owned,[paid]:1})),null);
assert.deepEqual(costCurve(['unknown']),Array(8).fill(0));
console.log('DECK WORKSHOP OK: owned-only completion, preserved selections, valid 30-card starters, rarity caps and correct cost curve.');

// Atomic full-deck replacement preserves order, capacity and live copy limits.
const base=completeOwnedDeck([],'whale',owned),baseCounts=deckCounts(base);
const candidate=Object.keys(deckCardCounts(owned)).find(id=>(baseCounts[id]??0)<deckCardCounts(owned)[id])!;
const victim=base[0],replaced=replaceDeckCard(base,victim,candidate,deckCardCounts(owned));
assert.ok(replaced);assert.equal(replaced.length,30);assert.deepEqual(base,completeOwnedDeck([],'whale',owned));assert.equal(deckError(replaced,deckCardCounts(owned)),null);
assert.equal(replaceDeckCard(base,'missing',candidate,deckCardCounts(owned)),null);
assert.equal(replaceDeckCard(base.slice(1),victim,candidate,deckCardCounts(owned)),null);
assert.equal(replaceDeckCard(base,victim,candidate,{}),null,'A changed ownership snapshot must reject an unowned replacement');
