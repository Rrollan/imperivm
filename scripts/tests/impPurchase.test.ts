import assert from 'node:assert/strict';
import {Connection, Keypair, Transaction, SystemProgram, type VersionedTransactionResponse} from '@solana/web3.js';
import {IMPERIVM_TITLE} from '../../lib/idos/title';
import {closeImpSwap, IMP_SWAP_URL, mountImpSwap, purchasedImpAmount, PurchaseJournal, SOL_MINT, verifyImpPurchase, type SwapScreen} from '../../lib/idos/impPurchase';
import {signatureBase58, type TransferStorage} from '../../lib/idos/walletTransfer';

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
  const txid=signatureBase58(new Uint8Array(64).fill(19)), saved=new Map<string,string>();
  const storage:TransferStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>{saved.set(key,value);},removeItem:key=>{saved.delete(key);}};
  const journal=new PurchaseJournal(storage,owner);assert.equal(journal.read(),null);journal.save(txid);assert.equal(journal.read()?.txid,txid);assert.equal(journal.read()?.owner,owner);assert(Number.isSafeInteger(journal.read()?.createdAt));
  const [storageKey,storedValue]=Array.from(saved.entries())[0];assert.deepEqual(Object.keys(JSON.parse(storedValue)).sort(),['createdAt','owner','txid'],'A saved purchase is a transaction reference, never a trusted token balance.');
  assert.equal(new PurchaseJournal(storage,Keypair.generate().publicKey.toBase58()).read(),null,'Another wallet cannot recover this purchase.');
  assert.throws(()=>journal.save('unconfirmed-widget-result'),/корректный чек/);assert.equal(saved.get(storageKey),storedValue);
  for (const value of [
    'broken JSON',
    'null',
    '[]',
    JSON.stringify({...JSON.parse(storedValue),owner:Keypair.generate().publicKey.toBase58()}),
    JSON.stringify({...JSON.parse(storedValue),txid:'not-a-signature'}),
    JSON.stringify({...JSON.parse(storedValue),createdAt:'today'}),
  ]) {saved.set(storageKey,value);assert.throws(()=>journal.read(),/чек/);}saved.set(storageKey,storedValue);
  const denied=new PurchaseJournal({getItem:()=>null,setItem:()=>{throw Error('Storage denied');},removeItem:()=>{}},owner);assert.throws(()=>denied.save(txid),/Storage denied/);
  const ineffective=new PurchaseJournal({getItem:()=>null,setItem:()=>{},removeItem:()=>{}},owner);assert.throws(()=>ineffective.save(txid),/сохранить чек/);
  const previousRpc=process.env.NEXT_PUBLIC_SOLANA_TRANSACTION_RPC_URL, getTransaction=Connection.prototype.getTransaction;process.env.NEXT_PUBLIC_SOLANA_TRANSACTION_RPC_URL='https://example.test/wallet/rpc';
  try {
    Connection.prototype.getTransaction=(async(hash:string,options:unknown)=>{assert.equal(hash,txid);assert.deepEqual(options,{commitment:'confirmed',maxSupportedTransactionVersion:0});return receipt();}) as typeof getTransaction;
    assert.equal(await verifyImpPurchase(journal.read()!.txid,owner),'45000.123456','Reopening a receipt verifies the chain again before displaying an amount.');
    Connection.prototype.getTransaction=(async()=>null) as typeof getTransaction;await assert.rejects(verifyImpPurchase(txid,owner),/ещё не подтверждена/);assert.equal(journal.read()?.txid,txid,'A pending receipt remains recoverable without submitting another swap.');
  } finally {Connection.prototype.getTransaction=getTransaction;if(previousRpc===undefined)delete process.env.NEXT_PUBLIC_SOLANA_TRANSACTION_RPC_URL;else process.env.NEXT_PUBLIC_SOLANA_TRANSACTION_RPC_URL=previousRpc;}
  assert(IMP_SWAP_URL.endsWith(`/${SOL_MINT}-${IMPERIVM_TITLE.mint}`));
  let options: Parameters<Parameters<typeof mountImpSwap>[0]['init']>[0] | undefined;
  let event='', error='', closes=0, unmounts=0;const screens:SwapScreen[]=[];
  const plugin={init:(value:Parameters<Parameters<typeof mountImpSwap>[0]['init']>[0])=>{options=value;},close:()=>{closes++;},root:{unmount:()=>{unmounts++;}} as {unmount:()=>void}|null};
  const previousWindow=globalThis.window;Object.defineProperty(globalThis,'window',{value:{Jupiter:plugin},configurable:true,writable:true});
  try {
    await mountImpSwap(plugin,'test-imp-purchase',hash=>{event=hash;},screen=>{screens.push(screen);},message=>{error=message;});
    assert(options);assert.equal(options.autoConnect,true);assert.equal(options.formProps.initialInputMint,SOL_MINT);assert.equal(options.formProps.initialOutputMint,IMPERIVM_TITLE.mint);assert.equal(options.formProps.fixedMint,IMPERIVM_TITLE.mint);assert.equal(options.formProps.swapMode,'ExactIn');assert.equal(event,'','Opening or reconnecting a form never starts a financial action.');
    for (const screen of ['Initial','Wallet','Swapping','Success'] as const) options.onScreenUpdate(screen);assert.deepEqual(screens,['Initial','Wallet','Swapping','Success']);assert.equal(event,'','Screen transitions alone cannot credit a purchase.');
    options.onSuccess({txid});assert.equal(event,txid);
    options.onScreenUpdate('Error');options.onSwapError({error:{message:'Wallet rejected request'}});assert.equal(error,'Wallet rejected request');options.onSwapError({});assert.match(error,/Обмен не подтверждён/);
    await assert.rejects(mountImpSwap({init:()=>{},close:()=>{}},'second-form',()=>{}),/уже открыта/);
    closeImpSwap('unrelated-form');assert.equal(closes,0);assert.equal(unmounts,0);closeImpSwap('test-imp-purchase');assert.equal(closes,1);assert.equal(unmounts,1);assert.equal(plugin.root,null);closeImpSwap('test-imp-purchase');assert.equal(closes,1,'Repeated cleanup is harmless.');
    await assert.rejects(mountImpSwap({init:async()=>{throw Error('Plugin failed');},close:()=>{}},'failed-form',()=>{}),/Plugin failed/);
    await mountImpSwap(plugin,'second-form',()=>{});closeImpSwap('second-form');assert.equal(closes,2,'Failed initialization releases the single-widget lock.');
  } finally {if(previousWindow===undefined)delete (globalThis as {window?:Window}).window;else globalThis.window=previousWindow;}
  console.log('IMP purchase checks passed: exact confirmed net receipt, correct signer/mint/decimals, rejected failed/unrelated swaps, durable owner-scoped receipt re-verification, swap success/error/screens and widget cleanup. No swaps or deposits executed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
