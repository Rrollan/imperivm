/** DOM-free collectible access shared with both match authorities. */
import {FREE_HERO_IDS,CASE_HERO_IDS} from '../heroes';
export const rulerCollectible=(hero:string)=>`ruler-${hero}`;
export function cleanHeroes(value:unknown):string[]{return [...FREE_HERO_IDS,...(Array.isArray(value)?CASE_HERO_IDS.filter(id=>value.includes(id)):[])];}
export function heroesFromCollectibles(value:unknown):string[]{const owned=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};return [...FREE_HERO_IDS,...CASE_HERO_IDS.filter(id=>typeof owned[rulerCollectible(id)]==='number'&&Number.isSafeInteger(owned[rulerCollectible(id)])&&(owned[rulerCollectible(id)] as number)>0)];}
