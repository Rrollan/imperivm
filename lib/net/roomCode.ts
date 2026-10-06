/** Shared by the browser lobby and the Node room authority. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function createRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, value => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
}
export function normalizeRoomCode(code: string): string {return code.trim().toUpperCase();}
export function validRoomCode(code: string): boolean {return /^[A-Z0-9]{6}$/.test(normalizeRoomCode(code));}
