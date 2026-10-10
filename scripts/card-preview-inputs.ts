import {CARDS} from '../lib/cards';
import {cardArtPath,cardPreviewArtPath} from '../lib/cardArt';

console.log(JSON.stringify([
  ...Object.keys(CARDS).map(id=>({id,source:`public${cardArtPath(id)}`,output:`public${cardPreviewArtPath(id)}`,max:[384,576]})),
  ...['common','rare','epic','legendary'].map(id=>({id:`frame-${id}`,source:`public/ui/cards/rarity-v1/${id}.png`,output:`public/ui/cards/preview-v1/frames/${id}.webp`,max:[768,1344]})),
]));
