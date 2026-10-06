/** IMPERIVM's authored motion targets; these are not measured Hearthstone timings. */
export const MOTION = {
  attack: { duration: 460, contact: .42 },
  play: { duration: 440, contact: .62 },
  power: { duration: 500, contact: .36 },
  turn: { duration: 480, contact: .40 },
  hoverMs: 70,
  gasMs: 90,
  arrivalFadeMs: 110,
} as const;

export const smooth = (t: number) => { const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x); };
/** Exponential settling is stable at different frame rates and after a slow frame. */
export function settle(current: number, target: number, delta: number, timeConstant: number) {
  const next=target+(current-target)*Math.exp(-Math.max(0,delta)/timeConstant);
  return Math.abs(next-target)<.002?target:next;
}
export function attackTravel(progress: number) {
  if(progress<=0)return 0;
  if(progress<.10)return -.035*smooth(progress/.10);
  if(progress<MOTION.attack.contact)return -.035+1.035*smooth((progress-.10)/(MOTION.attack.contact-.10));
  if(progress<.48)return 1;
  return 1-smooth((progress-.48)/.52);
}

/** A long spell queue can move contact beyond halfway through the action. */
export function deathProgress(progress:number,contact:number){
  const after=(progress-contact)/Math.max(.001,1-contact);
  return smooth((after-.12)/.88);
}
