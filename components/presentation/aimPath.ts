export type AimPoint={x:number;y:number;z:number};
/** Arena XY coordinates, negative Z toward the orthographic camera. */
export function aimPath(from:AimPoint,to:AimPoint,sourceInset:number,targetInset:number,headLength:number){
  const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);
  if(!Number.isFinite(length)||length<=(sourceInset+targetInset)/50+.06)return null;
  const ux=dx/length,uy=dy/length,a={x:from.x+ux*sourceInset/50,y:from.y+uy*sourceInset/50,z:-6},b={x:to.x-ux*targetInset/50,y:to.y-uy*targetInset/50,z:-6};
  const lane=Math.hypot(b.x-a.x,b.y-a.y),bend=Math.min(1.25,lane*.2);
  const control={x:(a.x+b.x)/2-uy*bend,y:(a.y+b.y)/2+ux*bend,z:-6-Math.min(2,lane*.3)};
  return {a,b,control,lane,head:Math.max(.08,headLength/50)};
}
