import {CARDS} from './cards';
import {DECKS} from './decks';
import {deckCardCounts} from './collection/access';

export function deckCounts(ids: readonly string[]) {
  const counts: Record<string,number> = {};
  for (const id of ids) counts[id]=(counts[id]??0)+1;
  return counts;
}
export function costCurve(ids: readonly string[]) {
  const bins = Array<number>(8).fill(0);
  for (const id of ids) if (Object.hasOwn(CARDS,id)) bins[Math.min(7,CARDS[id].cost)]++;
  return bins;
}
/** A full-deck replacement is atomic and respects the current ownership/copy cap. */
export function replaceDeckCard(ids:readonly string[],removeId:string,addId:string,limits:Record<string,number>){
  const index=ids.lastIndexOf(removeId);if(ids.length!==30||index<0||!Object.hasOwn(CARDS,addId))return null;
  const count=ids.filter(id=>id===addId).length-(removeId===addId?1:0);
  if(count>=(limits[addId]??0))return null;
  const next=[...ids];next[index]=addId;return next;
}
/** Transparent recipe/curve helper, not a win-rate or meta prediction. Preserves legal chosen cards. */
export function completeOwnedDeck(ids: readonly string[], hero: string, owned: Record<string,number>) {
  const limits=deckCardCounts(owned), result:string[]=[], counts:Record<string,number>={};
  for(const id of ids){if(result.length===30)break;if(Object.hasOwn(CARDS,id)&&(counts[id]??0)<(limits[id]??0)){result.push(id);counts[id]=(counts[id]??0)+1;}}
  const recipe=deckCounts(DECKS[hero]??[]), target=[1,4,6,6,5,4,2,2];
  while(result.length<30){
    const curve=costCurve(result), candidates=Object.values(CARDS).filter(c=>(counts[c.id]??0)<(limits[c.id]??0));
    const score=(id:string)=>{const c=CARDS[id], bucket=Math.min(7,c.cost);return ((recipe[id]??0)>(counts[id]??0)?6:0)+(target[bucket]-curve[bucket])*2;};
    candidates.sort((a,b)=>score(b.id)-score(a.id)||a.cost-b.cost||a.id.localeCompare(b.id));
    const chosen=candidates[0];if(!chosen)break;result.push(chosen.id);counts[chosen.id]=(counts[chosen.id]??0)+1;
  }
  return result;
}
