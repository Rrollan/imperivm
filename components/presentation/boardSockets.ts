/** Measured inner velvet apertures. The landscape bitmap is 1586×992,
 * stretched onto a 1600×1000 plane; use that same projection for every inlay. */
const landscape = (x:number,y:number,width:number,height:number) => ({
  x:x*1600/1586,y:y*1000/992,width:width*1600/1586,height:height*1000/992,
});
export function rulerSocket(owner:number,portrait:boolean){
  if(portrait)return owner===0?{x:796,y:774,width:137,height:136}:{x:794,y:25,width:130,height:127};
  return owner===0?landscape(792,679,146,130):landscape(792,142,129,105);
}
export function turnSocket(portrait:boolean){
  return portrait?{x:1138.4,y:628.25,width:178.2,height:67.5}:landscape(1425.5,456.5,189,75);
}
/** Inner wooden aperture vertices, measured in landscape source pixels.
 * The slight skew follows the painted board perspective rather than a generic octagon. */
export const TURN_INLAY_OUTLINE = [[22/189,0],[163/189,0],[180/189,12/75],[1,60/75],[175/189,1],[22/189,1],[7/189,62/75],[0,21/75]] as const;
export const PORTRAIT_TURN_INLAY_OUTLINE = [[13/198,0],[185/198,0],[1,10/75],[1,64/75],[185/198,1],[13/198,1],[0,64/75],[0,10/75]] as const;
export function powerSocket(portrait:boolean){
  return portrait?{x:960,y:792,width:84,height:84}:landscape(970,698,79,73);
}
export function edictRegister(portrait:boolean){
  return portrait?{x:423,y:175,width:140,height:70}:{x:230,y:313,width:154,height:77};
}
