import {mempoolOf} from '../../lib/engine/engine';
import type {GameState} from '../../lib/engine/types';

/** One public placement contract for cards, flights and hidden-stack feedback. */
export function queueSlot(owner:number,portrait:boolean,index=0){
  const x=portrait?430:230,y=portrait?(owner===0?620:400):(owner===0?640:456);
  if(index>=3)return {x,y:y+89,overflow:true};
  return {x:x+index*7,y:y-index*7,overflow:false};
}
export const QUEUED_CARD={width:90,height:157.5};
export function queueAnchor(uid:string,states:GameState[],portrait:boolean){
  for(const state of states)for(const owner of [0,1] as const){
    const index=mempoolOf(state,owner).findIndex(entry=>`queued-${entry.uid}`===uid);
    if(index>=0)return queueSlot(owner,portrait,index);
  }
}
