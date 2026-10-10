import assert from 'node:assert/strict';
import {ComputeBudgetProgram, Connection, Keypair, SystemProgram, Transaction, TransactionInstruction, PublicKey} from '@solana/web3.js';
import type {IDosGamesClient, SolanaWithdrawalSignature} from '@idosgames/core';
import {IMPERIVM_TITLE} from '../../lib/idos/title';
import {createImpTransferAdapter, ImpTransferService, parseImpTransferAmount, signatureBase58, TransferJournal, type TransferAdapterFactory, type TransferReceipt} from '../../lib/idos/walletTransfer';
import {createPlatformPoolAdapter} from '../../lib/idos/platformPool';
import type {Wallet} from '@wallet-standard/base';

const owner = Keypair.fromSeed(new Uint8Array(32).fill(4)).publicKey.toBase58(), userId = 'test-user';
const signature = signatureBase58(new Uint8Array(64).fill(17));
const programId = Keypair.fromSeed(new Uint8Array(32).fill(9)).publicKey.toBase58();
const saved = new Map<string,string>(), storage = {getItem: (key:string) => saved.get(key) ?? null, setItem: (key:string, value:string) => {saved.set(key,value);}, removeItem: (key:string) => {saved.delete(key);}};
const journal = () => new TransferJournal(storage, userId, owner);
const receipt = (direction: 'deposit'|'withdraw'): TransferReceipt => ({version:1,userId,owner,direction,amount:'225000',startedAt:Date.now()});
const voucher: SolanaWithdrawalSignature = {ProgramID:programId,Mint:IMPERIVM_TITLE.mint,WalletAddress:owner,UserID:userId,TitleID:IMPERIVM_TITLE.id,Category:'game_topup',Domain:'SPL',Amount:'211500000000',Splits:[{To:programId,Amount:'13500000000'}]};
function fixture() {
  let requests=0, sends=0, reports=0, confirms=0, retries=0;
  let rejectReport=false, refuseWallet=false, uncertainRequest=false, falseRequest=false;
  const currentVoucher={...voucher};
  const definition={Blockchain:{SystemState:{DepositsEnabled:true,WithdrawalsEnabled:true,PlatformOverrides:{Web:true}},AccountSafety:{MinAccountAgeDays:7},Networks:{solana:{NetworkID:'solana',Type:'Solana',ChainID:0,RewardPoolAddress:programId,DepositsEnabled:true,WithdrawalsEnabled:true}}},CryptoCurrencies:{Main:{CurrencyID:'Main',Status:'Active',Permissions:{SpendableInGame:true,DepositsEnabled:true,WithdrawalsEnabled:true},Networks:[{NetworkID:'solana',ContractAddress:IMPERIVM_TITLE.mint,Decimals:6}],DeveloperWithdrawalFeePercent:'6'}}};
  const blockchain={
    getDefinitions:async(options: unknown)=>{assert.deepEqual(options,{forceRefresh:true});return {ok:true,data:definition};},
    getUserState:async()=>({ok:true,data:{}}),
    depositToken:async(network:string,hash:string)=>{reports++;assert.equal(network,'solana');assert.equal(hash,signature);return rejectReport?{ok:false,error:'Not enough confirmations',reason:'server'}:{ok:true,data:{AmountNative:'225000'}};},
    requestTokenWithdrawal:async(...args:unknown[])=>{requests++;assert.deepEqual(args,['Main','solana',owner,'225000','game_topup']);if(uncertainRequest)throw new Error('Request timed out');if(falseRequest)return {ok:false,reason:'network',error:'Network response lost'};return {ok:true,data:{TitleTransactionID:'withdraw-1',SolanaSignature:currentVoucher}};},
    confirmWithdrawal:async(id:string,hash:string)=>{confirms++;assert.equal(id,'withdraw-1');assert.equal(hash,signature);return {ok:true,data:{Status:'Completed'}};},
    retryWithdrawal:async(id:string)=>{retries++;assert.equal(id,'withdraw-1');return {ok:true,data:{TitleTransactionID:id,SolanaSignature:currentVoucher}};},
    getTransactionHistory:async()=>({ok:true,data:{TokenTransactions:[]}}),
  };
  const client={titleID:IMPERIVM_TITLE.id,auth:{context:{userID:userId}},blockchain,data:{user:{getCryptoCurrencyAmount:()=> '1000000'}}} as unknown as IDosGamesClient;
  const factory: TransferAdapterFactory=async(network,proof,log)=>({connection:{} as Connection,adapter:{
    depositSpl:async args=>{assert.equal(args.mint,IMPERIVM_TITLE.mint);assert.equal(args.amountRaw,BigInt('225000000000'));assert.equal(args.userID,userId);assert.equal(args.category,'game_topup');if(refuseWallet)throw new Error('Wallet declined');sends++;proof.hash=signature;log.save(proof);return signature;},
    submitWithdrawal:async()=>{if(refuseWallet)throw new Error('Wallet declined');sends++;proof.hash=signature;log.save(proof);return signature;},
  }});
  const rpc=async()=>({getSignatureStatuses:async()=>({context:{slot:1},value:[{slot:1,confirmations:1,err:null,confirmationStatus:'confirmed' as const}]}),getBlockHeight:async()=>100});
  const service=new ImpTransferService(client,journal(),factory,rpc);
  return {service,client,definition,currentVoucher,blockchain,counters:()=>({requests,sends,reports,confirms,retries}),setReportFailure:(value:boolean)=>{rejectReport=value;},setWalletRefusal:(value:boolean)=>{refuseWallet=value;},setUncertainRequest:(value:boolean)=>{uncertainRequest=value;},setFalseRequest:(value:boolean)=>{falseRequest=value;}};
}
async function main() {
  assert.deepEqual(parseImpTransferAmount(' 490021,764541 '),{amount:'490021.764541',raw:BigInt('490021764541')});
  assert.deepEqual(parseImpTransferAmount('000001.230000'),{amount:'1.23',raw:BigInt('1230000')});
  for(const input of ['0','-1','1e6','1.0000001','Infinity','1.2.3','1 000','18446744073710']) assert.throws(()=>parseImpTransferAmount(input));
  assert.equal(signatureBase58(new Uint8Array(64)), '1'.repeat(64));
  assert(signature.length >= 64 && signature.length <= 88);
  const owned=journal();owned.save(receipt('deposit'));assert.equal(owned.read()?.amount,'225000');assert.equal(new TransferJournal(storage,'other-user',owner).read(),null);owned.clear();
  const denied={getItem:()=>null,setItem:()=>{throw Error('Storage denied');},removeItem:()=>{}};
  assert.throws(()=>new TransferJournal(denied,userId,owner).save(receipt('deposit')),/Storage denied/);

  let f=fixture();const phases:string[]=[];await assert.rejects(f.service.transfer('deposit','0'));await f.service.transfer('deposit','225000',undefined,value=>{phases.push(value.phase);if(value.phase==='crediting'||value.phase==='complete')assert.equal(value.hash,signature);});assert.equal(journal().read(),null);assert.deepEqual(phases,['preparing','crediting','complete']);assert.deepEqual(f.counters(),{requests:0,sends:1,reports:1,confirms:0,retries:0});
  f=fixture();f.setWalletRefusal(true);await assert.rejects(f.service.transfer('deposit','225000'),/declined/);assert.equal(journal().read(),null);assert.equal(f.counters().reports,0);
  f=fixture();f.setReportFailure(true);const incompletePhases:string[]=[];await assert.rejects(f.service.transfer('deposit','225000',undefined,value=>{incompletePhases.push(value.phase);}),/confirmations/);assert.deepEqual(incompletePhases,['preparing','crediting'],'A chain transfer is not presented as complete before iDos credits it.');assert.equal(journal().read()?.hash,signature);await assert.rejects(f.service.transfer('deposit','225000'),/Повторное/);assert.equal(f.counters().sends,1);f.setReportFailure(false);await f.service.recover();assert.equal(journal().read(),null);assert.equal(f.counters().sends,1);assert.equal(f.counters().reports,2);
  f=fixture();f.definition.CryptoCurrencies.Main.Networks[0].Decimals=0;await assert.rejects(f.service.transfer('deposit','225000'),/6 decimals/);assert.equal(f.counters().sends,0);f.definition.CryptoCurrencies.Main.Networks[0].Decimals=6;f.definition.Blockchain.Networks.solana.DepositsEnabled=false;await assert.rejects(f.service.transfer('deposit','225000'),/отключил/);assert.equal(f.counters().sends,0);
  f=fixture();assert.equal((await f.service.config()).minimumAccountAgeDays,7);f.definition.Blockchain.AccountSafety.MinAccountAgeDays=12;assert.equal((await f.service.config()).minimumAccountAgeDays,12);
  f.definition.Blockchain.SystemState.DepositsEnabled=false;await assert.rejects(f.service.transfer('deposit','225000'),/отключил/);assert.equal(f.counters().sends,0);f.definition.Blockchain.SystemState.DepositsEnabled=true;
  f.definition.Blockchain.SystemState.WithdrawalsEnabled=false;await assert.rejects(f.service.transfer('withdraw','225000'),/отключил/);assert.equal(f.counters().requests,0);f.definition.Blockchain.SystemState.WithdrawalsEnabled=true;
  f.definition.Blockchain.SystemState.PlatformOverrides.Web=false;await assert.rejects(f.service.transfer('deposit','225000'),/отключил/);assert.equal(f.counters().sends,0);assert.equal((await f.service.config()).network.WithdrawalsEnabled,false);assert.equal(journal().read(),null);
  f=fixture();await assert.rejects(f.service.transfer('withdraw','225000','7'),/Комиссия вывода/);assert.equal(f.counters().requests,0);assert.equal(journal().read(),null);
  f=fixture();f.setWalletRefusal(true);await assert.rejects(f.service.transfer('withdraw','225000'),/declined/);assert.equal(journal().read()?.transactionId,'withdraw-1');await assert.rejects(f.service.transfer('withdraw','225000'),/Повторное/);f.setWalletRefusal(false);await f.service.recover();assert.equal(journal().read(),null);assert.deepEqual(f.counters(),{requests:1,sends:1,reports:0,confirms:1,retries:1});
  f=fixture();f.currentVoucher.WalletAddress=Keypair.generate().publicKey.toBase58();await assert.rejects(f.service.transfer('withdraw','225000'),/другого аккаунта/);assert.equal(f.counters().sends,0);assert.equal(journal().read()?.transactionId,'withdraw-1');journal().clear();
  f=fixture();f.currentVoucher.Amount='211500000001';await assert.rejects(f.service.transfer('withdraw','225000'),/Сумма подписанного вывода/);assert.equal(f.counters().sends,0);journal().clear();
  f=fixture();f.setUncertainRequest(true);await assert.rejects(f.service.transfer('withdraw','225000'),/timed out/);assert.equal(journal().read()?.requestUncertain,true);await assert.rejects(f.service.transfer('withdraw','225000'),/Повторное/);await assert.rejects(f.service.recover(),/проверяет запрос/);assert.equal(f.counters().requests,1);journal().clear();
  f=fixture();f.setFalseRequest(true);await assert.rejects(f.service.transfer('withdraw','225000'),/Network response lost/);assert.equal(journal().read()?.requestUncertain,true);await assert.rejects(f.service.transfer('withdraw','225000'),/Повторное/);assert.equal(f.counters().requests,1);journal().clear();
  f=fixture();journal().save({...receipt('deposit'),hash:signature,lastValidBlockHeight:99});const missingStatus=new ImpTransferService(f.client,journal(),undefined,async()=>({getSignatureStatuses:async()=>({context:{slot:1},value:[null]}),getBlockHeight:async()=>100}));await assert.rejects(missingStatus.recover(),/новый перевод заблокирован/);assert.equal(journal().read()?.hash,signature);await assert.rejects(missingStatus.transfer('deposit','225000'),/Повторное/);assert.equal(f.counters().sends,0);journal().clear();
  f=fixture();(f.client.auth.context as {userID:string}).userID='changed';await assert.rejects(f.service.transfer('deposit','225000'),/Аккаунт iDos изменился/);assert.equal(f.counters().sends,0);

  // Decode the official SDK's deposit wire transaction with mocked RPC/wallet; never broadcast.
  const signer=Keypair.fromSeed(new Uint8Array(32).fill(4));let captured:Transaction|null=null;
  const fakeConnection={getAccountInfo:async()=>({owner:new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb')}),getLatestBlockhash:async()=>({blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:10}),sendRawTransaction:async(bytes:Uint8Array)=>{captured=Transaction.from(bytes);return signature;},getSignatureStatuses:async()=>({value:[{err:null,confirmationStatus:'confirmed'}]})} as unknown as Connection;
  const adapter=createPlatformPoolAdapter({connection:fakeConnection,owner,programId,signTransaction:async tx=>{tx.sign(signer);return tx;}});
  await adapter.depositSpl({mint:IMPERIVM_TITLE.mint,amountRaw:BigInt('225000000000'),userID:userId,titleID:IMPERIVM_TITLE.id,category:'game_topup'});
  const transaction=captured as Transaction|null;assert(transaction);assert.equal(transaction.instructions.length,1);const ix=transaction.instructions[0];assert.equal(ix.programId.toBase58(),programId);assert.equal(ix.data.subarray(0,8).toString('hex'),'e000c6afc62f69cc');assert.equal(ix.data.readBigUInt64LE(8),BigInt('225000000000'));assert.equal(ix.keys[2].pubkey.toBase58(),IMPERIVM_TITLE.mint);assert.equal(ix.keys[3].pubkey.toBase58(),owner);assert(ix.keys[3].isSigner);
  // Exercise the real Wallet Standard wrapper: a receipt must be durable before any RPC send.
  const {getWallets}=await import('@wallet-standard/app');const registry=getWallets();const original={getAccountInfo:Connection.prototype.getAccountInfo,getLatestBlockhash:Connection.prototype.getLatestBlockhash,sendRawTransaction:Connection.prototype.sendRawTransaction,getSignatureStatuses:Connection.prototype.getSignatureStatuses};
  const account={address:owner,publicKey:signer.publicKey.toBytes(),chains:['solana:mainnet'],features:['solana:signTransaction']};
  let modify = (_tx: Transaction) => {}, broadcasts = 0;
  const disconnect=registry.register({version:'1.0.0',name:'Phantom',icon:'data:image/png;base64,AA==',chains:['solana:mainnet'],accounts:[account],features:{'solana:signTransaction':{version:'1.0.0',supportedTransactionVersions:['legacy'],signTransaction:async(input:{transaction:Uint8Array,chain:string})=>{assert.equal(input.chain,'solana:mainnet');const tx=Transaction.from(input.transaction);modify(tx);tx.sign(signer);return [{signedTransaction:tx.serialize()}];}}}} as unknown as Wallet);
  try {
    const proof=receipt('deposit'), log=journal();log.save(proof);
    Connection.prototype.getAccountInfo=async()=>({owner:new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'),data:Buffer.alloc(1),lamports:1,executable:false,rentEpoch:0});
    Connection.prototype.getLatestBlockhash=async()=>({blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:99});
    Connection.prototype.sendRawTransaction=async bytes=>{broadcasts++;const signed=Transaction.from(bytes);assert(signed.signature);const hash=signatureBase58(signed.signature);assert.equal(log.read()?.hash,hash);assert.equal(log.read()?.lastValidBlockHeight,99);return hash;};
    Connection.prototype.getSignatureStatuses=async()=>({context:{slot:1},value:[{slot:1,confirmations:1,err:null,confirmationStatus:'confirmed'}]});
    const walletPhases:string[]=[];
    modify = tx => {assert.equal(tx.instructions.length,3,'The wallet receives one explicit budget and the original deposit.');assert.equal(tx.instructions[0].programId.toBase58(),ComputeBudgetProgram.programId.toBase58());assert.equal(tx.instructions[0].data.readUInt32LE(1),300000);assert.equal(tx.instructions[1].data.readBigUInt64LE(1),BigInt(10000));assert.equal(tx.instructions[2].programId.toBase58(),programId);assert.equal(tx.instructions[2].data.readBigUInt64LE(8),BigInt('225000000000'));};
    const {adapter:wrapped}=await createImpTransferAdapter({RewardPoolAddress:programId},proof,log,value=>{walletPhases.push(value.phase);if(value.phase==='confirming')assert.equal(log.read()?.hash,value.hash,'A visible chain confirmation is tied to the durable receipt.');});
    await wrapped.depositSpl({mint:IMPERIVM_TITLE.mint,amountRaw:BigInt('225000000000'),userID:userId,titleID:IMPERIVM_TITLE.id,category:'game_topup'});assert(log.read()?.hash);assert.deepEqual(walletPhases,['wallet','confirming']);log.clear();
    const deposit = async (amount='1') => {const next={...receipt('deposit'),amount};log.save(next);const {adapter}=await createImpTransferAdapter({RewardPoolAddress:programId},next,log);return adapter.depositSpl({mint:IMPERIVM_TITLE.mint,amountRaw:parseImpTransferAmount(amount).raw,userID:userId,titleID:IMPERIVM_TITLE.id,category:'game_topup'});};
    const budget = () => [ComputeBudgetProgram.setComputeUnitLimit({units:300000}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:250000})];
    modify = () => {};await deposit();assert(log.read()?.hash);assert.equal(broadcasts,2);log.clear();
    const lighthouse=new PublicKey('L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95');
    // Pinned Lighthouse codec: AssertAccountInfo(5), Silent(0), IsWritable(6), true, Equal(0).
    // The guard inspects the already-writable deposit signer and cannot spend or create accounts.
    const guard=(target=signer.publicKey,data=Buffer.from([5,0,6,1,0]))=>new TransactionInstruction({programId:lighthouse,keys:[{pubkey:target,isSigner:false,isWritable:false}],data});
    // Phantom may normalize bounded priority limits/prices. Neither a new payment nor a new recipient is allowed.
    for (const change of [
      (tx:Transaction)=>{tx.instructions[0]=ComputeBudgetProgram.setComputeUnitLimit({units:300001});},
      (tx:Transaction)=>{tx.instructions[1]=ComputeBudgetProgram.setComputeUnitPrice({microLamports:10001});},
      (tx:Transaction)=>{tx.instructions[1]=ComputeBudgetProgram.setComputeUnitPrice({microLamports:2440000});tx.instructions.push(guard());assert.equal(tx.instructions[2].data.readBigUInt64LE(8),BigInt('100000000'));},
      (tx:Transaction)=>{tx.instructions.push(guard());},
      (tx:Transaction)=>{tx.instructions.push(guard(tx.instructions[2].programId));}, // read-only program assertion is allowed
      (tx:Transaction)=>{tx.instructions.unshift(guard());},
      (tx:Transaction)=>{tx.instructions.splice(1,0,guard());},
      (tx:Transaction)=>{tx.instructions.splice(2,0,guard());},
      (tx:Transaction)=>{tx.instructions=[tx.instructions[2],guard(),tx.instructions[0],tx.instructions[1]];},
    ]) {const before:number=broadcasts;modify=change;await deposit('100');assert.equal(broadcasts,before+1);assert(log.read()?.hash);log.clear();}
    const beforeRejected=broadcasts;
    const forbidden: ((tx:Transaction)=>void)[] = [
      tx=>{tx.instructions[2].data=Buffer.from(tx.instructions[2].data);tx.instructions[2].data.writeBigUInt64LE(BigInt('2000000'),8);},
      tx=>{tx.instructions[2].keys[2].pubkey=Keypair.generate().publicKey;},
      tx=>{tx.instructions[2].programId=SystemProgram.programId;},
      tx=>{tx.recentBlockhash=Keypair.generate().publicKey.toBase58();},
      tx=>{tx.instructions.push(SystemProgram.transfer({fromPubkey:signer.publicKey,toPubkey:Keypair.generate().publicKey,lamports:1}));},
      tx=>{tx.instructions[2].keys[0].isWritable=!tx.instructions[2].keys[0].isWritable;},
      tx=>{tx.instructions.unshift(...budget(),ComputeBudgetProgram.setComputeUnitPrice({microLamports:1}));},
      tx=>{tx.instructions.unshift(ComputeBudgetProgram.requestHeapFrame({bytes:32768}));},
      tx=>{tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({units:1400001}));},
      tx=>{tx.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({units:300000}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:3333334}));},
      tx=>{tx.instructions.unshift(new TransactionInstruction({programId:ComputeBudgetProgram.programId,keys:[],data:Buffer.from([2])}));},
      tx=>{tx.instructions.unshift(new TransactionInstruction({programId:ComputeBudgetProgram.programId,keys:[{pubkey:signer.publicKey,isSigner:false,isWritable:true}],data:budget()[0].data}));},
    ];
    for (const change of forbidden) {modify=change;await assert.rejects(deposit(),/Подписанный перевод не прошёл проверку|Комиссия приоритета/);assert.equal(broadcasts,beforeRejected,'A changed payment must never reach sendRawTransaction');assert.equal(log.read()?.hash,undefined);log.clear();}
    // Duplicated/deleted budgets and non-assertion Lighthouse mutations cannot be broadcast.
    const forbiddenEnhancements: ((tx:Transaction)=>void)[] = [
      tx=>{tx.instructions.unshift(...budget());},
      tx=>{tx.instructions.push(...budget());},
      tx=>{tx.instructions.splice(0,2);},
      tx=>{tx.instructions.push(guard(signer.publicKey,Buffer.from([0,0,0])));}, // MemoryWrite
      tx=>{tx.instructions.push(guard(signer.publicKey,Buffer.from([1,0,0])));}, // MemoryClose
      tx=>{tx.instructions.push(guard(signer.publicKey,Buffer.from([4,0,0])));}, // delta/memory
      tx=>{tx.instructions.push(guard(signer.publicKey,Buffer.from([16,0,0])));}, // compression/CPI
      tx=>{tx.instructions.push(guard(signer.publicKey,Buffer.from([255,0,0])));},
      tx=>{tx.instructions.push(guard(signer.publicKey,Buffer.from([5,0])));}, // truncated opcode/header
      tx=>{tx.instructions.push(guard(signer.publicKey,Buffer.from([5,255,6,1,0])));}, // invalid Borsh LogLevel
      tx=>{tx.instructions.push(guard(Keypair.generate().publicKey));}, // unrelated target account
      tx=>{const extra=guard();extra.programId=Keypair.generate().publicKey;tx.instructions.push(extra);},
      tx=>{const extra=guard();extra.keys.push({pubkey:signer.publicKey,isSigner:false,isWritable:false});tx.instructions.push(extra);},
      tx=>{const extra=guard(tx.instructions[2].keys[2].pubkey);extra.keys[0].isWritable=true;tx.instructions.push(extra);}, // elevates mint privilege
      tx=>{const extra=guard(tx.instructions[2].programId);extra.keys[0].isWritable=true;tx.instructions.push(extra);}, // executable pool program privilege
      tx=>{const extra=guard(ComputeBudgetProgram.programId);extra.keys[0].isWritable=true;tx.instructions.unshift(extra);}, // original budget program privilege
      tx=>{tx.instructions.push(...Array.from({length:17},()=>guard()));},
      tx=>{tx.instructions[1]=ComputeBudgetProgram.setComputeUnitPrice({microLamports:3333334});}, // ceil > 0.001 SOL
    ];
    for (const change of forbiddenEnhancements) {modify=change;await assert.rejects(deposit(),/Подписанный перевод не прошёл проверку|Комиссия приоритета/);assert.equal(broadcasts,beforeRejected);assert.equal(log.read()?.hash,undefined);log.clear();}
    // An existing withdrawal budget must remain byte-identical even with a valid wallet signature.
    const {assertSignedImpTransfer}=await import('../../lib/idos/walletTransfer');
    const protectedTx=new Transaction({feePayer:signer.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58()}).add(...budget(),SystemProgram.transfer({fromPubkey:signer.publicKey,toPubkey:signer.publicKey,lamports:1}));
    const originalTx=Transaction.from(protectedTx.serialize({requireAllSignatures:false,verifySignatures:false}));
    protectedTx.instructions[1]=ComputeBudgetProgram.setComputeUnitPrice({microLamports:1});protectedTx.sign(signer);assert.throws(()=>assertSignedImpTransfer(originalTx,protectedTx,'immutable'),/Подписанный перевод не прошёл проверку/);
    const invalid=Transaction.from(originalTx.serialize({requireAllSignatures:false,verifySignatures:false}));assert.throws(()=>assertSignedImpTransfer(originalTx,invalid),/signature/);
    const invalidSignature=Transaction.from(originalTx.serialize({requireAllSignatures:false,verifySignatures:false}));invalidSignature.sign(signer);invalidSignature.signatures[0].signature=Buffer.alloc(64,1);assert.throws(()=>assertSignedImpTransfer(originalTx,invalidSignature,'deposit'),/signature/);
    const changedPayer=Keypair.generate(), payerTx=Transaction.from(originalTx.serialize({requireAllSignatures:false,verifySignatures:false}));payerTx.feePayer=changedPayer.publicKey;payerTx.sign(changedPayer,signer);assert.throws(()=>assertSignedImpTransfer(originalTx,Transaction.from(payerTx.serialize()),'deposit'),/signers/);
    const immutableGuard=Transaction.from(originalTx.serialize({requireAllSignatures:false,verifySignatures:false}));immutableGuard.instructions.push(guard());immutableGuard.sign(signer);assert.doesNotThrow(()=>assertSignedImpTransfer(originalTx,Transaction.from(immutableGuard.serialize()),'immutable'));
    for(const position of [0,1,2]) {const guardedVoucher=Transaction.from(originalTx.serialize({requireAllSignatures:false,verifySignatures:false}));guardedVoucher.instructions.splice(position,0,guard());guardedVoucher.sign(signer);assert.throws(()=>assertSignedImpTransfer(originalTx,Transaction.from(guardedVoucher.serialize()),'immutable'),/guard-order|voucher-instructions/);}
    const immutableReordered=Transaction.from(originalTx.serialize({requireAllSignatures:false,verifySignatures:false}));immutableReordered.instructions=[immutableReordered.instructions[2],immutableReordered.instructions[0],immutableReordered.instructions[1]];immutableReordered.sign(signer);assert.throws(()=>assertSignedImpTransfer(originalTx,Transaction.from(immutableReordered.serialize()),'immutable'),/voucher-instructions/);
    // Legacy transactions without an explicit budget still support bounded Phantom enhancements.
    const legacy = () => Transaction.from(new Transaction({feePayer:signer.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58()}).add(SystemProgram.transfer({fromPubkey:signer.publicKey,toPubkey:Keypair.generate().publicKey,lamports:1})).serialize({requireAllSignatures:false,verifySignatures:false}));
    for (const position of ['prepend','append'] as const) {const expected=legacy();const enhanced=Transaction.from(expected.serialize({requireAllSignatures:false,verifySignatures:false}));if(position==='prepend')enhanced.instructions.unshift(...budget());else enhanced.instructions.push(...budget());enhanced.sign(signer);assert.doesNotThrow(()=>assertSignedImpTransfer(expected,Transaction.from(enhanced.serialize())));}
    const expected=legacy(), expensive=Transaction.from(expected.serialize({requireAllSignatures:false,verifySignatures:false}));expensive.instructions.unshift(ComputeBudgetProgram.setComputeUnitLimit({units:300000}),ComputeBudgetProgram.setComputeUnitPrice({microLamports:3333334}));expensive.sign(signer);assert.throws(()=>assertSignedImpTransfer(expected,Transaction.from(expensive.serialize())),/Комиссия приоритета/);
    // Assertions never permit reordering, changing or adding financial instructions.
    const twoPayments=new Transaction({feePayer:signer.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58()}).add(SystemProgram.transfer({fromPubkey:signer.publicKey,toPubkey:Keypair.generate().publicKey,lamports:1}),SystemProgram.transfer({fromPubkey:signer.publicKey,toPubkey:Keypair.generate().publicKey,lamports:2}));
    const twoExpected=Transaction.from(twoPayments.serialize({requireAllSignatures:false,verifySignatures:false}));
    const between=Transaction.from(twoPayments.serialize({requireAllSignatures:false,verifySignatures:false}));between.instructions.splice(1,0,guard());between.sign(signer);assert.doesNotThrow(()=>assertSignedImpTransfer(twoExpected,Transaction.from(between.serialize()),'deposit'));
    const reordered=Transaction.from(twoPayments.serialize({requireAllSignatures:false,verifySignatures:false}));reordered.instructions=[guard(),reordered.instructions[1],reordered.instructions[0]];reordered.sign(signer);assert.throws(()=>assertSignedImpTransfer(twoExpected,Transaction.from(reordered.serialize()),'deposit'),/payment-0/);
    const changedWithGuard=Transaction.from(twoPayments.serialize({requireAllSignatures:false,verifySignatures:false}));changedWithGuard.instructions[0].data=Buffer.from(changedWithGuard.instructions[0].data);changedWithGuard.instructions[0].data.writeBigUInt64LE(BigInt(3),4);changedWithGuard.instructions.unshift(guard());changedWithGuard.sign(signer);assert.throws(()=>assertSignedImpTransfer(twoExpected,Transaction.from(changedWithGuard.serialize()),'deposit'),/payment-0/);
    // Losing a send response must retain the exact signed receipt; never send a fresh transaction automatically.
    modify=()=>{};Connection.prototype.sendRawTransaction=async bytes=>{broadcasts++;const signed=Transaction.from(bytes);assert(signed.signature);assert.equal(log.read()?.hash,signatureBase58(signed.signature));throw Error('RPC response lost');};
    await assert.rejects(deposit(),/RPC response lost/);assert.equal(broadcasts,beforeRejected+1);assert(log.read()?.hash);assert.equal(log.read()?.lastValidBlockHeight,99);log.clear();
  } finally {disconnect();Object.assign(Connection.prototype,original);}
  console.log('IMP transfer checks passed: exact six decimals, durable receipts and phases, single credit/debit, explicit deposit budget, bounded legacy Phantom fees, rejected financial/fee/privilege mutations, pure deposit assertions before/between/after instructions, exact financial ordering, and protected withdrawal vouchers. No external transactions.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
