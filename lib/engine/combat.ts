/** Defenders retaliate for half their current attack, rounded up; zero stays zero. */
export function retaliationDamage(attack: number): number {
  return Math.ceil(Math.max(0, attack) / 2);
}
