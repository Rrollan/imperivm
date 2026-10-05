/** Art revisions preserve card IDs, rules and the original asset files. */
const renewed = new Set(['dogen', 'pepito', 'fud-hydra']);

export function cardArtPath(id: string): string {
  return `/cards/${renewed.has(id) ? 'renewed/' : ''}${id}.webp`;
}
