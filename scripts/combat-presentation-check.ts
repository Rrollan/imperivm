import assert from 'node:assert/strict';
import {CARDS} from '../lib/cards';
import {HEROES} from '../lib/heroes';
import {chooseAiAction} from '../lib/ai';
import {applyAction} from '../lib/engine/engine';
import {GameSession,createLabGame} from '../components/presentation/GameSession';
import {combatStyle} from '../components/presentation/combatStyle';
import {videoCues} from '../components/presentation/videoCue';
import {soundsForEvents} from '../lib/audio/events';

assert.equal(combatStyle('gm-greeter').delivery,'arcane');
assert.equal(combatStyle('liquidation-officer').delivery,'arcane');
assert.equal(combatStyle('frontrun-bot').delivery,'bolt');
assert.equal(combatStyle('lending-legionnaire').delivery,'melee');
assert.equal(combatStyle(undefined).delivery,'melee');
for(const card of Object.values(CARDS))assert.ok(combatStyle(card.id).sound);
const deliveries=new Set<string>();let attacks=0,actions=0;
for(const hero of Object.keys(HEROES))for(const seed of [21,375,2718]){
  const session=new GameSession(createLabGame(hero,true,seed));
  for(let i=0;i<2000&&session.snapshot().state.winner===null;i++){
    const before=session.snapshot().state,action=chooseAiAction(before),batch=session.dispatch(action)!;
    assert.ok(batch);assert.deepEqual(batch.after,applyAction(before,action));
    if(action.type==='attack'&&batch.events){
      const card=before.players[before.turn].board.find(m=>m.uid===action.attackerUid)!;
      const style=combatStyle(card.cardId),sounds=soundsForEvents(batch.events,batch);
      deliveries.add(style.delivery);attacks++;
      assert.ok(sounds.includes(style.sound),`${card.cardId}: correct combat material`);
      assert.equal(sounds.filter(s=>s==='attack'||s==='arcane-impact'||s==='bolt-impact').length,1,'One contact, one weapon sound');
      assert.ok(!sounds.includes('damage'),'A weapon contact must not stack a generic thud');
      assert.equal(videoCues(batch)[0].id,style.delivery==='arcane'?'07-spell-impact':'01-impact');
    }
    session.impact(batch.id);session.complete(batch.id);actions++;
  }
  assert.notEqual(session.snapshot().state.winner,null,'Presentation changes cannot stall a complete match');
}
assert.equal(deliveries.size,3,'Real matches cover steel, magic and bolt attacks');
console.log(`COMBAT PRESENTATION OK: ${actions} legal actions, ${attacks} contacts, all three delivery styles, exact engine outcomes and single audio/VFX contact.`);
