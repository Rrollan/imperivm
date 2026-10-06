/** Artwork coordinates shared by settled pieces, flights and effect anchors. */
export function fighterRow(count:number,owner:number,portrait:boolean){
  const width=portrait?(count>=7?84:count>=5?96:104):102;
  return {
    center:portrait?805:800,
    y:owner===0?(portrait?460:515):(portrait?240:315),
    spacing:Math.min(portrait?124:150,(portrait?620:980)/Math.max(1,count)),
    width,
    height:width*7/4,
  };
}
