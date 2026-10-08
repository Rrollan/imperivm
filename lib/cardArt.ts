/** Art revisions preserve card IDs, rules and the original asset files. */
import { CHARACTER_CARD_ART } from './characterCards';

const renewed = new Set(['dogen', 'pepito', 'fud-hydra']);

export function cardArtPath(id: string): string {
  return CHARACTER_CARD_ART[id] ?? `/cards/${renewed.has(id) ? 'renewed/' : ''}${id}.webp`;
}
