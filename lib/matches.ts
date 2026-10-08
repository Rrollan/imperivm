import { HEROES } from './heroes';
import type { MatchStats } from './ui/matchStats';
import { validPlayProof, type PlayProof } from './solana/proof';
export const MATCHES_KEY = 'imperivm.matches.v1';
export interface MatchRecord { id: string; owner: string; heroId: string; won: boolean; draw: boolean; blocks: number; playedAt: string; stats: MatchStats; exhibition: boolean; proofSignature?: string; proof?: PlayProof; }
let memory: MatchRecord[] = [];
export function readMatches(): MatchRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MATCHES_KEY) || '[]');
    if (Array.isArray(parsed)) memory = parsed.filter((entry): entry is MatchRecord => {
      const e = entry as Partial<MatchRecord> | null;
      return !!e && typeof e.id === 'string' && e.id.length <= 80 && typeof e.owner === 'string' && e.owner.length <= 60 &&
        typeof e.heroId === 'string' && Object.hasOwn(HEROES, e.heroId) && typeof e.won === 'boolean' && typeof e.exhibition === 'boolean' &&
        Number.isSafeInteger(e.blocks) && typeof e.playedAt === 'string' && !!e.stats && Object.values(e.stats).every(v => Number.isFinite(v) && v >= 0);
    }).slice(0, 200);
  } catch { /* memory fallback */ }
  return structuredClone(memory);
}
export function saveMatch(record: MatchRecord): void {
  memory = [record, ...readMatches().filter(m => m.id !== record.id)].slice(0, 200);
  try { localStorage.setItem(MATCHES_KEY, JSON.stringify(memory)); } catch { /* memory fallback */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('imperivm:matches'));
}
export function winsFor(owner: string) { return readMatches().filter(m => m.owner === owner && m.won && !m.exhibition && validPlayProof(m.proof, m)).length; }
export function localLeaderboard() {
  const rows = new Map<string, { owner: string; wins: number; games: number }>();
  for (const match of readMatches().filter(m => !m.exhibition)) {
    const row = rows.get(match.owner) ?? { owner: match.owner, wins: 0, games: 0 };
    row.games++; if (match.won) row.wins++; rows.set(match.owner, row);
  }
  return Array.from(rows.values()).sort((a, b) => b.wins - a.wins || a.games - b.games);
}
