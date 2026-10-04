type IconKind = 'sleep' | 'priority' | 'attack' | 'health' | 'chain';

/** Battle symbols share a metal color and a two-pixel outline. */
export default function BattleIcon({ kind }: { kind: IconKind }) {
  const paths: Record<IconKind, string> = {
    sleep: 'M2 15h5l-5 6h5 M9 9h5l-5 6h5 M16 3h6l-6 6h6',
    priority: 'M13 2 4 14h7l-1 8 10-13h-7Z',
    attack: 'M19 3 21 5 10 16 7 13ZM5 11l8 8M8 16l-5 5M2 19l3 3',
    health: 'M12 21 3 12C-2 5 7 1 12 7c5-6 14-2 9 5Z',
    chain: 'M9 15l6-6M8 12l-2 2a4 4 0 0 0 6 6l3-3a4 4 0 0 0 0-6M16 12l2-2a4 4 0 0 0-6-6L9 7a4 4 0 0 0 0 6',
  };
  return <svg className="battle-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#b8b8c8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
}
