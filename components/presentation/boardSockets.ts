/** Native artwork apertures, in the same 1600×1000 scene coordinates as the board. */
export function rulerSocket(owner:number,portrait:boolean){
  if(portrait)return owner===0?{x:796,y:774,width:137,height:136}:{x:794,y:25,width:130,height:127};
  return owner===0?{x:801,y:687,width:137,height:133}:{x:800,y:147,width:122,height:119};
}
export function turnSocket(portrait:boolean){
  return portrait?{x:1138,y:631,width:177,height:70}:{x:1442,y:463,width:171,height:68};
}
export function edictRegister(portrait:boolean){
  return portrait?{x:423,y:175,width:140,height:70}:{x:230,y:313,width:154,height:77};
}
