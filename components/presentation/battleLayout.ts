import {BATTLE_FACE} from './cardFace';

/** Artwork coordinates shared by settled pieces, flights and effect anchors. */
export function fighterRow(count:number,owner:number,portrait:boolean,compact=false){
  const width=compact?(count>=7?104:120):portrait?(count>=7?84:count>=5?96:104):count>=8?100:count>=7?132:144;
  return {
    center:portrait?805:800,
    y:owner===0?(compact?465:portrait?460:514):(compact?295:portrait?240:301),
    spacing:Math.min(portrait?124:compact?150:170,(portrait?620:980)/Math.max(1,count)),
    width,
    height:compact?width:width/BATTLE_FACE.ratio,
  };
}
