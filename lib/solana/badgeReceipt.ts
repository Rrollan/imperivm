import type { StoragePort } from '../collection/gateway';
export function readPendingBadge(storage: StoragePort, owner: string): string | null {
  try {
    const value = storage.getItem(`imperivm.badge.pending.${owner}`);
    return value && /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(value) ? value : null;
  } catch { return null; }
}
export function savePendingBadge(owner: string, signature: string | null): void {
  try {
    const key = `imperivm.badge.pending.${owner}`;
    if (signature) localStorage.setItem(key, signature); else localStorage.removeItem(key);
  } catch { /* The visible recovery receipt still works in memory. */ }
}
