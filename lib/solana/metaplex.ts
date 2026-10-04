import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, signerIdentity, type Signer, type Transaction, type TransactionBuilder, type Umi, type BlockhashWithExpiryBlockHeight } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { mplCore } from '@metaplex-foundation/mpl-core';
import type { Base64EncodedWireTransaction, TransactionMessageBytesBase64 } from '@solana/kit';
import { assertDevnet, DEVNET_RPC, devnetRpc, readDevnetBalance } from './devnet';
import { bytesToBase64 } from './proof';

export type WalletSign = (bytes: Uint8Array, expectedOwner: string) => Promise<Uint8Array>;
export interface DevnetPlan {
  umi: Umi; transaction: Transaction; blockhash: BlockhashWithExpiryBlockHeight;
  title: string; owner: string; recipient: string; account: string;
  rentLamports: bigint; feeLamports: bigint; units: bigint; createdAt: number;
}
export function makeUmi(owner: string, sign: WalletSign): Umi {
  const umi = createUmi(DEVNET_RPC).use(mplCore());
  const signer: Signer = {
    publicKey: publicKey(owner),
    signMessage: async () => { throw new Error('Use the proof-of-play message flow.'); },
    signTransaction: async transaction => {
      const returned = umi.transactions.deserialize(await sign(umi.transactions.serialize(transaction), owner));
      if (transaction.serializedMessage.length !== returned.serializedMessage.length || !transaction.serializedMessage.every((v, i) => v === returned.serializedMessage[i])) throw new Error('The wallet changed the transaction message. It was not sent.');
      return returned;
    },
    signAllTransactions: async () => { throw new Error('Approve each devnet transaction separately.'); },
  };
  return umi.use(signerIdentity(signer));
}
/** Does not invoke the wallet. Only ephemeral new-account signers sign here. */
export async function prepareDevnetPlan(umi: Umi, builder: TransactionBuilder, details: Pick<DevnetPlan, 'title' | 'owner' | 'recipient' | 'account'>): Promise<DevnetPlan> {
  await assertDevnet();
  const blockhash = await umi.rpc.getLatestBlockhash({ commitment: 'confirmed' });
  builder = builder.setVersion(0).setBlockhash(blockhash);
  if (!builder.fitsInOneTransaction(umi)) throw new Error('This transaction exceeds the wallet size limit. Split it into smaller steps.');
  let transaction = builder.build(umi);
  for (const signer of builder.getSigners(umi).filter(s => s.publicKey !== umi.identity.publicKey)) transaction = await signer.signTransaction(transaction);
  const feeResult = await devnetRpc.getFeeForMessage(bytesToBase64(transaction.serializedMessage) as TransactionMessageBytesBase64, { commitment: 'confirmed' }).send();
  if (feeResult.value === null) throw new Error('The blockhash expired. Prepare the transaction again.');
  const rent = await builder.getRentCreatedOnChain(umi);
  const simulation = await devnetRpc.simulateTransaction(bytesToBase64(umi.transactions.serialize(transaction)) as Base64EncodedWireTransaction, { encoding: 'base64', sigVerify: false, commitment: 'confirmed' }).send();
  if (simulation.value.err) throw new Error(`Devnet simulation failed: ${JSON.stringify(simulation.value.err).slice(0, 220)}. Check test SOL and account configuration.`);
  const rentLamports = rent.basisPoints, feeLamports = feeResult.value;
  if (await readDevnetBalance(details.owner) * 1e9 < Number(rentLamports + feeLamports)) throw new Error('Not enough test SOL for account rent and network fees. Use faucet.solana.com on devnet.');
  return { umi, transaction, blockhash, ...details, rentLamports, feeLamports, units: simulation.value.unitsConsumed ?? BigInt(0), createdAt: Date.now() };
}
/** Called only by the visible Approve button, after a successful simulation. */
export async function sendDevnetPlan(plan: DevnetPlan): Promise<string> {
  await assertDevnet();
  if (Date.now() - plan.createdAt > 45_000) throw new Error('The transaction preview expired. Prepare it again.');
  const transaction = await plan.umi.identity.signTransaction(plan.transaction);
  const signature = await plan.umi.rpc.sendTransaction(transaction, { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 2 });
  const encoded = base58.deserialize(signature)[0];
  try {
    const result = await plan.umi.rpc.confirmTransaction(signature, { strategy: { type: 'blockhash', ...plan.blockhash }, commitment: 'confirmed' });
    if (result.value.err) throw new Error(`Transaction failed: ${JSON.stringify(result.value.err).slice(0, 160)}`);
  } catch (error) { throw new Error(`Transaction submitted (${encoded}), but confirmation is unresolved. Check devnet Explorer before retrying. ${error instanceof Error ? error.message : ''}`); }
  return encoded;
}
