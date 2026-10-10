import type { OperationResult, WalletChallengeResponse, PlatformPageAnswer } from '@idosgames/core';
import {PublicKey} from '@solana/web3.js';

export function idosResult<T>(result: OperationResult<T>): T {
  if (!result.ok) throw new Error(`iDos ${result.reason}: ${result.error}`);
  return result.data;
}

type WalletAuthPort<T> = {
  requestWalletChallenge: (address: string, network: string) => Promise<OperationResult<WalletChallengeResponse>>;
  loginWithWallet: (address: string, network: string, signature: string) => Promise<OperationResult<T>>;
};
/** The SDK types (address first) take precedence over the registry's older method table. */
export async function authenticateSolanaWallet<T>(auth: WalletAuthPort<T>, owner: string, network: string,
  sign: (message: Uint8Array, expectedOwner: string) => Promise<Uint8Array>, now = Date.now): Promise<T> {
  const challenge = idosResult(await auth.requestWalletChallenge(owner, network));
  const expires = Date.parse(challenge.ExpiresAt);
  if (!challenge.Message || challenge.Message.length > 8192 || !Number.isFinite(expires) || expires <= now()) throw new Error('iDos wallet challenge expired. Please retry.');
  const signature = await sign(new TextEncoder().encode(challenge.Message), owner);
  if (signature.length !== 64) throw new Error('Invalid Solana wallet signature.');
  if (expires <= now()) throw new Error('iDos wallet challenge expired. Please retry.');
  // Official @idosgames/wallet sends 0x-hex: base58 and base64 are ambiguous to the backend.
  const hex = `0x${Array.from(signature, byte => byte.toString(16).padStart(2, '0')).join('')}`;
  return idosResult(await auth.loginWithWallet(owner, network, hex));
}

/** Capture the address actually used for the verified challenge, not optional cached Blockchain fields. */
export async function authenticatePlatformSolanaWallet<T>(params: {
  auth: WalletAuthPort<T>; titleID: string; network: string;
  messages: {addressRequest: string; addressResponse: string; signRequest: string; signResponse: string};
  ask: (type: string, responseType: string, payload: Record<string, unknown>) => Promise<PlatformPageAnswer>;
}, now = Date.now): Promise<string> {
  const {auth, titleID, network, messages, ask} = params;
  const address = await ask(messages.addressRequest, messages.addressResponse, {titleID, family: 'solana'});
  if (!address.ok) throw new Error(`iDos challenge: ${address.error ?? 'NO_WALLET'}`);
  const owner = address.data.address;
  if (typeof owner !== 'string' || owner.length > 44) throw new Error('iDos returned an invalid Solana wallet.');
  try {if (new PublicKey(owner).toBase58() !== owner) throw new Error();}
  catch {throw new Error('iDos returned an invalid Solana wallet.');}
  await authenticateSolanaWallet(auth, owner, network, async (bytes, expectedOwner) => {
    const signed = await ask(messages.signRequest, messages.signResponse, {
      titleID, family: 'solana', address: expectedOwner, message: new TextDecoder().decode(bytes),
    });
    if (!signed.ok) throw new Error(`iDos sign: ${signed.error ?? 'SIGN_FAILED'}`);
    if (signed.data.address !== undefined && signed.data.address !== expectedOwner) throw new Error('Wallet changed while signing.');
    const signature = signed.data.signature;
    if (typeof signature !== 'string' || !/^0x[0-9a-f]{128}$/i.test(signature)) throw new Error('Invalid Solana wallet signature.');
    return Uint8Array.from(signature.slice(2).match(/../g)!, byte => parseInt(byte, 16));
  }, now);
  return owner;
}

/** Serializes SDK operations; account changes cannot occur halfway through a purchase. */
export class SessionQueue {
  private tail: Promise<unknown> = Promise.resolve();
  revision = 0;
  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  forAccount<T>(work: () => Promise<T>): Promise<T> {
    const revision = this.revision;
    return this.run(async () => {
      if (revision !== this.revision) throw new Error('iDos account changed. Refresh before continuing.');
      return work();
    });
  }
  change() { this.revision++; }
}
