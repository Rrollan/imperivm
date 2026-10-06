import {mempoolOf} from '../../lib/engine/engine';
import type {GameState} from '../../lib/engine/types';

/** One public placement contract for cards, flights and hidden-stack feedback. */
export function queueSlot(owner:number,portrait:boolean,index=0){
  const x=portrait?443:230,y=portrait?(owner===0?620:400):(owner===0?525:339);
  if(index>=3)return {x:x+53,y:y+89,overflow:true};
  return {x:x+index*7,y:y-index*7,overflow:false};
}
export function queueAnchor(uid:string,states:GameState[],portrait:boolean){
  for(const state of states)for(const owner of [0,1] as const){
    const index=mempoolOf(state,owner).findIndex(entry=>`queued-${entry.uid}`===uid);
    if(index>=0)return queueSlot(owner,portrait,index);
  }
}
