import type {FighterBounds} from './deploymentGeometry';

export const LEGENDARY_CONTACT_MS=1500;
/** A finite marble scar and a damped, sub-three-pixel camera impulse.
 * Coordinates are table units, so phone/iframe layouts keep the same contact. */
export function legendaryContact(elapsed:number,bounds:FighterBounds,reduced=false){
  const age=Math.max(0,elapsed),t=Math.min(1,age/320),envelope=(1-t)**2;
  const visible=age<LEGENDARY_CONTACT_MS&&!reduced;
  return {
    x:visible?.055*Math.sin(age*.064)*envelope:0,
    y:visible?.036*Math.sin(age*.081)*envelope:0,
    opacity:visible?Math.min(1,age/65)*Math.min(1,(LEGENDARY_CONTACT_MS-age)/650)*.78:0,
    width:Math.min(bounds.width*2.05,bounds.spacing*1.85),
    height:bounds.height*1.56,
  };
}
