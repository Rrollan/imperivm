/** Fit the interactive table to its host, including iDos' 1280px iframe.
 * Short landscape hosts use the whole width; only the painted scenery is
 * compressed vertically. Cards and medallions retain their proportions. */
export function arenaViewport(width:number,height:number){
  const aspect=Math.max(1,width)/Math.max(1,height);
  const portrait=aspect<1.1;
  const compact=!portrait&&height<=540&&aspect>=1.65;
  const halfHeight=portrait?Math.max(12.6,9/aspect):compact?16/aspect:Math.max(10,16/aspect);
  return {portrait,compact,halfHeight,halfWidth:halfHeight*aspect,yScale:compact?halfHeight/10:1};
}
