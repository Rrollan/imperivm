import { createCollection, fetchCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner, publicKey, some, isSome } from '@metaplex-foundation/umi';
import { addConfigLines, create as createMachine, fetchCandyMachine, fetchCandyGuard, findCandyGuardPda, mintV1, mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine';
import { CARDS } from '../cards';
import { GENESIS_IDS, metadataUri, cardIdFromUri, metadataBase, nftMetadata } from './metadata';
import { makeUmi, prepareDevnetPlan, type DevnetPlan, type WalletSign } from './metaplex';
import type { GenesisDeployment } from './deployment';
import { assertDevnet } from './devnet';

export interface GenesisSetupPlan { plan: DevnetPlan; deployment: GenesisDeployment; step: 'collection' | 'machine' | 'items'; }
function genesisUmi(owner: string, sign: WalletSign) { return makeUmi(owner, sign).use(mplCandyMachine()); }
async function checkCollection(umi: ReturnType<typeof genesisUmi>, deployment: GenesisDeployment) {
  const address = publicKey(deployment.collection);
  const raw = await umi.rpc.getAccount(address, { commitment: 'confirmed' });
  if (!raw.exists || raw.owner !== umi.programs.getPublicKey('mplCore')) throw new Error('The configured collection is not a Metaplex Core account.');
  const collection = await fetchCollection(umi, address, { commitment: 'confirmed' });
  if (collection.uri !== metadataUri('genesis', deployment.metadataOrigin) || collection.name !== 'IMPERIVM Genesis') throw new Error('This collection does not match IMPERIVM Genesis metadata.');
  return collection;
}
async function checkMachine(umi: ReturnType<typeof genesisUmi>, deployment: GenesisDeployment) {
  const address = publicKey(deployment.candyMachine);
  const raw = await umi.rpc.getAccount(address, { commitment: 'confirmed' });
  if (!raw.exists || raw.owner !== umi.programs.getPublicKey('mplCoreCandyMachineCore')) throw new Error('The configured account is not a Core Candy Machine.');
  const machine = await fetchCandyMachine(umi, address, { commitment: 'confirmed' });
  if (machine.collectionMint !== deployment.collection || machine.data.itemsAvailable !== BigInt(40) || !isSome(machine.data.configLineSettings) || machine.data.configLineSettings.value.isSequential || machine.data.configLineSettings.value.prefixUri !== `${deployment.metadataOrigin}/api/nft/metadata/`) throw new Error('Candy Machine collection, supply or random configuration is invalid.');
  return machine;
}
export async function verifyPublicMetadata(base: string) {
  // Only exact routes at the configured public origin; never follow NFT-provided URIs.
  if (metadataBase(base) !== base || metadataBase() !== base) throw new Error('Use the configured public HTTPS metadata origin.');
  const ids = ['genesis', ...GENESIS_IDS]; let next = 0, failure: unknown;
  await Promise.all(Array.from({ length: 4 }, async () => {
    try { while (next < ids.length && !failure) {
      const id = ids[next++], expected = nftMetadata(id, base);
      const response = await fetch(metadataUri(id, base), { signal: AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error' });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`Public metadata is unavailable for ${id}. Publish the app before creating Genesis.`);
      const text = await response.text();
      if (text.length > 32_768) throw new Error(`Public metadata is too large for ${id}.`);
      const data = JSON.parse(text);
      if (data.name !== expected.name || data.symbol !== expected.symbol || data.description !== expected.description || data.image !== expected.image || data.external_url !== expected.external_url ||
        !Array.isArray(data.attributes) || !expected.attributes.every(attribute => data.attributes.some((a: { trait_type?: unknown; value?: unknown }) => a?.trait_type === attribute.trait_type && a.value === attribute.value))) throw new Error(`Metadata does not match ${id}.`);
      const image = await fetch(expected.image, { method: 'GET', headers: { Range: 'bytes=0-31' }, signal: AbortSignal.timeout(10_000), cache: 'no-store', redirect: 'error' });
      try {
        const reader = image.body?.getReader(), bytes = new Uint8Array(12); let received = 0;
        if (reader) {
          try { while (received < bytes.length) { const part = await reader.read(); if (part.done) break; const used = part.value.subarray(0, bytes.length - received); bytes.set(used, received); received += used.length; } }
          finally { await reader.cancel(); }
        }
        if (!image.ok || !image.headers.get('content-type')?.includes('image/webp') || received < 12 ||
          new TextDecoder().decode(bytes.subarray(0, 4)) !== 'RIFF' || new TextDecoder().decode(bytes.subarray(8, 12)) !== 'WEBP') throw new Error(`Published card art is unavailable or invalid for ${id}.`);
      } finally { if (!image.body?.locked) await image.body?.cancel().catch(() => {}); }
    } } catch (error) { failure ??= error; }
  }));
  if (failure) throw failure;
}
export async function prepareGenesisCollection(owner: string, sign: WalletSign, base: string): Promise<GenesisSetupPlan> {
  await assertDevnet(); await verifyPublicMetadata(base);
  const umi = genesisUmi(owner, sign), collection = generateSigner(umi);
  const builder = createCollection(umi, { collection, name: 'IMPERIVM Genesis', uri: metadataUri('genesis', base), updateAuthority: umi.identity.publicKey });
  const plan = await prepareDevnetPlan(umi, builder, { title: 'Create IMPERIVM Genesis collection', owner, recipient: owner, account: collection.publicKey });
  return { plan, step: 'collection', deployment: { collection: collection.publicKey, candyMachine: '', authority: owner, metadataOrigin: base } };
}
export async function prepareGenesisMachine(owner: string, sign: WalletSign, deployment: GenesisDeployment): Promise<GenesisSetupPlan> {
  const umi = genesisUmi(owner, sign), collection = await checkCollection(umi, deployment);
  if (collection.updateAuthority !== owner) throw new Error('Connect the Genesis collection authority wallet to create its Candy Machine.');
  const candyMachine = generateSigner(umi);
  const builder = await createMachine(umi, { candyMachine, collection: collection.publicKey, collectionUpdateAuthority: umi.identity, authority: umi.identity.publicKey, itemsAvailable: 40, isMutable: false, configLineSettings: some({ prefixName: '', nameLength: 32, prefixUri: `${deployment.metadataOrigin}/api/nft/metadata/`, uriLength: 32, isSequential: false }), guards: {}, groups: [] });
  const plan = await prepareDevnetPlan(umi, builder, { title: 'Create free devnet Candy Machine · 40 cards', owner, recipient: owner, account: candyMachine.publicKey });
  return { plan, step: 'machine', deployment: { ...deployment, candyMachine: candyMachine.publicKey, authority: owner } };
}
export async function prepareGenesisItems(owner: string, sign: WalletSign, deployment: GenesisDeployment): Promise<GenesisSetupPlan> {
  const umi = genesisUmi(owner, sign), machine = await checkMachine(umi, deployment);
  if (machine.authority !== owner) throw new Error('Connect the Candy Machine authority wallet to load cards.');
  if (machine.itemsRedeemed > BigInt(0)) throw new Error('Config lines cannot be changed after minting starts.');
  const loaded = machine.itemsLoaded;
  if (loaded >= 40) throw new Error('All forty Genesis items are already loaded.');
  // Validate the existing prefix before resuming an interrupted setup.
  if (machine.items.length !== loaded || machine.items.some(item => item.index >= loaded || cardIdFromUri(item.uri, deployment.metadataOrigin) !== GENESIS_IDS[item.index] || item.name !== CARDS[GENESIS_IDS[item.index]].name)) throw new Error('Existing config lines do not match the Genesis manifest.');
  const ids = GENESIS_IDS.slice(loaded, loaded + 8);
  const builder = addConfigLines(umi, { candyMachine: machine.publicKey, index: loaded, configLines: ids.map(id => ({ name: CARDS[id].name, uri: id })) });
  const plan = await prepareDevnetPlan(umi, builder, { title: `Load Genesis cards ${loaded + 1}–${loaded + ids.length} of 40`, owner, recipient: owner, account: machine.publicKey });
  return { plan, step: 'items', deployment };
}
export async function genesisStatus(owner: string, sign: WalletSign, deployment: GenesisDeployment) {
  await assertDevnet();
  const umi = genesisUmi(owner, sign), collection = await checkCollection(umi, deployment);
  if (!deployment.candyMachine) return { loaded: 0, minted: 0, collectionAuthority: collection.updateAuthority, machineAuthority: '' };
  const machine = await checkMachine(umi, deployment);
  return { loaded: machine.itemsLoaded, minted: Number(machine.itemsRedeemed), collectionAuthority: collection.updateAuthority, machineAuthority: machine.authority };
}
export async function prepareGenesisPack(owner: string, sign: WalletSign, deployment: GenesisDeployment) {
  const umi = genesisUmi(owner, sign);
  await checkCollection(umi, deployment);
  const machine = await checkMachine(umi, deployment);
  if (machine.itemsLoaded !== 40) throw new Error('All 40 config lines must be loaded before opening NFT packs.');
  if (machine.itemsRedeemed >= machine.data.itemsAvailable) throw new Error('This devnet Genesis edition is sold out. Demo packs remain available.');
  if (machine.items.some(item => !cardIdFromUri(item.uri, deployment.metadataOrigin) || item.name !== CARDS[cardIdFromUri(item.uri, deployment.metadataOrigin)!]?.name)) throw new Error('Candy Machine items do not match the Genesis manifest.');
  const guardAddress = findCandyGuardPda(umi, { base: machine.publicKey });
  if (machine.mintAuthority !== guardAddress[0]) throw new Error('Candy Machine mint authority does not match its Candy Guard.');
  const guard = await fetchCandyGuard(umi, guardAddress, { commitment: 'confirmed' });
  if (guard.header.owner !== umi.programs.getPublicKey('mplCoreCandyGuard')) throw new Error('The guard account is owned by the wrong program.');
  if (guard.groups.length || Object.values(guard.guards).some(value => value && typeof value === 'object' && '__option' in value && value.__option === 'Some')) throw new Error('This machine has enabled guards. IMPERIVM permits only free devnet mints with no payment or bot tax.');
  const asset = generateSigner(umi);
  const builder = mintV1(umi, { candyMachine: machine.publicKey, candyGuard: guardAddress, collection: publicKey(deployment.collection), asset, owner: umi.identity.publicKey });
  return prepareDevnetPlan(umi, builder, { title: 'Open devnet pack · one random Genesis NFT', owner, recipient: owner, account: asset.publicKey });
}
