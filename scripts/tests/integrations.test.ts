import assert from 'node:assert/strict';
import { ed25519 } from '@noble/curves/ed25519';
import { LocalCollectionGateway, PACK_COST, COLLECTION_KEY, configuredTitle, parseLocalCollection } from '../../lib/collection/gateway';
import { GENESIS_IDS, cardIdFromUri, metadataBase, metadataUri, nftMetadata } from '../../lib/solana/metadata';
import { proofMessage, verifyPlaySignature } from '../../lib/solana/proof';
import { deckError } from '../../lib/deckbuilder';
import { DECKS } from '../../lib/decks';
import { validatedDasCard, nftCounts } from '../../lib/solana/ownership';
import { verifyPublicMetadata } from '../../lib/solana/genesis';
import { confirmedNftMatchesScope, nftScope, readNftCards } from '../../components/NftContext';
import { GET as ownedGET } from '../../app/api/nft/owned/route';
import { base58 } from '@metaplex-foundation/umi/serializers';
async function main() {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  assert.equal(configuredTitle(undefined), null); assert.equal(configuredTitle('YOUR_TITLE_ID'), null); assert.equal(configuredTitle(' real-title '), 'real-title');
  assert.equal(parseLocalCollection('{broken').rug, 500);
  const gateway = new LocalCollectionGateway(storage, () => 0.2);
  assert.equal((await gateway.load()).rug, 500);
  const pack = await gateway.openPack();
  assert.equal(pack.cards.length, 5); assert.equal(pack.snapshot.rug, 500 - PACK_COST); assert.equal(pack.snapshot.packsOpened, 1);
  const id = pack.cards[0].id; assert.equal(pack.snapshot.owned[id], 7);
  assert.equal((await new LocalCollectionGateway(storage).load()).owned[id], 7);
  const concurrent = await Promise.allSettled([gateway.openPack(), gateway.openPack()]); assert.equal(concurrent.filter(x => x.status === 'fulfilled').length, 1);
  for (let i = 0; i < 8; i++) await gateway.openPack();
  assert.equal((await gateway.load()).rug, 0); await assert.rejects(gateway.openPack(), /Not enough/); assert.equal((await gateway.load()).packsOpened, 10);
  values.set(COLLECTION_KEY, JSON.stringify({ version: 1, rug: -1, owned: { rug: 100 }, packsOpened: 2 })); assert.equal((await gateway.load()).rug, 500);
  const blocked = new LocalCollectionGateway({ getItem: () => { throw Error(); }, setItem: () => { throw Error(); } }, () => 0);
  await blocked.openPack(); assert.equal((await blocked.load()).rug, 450);
  const readOnly = new LocalCollectionGateway({ getItem: () => null, setItem: () => { throw Error(); } }, () => 0);
  await readOnly.openPack(); await readOnly.openPack(); assert.equal((await readOnly.load()).rug, 400);
  const key = new Uint8Array(32).fill(7), pub = ed25519.getPublicKey(key);
  const bytes = new TextEncoder().encode(proofMessage('localhost', 'match1', 'whale', 'nonce1', '2026-10-04T00:00:00Z'));
  const sig = ed25519.sign(bytes, key);
  assert(verifyPlaySignature(bytes, bytes, sig, pub)); assert(!verifyPlaySignature(bytes, new Uint8Array(bytes.length), sig, pub)); assert(!verifyPlaySignature(bytes, bytes, sig, new Uint8Array(32))); assert(!verifyPlaySignature(bytes, bytes, new Uint8Array(64), pub));
  assert.equal(GENESIS_IDS.length, 40); assert(!GENESIS_IDS.includes('audit'));
  for (const value of ['', 'http://game.test', 'https://example.com', 'https://localhost', 'https://127.0.0.1', 'https://good.com/path', 'https://user:pass@good.com', 'https://good.com/?key=a']) assert.equal(metadataBase(value), null);
  const base = 'https://imperivm.vercel.app'; assert.equal(metadataBase(base), base);
  for (const card of GENESIS_IDS) { const uri = metadataUri(card, base); assert.equal(cardIdFromUri(uri, base), card); const metadata = nftMetadata(card, base); assert.equal(metadata.image, `${base}/cards/${card}.webp`); }
  assert.equal(cardIdFromUri(`${base}/api/nft/metadata/audit`, base), null); assert.equal(cardIdFromUri(`${base}/api/nft/metadata/rug-pull?other=1`, base), null); assert.equal(cardIdFromUri('https://evil.com/api/nft/metadata/rug-pull', base), null);
  const owner = '11111111111111111111111111111111', collection = 'So11111111111111111111111111111111111111112';
  const asset = { id: owner, interface: 'MplCoreAsset', burnt: false, ownership: { owner }, grouping: [{ group_key: 'collection', group_value: collection }], content: { json_uri: metadataUri('rug-pull', base) }, compression: { compressed: false } };
  const verified = validatedDasCard(asset, owner, collection, base)!; assert.equal(verified.cardId, 'rug-pull');
  assert.equal(validatedDasCard({ ...asset, burnt: true }, owner, collection, base), null);
  assert.equal(validatedDasCard(asset, collection, collection, base), null);
  assert.equal(validatedDasCard(asset, owner, owner, base), null);
  assert.equal(validatedDasCard({ ...asset, id: 'fake-address' }, owner, collection, base), null);
  assert.equal(validatedDasCard({ ...asset, interface: 'FungibleToken' }, owner, collection, base), null);
  assert.equal(validatedDasCard({ ...asset, content: { json_uri: 'https://evil.com/api/nft/metadata/rug-pull' } }, owner, collection, base), null);
  assert.equal(validatedDasCard({ ...asset, content: { json_uri: `${base}/api/nft/metadata/audit` } }, owner, collection, base), null);
  assert.deepEqual(nftCounts([verified, verified]), { 'rug-pull': 1 });
  const deployment = { collection, candyMachine: owner, metadataOrigin: base, authority: owner };
  const scope = nftScope(owner, deployment);
  assert(confirmedNftMatchesScope(verified, scope, scope, owner));
  assert(!confirmedNftMatchesScope(verified, scope, nftScope(collection, deployment), collection));
  assert(!confirmedNftMatchesScope(verified, scope, nftScope(owner, { ...deployment, candyMachine: collection }), owner));
  assert(!confirmedNftMatchesScope(verified, scope, nftScope(owner, { ...deployment, collection: owner }), owner));
  assert(!confirmedNftMatchesScope(verified, scope, nftScope(owner, { ...deployment, metadataOrigin: 'https://other.valid.app' }), owner));
  const originalFetch = globalThis.fetch, originalNow = Date.now;
  const originalEnv = { base: process.env.NEXT_PUBLIC_NFT_METADATA_BASE_URL, collection: process.env.NEXT_PUBLIC_GENESIS_COLLECTION, key: process.env.HELIUS_DEVNET_API_KEY };
  process.env.NEXT_PUBLIC_NFT_METADATA_BASE_URL = base; process.env.NEXT_PUBLIC_GENESIS_COLLECTION = collection;
  process.env.HELIUS_DEVNET_API_KEY = 'public-offline-test-placeholder';
  try {
    let fallbackReads = 0;
    const readCore = async () => { fallbackReads++; return [verified]; };
    globalThis.fetch = async () => { throw new Error('Offline network failure'); };
    assert.deepEqual((await readNftCards(owner, deployment, readCore)).cards, [verified]); assert.equal(fallbackReads, 1);
    globalThis.fetch = async () => Response.json({ cards: [{ ...verified, owner: collection }] });
    await readNftCards(owner, deployment, readCore); assert.equal(fallbackReads, 2);
    globalThis.fetch = async () => { throw new Error('DAS must not be queried for another deployment'); };
    await readNftCards(owner, { ...deployment, collection: owner }, readCore); assert.equal(fallbackReads, 3);

    let active = 0, maxActive = 0, metadataRequests = 0, imageRequests = 0, missing = '', missingImage = '', tamper = '';
    const webpHeader = new TextEncoder().encode('RIFF0000WEBP');
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input)); assert.equal(url.origin, base); assert.equal(init?.redirect, 'error');
      active++; maxActive = Math.max(maxActive, active);
      await new Promise<void>(resolve => setImmediate(resolve)); active--;
      if (url.pathname.startsWith('/api/nft/metadata/')) {
        metadataRequests++;
        const id = url.pathname.split('/').pop()!;
        if (id === missing) return new Response('', { status: 404 });
        const json = nftMetadata(id, base);
        return Response.json(id === tamper ? { ...json, image: 'https://foreign.invalid/secret' } : json);
      }
      imageRequests++;
      assert.equal(new Headers(init?.headers).get('Range'), 'bytes=0-31');
      if (url.pathname === `/cards/${missingImage}.webp`) return new Response('', { status: 404 });
      // The image header may arrive split across network chunks.
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(webpHeader.subarray(0, 5)); controller.enqueue(webpHeader.subarray(5)); controller.close(); } }), { headers: { 'Content-Type': 'image/webp' } });
    };
    await verifyPublicMetadata(base);
    assert.equal(metadataRequests, 41); assert.equal(imageRequests, 41); assert(maxActive <= 4);
    missing = 'genesis'; await assert.rejects(verifyPublicMetadata(base), /genesis/);
    missing = ''; missingImage = GENESIS_IDS[39]; await assert.rejects(verifyPublicMetadata(base), /unavailable|invalid/);
    missingImage = ''; tamper = 'rug-pull'; await assert.rejects(verifyPublicMetadata(base), /Metadata does not match/);
    await assert.rejects(verifyPublicMetadata('https://foreign.invalid'), /configured public/);

    let clock = originalNow(), calls = 0;
    Date.now = () => clock;
    const addressFor = (index: number) => base58.deserialize(ed25519.getPublicKey(new Uint8Array(32).fill(index)))[0];
    const request = (index: number, ip: number) => new Request(`http://localhost/api/nft/owned?owner=${addressFor(index)}`, { headers: { 'x-forwarded-for': `10.0.0.${ip}` } });
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    globalThis.fetch = async input => { assert(String(input).startsWith('https://devnet.helius-rpc.com/')); calls++; await gate; return Response.json({ result: { items: [] } }); };
    const one = ownedGET(request(20, 1)), duplicate = ownedGET(request(20, 2));
    const two = ownedGET(request(21, 3)), three = ownedGET(request(22, 4));
    assert.equal((await ownedGET(request(23, 5))).status, 429); assert.equal(calls, 3);
    release();
    for (const response of await Promise.all([one, duplicate, two, three])) assert.equal(response.status, 200);
    assert.equal((await ownedGET(request(20, 6))).status, 200); assert.equal(calls, 3);

    clock += 61_000; calls = 0;
    globalThis.fetch = async input => { assert(String(input).startsWith('https://devnet.helius-rpc.com/')); calls++; return Response.json({ result: { items: Array(100).fill({}) } }); };
    for (let i = 30; i < 36; i++) {
      const response = await ownedGET(request(i, i)); assert.equal(response.status, 200);
      assert.equal((await response.json()).partial, true);
    }
    assert.equal(calls, 30); assert.equal((await ownedGET(request(36, 36))).status, 429); assert.equal(calls, 30);
    clock += 61_000; calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ result: { items: [] } }); };
    for (let i = 0; i < 8; i++) assert.equal((await ownedGET(request(50, 50))).status, 200);
    assert.equal((await ownedGET(request(50, 50))).status, 429); assert.equal(calls, 1);
    assert.equal((await ownedGET(new Request('http://localhost/api/nft/owned?owner=not-an-address'))).status, 400);
  } finally {
    globalThis.fetch = originalFetch; Date.now = originalNow;
    for (const [key, value] of Object.entries({ NEXT_PUBLIC_NFT_METADATA_BASE_URL: originalEnv.base, NEXT_PUBLIC_GENESIS_COLLECTION: originalEnv.collection, HELIUS_DEVNET_API_KEY: originalEnv.key })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
  for (const deck of Object.values(DECKS)) assert.equal(deckError(deck), null);
  assert(deckError(DECKS.whale.slice(0, 29))); assert(deckError(Array(30).fill('rug-pull'))); assert(deckError([...DECKS.whale.slice(0, 29), '__proto__'])); assert(deckError(DECKS.whale, {}));
  console.log('Integration checks passed: local persistence, atomic purchases, fallback, signatures, metadata and custom decks. No live wallet transactions were sent.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
