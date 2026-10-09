import assert from 'node:assert/strict';
import {CARD_FACE,BATTLE_FACE,CARD_FRAME_LAYOUT,cardFaceLayout} from '../../components/presentation/cardFace';
import {fighterRow} from '../../components/presentation/battleLayout';
import {rulerSocket} from '../../components/presentation/boardSockets';
import {arenaViewport} from '../../components/presentation/arenaViewport';
import {pixelRatio,RENDER_PIXEL_BUDGET} from '../../components/presentation/renderQuality';
import type {Rarity} from '../../lib/engine/types';

for(const rarity of Object.keys(CARD_FRAME_LAYOUT) as Rarity[]){
  const hand=cardFaceLayout(rarity),court=cardFaceLayout(rarity,true);
  assert.deepEqual(hand,CARD_FRAME_LAYOUT[rarity],'Hand/inspection keep the measured original painting');
  assert.equal(court.art.y,hand.art.y,'The rarity gem and cost socket never move');
  assert.equal(court.art.w,hand.art.w,'Portraits and panel lettering are never squeezed horizontally');
  assert.equal(court.statsY-court.nameY,hand.statsY-hand.nameY,'Shortening preserves both engraved panels');
  for(const [layout,height] of [[hand,CARD_FACE.height],[court,BATTLE_FACE.height]] as const){
    assert(layout.art.h>0&&layout.art.y+layout.art.h<layout.nameY-36,'Art must stop before the entire nameplate');
    assert(layout.nameY+36<layout.statsY-37,'Two-line names must clear the stat circles');
    assert(layout.statsY+37<height,'Stat circles must stay inside the face');
  }
}
for(const [w,h] of [[1280,800],[1280,720],[1440,900],[844,390],[932,430]]){
  const v=arenaViewport(w,h);
  for(let count=1;count<=9;count++){
    const own=fighterRow(count,0,v.portrait,v.compact),enemy=fighterRow(count,1,v.portrait,v.compact);
    assert(own.spacing>=own.width,'Even an expanded formation cannot cover a neighbouring portrait');
    assert(own.y*v.yScale-own.height/2>enemy.y*v.yScale+enemy.height/2,'Opposing rows never cover each other in the actual camera projection');
    if(!v.compact){
      const upper=rulerSocket(1,false),lower=rulerSocket(0,false);
      assert(enemy.y-enemy.height/2>upper.y+upper.height/2+4);
      assert(own.y+own.height/2<lower.y-lower.height/2-4);
      if(count<=5)assert(38*own.width/384*w/(v.halfWidth*100)>=10.2,'Ordinary battlefield names stay above the former 7–9px size at the iframe limit');
    }
  }
}
for(const [w,h] of [[1280,800],[1440,900],[844,390]])assert.equal(pixelRatio(w,h,2,'auto'),2,'Typical Retina hosts keep their native backing resolution');
for(const quality of ['auto','sharp'] as const)for(const [w,h] of [[1920,1080],[2560,1440]]){
  assert(w*h*pixelRatio(w,h,3,quality)**2<=Math.max(w*h,RENDER_PIXEL_BUDGET[quality])+1,'Large hosts retain a finite GPU pixel budget');
}
assert.equal(pixelRatio(1440,900,2,'fast'),1,'Performance mode remains available');
console.log('ARENA LEGIBILITY OK: all rarity apertures, name/stat separation, nine-piece formations, ruler clearance, iframe captions, mobile camera projection and bounded Retina resolution.');
