/** Art revisions preserve card IDs, rules and the original asset files. */
import { CHARACTER_CARD_ART } from './characterCards';

const renewed = new Set(['dogen', 'pepito', 'fud-hydra']);

export function cardArtPath(id: string): string {
  // Keep each directory explicit: static packaging must discover the renewed
  // portraits as well as the original cards, including dynamically selected IDs.
  return CHARACTER_CARD_ART[id] ?? (renewed.has(id) ? `/cards/renewed/${id}.webp` : `/cards/${id}.webp`);
}
