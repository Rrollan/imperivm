import {CARDS} from '../lib/cards';

/** Keep ordered queue/counter regression coverage after live tactical cards
 * become instant. These temporary definitions never enter production decks. */
export function installDelayedSpellFixtures(ids:string[]):()=>void {
  const keys=ids.map(id=>`delayed-fixture-${id}`);
  ids.forEach((id,index)=>{CARDS[keys[index]]={...CARDS[id],id:keys[index]};});
  return ()=>keys.forEach(id=>delete CARDS[id]);
}
