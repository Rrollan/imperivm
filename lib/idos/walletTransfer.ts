import type {BlockchainNetworkDefinition, CryptoCurrencyDefinition, IDosGamesClient, SolanaWithdrawalSignature} from '@idosgames/core';
import type {SolanaProgramAdapter} from '@idosgames/wallet';
import type {Connection, Transaction} from '@solana/web3.js';
import {Buffer} from 'buffer';
import {IMPERIVM_TITLE} from './title';
import {validateImpToken} from './token';
import {idosResult} from './auth';

export type TransferDirection = 'deposit' | 'withdraw';
export type TransferProgress = {phase: 'preparing' | 'wallet' | 'confirming' | 'crediting' | 'complete'; hash?: string};
export type TransferReceipt = {version: 1; userId: string; owner: string; direction: TransferDirection; amount: string; startedAt: number; hash?: string; transactionId?: string; requestUncertain?: boolean; lastValidBlockHeight?: number};
export interface TransferStorage {getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void;}
export const TRANSFER_KEY = 'imperivm.imp-transfer.v1';
const signaturePattern = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
/** IMP's six decimals are parsed as integers; never round a payment with Number. */
export function parseImpTransferAmount(input: string): {amount: string; raw: bigint} {
  const clean = input.trim().replace(',', '.');
  if (!/^\d{1,14}(?:\.\d{1,6})?$/.test(clean)) throw new Error('Введите положительную сумму IMP, до 6 знаков после запятой.');
  const [integer, fraction = ''] = clean.split('.');
  const raw = BigInt(integer) * BigInt('1000000') + BigInt(fraction.padEnd(6, '0'));
  if (raw <= BigInt('0') || raw > BigInt('18446744073709551615')) throw new Error('Сумма IMP вне допустимого диапазона.');
  const remaining = fraction.replace(/0+$/, '');
  return {raw, amount: `${BigInt(integer)}${remaining ? `.${remaining}` : ''}`};
}
export function transferJournalKey(userId: string, owner: string) {return `${TRANSFER_KEY}:${IMPERIVM_TITLE.id}:${userId}:${owner}`;}
export class TransferJournal {
  private readonly key: string;
  constructor(private storage: TransferStorage, readonly userId: string, readonly owner: string) {this.key = transferJournalKey(userId, owner);}
  read(): TransferReceipt | null {
    const raw = this.storage.getItem(this.key); if (!raw) return null;
    let receipt: TransferReceipt;
    try {receipt = JSON.parse(raw);} catch {throw new Error('История перевода повреждена. Проверьте операции в кошельке iDos.');}
    if (receipt.version !== 1 || receipt.userId !== this.userId || receipt.owner !== this.owner || !['deposit', 'withdraw'].includes(receipt.direction) || !Number.isSafeInteger(receipt.startedAt) || typeof receipt.amount !== 'string' || (receipt.hash && !signaturePattern.test(receipt.hash)) || (receipt.transactionId && (typeof receipt.transactionId !== 'string' || receipt.transactionId.length > 160))) throw new Error('Не удалось проверить сохранённый перевод. Откройте историю iDos.');
    parseImpTransferAmount(receipt.amount);
    return receipt;
  }
  save(receipt: TransferReceipt) {this.storage.setItem(this.key, JSON.stringify(receipt)); if (this.storage.getItem(this.key) !== JSON.stringify(receipt)) throw new Error('Не удалось сохранить чек перевода. Разрешите хранилище браузера.');}
  clear() {this.storage.removeItem(this.key);}
}
export type TransferConfig = {network: BlockchainNetworkDefinition; currency: CryptoCurrencyDefinition; balance: string; pending: TransferReceipt | null; withdrawalFeePercent: string | null; minimumAccountAgeDays: number | null};
function feePercent(currency: CryptoCurrencyDefinition): string | null {
  const values = [currency.DeveloperWithdrawalFeePercent, currency.CommunityMarketingWithdrawalFeePercent, currency.WithdrawalBurnPercent];
  if (values.every(value => value == null)) return null;
  if (values.some(value => value != null && !/^\d{1,2}(?:\.\d{1,6})?$/.test(value))) return null;
  const sum = values.reduce((total, value) => total + (value == null ? BigInt('0') : BigInt(value.split('.')[0]) * BigInt('1000000') + BigInt((value.split('.')[1] ?? '').padEnd(6, '0'))), BigInt('0'));
  if (sum > BigInt('100000000')) return null;
  const fraction = (sum % BigInt('1000000')).toString().padStart(6, '0').replace(/0+$/, '');
  return `${sum / BigInt('1000000')}${fraction ? '.' + fraction : ''}`;
}
export async function loadImpTransferConfig(client: IDosGamesClient, journal: TransferJournal): Promise<TransferConfig> {
  const definitions = idosResult(await client.blockchain.getDefinitions({forceRefresh: true}));
  validateImpToken({CryptoCurrencies: definitions.CryptoCurrencies});
  const network = definitions.Blockchain?.Networks?.[IMPERIVM_TITLE.network], currency = definitions.CryptoCurrencies?.[IMPERIVM_TITLE.currency];
  if (!network || network.Type !== 'Solana' || network.ChainID === 103 || !network.RewardPoolAddress || !currency) throw new Error('iDos ещё не настроил пул IMP в Solana mainnet.');
  const state = idosResult(await client.blockchain.getUserState());
  let pending = journal.read();
  if (!pending && state.State?.PendingWithdrawals?.some(item => item.Type === 'Token' && item.NetworkID === IMPERIVM_TITLE.network && item.AssetID === IMPERIVM_TITLE.currency)) {
    // A withdrawal begun on another device is also recoverable; never assume an empty local journal means no debit.
    const ids = new Set(state.State.PendingWithdrawals.filter(item => item.Type === 'Token' && item.NetworkID === IMPERIVM_TITLE.network && item.AssetID === IMPERIVM_TITLE.currency).map(item => item.TitleTransactionID));
    const history = idosResult(await client.blockchain.getTransactionHistory(50));
    const previous = history.TokenTransactions?.find(item => ids.has(item.ID) && item.Direction === 'UsersCryptoWallet' && item.CurrencyID === IMPERIVM_TITLE.currency && item.To === journal.owner && item.Status === 'Pending' && item.Amount && item.CreatedAt);
    if (!previous?.ID || !previous.Amount || !previous.CreatedAt) throw new Error('На счёте уже есть незавершённый вывод IMP. Проверьте историю кошелька iDos.');
    pending = {version: 1, userId: journal.userId, owner: journal.owner, direction: 'withdraw', amount: parseImpTransferAmount(previous.Amount).amount, startedAt: Date.parse(previous.CreatedAt), transactionId: previous.ID, hash: previous.TransactionHash ?? undefined};
    if (!Number.isSafeInteger(pending.startedAt) || pending.hash && !signaturePattern.test(pending.hash)) throw new Error('iDos вернул неполный чек предыдущего вывода.');
    journal.save(pending);
  }
  const system = definitions.Blockchain?.SystemState;
  const webEnabled = system?.PlatformOverrides?.Web !== false && network.PlatformOverrides?.Web !== false;
  const configuredAge = definitions.Blockchain?.AccountSafety?.MinAccountAgeDays;
  const minimumAccountAgeDays = typeof configuredAge === 'number' && Number.isSafeInteger(configuredAge) && configuredAge >= 0 ? configuredAge : null;
  return {network: {...network, NetworkID: IMPERIVM_TITLE.network,
    DepositsEnabled: network.DepositsEnabled === true && system?.DepositsEnabled !== false && webEnabled,
    WithdrawalsEnabled: network.WithdrawalsEnabled === true && system?.WithdrawalsEnabled !== false && webEnabled,
  }, currency, balance: client.data.user.getCryptoCurrencyAmount(IMPERIVM_TITLE.currency), pending, withdrawalFeePercent: feePercent(currency), minimumAccountAgeDays};
}
/** Allow only a HTTPS transaction endpoint; the server fixes the mainnet upstream. */
export function impTransactionRpcUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SOLANA_TRANSACTION_RPC_URL;
  if (explicit) {const url = new URL(explicit); if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Invalid transaction RPC URL.'); return url.href;}
  const url = new URL(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3102');
  url.protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol;
  url.pathname = '/wallet/rpc'; url.search = ''; url.hash = ''; return url.href;
}
/** Exported for a deterministic receipt saved BEFORE broadcast, including an ambiguous RPC failure. */
export function signatureBase58(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = BigInt('0'); for (const byte of Array.from(bytes)) value = (value << BigInt('8')) | BigInt(byte);
  let output = ''; while (value > BigInt('0')) {output = alphabet[Number(value % BigInt('58'))] + output; value /= BigInt('58');}
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  return '1'.repeat(zeros) + output;
}
export type TransferAdapterFactory = (network: BlockchainNetworkDefinition, receipt: TransferReceipt, journal: TransferJournal, progress?: (value: TransferProgress) => void) => Promise<{adapter: SolanaProgramAdapter; connection: Connection}>;
type ReceiptRpc = Pick<Connection, 'getSignatureStatuses' | 'getBlockHeight'>;
async function receiptRpc(): Promise<ReceiptRpc> {const {Connection} = await import('@solana/web3.js'); return new Connection(impTransactionRpcUrl(), 'confirmed');}
const computeBudgetProgram = 'ComputeBudget111111111111111111111111111111';
const lighthouseProgram = 'L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95';
/** Phantom's priority fees and Lighthouse guards are not extra payments. Keep
 * every original financial instruction and its effective privileges exact.
 * Lighthouse MemoryWrite/Close and unfamiliar programs remain prohibited.
 * Source: Jac0xb/lighthouse@4c579479c98635e419b1b167f08be02a71604a71. */
export function assertSignedImpTransfer(expected: Transaction, signed: Transaction, policy: 'deposit' | 'immutable' | 'legacy' = 'legacy'): void {
  const refused = (reason = 'instructions') => {throw new Error(`Подписанный перевод не прошёл проверку (${reason}). Транзакция не отправлена.`);};
  if (!signed.signature || !signed.verifySignatures()) refused('signature');
  if (Buffer.from(signed.serializeMessage()).equals(Buffer.from(expected.serializeMessage()))) return;
  if (signed.recentBlockhash !== expected.recentBlockhash) refused('blockhash');
  if (!signed.feePayer?.equals(expected.feePayer!) ||
    signed.signatures.length !== expected.signatures.length || signed.signatures.some((item, index) => !item.publicKey.equals(expected.signatures[index].publicKey)) ||
    expected.signatures.some(item => item.signature)) refused('signers');
  // Instruction keys omit executable program accounts. Compare the compiled
  // privileges of EVERY original account, including programs, before allowing
  // any wallet-added assertion to reference one of them.
  const originalMessage = expected.compileMessage(), signedMessage = signed.compileMessage();
  const signedPositions = new Map(signedMessage.accountKeys.map((key, index) => [key.toBase58(), index]));
  originalMessage.accountKeys.forEach((key, index) => {
    const position = signedPositions.get(key.toBase58());
    if (position == null || originalMessage.isAccountSigner(index) !== signedMessage.isAccountSigner(position) ||
      originalMessage.isAccountWritable(index) !== signedMessage.isAccountWritable(position)) refused('account-privileges');
  });
  const originalBudget = expected.instructions.filter(ix => ix.programId.toBase58() === computeBudgetProgram);
  const added = signed.instructions.filter(ix => ix.programId.toBase58() === computeBudgetProgram);
  const guards = signed.instructions.filter(ix => ix.programId.toBase58() === lighthouseProgram);
  const originalFinancial = expected.instructions.filter(ix => ix.programId.toBase58() !== computeBudgetProgram);
  const financial = signed.instructions.filter(ix => ![computeBudgetProgram, lighthouseProgram].includes(ix.programId.toBase58()));
  if (expected.instructions.some(ix => ix.programId.toBase58() === lighthouseProgram) || financial.length !== originalFinancial.length) refused('extra-instructions');
  financial.forEach((ix, index) => {
    const original = originalFinancial[index];
    if (!ix.programId.equals(original.programId) || !ix.data.equals(original.data) || ix.keys.length !== original.keys.length ||
      ix.keys.some((key, position) => !key.pubkey.equals(original.keys[position].pubkey) || key.isSigner !== original.keys[position].isSigner || key.isWritable !== original.keys[position].isWritable)) refused(`payment-${index}`);
  });
  // Guards may only inspect accounts already involved in the original operation.
  // Single-target assertions 2/3/5..14/17 and zero-account clock assertion 15
  // are read-only; delta, memory, compression and state-changing CPI are excluded.
  const accounts = new Set(originalMessage.accountKeys.map(key => key.toBase58()));
  if (guards.length > 16) refused('guard-count');
  let guardSeen = false;
  for (const ix of signed.instructions) {
    if (ix.programId.toBase58() === lighthouseProgram) {
      guardSeen = true;
      const kind = ix.data[0], count = kind === 15 ? 0 : 1;
      // Borsh stores the LogLevel variant ordinal (0..6), not its Rust repr.
      if (![2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17].includes(kind) || ix.data.length < 3 || ix.data.length > 1024 || ix.data[1] > 6 || ix.keys.length !== count || ix.keys.some(key => !accounts.has(key.pubkey.toBase58()))) refused(`guard-${kind ?? 'empty'}`);
    } else if (guardSeen && policy !== 'deposit') refused('guard-order');
  }
  // A deposit has no index-sensitive signature voucher. Pure, whitelisted
  // assertions can run before or between its unchanged instructions: they can
  // only inspect existing accounts or fail the transaction. Phantom need not
  // place them last. All other policies retain the original ordered prefix.
  // Withdrawal vouchers include index-sensitive signature instructions. Neither
  // their budget nor the ordered original instruction prefix may be changed.
  if (policy === 'immutable' || policy === 'legacy' && originalBudget.length) {
    if (signed.instructions.length !== expected.instructions.length + guards.length || expected.instructions.some((ix, index) => {
      const actual = signed.instructions[index];
      return !actual || !actual.programId.equals(ix.programId) || !actual.data.equals(ix.data) || actual.keys.length !== ix.keys.length || actual.keys.some((key, position) => !key.pubkey.equals(ix.keys[position].pubkey) || key.isSigner !== ix.keys[position].isSigner || key.isWritable !== ix.keys[position].isWritable);
    })) refused('voucher-instructions');
    return;
  }
  if (added.length > 2 || originalBudget.length && !added.length) refused('fee-instructions');
  let limit = BigInt(1_400_000), price = BigInt(0); const seen = new Set<number>();
  for (const ix of added) {
    const kind = ix.data[0];
    if (ix.keys.length || seen.has(kind)) refused('fee-instructions');
    seen.add(kind);
    if (kind === 2 && ix.data.length === 5) {
      limit = BigInt(ix.data.readUInt32LE(1)); if (limit < BigInt(1) || limit > BigInt(1_400_000)) refused('fee-limit');
    } else if (kind === 3 && ix.data.length === 9) price = ix.data.readBigUInt64LE(1);
    else refused('fee-kind');
  }
  // Ceiling in lamports; reject unexpectedly expensive wallet-added priority fees.
  if ((limit * price + BigInt(999_999)) / BigInt(1_000_000) > BigInt(1_000_000)) throw new Error('Комиссия приоритета выше 0.001 SOL. Уменьшите её в Phantom и повторите перевод.');
}
export async function createImpTransferAdapter(network: BlockchainNetworkDefinition, receipt: TransferReceipt, journal: TransferJournal, progress: (value: TransferProgress) => void = () => {}) {
  const [{Connection, Transaction, ComputeBudgetProgram}, {createPlatformPoolAdapter}, {getWallets}] = await Promise.all([import('@solana/web3.js'), import('./platformPool'), import('@wallet-standard/app')]);
  const candidate = getWallets().get().find(wallet => wallet.name.toLowerCase() === 'phantom' && wallet.accounts.some(account => account.address === receipt.owner && account.chains.includes('solana:mainnet')) && 'solana:signTransaction' in wallet.features);
  if (!candidate) throw new Error('Подключите тот же кошелёк Phantom для перевода IMP.');
  const account = candidate.accounts.find(account => account.address === receipt.owner)!;
  type SignFeature = {supportedTransactionVersions: readonly ('legacy' | 0)[]; signTransaction(...inputs: {account: typeof account; transaction: Uint8Array; chain: 'solana:mainnet'}[]): Promise<readonly {signedTransaction: Uint8Array}[]>};
  const feature = candidate.features['solana:signTransaction'] as SignFeature;
  if (!feature.supportedTransactionVersions.includes('legacy')) throw new Error('Кошелёк не поддерживает перевод IMP.');
  const connection = new Connection(impTransactionRpcUrl(), 'confirmed');
  const latestBlockhash = connection.getLatestBlockhash.bind(connection), sendRaw = connection.sendRawTransaction.bind(connection);
  connection.getLatestBlockhash = async (...args) => {const result = await latestBlockhash(...args); receipt.lastValidBlockHeight = result.lastValidBlockHeight; journal.save(receipt); return result;};
  connection.sendRawTransaction = async (...args) => {
    const signed = Transaction.from(args[0]);
    if (!signed.signature) throw new Error('Phantom не подписал транзакцию.');
    receipt.hash = signatureBase58(signed.signature); journal.save(receipt);
    progress({phase: 'confirming', hash: receipt.hash});
    const hash = await sendRaw(...args); if (hash !== receipt.hash) throw new Error('RPC вернул другую подпись перевода.'); return hash;
  };
  const adapter = createPlatformPoolAdapter({connection, owner: receipt.owner, programId: network.RewardPoolAddress!, signTransaction: async (transaction: Transaction) => {
    if (!candidate.accounts.some(current => current.address === receipt.owner)) throw new Error('Кошелёк изменился. Перевод отменён.');
    // Request an explicit budget. Phantom can append safety assertions or adjust
    // this deposit budget; the post-sign guard verifies those changes separately.
    // 300k CU matches the pool SDK's withdrawal limit; 10k micro-lamports/CU
    // caps our added priority fee at 3,000 lamports (0.000003 SOL).
    // Withdrawal vouchers retain their original instruction indices and budget.
    if (receipt.direction === 'deposit' && !transaction.instructions.some(ix => ix.programId.toBase58() === computeBudgetProgram)) transaction.instructions.unshift(
      ComputeBudgetProgram.setComputeUnitLimit({units: 300_000}), ComputeBudgetProgram.setComputeUnitPrice({microLamports: 10_000}),
    );
    const bytes = transaction.serialize({requireAllSignatures: false, verifySignatures: false});
    // Deserialization resolves account privileges exactly as they appear on the wire.
    const expected = Transaction.from(bytes);
    progress({phase: 'wallet'});
    const [result] = await feature.signTransaction({account, transaction: bytes, chain: 'solana:mainnet'});
    if (!result || !candidate.accounts.some(current => current.address === receipt.owner)) throw new Error('Подпись отменена или кошелёк изменился.');
    const signed = Transaction.from(result.signedTransaction);
    assertSignedImpTransfer(expected, signed, receipt.direction === 'deposit' ? 'deposit' : 'immutable');
    return signed;
  }});
  return {adapter, connection};
}

export class ImpTransferService {
  private busy = false;
  constructor(private client: IDosGamesClient, readonly journal: TransferJournal, private factory: TransferAdapterFactory = createImpTransferAdapter, private readRpc: () => Promise<ReceiptRpc> = receiptRpc) {}
  async config() {return loadImpTransferConfig(this.client, this.journal);}
  private assertAccount() {if (!this.client.auth.context || this.client.auth.context.userID !== this.journal.userId) throw new Error('Аккаунт iDos изменился. Войдите заново.');}
  async transfer(direction: TransferDirection, input: string, expectedWithdrawalFeePercent?: string | null, progress: (value: TransferProgress) => void = () => {}): Promise<string> {
    if (this.busy || this.journal.read()) throw new Error('Предыдущий перевод ещё проверяется. Повторное списание заблокировано.');
    const {amount, raw} = parseImpTransferAmount(input);
    this.busy = true;
    let receipt: TransferReceipt | undefined;
    try {
      this.assertAccount();
      progress({phase: 'preparing'});
      const config = await this.config();
      if (config.pending) throw new Error('На игровом счёте есть незавершённый перевод. Сначала восстановите его.');
      if (direction === 'withdraw' && expectedWithdrawalFeePercent !== undefined && config.withdrawalFeePercent !== expectedWithdrawalFeePercent) throw new Error('Комиссия вывода iDos изменилась. Проверьте новую комиссию перед подтверждением.');
      const binding = config.currency.Networks?.find(item => item.NetworkID === IMPERIVM_TITLE.network);
      if (direction === 'deposit' && (config.network.DepositsEnabled !== true || config.currency.Permissions?.DepositsEnabled !== true) || direction === 'withdraw' && (config.network.WithdrawalsEnabled !== true || config.currency.Permissions?.WithdrawalsEnabled !== true)) throw new Error('iDos временно отключил этот перевод.');
      if (direction === 'deposit' && binding?.DepositsEnabled === false || direction === 'withdraw' && binding?.WithdrawalsEnabled === false) throw new Error('iDos временно отключил перевод IMP в этой сети.');
      if (direction === 'withdraw' && binding?.MinWithdraw && binding.MinWithdraw !== '0' && raw < parseImpTransferAmount(binding.MinWithdraw).raw) throw new Error(`Минимальный вывод iDos: ${binding.MinWithdraw} IMP.`);
      if (direction === 'withdraw' && (config.balance === '0' ? BigInt('0') : parseImpTransferAmount(config.balance).raw) < raw) throw new Error('Недостаточно IMP на игровом счёте.');
      receipt = {version: 1, userId: this.journal.userId, owner: this.journal.owner, direction, amount, startedAt: Date.now()};
      this.journal.save(receipt);
      const {adapter} = await this.factory(config.network, receipt, this.journal, progress);
      this.assertAccount();
      if (direction === 'deposit') {
        const {depositTokenSolana} = await import('@idosgames/wallet');
        const originalDeposit = adapter.depositSpl.bind(adapter);
        const tracked = {...adapter, depositSpl: async (args: Parameters<typeof originalDeposit>[0]) => {const hash = await originalDeposit(args); progress({phase: 'crediting', hash}); return hash;}};
        const result = await depositTokenSolana({client: this.client, adapter: tracked, network: config.network, mint: IMPERIVM_TITLE.mint, amountRaw: raw, titleID: this.client.titleID});
        if (!result.ok) throw new Error(result.error);
      } else {
        // Persist the debit ID immediately; a failed signature never creates a second withdrawal.
        receipt.requestUncertain = true; this.journal.save(receipt);
        const requested = await this.client.blockchain.requestTokenWithdrawal(IMPERIVM_TITLE.currency, IMPERIVM_TITLE.network, receipt.owner, amount, 'game_topup');
        // A refused/failed SDK result can follow a lost server reply. Keep the intent until history proves what happened.
        if (!requested.ok) throw new Error(requested.error);
        receipt.transactionId = requested.data.TitleTransactionID ?? undefined; receipt.requestUncertain = false; this.journal.save(receipt);
        if (!receipt.transactionId || !requested.data.SolanaSignature) throw new Error('iDos не вернул чек вывода. Проверьте историю операций.');
        this.validateVoucher(requested.data.SolanaSignature, config.network, amount);
        receipt.hash = await adapter.submitWithdrawal(requested.data.SolanaSignature); this.journal.save(receipt);
        const confirmed = idosResult(await this.client.blockchain.confirmWithdrawal(receipt.transactionId, receipt.hash));
        if (confirmed.Status !== 'Completed') throw new Error('iDos ещё проверяет этот вывод.');
      }
      progress({phase: 'complete', hash: receipt.hash});
      this.journal.clear();
      return amount;
    } catch (error) {
      // A deposit without a signed hash was never broadcast. A withdrawal with an ID/uncertain request stays locked.
      if (receipt && !receipt.hash && !receipt.transactionId && !receipt.requestUncertain) this.journal.clear();
      throw error;
    } finally {this.busy = false;}
  }
  private validateVoucher(voucher: SolanaWithdrawalSignature, network: BlockchainNetworkDefinition, amount: string) {
    if (voucher.ProgramID !== network.RewardPoolAddress || voucher.Mint !== IMPERIVM_TITLE.mint || voucher.WalletAddress !== this.journal.owner || voucher.UserID !== this.journal.userId || voucher.TitleID !== this.client.titleID || voucher.Category !== 'game_topup' || voucher.Domain !== 'SPL') throw new Error('iDos вернул вывод для другого аккаунта, токена или сети.');
    const raw = (value: string | number | null | undefined) => {
      if (typeof value === 'number' && !Number.isSafeInteger(value) || !/^\d{1,20}$/.test(String(value ?? '0'))) throw new Error('iDos вернул некорректную сумму вывода.');
      return BigInt(value ?? 0);
    };
    const total = raw(voucher.Amount) + raw(voucher.BurnAmount) + (voucher.Splits ?? []).reduce((sum, split) => sum + raw(split.Amount), BigInt(0));
    if (total !== parseImpTransferAmount(amount).raw || raw(voucher.Amount) <= BigInt(0)) throw new Error('Сумма подписанного вывода iDos не совпадает с подтверждённой суммой.');
  }
  async recover(): Promise<string> {
    if (this.busy) throw new Error('Перевод уже проверяется.');
    this.busy = true;
    try {
      this.assertAccount(); let receipt = this.journal.read(); if (!receipt) return 'complete';
      const config = await this.config();
      if (!receipt.hash && !receipt.transactionId && !receipt.requestUncertain) {this.journal.clear(); return 'complete';}
      if (receipt.direction === 'withdraw' && !receipt.transactionId) {
        const history = idosResult(await this.client.blockchain.getTransactionHistory(50));
        const matches = (history.TokenTransactions ?? []).filter(transaction => transaction.Direction === 'UsersCryptoWallet' && transaction.CurrencyID === IMPERIVM_TITLE.currency && transaction.To === receipt!.owner && transaction.Amount === receipt!.amount && Date.parse(transaction.CreatedAt ?? '') >= receipt!.startedAt - 5000 && transaction.ID);
        if (matches.length !== 1) throw new Error('iDos ещё проверяет запрос вывода. Откройте историю кошелька; новое списание заблокировано.');
        receipt = {...receipt, transactionId: matches[0].ID!, hash: matches[0].TransactionHash ?? receipt.hash, requestUncertain: false}; this.journal.save(receipt);
      }
      if (receipt.direction === 'withdraw' && receipt.transactionId) {
        const history = idosResult(await this.client.blockchain.getTransactionHistory(50));
        const transaction = history.TokenTransactions?.find(item => item.ID === receipt!.transactionId);
        if (transaction?.Status === 'Completed' || transaction?.RefundedAt) {this.journal.clear(); return 'complete';}
      }
      if (receipt.hash) {
        const connection = await this.readRpc();
        const status = (await connection.getSignatureStatuses([receipt.hash], {searchTransactionHistory: true})).value[0];
        if (status?.err) {if (receipt.direction === 'deposit') this.journal.clear(); throw new Error('Solana отклонила перевод. IMP не были перемещены. Для вывода проверьте возврат в истории iDos.');}
        if (!status || !['confirmed', 'finalized'].includes(status.confirmationStatus ?? '')) {
          if (!status && receipt.direction === 'deposit' && receipt.lastValidBlockHeight && await connection.getBlockHeight('confirmed') > receipt.lastValidBlockHeight) {
            const history = idosResult(await this.client.blockchain.getTransactionHistory(50));
            if ((history.TokenTransactions ?? []).some(transaction => transaction.TransactionHash === receipt!.hash && transaction.Status === 'Completed' && transaction.Direction === 'Game' && transaction.CurrencyID === IMPERIVM_TITLE.currency && transaction.From === receipt!.owner)) {this.journal.clear(); return 'complete';}
            // An expired blockhash does not prove a broadcast failed: the RPC may be behind or omit history.
            throw new Error('RPC пока не подтверждает этот перевод. Проверьте его в истории iDos и Solana; новый перевод заблокирован, чтобы не списать IMP повторно.');
          }
          throw new Error('Ожидаем подтверждение того же перевода в Solana. Повторная отправка заблокирована.');
        }
        if (receipt.direction === 'deposit') {
          const deposited = await this.client.blockchain.depositToken(IMPERIVM_TITLE.network, receipt.hash);
          if (!deposited.ok) {
            const history = idosResult(await this.client.blockchain.getTransactionHistory(50));
            if (!(history.TokenTransactions ?? []).some(transaction => transaction.TransactionHash === receipt!.hash && transaction.Status === 'Completed' && transaction.Direction === 'Game' && transaction.CurrencyID === IMPERIVM_TITLE.currency && transaction.From === receipt!.owner)) throw new Error(deposited.error);
          }
        }
        else {const result = idosResult(await this.client.blockchain.confirmWithdrawal(receipt.transactionId!, receipt.hash)); if (result.Status !== 'Completed') throw new Error('iDos ещё проверяет этот вывод.');}
      } else if (receipt.direction === 'withdraw' && receipt.transactionId) {
        const history = idosResult(await this.client.blockchain.getTransactionHistory(50));
        const transaction = history.TokenTransactions?.find(item => item.ID === receipt!.transactionId);
        if (transaction?.Status === 'Completed' || transaction?.RefundedAt) {this.journal.clear(); return 'complete';}
        const voucher = idosResult(await this.client.blockchain.retryWithdrawal(receipt.transactionId));
        if (!voucher.SolanaSignature) throw new Error('iDos не вернул подпись для восстановления вывода.');
        this.validateVoucher(voucher.SolanaSignature, config.network, receipt.amount);
        const {adapter} = await this.factory(config.network, receipt, this.journal);
        receipt.hash = await adapter.submitWithdrawal(voucher.SolanaSignature); this.journal.save(receipt);
        const result = idosResult(await this.client.blockchain.confirmWithdrawal(receipt.transactionId, receipt.hash)); if (result.Status !== 'Completed') throw new Error('iDos ещё проверяет этот вывод.');
      } else {throw new Error('Проверьте историю перевода в кошельке iDos.');}
      this.journal.clear(); return 'complete';
    } finally {this.busy = false;}
  }
}
