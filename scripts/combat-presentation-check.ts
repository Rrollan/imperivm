import assert from 'node:assert/strict';
import {CARDS} from '../lib/cards';
import {HEROES} from '../lib/heroes';
import {chooseAiAction} from '../lib/ai';
import {applyAction} from '../lib/engine/engine';
import {GameSession,createLabGame} from '../components/presentation/GameSession';
import {combatStyle} from '../components/presentation/combatStyle';
import {videoCues} from '../components/presentation/videoCue';
import {soundsForEvents} from '../lib/audio/events';
import registry from '../public/ui/arena-lab/fx/manifest.json';

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
      assert.equal(sounds.filter(s=>['attack','arcane-impact','bolt-impact','lightning-impact','shield-impact','rift-impact'].includes(s)).length,1,'One contact, one weapon sound');
      assert.ok(!sounds.includes('damage'),'A weapon contact must not stack a generic thud');
      const fallback=style.delivery==='arcane'?'07-spell-impact':'01-impact';
      const accent=style.shape==='lightning'?'18-olympian-lightning':style.shape==='rift'?'20-underworld-rift':style.shape==='shield'?'19-diamond-phalanx':style.delivery==='melee'?'22-titan-cleave':style.delivery==='bolt'?'36-relay-impact':'37-oracle-impact';
      const expected=Object.prototype.hasOwnProperty.call(registry.clips,accent)?accent:fallback;
      assert.equal(videoCues(batch)[0].id,expected,'Installed material accent must match the real attack; absent clips retain the native fallback');
    }
    session.impact(batch.id);session.complete(batch.id);actions++;
  }
  assert.notEqual(session.snapshot().state.winner,null,'Presentation changes cannot stall a complete match');
}
assert.equal(deliveries.size,3,'Real matches cover steel, magic and bolt attacks');
console.log(`COMBAT PRESENTATION OK: ${actions} legal actions, ${attacks} contacts, all three delivery styles, exact engine outcomes and single audio/VFX contact.`);
