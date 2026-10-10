import type {VersionedTransactionResponse} from '@solana/web3.js';
import {IMPERIVM_TITLE} from './title';
import {impTransactionRpcUrl} from './walletTransfer';
import type {TransferStorage} from './walletTransfer';

export const SOL_MINT = 'So11111111111111111111111111111111111111112';
export const IMP_SWAP_URL = `https://jup.ag/swap/${SOL_MINT}-${IMPERIVM_TITLE.mint}`;
const maxRaw = BigInt('18446744073709551615');
const signaturePattern = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
export type PurchaseReceipt = {owner: string; txid: string; createdAt: number};
/** Persist the transaction, never a trusted balance. Reopening verifies it again. */
export class PurchaseJournal {
  private key: string;
  constructor(private storage: TransferStorage, readonly owner: string) {this.key = `imperivm.imp-purchase.v1:${IMPERIVM_TITLE.id}:${owner}`;}
  read(): PurchaseReceipt | null {
    const raw = this.storage.getItem(this.key); if (!raw) return null;
    let value: PurchaseReceipt; try {value = JSON.parse(raw);} catch {throw new Error('Не удалось прочитать чек покупки. Проверьте историю Phantom.');}
    if (!value || typeof value !== 'object' || value.owner !== this.owner || typeof value.txid !== 'string' || !signaturePattern.test(value.txid) || !Number.isSafeInteger(value.createdAt)) throw new Error('Не удалось проверить сохранённый чек покупки.');
    return value;
  }
  save(txid: string) {if (!signaturePattern.test(txid)) throw new Error('Jupiter не вернул корректный чек покупки.'); const value = JSON.stringify({owner: this.owner, txid, createdAt: Date.now()}); this.storage.setItem(this.key, value); if (this.storage.getItem(this.key) !== value) throw new Error('Не удалось сохранить чек. Разрешите хранилище браузера.');}
}
/** A widget callback/quote is not a credit. Read the confirmed chain receipt and
 * calculate the actual net IMP received by the game account's signing wallet. */
export function purchasedImpAmount(receipt: VersionedTransactionResponse | null, owner: string): string {
  if (!receipt?.meta || receipt.meta.err !== null || !receipt.meta.preTokenBalances || !receipt.meta.postTokenBalances) throw new Error('Покупка ещё не подтверждена Solana. Проверьте чек и обновите баланс.');
  const message = receipt.transaction.message;
  const keys = message.staticAccountKeys;
  if (!keys.slice(0, message.header.numRequiredSignatures).some(key => key.toBase58() === owner)) throw new Error('Покупка выполнена другим кошельком. Войдите в iDos тем же Phantom.');
  const sum = (balances: NonNullable<VersionedTransactionResponse['meta']>['postTokenBalances']) => {
    if (!balances || balances.length > 128) throw new Error('Не удалось проверить токены покупки.');
    return balances.filter(balance => balance.mint === IMPERIVM_TITLE.mint && balance.owner === owner).reduce((total, balance) => {
      const value = balance.uiTokenAmount;
      if (value.decimals !== IMPERIVM_TITLE.decimals || !/^\d{1,20}$/.test(value.amount) || BigInt(value.amount) > maxRaw) throw new Error('Чек покупки содержит некорректный баланс IMP.');
      return total + BigInt(value.amount);
    }, BigInt(0));
  };
  const received = sum(receipt.meta.postTokenBalances) - sum(receipt.meta.preTokenBalances);
  if (received <= BigInt(0) || received > maxRaw) throw new Error('Этот чек не подтверждает получение IMP подключённым кошельком. Обновите баланс Phantom.');
  const fraction = (received % BigInt(1_000_000)).toString().padStart(6, '0').replace(/0+$/, '');
  return `${received / BigInt(1_000_000)}${fraction ? '.' + fraction : ''}`;
}
export async function verifyImpPurchase(txid: string, owner: string): Promise<string> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(txid)) throw new Error('Jupiter не вернул корректный чек покупки.');
  const {Connection} = await import('@solana/web3.js');
  const connection = new Connection(impTransactionRpcUrl(), 'confirmed');
  return purchasedImpAmount(await connection.getTransaction(txid, {commitment: 'confirmed', maxSupportedTransactionVersion: 0}), owner);
}

export type SwapScreen = 'Initial' | 'Swapping' | 'Success' | 'Error' | 'Wallet';
type Plugin = {init: (options: {displayMode: 'integrated'; integratedTargetId: string; autoConnect: true; localStoragePrefix: string; formProps: {initialInputMint: string; initialOutputMint: string; fixedMint: string; swapMode: 'ExactIn'}; onSuccess: (result: {txid: string}) => void; onSwapError: (result: {error?: {message?: string}}) => void; onScreenUpdate: (screen: SwapScreen) => void}) => void | Promise<void>; close: () => void; root?: {unmount: () => void} | null};
let loading: Promise<Plugin> | null = null, activeContainer: string | null = null;
function pluginWindow() {return window as Window & {Jupiter?: Plugin};}
/** Load the official swap UI only when requested, never during arena startup. */
export function loadImpSwapPlugin(): Promise<Plugin> {
  if (pluginWindow().Jupiter) return Promise.resolve(pluginWindow().Jupiter!);
  return loading ??= new Promise<Plugin>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://plugin.jup.ag/plugin-v1.js'; script.async = true;
    const timeout = window.setTimeout(() => fail(), 20_000);
    function fail() {clearTimeout(timeout); script.remove(); loading = null; reject(new Error('Форма Jupiter не загрузилась. Повторите или откройте обмен в новой вкладке.'));}
    script.onerror = fail;
    script.onload = () => {clearTimeout(timeout); const plugin = pluginWindow().Jupiter; if (plugin) resolve(plugin); else fail();};
    document.head.append(script);
  });
}
export async function mountImpSwap(plugin: Plugin, container: string, onSuccess: (txid: string) => void, onScreen: (screen: SwapScreen) => void = () => {}, onError: (message: string) => void = () => {}) {
  if (activeContainer && activeContainer !== container) throw new Error('Форма покупки уже открыта. Закройте её перед открытием другой.');
  activeContainer = container;
  try {await plugin.init({displayMode: 'integrated', integratedTargetId: container, autoConnect: true, localStoragePrefix: 'imperivm-imp-swap',
    formProps: {initialInputMint: SOL_MINT, initialOutputMint: IMPERIVM_TITLE.mint, fixedMint: IMPERIVM_TITLE.mint, swapMode: 'ExactIn'},
    onSuccess: ({txid}) => onSuccess(txid),
    onScreenUpdate: onScreen,
    onSwapError: ({error}) => onError(error?.message ?? 'Обмен не подтверждён. Проверьте историю Phantom перед повторной покупкой.'),
  });} catch (error) {activeContainer = null; throw error;}
}
export function closeImpSwap(container: string) {
  if (activeContainer !== container) return;
  const plugin = pluginWindow().Jupiter;
  plugin?.close(); plugin?.root?.unmount(); if (plugin) plugin.root = null;
  activeContainer = null;
}
