import assert from 'node:assert/strict';
import {Keypair, Transaction, SystemProgram, type VersionedTransactionResponse} from '@solana/web3.js';
import {IMPERIVM_TITLE} from '../../lib/idos/title';
import {IMP_SWAP_URL, mountImpSwap, purchasedImpAmount, SOL_MINT, verifyImpPurchase} from '../../lib/idos/impPurchase';

const signer = Keypair.fromSeed(new Uint8Array(32).fill(12));
const owner = signer.publicKey.toBase58();
const message = new Transaction({feePayer: signer.publicKey, recentBlockhash:Keypair.generate().publicKey.toBase58()}).add(SystemProgram.transfer({fromPubkey: signer.publicKey, toPubkey:Keypair.generate().publicKey, lamports:1})).compileMessage();
function balance(amount: string, accountIndex = 1, wallet = owner, mint: string = IMPERIVM_TITLE.mint, decimals = 6) {return {accountIndex, mint, owner:wallet, uiTokenAmount:{amount, decimals, uiAmount:null}};}
function receipt() {return {transaction:{message, signatures:[]},meta:{err:null, preTokenBalances:[balance('490021764541')], postTokenBalances:[balance('535021887997')]}} as unknown as VersionedTransactionResponse;}
async function main() {
  assert.equal(purchasedImpAmount(receipt(),owner),'45000.123456');
  const multiple = receipt(); multiple.meta!.preTokenBalances!.push(balance('123000000',2)); multiple.meta!.postTokenBalances!.push(balance('122000000',2)); assert.equal(purchasedImpAmount(multiple,owner),'44999.123456','Use actual net received across all wallet token accounts.');
  const newAccount=receipt();newAccount.meta!.preTokenBalances=[];newAccount.meta!.postTokenBalances=[balance('1000001')];assert.equal(purchasedImpAmount(newAccount,owner),'1.000001');
  for (const mutate of [
    (tx:VersionedTransactionResponse)=>{tx.meta!.err={InstructionError:[0,'Custom']};},
    (tx:VersionedTransactionResponse)=>{tx.meta!.postTokenBalances=[balance('535021887997',1,Keypair.generate().publicKey.toBase58())];},
    (tx:VersionedTransactionResponse)=>{tx.meta!.postTokenBalances=[balance('535021887997',1,owner,SOL_MINT,9)];},
    (tx:VersionedTransactionResponse)=>{tx.meta!.postTokenBalances=[balance('535021887997',1,owner,IMPERIVM_TITLE.mint,9)];},
    (tx:VersionedTransactionResponse)=>{tx.meta!.postTokenBalances=[balance('18446744073709551616')];},
    (tx:VersionedTransactionResponse)=>{tx.meta!.postTokenBalances=[balance('1e12')];},
    (tx:VersionedTransactionResponse)=>{tx.meta!.postTokenBalances=[balance('490021764541')];},
  ]) {const tx=receipt();mutate(tx);assert.throws(()=>purchasedImpAmount(tx,owner));}
  assert.throws(()=>purchasedImpAmount(null,owner));
  assert.throws(()=>purchasedImpAmount(receipt(),Keypair.generate().publicKey.toBase58()),/другим кошельком/);
  await assert.rejects(verifyImpPurchase('not-a-receipt',owner),/корректный чек/);
  assert(IMP_SWAP_URL.endsWith(`/${SOL_MINT}-${IMPERIVM_TITLE.mint}`));
  let options: Parameters<Parameters<typeof mountImpSwap>[0]['init']>[0] | undefined;
  let event = '';
  await mountImpSwap({init: value=>{options=value;},close:()=>{}},'test-imp-purchase',txid=>{event=txid;});
  assert(options);assert.equal(options.autoConnect,false);assert.equal(options.formProps.initialInputMint,SOL_MINT);assert.equal(options.formProps.initialOutputMint,IMPERIVM_TITLE.mint);assert.equal(options.formProps.fixedMint,IMPERIVM_TITLE.mint);assert.equal(event,'','Opening a form never starts a financial action.');
  options.onSuccess({txid:'receipt'});assert.equal(event,'receipt');
  await assert.rejects(mountImpSwap({init:()=>{},close:()=>{}},'second-form',()=>{}),/уже открыта/);
  console.log('IMP purchase checks passed: exact confirmed net receipt, correct signer/mint/decimals, rejected failed and unrelated swaps, fixed IMP output, on-demand form and single widget. No swaps or deposits executed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
