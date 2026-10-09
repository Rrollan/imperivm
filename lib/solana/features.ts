/** Participation signatures stay off until the optional achievement flow ships.
 * Wallet sign-in to iDos is independent and must remain available. */
export function playProofEnabled() {
  return process.env.NEXT_PUBLIC_PLAY_PROOF_ENABLED === 'true';
}
