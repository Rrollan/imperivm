import {CARDS} from '../../lib/cards';
import {isInstantSpell} from '../../lib/engine/spellTiming';
import type {Locale} from '../../lib/locale';
import roles from './cardRoles.json';

export type CardRole='legionary'|'guard'|'commander'|'minister'|'priest'|'engineer'|'edict';
export const ROLE_LABELS:Record<CardRole,[string,string]>={legionary:['Легионер','Legionary'],guard:['Страж','Guardian'],commander:['Предводитель','Commander'],minister:['Военный министр','War minister'],priest:['Жрец','Priest'],engineer:['Инженер','Engineer'],edict:['Указ','Edict']};
export const ROLE_COLORS:Record<CardRole,string>={legionary:'#e6ad64',guard:'#a9cbd8',commander:'#ef8869',minister:'#ccb0e1',priest:'#99dbc8',engineer:'#71cdd4',edict:'#dcb981'};
const ranks={common:1,rare:2,epic:3,legendary:4} as const;
export function cardIdentity(id:string){
  const card=CARDS[id];
  const role=(roles as Record<string,CardRole>)[id]??(card.type==='spell'?'edict':'legionary');
  return {role,rank:ranks[card.rarity],color:ROLE_COLORS[role]};
}
export function roleName(id:string,locale:Locale){if(isInstantSpell(CARDS[id]))return locale==='ru'?'Мгновенное заклинание':'Instant spell';return ROLE_LABELS[cardIdentity(id).role][locale==='ru'?0:1];}
export function rankName(id:string,locale:Locale){
  const rarity={common:['обычная','common'],rare:['редкая','rare'],epic:['эпическая','epic'],legendary:['легендарная','legendary']}[CARDS[id].rarity][locale==='ru'?0:1];
  return `${locale==='ru'?'Редкость':'Rarity'}: ${rarity} (${['','I','II','III','IV'][cardIdentity(id).rank]})`;
}
