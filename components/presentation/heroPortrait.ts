export function heroPortraitPath(id:string){
  if(id==='builder')return '/ui/arena-lab/native/builder-medallion-front.webp';
  return id==='whale'?'/models/hero-whale.webp':`/heroes/${id}.webp`;
}
