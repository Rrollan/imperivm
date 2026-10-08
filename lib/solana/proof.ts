import { ed25519 } from '@noble/curves/ed25519';
import { PublicKey } from '@solana/web3.js';

export interface PlayProof { matchId: string; owner: string; heroId: string; message: string; signature: string; createdAt: string; }
export function proofMessage(domain: string, matchId: string, heroId: string, nonce: string, createdAt: string) {
  return `${domain} requests an IMPERIVM proof of play.\n\nNetwork: Solana devnet\nMatch: ${matchId}\nHero: ${heroId}\nNonce: ${nonce}\nIssued: ${createdAt}\n\nThis signs a message only. No transaction, payment, or token approval.\nThe match runs locally against AI.`;
}
export function verifyPlaySignature(message: Uint8Array, signedMessage: Uint8Array, signature: Uint8Array, key: Uint8Array) {
  try {
    return message.length === signedMessage.length && message.every((v, i) => v === signedMessage[i]) &&
      signature.length === 64 && key.length === 32 && ed25519.verify(signature, message, key);
  } catch { return false; }
}
export function bytesToBase64(bytes: Uint8Array) { return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')); }
/** Verifies participation only. A wallet signature does not verify a local match's outcome. */
export function validPlayProof(proof: PlayProof | undefined, match: { id: string; heroId: string; owner: string }): boolean {
  try {
    if (!proof || proof.matchId !== match.id || proof.heroId !== match.heroId || proof.owner !== match.owner || typeof proof.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(proof.signature) || typeof proof.message !== 'string' || proof.message.length > 2048 || !Number.isFinite(Date.parse(proof.createdAt))) return false;
    const domain = proof.message.split(' requests an IMPERIVM proof of play.')[0];
    const nonce = /^Nonce: ([A-Za-z0-9-]{1,80})$/m.exec(proof.message)?.[1];
    if (!domain || domain.length > 253 || !nonce || proof.message !== proofMessage(domain, match.id, match.heroId, nonce, proof.createdAt)) return false;
    const bytes = new TextEncoder().encode(proof.message), signature = Uint8Array.from(atob(proof.signature), c => c.charCodeAt(0));
    return verifyPlaySignature(bytes, bytes, signature, new PublicKey(match.owner).toBytes());
  } catch { return false; }
}
