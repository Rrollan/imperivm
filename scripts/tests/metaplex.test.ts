import assert from 'node:assert/strict';
import { createSignerFromKeypair, generateSigner, some, sol } from '@metaplex-foundation/umi';
import { create, createCollection, updatePlugin } from '@metaplex-foundation/mpl-core';
import { create as createMachine, addConfigLines, mintV1, mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine';
import { makeUmi, sendDevnetPlan, signedTransactionSignature, readDevnetSignatureState, SubmittedDevnetTransactionError, type DevnetPlan } from '../../lib/solana/metaplex';
import { DEVNET_RPC, DEVNET_GENESIS } from '../../lib/solana/devnet';
import { GENESIS_IDS } from '../../lib/solana/metadata';
import { CARDS } from '../../lib/cards';
async function main() {
  let walletCalls = 0;
  const umi = makeUmi('11111111111111111111111111111111', async () => { walletCalls++; throw new Error('Wallet signing must never run in offline tests.'); }).use(mplCandyMachine());
  // Mock rent lookup only. No RPC, simulation, signing, sending or confirmation.
  umi.rpc.getRent = async () => sol(0.01);
  const collection = generateSigner(umi), machine = generateSigner(umi), asset = generateSigner(umi);
  const base = 'https://imperivm.vercel.app';
  const builders = [
    createCollection(umi, { collection, name: 'IMPERIVM Genesis', uri: `${base}/api/nft/metadata/genesis`, updateAuthority: umi.identity.publicKey }),
    create(umi, { asset, name: 'IMPERIVM First Victory', uri: `${base}/api/nft/metadata/victory`, plugins: [{ type: 'Attributes', attributeList: [{ key: 'wins', value: '1' }] }] }),
    updatePlugin(umi, { asset: asset.publicKey, plugin: { type: 'Attributes', attributeList: [{ key: 'wins', value: '2' }] } }),
    await createMachine(umi, { candyMachine: machine, collection: collection.publicKey, collectionUpdateAuthority: umi.identity, itemsAvailable: 40, isMutable: false, configLineSettings: some({ prefixName: '', nameLength: 32, prefixUri: `${base}/api/nft/metadata/`, uriLength: 32, isSequential: false }), guards: {}, groups: [] }),
    mintV1(umi, { candyMachine: machine.publicKey, collection: collection.publicKey, asset, owner: umi.identity.publicKey }),
  ];
  for (let i = 0; i < 40; i += 8) builders.push(addConfigLines(umi, { candyMachine: machine.publicKey, index: i, configLines: GENESIS_IDS.slice(i, i + 8).map(id => ({ name: CARDS[id].name, uri: id })) }));
  for (const builder of builders) {
    const prepared = builder.setVersion(0).setBlockhash('11111111111111111111111111111111');
    assert(prepared.fitsInOneTransaction(umi), 'Every transaction must fit the wallet packet limit.');
    const tx = prepared.build(umi);
    const encoded = umi.transactions.serialize(tx), decoded = umi.transactions.deserialize(encoded);
    assert.deepEqual(decoded.serializedMessage, tx.serializedMessage);
    assert.equal(decoded.message.version, 0);
  }
  for (const id of GENESIS_IDS) { assert(new TextEncoder().encode(id).length <= 32); assert(new TextEncoder().encode(CARDS[id].name).length <= 32); }
  assert.equal(walletCalls, 0);
  // Public deterministic test fixture only; no browser wallet, funding, or live network.
  const payer = umi.eddsa.createKeypairFromSeed(new Uint8Array(32).fill(7));
  const fixtureSigner = createSignerFromKeypair(umi, payer);
  let changeScopeWhileSigning = false, currentScope = true, fixtureApprovals = 0, submissions = 0, confirmations = 0;
  const sendUmi = makeUmi(payer.publicKey, async bytes => {
    fixtureApprovals++;
    const signed = await fixtureSigner.signTransaction(sendUmi.transactions.deserialize(bytes));
    if (changeScopeWhileSigning) currentScope = false;
    return sendUmi.transactions.serialize(signed);
  });
  const tx = createCollection(sendUmi, { collection, name: 'Offline fixture', uri: `${base}/api/nft/metadata/genesis` }).setVersion(0).setBlockhash('11111111111111111111111111111111').build(sendUmi);
  const plan: DevnetPlan = { umi: sendUmi, transaction: tx, owner: payer.publicKey, recipient: payer.publicKey, account: collection.publicKey,
    blockhash: { blockhash: tx.message.blockhash, lastValidBlockHeight: 100 }, title: 'Offline fixture', rentLamports: BigInt(0), feeLamports: BigInt(0), units: BigInt(0), createdAt: Date.now() };
  const expected = signedTransactionSignature(sendUmi, await fixtureSigner.signTransaction(tx), payer.publicKey);
  const originalFetch = globalThis.fetch;
  let chainStatus: { confirmationStatus: string; err: null | string } | null = null;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), DEVNET_RPC);
    const body = JSON.parse(String(init?.body));
    if (body.method === 'getGenesisHash') return Response.json({ jsonrpc: '2.0', id: body.id, result: DEVNET_GENESIS });
    assert.equal(body.method, 'getSignatureStatuses'); assert.equal(body.params[0][0], expected); assert.equal(body.params[1].searchTransactionHistory, true);
    return Response.json({ jsonrpc: '2.0', id: body.id, result: { context: { slot: 1 }, value: [chainStatus ? { ...chainStatus, slot: 1, confirmations: null, status: chainStatus.err ? { Err: chainStatus.err } : { Ok: null } } : null] } });
  };
  sendUmi.rpc.sendTransaction = async transaction => { submissions++; return transaction.signatures[0]; };
  sendUmi.rpc.confirmTransaction = async () => { confirmations++; return { context: { slot: 1 }, value: { err: null } }; };
  try {
    let captured = '';
    assert.equal(await sendDevnetPlan(plan, { onSubmitted: signature => { captured = signature; } }), expected);
    assert.equal(captured, expected); assert.equal(submissions, 1); assert.equal(confirmations, 1);
    sendUmi.rpc.sendTransaction = async () => { submissions++; throw new Error('Offline simulated transport interruption'); };
    await assert.rejects(sendDevnetPlan(plan), error => error instanceof SubmittedDevnetTransactionError && error.signature === expected && error.account === plan.account && error.outcome === 'unresolved');
    sendUmi.rpc.sendTransaction = async () => new Uint8Array(64).fill(2);
    await assert.rejects(sendDevnetPlan(plan), error => error instanceof SubmittedDevnetTransactionError && error.signature === expected && error.outcome === 'unresolved');
    sendUmi.rpc.sendTransaction = async transaction => { submissions++; return transaction.signatures[0]; };
    sendUmi.rpc.confirmTransaction = async () => { throw new Error('Offline confirmation timeout'); };
    await assert.rejects(sendDevnetPlan(plan), error => error instanceof SubmittedDevnetTransactionError && error.signature === expected && error.outcome === 'unresolved');
    sendUmi.rpc.confirmTransaction = async () => ({ context: { slot: 1 }, value: { err: 'offline fixture rejected' } });
    await assert.rejects(sendDevnetPlan(plan), error => error instanceof SubmittedDevnetTransactionError && error.outcome === 'failed');
    const before = { fixtureApprovals, submissions };
    currentScope = false;
    await assert.rejects(sendDevnetPlan(plan, { isCurrent: () => currentScope }), /deployment changed/);
    assert.equal(fixtureApprovals, before.fixtureApprovals); assert.equal(submissions, before.submissions);
    currentScope = true; changeScopeWhileSigning = true;
    await assert.rejects(sendDevnetPlan(plan, { isCurrent: () => currentScope }), /changed while signing/);
    assert.equal(submissions, before.submissions);
    assert.throws(() => signedTransactionSignature(sendUmi, { ...tx, signatures: [new Uint8Array(64)] }, payer.publicKey), /did not verify/);
    assert.equal(await readDevnetSignatureState(expected), 'unresolved');
    chainStatus = { confirmationStatus: 'processed', err: 'fixture' }; assert.equal(await readDevnetSignatureState(expected), 'unresolved');
    chainStatus = { confirmationStatus: 'confirmed', err: null }; assert.equal(await readDevnetSignatureState(expected), 'confirmed');
    chainStatus = { confirmationStatus: 'finalized', err: 'fixture' }; assert.equal(await readDevnetSignatureState(expected), 'failed');
  } finally { globalThis.fetch = originalFetch; }
  console.log('Metaplex offline checks passed: collection, badge, update, Candy Machine, five config batches and mint instructions serialize and fit v0 packets. No live transactions were sent.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
