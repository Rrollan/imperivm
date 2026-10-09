export interface ReceiptStorage {getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void}
type Receipt = {version: 1; state: 'pending' | 'accepted'; pack: string; amount: number; startedAt: number};
/** openPack has no idempotency key. Persist intent before sending and never retry a lost reply. */
export class PackPaymentReceipt {
  private key: string;
  constructor(title: string, userId: string, private storage?: ReceiptStorage) {
    this.key = `imperivm.pack-payment.v1:${title}:${userId}`;
    if (!storage && typeof window !== 'undefined') {
      try {this.storage = window.localStorage;} catch { /* begin fails closed */ }
    }
  }
  private read(): Receipt | null {
    if (!this.storage) throw new Error('Для покупки нужно разрешить сохранение платёжного статуса в браузере.');
    const raw = this.storage.getItem(this.key); if (raw === null) return null;
    try {
      const value = JSON.parse(raw);
      if (value.version === 1 && ['pending', 'accepted'].includes(value.state) && typeof value.pack === 'string' && value.pack.length <= 80 && Number.isSafeInteger(value.amount) && value.amount > 0 && Number.isSafeInteger(value.startedAt)) return value;
    } catch {}
    throw new Error('Платёжный статус повреждён. Покупка заблокирована до проверки операций iDos.');
  }
  status() {return this.read()?.state ?? 'none';}
  begin(pack: string, amount: number) {
    if (this.read()) throw new Error('Предыдущая покупка ещё не подтверждена. Проверьте операции iDos; повторное списание заблокировано.');
    this.storage!.setItem(this.key, JSON.stringify({version: 1, state: 'pending', pack, amount, startedAt: Date.now()} satisfies Receipt));
    if (this.status() !== 'pending') throw new Error('Не удалось сохранить платёжный статус. Покупка отменена.');
  }
  accept() {
    const receipt = this.read(); if (!receipt) throw new Error('Платёжный статус отсутствует. Обновите коллекцию.');
    this.storage!.setItem(this.key, JSON.stringify({...receipt, state: 'accepted'}));
  }
  clear() {this.storage!.removeItem(this.key);}
}
