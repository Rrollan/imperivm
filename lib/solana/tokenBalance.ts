function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid token account.');
  return value as Record<string, unknown>;
}
export function tokenBalance(entries: readonly unknown[], owner: string, mint: string): string {
  let total = BigInt(0), decimals: number | null = null;
  for (const entry of entries) {
    const info = object(object(entry).info), amount = object(info.tokenAmount);
    if (info.owner !== owner || info.mint !== mint || typeof amount.amount !== 'string' || !/^\d{1,20}$/.test(amount.amount) || typeof amount.decimals !== 'number' || !Number.isInteger(amount.decimals) || amount.decimals < 0 || amount.decimals > 18) throw new Error('Invalid token account.');
    if (decimals !== null && decimals !== amount.decimals) throw new Error('Inconsistent token decimals.');
    decimals = amount.decimals; total += BigInt(amount.amount);
  }
  if (!decimals) return total.toString();
  const digits = total.toString().padStart(decimals + 1, '0'), fraction = digits.slice(-decimals).replace(/0+$/, '');
  return `${digits.slice(0, -decimals)}${fraction ? `.${fraction}` : ''}`;
}

/** Base58 public key must decode to exactly 32 bytes. No network or SDK required. */
export function validSolanaAddress(value: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)) return false;
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let number = BigInt(0);
  for (const character of value) number = number * BigInt(58) + BigInt(alphabet.indexOf(character));
  let bytes = 0;
  for (let n = number; n > 0; n >>= BigInt(8)) bytes++;
  return bytes + (value.match(/^1+/)?.[0].length ?? 0) === 32;
}
