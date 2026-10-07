/** IMPERIVM's authored motion targets; these are not measured Hearthstone timings. */
export const MOTION = {
  attack: { duration: 460, contact: .42 },
  play: { duration: 440, contact: .62 },
  enemyPlay: { duration: 1050, contact: .78 },
  legendaryPlay: { duration: 1550, contact: .84 },
  drawMs: 700,
  power: { duration: 500, contact: .36 },
  turn: { duration: 480, contact: .40 },
  hoverMs: 70,
  gasMs: 90,
  arrivalFadeMs: 110,
} as const;

export const smooth = (t: number) => { const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x); };
/** A public opponent play approaches, holds for recognition, then lands once. */
export function publicPlayPhase(progress:number){
  const t=Math.max(0,Math.min(1,progress));
  if(t<.22)return {approach:smooth(t/.22),landing:0};
  if(t<.77)return {approach:1,landing:0};
  return {approach:1,landing:smooth((t-.77)/.23)};
}

/** Face recognition happens before settling into the hand, with an exact endpoint. */
export function drawPhase(progress:number){
  const t=Math.max(0,Math.min(1,progress));
  return {approach:smooth(t/.38),landing:smooth((t-.58)/.42),flip:smooth((t-.16)/.22)};
}
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

/** Stagger within a phase, so long queues cannot push an accent past completion. */
export function accentProgress(progress:number,contact:number,phase:'contact'|'after',delay:number){
  const phaseTime=phase==='after'?(progress-contact)/Math.max(.001,1-contact):progress/Math.max(.001,contact);
  const stagger=Math.min(.6,Math.max(0,delay));
  return (phaseTime-stagger)/(1-stagger);
}
