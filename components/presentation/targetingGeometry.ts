/** Distance to a piece's visible edge along a target ray, in board pixels. */
export function targetingEdge(dx:number,dy:number,width:number,height:number,oval=false){
  const length=Math.hypot(dx,dy);if(!length)return 0;
  const x=Math.abs(dx/length),y=Math.abs(dy/length),rx=width/2,ry=height/2;
  return oval?1/Math.sqrt((x/rx)**2+(y/ry)**2):Math.min(x?rx/x:Infinity,y?ry/y:Infinity);
}

/** Launch from the upper part of the attacker, with the tip outside the enemy.
 * Reserving the head twice used to leave only a few pixels between close rows. */
export function targetingInsets(distance:number,sourceEdge:number,targetEdge=0){
  const gap=Math.max(0,distance-sourceEdge-targetEdge),padding=Math.min(5,gap*.08);
  const sourceInset=sourceEdge*.48+padding,targetInset=targetEdge+padding;
  const lane=Math.max(0,distance-sourceInset-targetInset),headLength=Math.min(44,Math.max(36,lane*.32));
  return {sourceInset,targetInset,headLength};
}
