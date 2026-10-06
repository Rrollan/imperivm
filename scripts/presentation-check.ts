import assert from 'node:assert/strict';
import { applyAction, legalActions, mulliganAvailable } from '../lib/engine/engine';
import { chooseAiAction } from '../lib/ai';
import { GameSession, createLabGame } from '../components/presentation/GameSession';
import { PresentationScheduler } from '../components/presentation/PresentationScheduler';
import { videoCues } from '../components/presentation/videoCue';
import {MOTION,settle,attackTravel,deathProgress,accentProgress} from '../components/presentation/motionSpec';
import {HEROES} from '../lib/heroes';
import {abilityCues} from '../components/presentation/abilityCues';
import {pixelRatio} from '../components/presentation/renderQuality';

async function main() {
  assert.ok(pixelRatio(1280,800,2,'auto')>1.4,'Retina must improve image resolution above CSS pixels');
  assert.equal(pixelRatio(1280,800,2,'fast'),1,'Performance mode must retain the CSS pixel budget');
  assert.ok(3840*2160*pixelRatio(3840,2160,2,'auto')**2<=3840*2160,'Large windows must not render at four times their area');
  assert.ok(1920*1080*pixelRatio(1920,1080,2,'sharp')**2<=4_000_001,'Sharp mode must respect its pixel budget');
  const opening = createLabGame('builder', true, 2718);
  assert.ok(mulliganAvailable(opening), 'A new match must offer the real starting-hand choice');
  assert.ok(legalActions(opening).every(choice=>choice.type==='mulligan'), 'Cards cannot play before the opening choice');
  const kept = applyAction(opening, {type:'mulligan',uids:[]});
  assert.deepEqual(kept.players[0].hand, opening.players[0].hand, 'Keeping the hand must preserve its cards');
  assert.equal(mulliganAvailable(kept), false);
  const rejectedUid=opening.players[0].hand[1].uid;
  const replaced=applyAction(opening,{type:'mulligan',uids:[rejectedUid]});
  assert.equal(replaced.players[0].hand.length,opening.players[0].hand.length);
  assert.equal(replaced.players[0].deck.length,opening.players[0].deck.length);
  assert.ok(!replaced.players[0].hand.some(card=>card.uid===rejectedUid));
  assert.ok(opening.players[0].hand.filter(card=>card.uid!==rejectedUid).every(card=>replaced.players[0].hand.some(next=>next.uid===card.uid)), 'Only chosen cards are replaced');
  assert.throws(()=>applyAction(replaced,{type:'mulligan',uids:[]}), 'The opening choice cannot repeat');
  assert.equal(mulliganAvailable(createLabGame('builder',false,2718)),false,'Seeded training encounters keep their established rules');
  const initial = createLabGame();
  const session = new GameSession(initial);
  const before = JSON.stringify(initial);
  const action = session.legal().find(a => a.type === 'attack');
  assert.ok(action, 'The seeded encounter must offer an attack');
  const batch = session.dispatch(action)!;
  assert.equal(videoCues(batch)[0]?.anchor, action.target === 'hero' ? `hero-${1-initial.turn}` : action.target, 'Impact accent must follow the legal target');
  assert.deepEqual(session.snapshot().state, applyAction(initial, action));
  assert.equal(JSON.stringify(initial), before, 'Rules must preserve the previous snapshot');
  assert.equal(session.snapshot().shown, initial, 'Display waits until contact');
  assert.equal(session.dispatch({ type: 'end-turn' }), null, 'Input locks during a presentation');
  session.impact(batch.id);
  assert.equal(session.snapshot().shown, batch.after);
  assert.equal(session.snapshot().busy, true);
  session.complete(batch.id);
  assert.equal(session.snapshot().busy, false);

  const interrupted = session.dispatch({ type: 'end-turn' })!;
  const replacement = createLabGame('whale', true, 42);
  session.restart(replacement);
  const next = session.dispatch(session.legal()[0])!;
  session.impact(interrupted.id); session.complete(interrupted.id);
  assert.equal(session.snapshot().state, next.after);
  assert.equal(session.snapshot().shown, replacement, 'Stale callbacks cannot change a restarted match');
  assert.equal(session.snapshot().busy, true);
  session.complete(next.id);
  const stable = session.snapshot();
  assert.throws(() => session.dispatch({ type: 'play-minion', uid: 'missing-card' }));
  assert.deepEqual(session.snapshot(), stable, 'Invalid actions cannot mutate the session');

  // Compare whole matches with the existing engine across every hero, not mocked cards.
  for (const hero of ['builder', 'degen', 'whale', 'validator']) {
    let state = createLabGame(hero, true, 42);
    const game = new GameSession(state);
    let checkedPower=false;
    for (let i = 0; i < 3000 && state.winner === null; i++) {
      const choice = chooseAiAction(state);
      state = applyAction(state, choice);
      const presentation = game.dispatch(choice)!;
      if(choice.type==='hero-power'){
        const id=videoCues(presentation)[0]?.id;
        const expected={'heal-treasury':'02-builder-heal','damage-random-enemy':'03-whale-impact','draw-burn':'04-degen-draw','gain-gas':'05-validator-gas'}[HEROES[presentation.before.players[presentation.before.turn].heroId].power];
        if(presentation.after.winner===null)assert.equal(id,expected,'Hero accents must follow actual ownership and power semantics');
        checkedPower ||= presentation.before.players[presentation.before.turn].heroId === hero;
        const native=abilityCues(presentation)[0];
        assert.ok(native,'Every real hero power must have a native accent even without a video');
        if(HEROES[presentation.before.players[presentation.before.turn].heroId].power==='gain-gas')assert.equal(native.to,presentation.before.turn===0?'gas-counter':'hero-1');
        if(HEROES[presentation.before.players[presentation.before.turn].heroId].power==='heal-treasury')assert.equal(native.to,`hero-${presentation.before.turn}`);
      }
      assert.deepEqual(game.snapshot().state, state);
      game.impact(presentation.id); game.complete(presentation.id);
      assert.deepEqual(game.snapshot().shown, state);
    }
    assert.notEqual(state.winner, null, `${hero}: match must finish`);
    assert.ok(checkedPower,`${hero}: verify at least one real power`);
  }

  const clock = new PresentationScheduler();
  const callbacks: string[] = [];
  const task = clock.play(100, .5, () => {}, () => callbacks.push('impact'), () => callbacks.push('finish'));
  clock.tick(49); assert.deepEqual([...callbacks], []);
  clock.tick(1); clock.tick(5); assert.deepEqual([...callbacks], ['impact']);
  clock.tick(1000); await task;
  assert.deepEqual([...callbacks], ['impact', 'finish']); assert.equal(clock.active, false);
  const cancel = clock.play(100, .5, () => {}, () => callbacks.push('stale-impact'), () => callbacks.push('stale-finish'));
  clock.tick(20); clock.cancel(); clock.tick(1000); await cancel;
  assert.deepEqual([...callbacks], ['impact', 'finish']);
  const atImpact = clock.play(100, .5, () => {}, () => clock.cancel(), () => callbacks.push('stale-finish'));
  clock.tick(100); await atImpact; assert.equal(clock.active, false);
  const atUpdate = clock.play(100, .5, p => { if (p > 0) clock.cancel(); }, () => callbacks.push('stale-impact'), () => callbacks.push('stale-finish'));
  clock.tick(100); await atUpdate;
  assert.deepEqual([...callbacks], ['impact', 'finish'], 'Cancellation must invalidate every phase');
  const pausedCallbacks:string[]=[], progress:number[]=[];
  const pausedTask=clock.play(100,.5,p=>progress.push(p),()=>pausedCallbacks.push('impact'),()=>pausedCallbacks.push('finish'));
  clock.tick(30);clock.setPaused(true);clock.tick(10_000);
  assert.equal(clock.active,true);assert.equal(clock.paused,true);
  assert.equal(progress.at(-1),.3);assert.deepEqual([...pausedCallbacks],[],'Pause must stop movement, contact and completion');
  clock.setPaused(false);clock.tick(19);assert.deepEqual([...pausedCallbacks],[]);
  clock.tick(1);assert.deepEqual([...pausedCallbacks],['impact'],'Resume retains the remaining time without replaying contact');
  clock.tick(50);await pausedTask;assert.deepEqual([...pausedCallbacks],['impact','finish']);
  const cancelledWhilePaused=clock.play(100,.5,()=>{},()=>pausedCallbacks.push('stale-impact'),()=>pausedCallbacks.push('stale-finish'));
  clock.tick(20);clock.setPaused(true);clock.cancel();await cancelledWhilePaused;
  clock.setPaused(false);clock.tick(1000);
  assert.deepEqual([...pausedCallbacks],['impact','finish'],'Restart during pause cannot deliver old callbacks');
  assert.equal(attackTravel(0),0);
  assert.equal(attackTravel(MOTION.attack.contact),1,'The card must contact its target with the damage/sound phase');
  assert.equal(attackTravel(1),0,'An attack must finish at its original position');
  for(const contact of [.42,.62,.8]){
    assert.equal(deathProgress(contact-.01,contact),0,'A doomed fighter must remain intact until the actual contact, including long queues');
    assert.equal(deathProgress(contact,contact),0,'Contact applies the result before the death departure');
    assert.ok(deathProgress((1+contact)/2,contact)>0,'Death departure must follow contact');
    assert.equal(deathProgress(1,contact),1,'The death departure must finish with the batch');
    assert.ok(accentProgress(contact-.01,contact,'after',.9)<0,'A delayed accent cannot begin before contact');
    const delayed=accentProgress(contact+(1-contact)*.8,contact,'after',.9);
    assert.ok(delayed>0&&delayed<1,'Even a late counter in a long queue must have a visible phase');
    assert.ok(Math.abs(accentProgress(1,contact,'after',.9)-1)<.00001);
  }
  const runSettle=(step:number)=>{let value=0;for(let elapsed=0;elapsed<210;elapsed+=step)value=settle(value,1,Math.min(step,210-elapsed),MOTION.hoverMs);return value;};
  assert.ok(Math.abs(runSettle(7)-runSettle(30))<.00001,'Hover motion must be independent of frame rate');
  assert.equal(settle(0,1,1000,MOTION.hoverMs),1,'A stalled frame must catch up rather than stretch the animation');
  console.log('PRESENTATION OK: four complete engine-equivalent matches; starting-hand replacement, contact timing, pause/resume, input locking, invalid actions and restart/cancellation verified.');
}
void main();
