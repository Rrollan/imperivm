/** Presentation-only classification of the SDK's wallet refresh fallback.
 * This never authenticates an owner or discards credentials: a temporary refresh
 * failure can produce the same fallback message as a missing/expired token. */
export function requiresWalletReauthentication(message: string | null | undefined): boolean {
  return typeof message === 'string' && /Cannot auto-login: last session used ["']Wallet["']/.test(message);
}
