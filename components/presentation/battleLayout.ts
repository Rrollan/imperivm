/** Artwork coordinates shared by settled pieces, flights and effect anchors. */
export function fighterRow(count:number,owner:number,portrait:boolean,compact=false){
  const width=compact?(count>=7?104:120):portrait?(count>=7?84:count>=5?96:104):102;
  return {
    center:portrait?805:800,
    y:owner===0?(compact?465:portrait?460:515):(compact?295:portrait?240:315),
    spacing:Math.min(portrait?124:150,(portrait?620:980)/Math.max(1,count)),
    width,
    height:compact?width:width*7/4,
  };
}
