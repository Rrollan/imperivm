import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519';
import { PublicKey } from '@solana/web3.js';
import type { CollectionDefinitions, OperationResult, WalletChallengeResponse } from '@idosgames/core';
import { authenticateSolanaWallet, SessionQueue } from '../../lib/idos/auth';
import { validateIDosDefinitions } from '../../lib/collection/idos';
import { IDOS_CONFIG, PACK_COST } from '../../lib/collection/gateway';
import { bytesToBase64, proofMessage, validPlayProof, verifyPlaySignature, type PlayProof } from '../../lib/solana/proof';
import { rugMint, tokenBalance } from '../../lib/solana/rug';
import { readPendingBadge } from '../../lib/solana/badgeReceipt';
import { emptyMatchStats } from '../../lib/ui/matchStats';
import { saveMatch, winsFor, readMatches } from '../../lib/matches';

async function main() {
  const saved = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); }, removeItem: (key: string) => { saved.delete(key); } } });
  const secret = new Uint8Array(32).fill(17), key = ed25519.getPublicKey(secret), owner = new PublicKey(key).toBase58();
  let now = 5000, requests = 0, signed = 0, exchanged = 0, refuse = false;
  const message = 'Official server nonce: 123; title: IMPERIVM; Solana devnet';
  const auth = {
    requestWalletChallenge: async (address: string, network: string): Promise<OperationResult<WalletChallengeResponse>> => {
      requests++; assert.equal(address, owner); assert.equal(network, IDOS_CONFIG.network);
      return { ok: true, data: { Message: message, ExpiresAt: new Date(10_000).toISOString() } };
    },
    loginWithWallet: async (address: string, network: string, signature: string): Promise<OperationResult<{ user: string }>> => {
      exchanged++; assert.equal(address, owner); assert.equal(network, IDOS_CONFIG.network);
      assert.match(signature, /^0x[0-9a-f]{128}$/);
      const bytes = Uint8Array.from(signature.slice(2).match(/../g)!, byte => parseInt(byte, 16));
      assert(ed25519.verify(bytes, new TextEncoder().encode(message), key));
      return refuse ? { ok: false, reason: 'server', error: 'PLAY_ACCESS_REQUIRED' } : { ok: true, data: { user: owner } };
    },
  };
  const sign = async (bytes: Uint8Array, expected: string) => { signed++; assert.equal(expected, owner); assert.equal(new TextDecoder().decode(bytes), message); return ed25519.sign(bytes, secret); };
  assert.deepEqual(await authenticateSolanaWallet(auth, owner, IDOS_CONFIG.network, sign, () => now), { user: owner });
  refuse = true; await assert.rejects(authenticateSolanaWallet(auth, owner, IDOS_CONFIG.network, sign, () => now), /PLAY_ACCESS_REQUIRED/); refuse = false;
  const exchangedBefore = exchanged;
  await assert.rejects(authenticateSolanaWallet(auth, owner, IDOS_CONFIG.network, async () => { throw new Error('Wallet changed'); }, () => now), /Wallet changed/);
  await assert.rejects(authenticateSolanaWallet(auth, owner, IDOS_CONFIG.network, async () => new Uint8Array(3), () => now), /Invalid.*signature/);
  await assert.rejects(authenticateSolanaWallet(auth, owner, IDOS_CONFIG.network, async bytes => { now = 20_000; return sign(bytes, owner); }, () => now), /expired/);
  assert.equal(exchanged, exchangedBefore);
  const signedBefore = signed;
  await assert.rejects(authenticateSolanaWallet(auth, owner, IDOS_CONFIG.network, sign, () => now), /expired/);
  assert.equal(signed, signedBefore); assert(requests >= 6);

  const queue = new SessionQueue(), steps: string[] = [];
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const purchase = queue.forAccount(async () => { steps.push('purchase:start'); await hold; steps.push('purchase:done'); });
  const change = queue.run(async () => { queue.change(); steps.push('login'); });
  const stale = queue.forAccount(async () => { steps.push('stale-purchase'); });
  release(); await purchase; await change; await assert.rejects(stale, /account changed/);
  assert.deepEqual(steps, ['purchase:start', 'purchase:done', 'login']);
  await queue.forAccount(async () => { steps.push('new-purchase'); });
  assert.equal(steps.at(-1), 'new-purchase');

  const definitions: CollectionDefinitions = { Collections: { [IDOS_CONFIG.collection]: { CollectionID: IDOS_CONFIG.collection } }, PackTypes: { [IDOS_CONFIG.pack]: { CollectibleCount: 5, PriceOptions: { [IDOS_CONFIG.payment]: { Cost: { Standard: { Entries: [{ Type: 'VirtualCurrency', CurrencyID: IDOS_CONFIG.currency, Amount: PACK_COST }] } } } } } } };
  validateIDosDefinitions(definitions);
  const wrong = structuredClone(definitions); wrong.PackTypes![IDOS_CONFIG.pack].CollectibleCount = 4; assert.throws(() => validateIDosDefinitions(wrong), /5 cards/);
  const crypto = structuredClone(definitions); crypto.PackTypes![IDOS_CONFIG.pack].PriceOptions![IDOS_CONFIG.payment].Cost!.Standard!.Entries![0].Type = 'CryptoCurrency'; assert.throws(() => validateIDosDefinitions(crypto), /Crypto payments/);
  const extra = structuredClone(definitions); extra.PackTypes![IDOS_CONFIG.pack].PriceOptions![IDOS_CONFIG.payment].Cost!.Standard!.Entries!.push({ Type: 'VirtualCurrency', CurrencyID: 'OTHER', Amount: 1 }); assert.throws(() => validateIDosDefinitions(extra));

  const proof: PlayProof = { owner, matchId: 'match-idos-test', heroId: 'builder', createdAt: '2026-10-08T00:00:00Z', message: proofMessage('localhost:3101', 'match-idos-test', 'builder', 'nonce-idos-test', '2026-10-08T00:00:00Z'), signature: '' };
  proof.signature = bytesToBase64(ed25519.sign(new TextEncoder().encode(proof.message), secret));
  const match = { id: proof.matchId, owner, heroId: proof.heroId };
  assert(validPlayProof(proof, match)); assert(!validPlayProof({ ...proof, message: proof.message.replace('devnet', 'mainnet') }, match)); assert(!validPlayProof(proof, { ...match, id: 'other-match' })); assert(!validPlayProof(proof, { ...match, owner: 'fake' }));
  assert(!validPlayProof({ ...proof, signature: 'broken' }, match)); assert(!validPlayProof(undefined, match));
  assert(!verifyPlaySignature(new Uint8Array(1), new Uint8Array(1), new Uint8Array(64), new Uint8Array(32).fill(255)));
  const record = { ...match, won: true, draw: false, blocks: 12, playedAt: proof.createdAt, stats: emptyMatchStats(), exhibition: false, proofSignature: proof.signature, proof };
  saveMatch(record); saveMatch(record); assert.equal(winsFor(owner), 1); assert.equal(readMatches().length, 1);
  saveMatch({ ...record, id: 'exhibition', exhibition: true, proof: { ...proof, matchId: 'exhibition' } }); assert.equal(winsFor(owner), 1);
  saveMatch({ ...record, id: 'legacy', proof: undefined }); assert.equal(winsFor(owner), 1);

  const token = (raw: string, decimals = 6) => ({ info: { owner, mint: owner, tokenAmount: { amount: raw, decimals } } });
  assert.equal(tokenBalance([token('1000001'), token('2000002')], owner, owner), '3.000003');
  assert.equal(tokenBalance([token('18446744073709551615', 9)], owner, owner), '18446744073.709551615');
  assert.equal(tokenBalance([], owner, owner), '0');
  assert.throws(() => tokenBalance([token('5'), token('5', 9)], owner, owner), /decimals/);
  assert.throws(() => tokenBalance([token('-1')], owner, owner));
  assert.throws(() => tokenBalance([token('5')], 'different', owner));
  assert.equal(rugMint(''), null); assert.equal(rugMint('YOUR_MINT'), null); assert.equal(rugMint('invalid'), null); assert.equal(rugMint(owner), owner);
  assert.equal(readPendingBadge({ getItem: () => 'malformed', setItem: () => {} }, owner), null);
  assert.equal(readPendingBadge({ getItem: () => '1'.repeat(88), setItem: () => {} }, owner), '1'.repeat(88));
  console.log('iDos checks passed: exact challenge/hex login, expired/declined signatures, account isolation, safe pack cost, verified participation, idempotent wins, exact token balances and NFT recovery. No external transactions.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
