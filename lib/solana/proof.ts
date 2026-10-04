import { ed25519 } from '@noble/curves/ed25519';

export interface PlayProof { matchId: string; owner: string; heroId: string; message: string; signature: string; createdAt: string; }
export function proofMessage(domain: string, matchId: string, heroId: string, nonce: string, createdAt: string) {
  return `${domain} requests an IMPERIVM proof of play.\n\nNetwork: Solana devnet\nMatch: ${matchId}\nHero: ${heroId}\nNonce: ${nonce}\nIssued: ${createdAt}\n\nThis signs a message only. No transaction, payment, or token approval.\nThe match runs locally against AI.`;
}
export function verifyPlaySignature(message: Uint8Array, signedMessage: Uint8Array, signature: Uint8Array, key: Uint8Array) {
  return message.length === signedMessage.length && message.every((v, i) => v === signedMessage[i]) &&
    signature.length === 64 && key.length === 32 && ed25519.verify(signature, message, key);
}
export function bytesToBase64(bytes: Uint8Array) { return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')); }

