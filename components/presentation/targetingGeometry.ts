/** Distance to a piece's visible edge along a target ray, in board pixels. */
export function targetingEdge(dx:number,dy:number,width:number,height:number,oval=false){
  const length=Math.hypot(dx,dy);if(!length)return 0;
  const x=Math.abs(dx/length),y=Math.abs(dy/length),rx=width/2,ry=height/2;
  return oval?1/Math.sqrt((x/rx)**2+(y/ry)**2):Math.min(x?rx/x:Infinity,y?ry/y:Infinity);
}

/** Short lanes use a smaller lance head instead of drawing across either face. */
export function targetingInsets(distance:number,sourceEdge:number,targetEdge=0){
  const lane=Math.max(0,distance-sourceEdge-targetEdge),padding=Math.min(8,lane*.1),headLength=Math.min(28,Math.max(4,lane*.28));
  return {sourceInset:sourceEdge+padding,targetInset:targetEdge+padding+headLength,headLength};
}
