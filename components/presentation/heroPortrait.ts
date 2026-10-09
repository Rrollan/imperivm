export function heroPortraitPath(id:string){
  if(['strategist','athena','hermes','hephaestus','poseidon'].includes(id))return `/ui/heroes/rulers-v2/${id}.webp`;
  return `/ui/arena-lab/native/${id}-medallion-front.webp`;
}
