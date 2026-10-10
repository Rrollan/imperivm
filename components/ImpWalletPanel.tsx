'use client';
import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {useIDos} from './IDosContext';
import {useCollection} from './CollectionContext';
import {useLocale} from './LocaleContext';
import {RomanIcon} from './presentation/RomanIcon';
import {ImpPurchasePanel} from './ImpPurchasePanel';
import {formatImpAmount} from '../lib/solana/imp';
import {IMPERIVM_TITLE} from '../lib/idos/title';
import type {TransferConfig, TransferDirection, TransferProgress} from '../lib/idos/walletTransfer';
import styles from './ImpWalletPanel.module.css';

export function ImpWalletPanel({walletBalance, onBalanceChanged}: {walletBalance?: string; onBalanceChanged?: () => void}) {
  const idos = useIDos(), collection = useCollection(), {t, locale, errorText} = useLocale();
  const amountId = useId();
  const [buy, setBuy] = useState(false), [swapActive, setSwapActive] = useState(false);
  const [recoveryChecked, setRecoveryChecked] = useState(false);
  const [progress, setProgress] = useState<TransferProgress | null>(null), [completed, setCompleted] = useState<{amount: string; direction: TransferDirection; hash?: string} | null>(null);
  const [open, setOpen] = useState(false), [direction, setDirection] = useState<TransferDirection>('deposit');
  const [amount, setAmount] = useState(''), [review, setReview] = useState<string | null>(null);
  const [config, setConfig] = useState<TransferConfig | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const scope = useRef(0), locked = useRef(false);
  const signedIn = idos.session.status === 'wallet';
  const load = useCallback(async () => {
    const captured = scope.current;
    if (!idos.runtime || locked.current) return;
    locked.current = true; setBusy(true);
    try {const result = await idos.runtime.withImpTransfers(service => service.config()); if (captured === scope.current) {setConfig(result); setNotice('');}}
    catch (error) {if (captured === scope.current) setNotice(error instanceof Error ? error.message : (locale === 'ru' ? 'Кошелёк iDos временно недоступен.' : 'iDos wallet is temporarily unavailable.'));}
    finally {if (captured === scope.current) {locked.current = false; setBusy(false);}}
  }, [idos.runtime, locale]);
  useEffect(() => {scope.current++; locked.current = false; setOpen(false); setConfig(null); setReview(null); setAmount(''); setNotice(''); setBusy(false); setProgress(null); setCompleted(null); setRecoveryChecked(false); setBuy(false);}, [idos.session.owner, idos.session.userId]);
  useEffect(() => {if (open && signedIn && !idos.embedded) void load();}, [open, signedIn, idos.embedded, load]);
  useEffect(() => {const changed = () => {onBalanceChanged?.(); if (open && signedIn && !idos.embedded) void load();}; window.addEventListener('imperivm:idos-balance', changed); return () => window.removeEventListener('imperivm:idos-balance', changed);}, [onBalanceChanged, open, signedIn, idos.embedded, load]);
  function refreshBalances() {window.dispatchEvent(new Event('imperivm:idos-balance')); void collection.refresh();}
  async function platformPanel() {
    if (locked.current || swapActive) return;
    locked.current = true; setBusy(true); setNotice('');
    try {const {openPlatformWalletPanel} = await import('@idosgames/wallet'); if (!await openPlatformWalletPanel()) throw new Error(t('Откройте страницу IMPERIVM на iDos и нажмите кошелёк рядом с игрой.', 'Open IMPERIVM on iDos and press the wallet next to the game.'));}
    catch (error) {setNotice(error instanceof Error ? error.message : t('Кошелёк недоступен.', 'Wallet unavailable.'));}
    finally {locked.current = false; setBusy(false);}
  }
  async function prepare() {
    try {
      const {parseImpTransferAmount} = await import('../lib/idos/walletTransfer');
      const parsed = parseImpTransferAmount(amount);
      if (!config || (direction === 'deposit' ? config.network.DepositsEnabled : config.network.WithdrawalsEnabled) !== true) throw new Error(t('iDos временно отключил этот перевод.', 'iDos has temporarily disabled this transfer.'));
      const available = direction === 'deposit' ? walletBalance : config?.balance;
      if (available !== undefined && (available === '0' || parseImpTransferAmount(available).raw < parsed.raw)) throw new Error(t(direction === 'deposit' ? 'Недостаточно IMP в Phantom.' : 'Недостаточно IMP на игровом счёте.', direction === 'deposit' ? 'Not enough IMP in Phantom.' : 'Not enough IMP in your game account.'));
      setReview(parsed.amount); setNotice('');
    } catch (error) {setNotice(error instanceof Error ? error.message : t('Проверьте сумму.', 'Check the amount.'));}
  }
  async function execute(recovery = false) {
    const runtime = idos.runtime, captured = scope.current, confirmed = review;
    if (!runtime || locked.current || swapActive || (!recovery && !confirmed)) return;
    locked.current = true; setBusy(true); setNotice(''); setCompleted(null); setRecoveryChecked(false); setProgress({phase: 'preparing'});
    const track = (value: TransferProgress) => {if (captured === scope.current) {setProgress(value); if (value.phase === 'complete') setCompleted({amount: confirmed ?? config?.pending?.amount ?? '', direction: recovery ? config?.pending?.direction ?? direction : direction, hash: value.hash});}};
    try {
      await runtime.withImpTransfers(service => recovery ? service.recover() : service.transfer(direction, confirmed!, direction === 'withdraw' ? config?.withdrawalFeePercent : undefined, track));
      if (captured === scope.current) {setReview(null); setAmount(''); setNotice(''); setRecoveryChecked(recovery);}
      refreshBalances();
    } catch (error) {if (captured === scope.current) {setReview(null); setNotice(error instanceof Error ? error.message : t('Перевод ещё проверяется.', 'The transfer is still being checked.'));}}
    finally {
      if (captured === scope.current) {
        // Read the receipt even after a declined prompt; do not retry the financial operation.
        try {const result = await runtime.withImpTransfers(service => service.config()); if (captured === scope.current) setConfig(result);} catch { /* Keep the previous balance; the receipt stays saved for the next open. */ }
        locked.current = false; setBusy(false); setProgress(null);
      }
    }
  }
  return <section className={styles.panel} aria-label={t('Перевод IMP', 'Transfer IMP')}>
    <div className={styles.routeTabs} role="tablist" aria-label={t('Пополнение IMP', 'Fund IMP')}><button role="tab" aria-selected={!buy} disabled={swapActive || busy} className={`${styles.routeTab} ${!buy ? styles.routeSelected : ''}`} onClick={() => setBuy(false)}><span>01</span>{t('IMP уже в Phantom', 'IMP in Phantom')}</button><button role="tab" aria-selected={buy} disabled={busy} className={`${styles.routeTab} ${buy ? styles.routeSelected : ''}`} onClick={() => setBuy(true)}><span>02</span>{t('Купить за SOL', 'Buy with SOL')}</button></div>
    <div className={styles.purchaseSlot} hidden={!buy}><ImpPurchasePanel onActivity={setSwapActive} disabled={busy || !!config?.pending || !!review || collection.busy} onPurchased={received => {setDirection('deposit'); setOpen(true); setReview(null); setAmount(received); setNotice(''); setBuy(false); setCompleted(null); onBalanceChanged?.();}}/></div>
    <div className={styles.transferSlot} hidden={buy}>
    <div className={styles.intro}><span className={styles.symbol} aria-hidden="true"><RomanIcon name="laurel" size={22}/></span><div><strong>{t('Phantom → игровой счёт', 'Phantom → game account')}</strong><p>{t('Вход подключает кошелёк. IMP переходят в игру только после отдельного перевода.', 'Sign-in connects your wallet. IMP enters the game only after a separate transfer.')}</p></div></div>
    {!signedIn ? <button className={`${styles.button} ${styles.primary}`} disabled={idos.busy || collection.busy} onClick={() => void idos.login()}>{t('Войти для перевода IMP', 'Sign in to transfer IMP')}</button> : idos.embedded ? <div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void platformPanel()}>{t('Перевести IMP в игру', 'Deposit IMP in game')}</button><p className={styles.hint}>{t('Пополнение и вывод подтвердите в кошельке платформы.', 'Confirm deposits and withdrawals in the platform wallet.')}</p></div> : !open ? <button className={`${styles.button} ${styles.primary}`} onClick={() => setOpen(true)}>{t('Перевести IMP в игру', 'Deposit IMP in game')} <span aria-hidden="true">→</span></button> : <>
      <div className={styles.available}><span>{direction === 'deposit' ? t('Доступно в Phantom', 'Available in Phantom') : t('Доступно на игровом счёте', 'Available in game')}</span><strong>{(direction === 'deposit' ? walletBalance : config?.balance) !== undefined ? formatImpAmount((direction === 'deposit' ? walletBalance : config?.balance)!, locale) : '—'} <small>IMP</small></strong></div>
      <div className={styles.tabs} role="tablist" aria-label={t('Направление перевода', 'Transfer direction')}>{(['deposit', 'withdraw'] as const).map(value => <button key={value} role="tab" aria-selected={direction === value} disabled={busy || !!config?.pending} className={`${styles.tab} ${direction === value ? styles.selected : ''}`} onClick={() => {setDirection(value); setReview(null); setNotice('');}}>{value === 'deposit' ? t('В игру', 'Deposit') : t('В Phantom', 'Withdraw')}</button>)}</div>
      {config?.minimumAccountAgeDays != null && config.minimumAccountAgeDays > 0 && <p className={styles.fee}>{t(`Вывод доступен, когда аккаунту iDos не менее ${config.minimumAccountAgeDays} дней. Учитывайте это перед пополнением.`, `Withdrawals require an iDos account at least ${config.minimumAccountAgeDays} days old. Check this before depositing.`)}</p>}
      {config?.pending ? <div className={styles.pending} role="status"><strong>{t('Предыдущий перевод ещё проверяется', 'Previous transfer is still being checked')}</strong><p>{formatImpAmount(config.pending.amount, locale)} IMP · {config.pending.direction === 'deposit' ? t('в игру', 'to game') : t('в Phantom', 'to Phantom')}</p><p>{t('Новая операция заблокирована, чтобы не списать IMP дважды.', 'A new transfer is blocked to prevent a double debit.')}</p><div className={styles.actions}><button className={styles.button} disabled={busy} onClick={() => void execute(true)}>{busy ? t('Проверяем…', 'Checking…') : config.pending.direction === 'withdraw' ? t('Восстановить этот вывод', 'Recover this withdrawal') : t('Проверить зачисление', 'Check deposit')}</button>{config.pending.hash && <a href={`https://explorer.solana.com/tx/${config.pending.hash}`} target="_blank" rel="noreferrer">{t('Чек Solana', 'Solana receipt')} ↗</a>}</div></div> : review ? <div className={styles.review}>
        <span className={styles.eyebrow}>{direction === 'deposit' ? t('Пополнение игрового счёта', 'Game account deposit') : t('Вывод на подключённый Phantom', 'Withdraw to connected Phantom')}</span><strong>{formatImpAmount(review, locale)} <small>IMP</small></strong>
        <p>{direction === 'deposit' ? t('Указанная сумма IMP будет переведена с Phantom на ваш счёт iDos. SOL нужны только для комиссии сети.', 'The entered IMP amount will transfer from Phantom to your iDos account. SOL is used only for the network fee.') : t('Указанная сумма будет списана с игрового счёта. Phantom получит сумму после комиссии iDos; сеть оплачивается отдельно в SOL.', 'The entered amount is debited from the game account. Phantom receives the amount after the iDos fee; the network fee is paid separately in SOL.')}</p>
        {direction === 'withdraw' && <p className={styles.fee}>{config?.withdrawalFeePercent !== null && config?.withdrawalFeePercent !== undefined ? t(`Комиссии вывода по настройкам iDos: ${config.withdrawalFeePercent}%.`, `Withdrawal fees from iDos settings: ${config.withdrawalFeePercent}%.`) : t('Размер комиссии определяется iDos. Проверьте итог в запросе Phantom.', 'iDos sets the withdrawal fee. Review the final amount in the Phantom prompt.')}</p>}
        <div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void execute()}>{busy ? t('Проверяем перевод…', 'Checking transfer…') : t('Подтвердить и открыть Phantom', 'Confirm and open Phantom')}</button><button className={styles.button} disabled={busy} onClick={() => setReview(null)}>{t('Изменить сумму', 'Edit amount')}</button></div>
      </div> : <form className={styles.form} onSubmit={event => {event.preventDefault(); void prepare();}}>
        <label htmlFor={amountId}>{t('Сумма перевода', 'Transfer amount')}</label><div className={styles.inputRow}><input id={amountId} autoComplete="off" inputMode="decimal" placeholder="0" value={amount} disabled={busy || !config} onChange={event => {setAmount(event.target.value); setReview(null);}}/><span>IMP</span></div>
        <p className={styles.hint}>{direction === 'deposit' ? t('Выберите нужную сумму. Остальные токены останутся в Phantom.', 'Choose the amount you need. Other tokens stay in Phantom.') : t('Выводится доступный игровой баланс после комиссии iDos.', 'Withdraw your available game balance after the iDos fee.')}</p>
        <div className={styles.actions}><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={busy || !config || !amount}>{busy ? t('Проверяем настройки…', 'Checking settings…') : t('Проверить перевод', 'Review transfer')}</button>{!config && <button type="button" className={styles.button} disabled={busy} onClick={() => void load()}>{t('Повторить', 'Retry')}</button>}</div>
      </form>}
      <p className={styles.footnote}>{t('Solana mainnet · перевод требует подтверждения Phantom. Покупка пака — отдельное действие.', 'Solana mainnet · transfers require Phantom confirmation. Buying a pack is a separate action.')}</p>
    </>}
    {progress && <div className={styles.progress} role="status"><span className={styles.spinner}/><div><strong>{progress.phase === 'wallet' ? t('Подтвердите перевод в Phantom', 'Confirm deposit in Phantom') : progress.phase === 'confirming' ? t('Перевод отправлен · ждём Solana', 'Transfer sent · waiting for Solana') : progress.phase === 'crediting' ? t('Solana подтвердила · зачисляем в iDos', 'Solana confirmed · crediting iDos') : t('Проверяем настройки перевода', 'Checking transfer settings')}</strong><p>{progress.hash ? t('Чек сохранён. Повторный перевод заблокирован.', 'Receipt saved. A duplicate transfer is blocked.') : t('IMP ещё не отправлены.', 'IMP have not been sent yet.')}</p>{progress.hash && <a href={`https://explorer.solana.com/tx/${progress.hash}`} target="_blank" rel="noopener noreferrer">{t('Открыть чек ↗', 'Open receipt ↗')}</a>}</div></div>}
    {completed && <div className={styles.success} role="status"><span aria-hidden="true">✓</span><div><strong>{formatImpAmount(completed.amount, locale)} IMP {completed.direction === 'deposit' ? t('зачислено в игру', 'credited in game') : t('выведено в Phantom', 'withdrawn to Phantom')}</strong><p>{t('Перевод подтверждён. Баланс обновляется.', 'Transfer confirmed. Balance refreshing.')}</p>{completed.hash && <a href={`https://explorer.solana.com/tx/${completed.hash}`} target="_blank" rel="noopener noreferrer">{t('Чек перевода ↗', 'Transfer receipt ↗')}</a>}</div></div>}
    {recoveryChecked && <p className={styles.hint} role="status">{t('Статус перевода обновлён. Балансы проверяются; возврат можно увидеть в истории iDos.', 'Transfer status updated. Refreshing balances; refunds appear in iDos history.')}</p>}
    {notice && <p className={styles.notice} role="status">{errorText(notice)}</p>}
    {signedIn && !idos.embedded && open && <a className={styles.platformLink} href={IMPERIVM_TITLE.appUrl} target="_blank" rel="noopener noreferrer">{t('История и кошелёк на iDos', 'History and wallet on iDos')} ↗</a>}
    </div>
  </section>;
}
