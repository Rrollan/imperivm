import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, signerIdentity, type Signer, type Transaction, type TransactionBuilder, type Umi, type BlockhashWithExpiryBlockHeight } from '@metaplex-foundation/umi';
import { base58 } from '@metaplex-foundation/umi/serializers';
import { mplCore } from '@metaplex-foundation/mpl-core';
import { address, signature as solanaSignature, type Base64EncodedWireTransaction, type TransactionMessageBytesBase64 } from '@solana/kit';
import { assertDevnet, DEVNET_RPC, devnetRpc } from './devnet';
import { bytesToBase64 } from './proof';

export type WalletSign = (bytes: Uint8Array, expectedOwner: string) => Promise<Uint8Array>;
export interface DevnetPlan {
  umi: Umi; transaction: Transaction; blockhash: BlockhashWithExpiryBlockHeight;
  title: string; owner: string; recipient: string; account: string;
  rentLamports: bigint; feeLamports: bigint; units: bigint; createdAt: number;
}
/** Public recovery data only. An uncertain broadcast must never be retried as a new mint. */
export class SubmittedDevnetTransactionError extends Error {
  constructor(public readonly signature: string, public readonly account: string, public readonly owner: string,
    public readonly outcome: 'unresolved' | 'failed', cause: unknown) {
    super(outcome === 'failed' ? `Devnet transaction failed (${signature}). Check Explorer before preparing another transaction.`
      : `Transaction submitted or broadcast unresolved (${signature}). Check devnet Explorer and retry the ownership read; do not resend.`);
    this.name = 'SubmittedDevnetTransactionError';
    this.cause = cause;
  }
  readonly cause: unknown;
}
export interface DevnetSendOptions {
  /** Rechecked after Phantom returns, before any broadcast. */
  isCurrent?: () => boolean;
  /** Persist the known signed-wire signature before requesting broadcast. */
  onSubmitted?: (signature: string) => void;
}
export function signedTransactionSignature(umi: Umi, transaction: Transaction, owner: string): string {
  const first = transaction.signatures[0];
  if (transaction.message.accounts[0] !== owner || !first || first.length !== 64 ||
    !umi.eddsa.verify(transaction.serializedMessage, first, publicKey(owner))) throw new Error('The signed payer transaction did not verify. It was not sent.');
  return base58.deserialize(first)[0];
}
/** Recovery reads only: never signs, resends, or prepares a replacement transaction. */
export async function readDevnetSignatureState(encoded: string): Promise<'confirmed' | 'failed' | 'unresolved'> {
  await assertDevnet();
  const status = (await devnetRpc.getSignatureStatuses([solanaSignature(encoded)], { searchTransactionHistory: true }).send()).value[0];
  if (!status || !['confirmed', 'finalized'].includes(status.confirmationStatus ?? '')) return 'unresolved';
  return status.err ? 'failed' : 'confirmed';
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
  const before = await devnetRpc.getBalance(address(details.owner), { commitment: 'confirmed' }).send();
  const simulation = await devnetRpc.simulateTransaction(bytesToBase64(umi.transactions.serialize(transaction)) as Base64EncodedWireTransaction, { encoding: 'base64', sigVerify: false, commitment: 'confirmed', accounts: { addresses: [address(details.owner)], encoding: 'base64' } }).send();
  if (simulation.value.err) throw new Error(`Devnet simulation failed: ${JSON.stringify(simulation.value.err).slice(0, 220)}. Check test SOL and account configuration.`);
  const after = simulation.value.accounts?.[0]?.lamports;
  if (after === undefined) throw new Error('The simulation did not return the payer balance. Prepare again.');
  const feeLamports = feeResult.value;
  // Simulations include the transaction fee. The payer delta also captures Core
  // rent and Candy Machine guard-account rent, omitted by generated SDK estimates.
  const debit = before.value - after;
  const rentLamports = debit > feeLamports ? debit - feeLamports : BigInt(0);
  if (before.value < rentLamports + feeLamports) throw new Error('Not enough test SOL for account rent and network fees. Use faucet.solana.com on devnet.');
  return { umi, transaction, blockhash, ...details, rentLamports, feeLamports, units: simulation.value.unitsConsumed ?? BigInt(0), createdAt: Date.now() };
}
/** Called only by the visible Approve button, after a successful simulation. */
export async function sendDevnetPlan(plan: DevnetPlan, options: DevnetSendOptions = {}): Promise<string> {
  await assertDevnet();
  if (options.isCurrent && !options.isCurrent()) throw new Error('Wallet or Genesis deployment changed. Prepare the transaction again.');
  if (Date.now() - plan.createdAt > 45_000) throw new Error('The transaction preview expired. Prepare it again.');
  const transaction = await plan.umi.identity.signTransaction(plan.transaction);
  if (options.isCurrent && !options.isCurrent()) throw new Error('Wallet or Genesis deployment changed while signing. Transaction was not sent.');
  const encoded = signedTransactionSignature(plan.umi, transaction, plan.owner);
  options.onSubmitted?.(encoded);
  let signature: Uint8Array;
  try {
    signature = await plan.umi.rpc.sendTransaction(transaction, { skipPreflight: false, preflightCommitment: 'confirmed', maxRetries: 2 });
    if (base58.deserialize(signature)[0] !== encoded) throw new Error('RPC returned a different transaction signature.');
  } catch (error) { throw new SubmittedDevnetTransactionError(encoded, plan.account, plan.owner, 'unresolved', error); }
  try {
    const result = await plan.umi.rpc.confirmTransaction(signature, { strategy: { type: 'blockhash', ...plan.blockhash }, commitment: 'confirmed' });
    if (result.value.err) throw new SubmittedDevnetTransactionError(encoded, plan.account, plan.owner, 'failed', result.value.err);
  } catch (error) {
    if (error instanceof SubmittedDevnetTransactionError) throw error;
    throw new SubmittedDevnetTransactionError(encoded, plan.account, plan.owner, 'unresolved', error);
  }
  return encoded;
}
