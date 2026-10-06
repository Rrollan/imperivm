/** Artwork coordinates shared by settled pieces, flights and effect anchors. */
export function fighterRow(count:number,owner:number,portrait:boolean){
  return {
    center:portrait?785:800,
    y:owner===0?(portrait?460:535):(portrait?260:335),
    spacing:Math.min(portrait?124:150,(portrait?640:980)/Math.max(1,count)),
    width:portrait?100:145,
    height:portrait?135:196,
  };
}
