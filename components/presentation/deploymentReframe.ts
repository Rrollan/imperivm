import {CARD_FACE,BATTLE_FACE} from './cardFace';

/** Shorten the artwork aperture, never stretch the illustration or lettering.
 * The matching face/backing height makes every painted pixel square in world
 * space throughout flight, and both dimensions meet the court at contact. */
export function deploymentReframe(progress:number,targetHeight=BATTLE_FACE.height){
  const t=Math.max(0,Math.min(1,(progress-.25)/.75)),e=t*t*(3-2*t);
  const height=CARD_FACE.height+(targetHeight-CARD_FACE.height)*e;
  return {height,planeY:height/CARD_FACE.height};
}
