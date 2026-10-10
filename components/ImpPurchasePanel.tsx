'use client';
import {useEffect, useId, useRef, useState} from 'react';
import {useIDos} from './IDosContext';
import {useLocale} from './LocaleContext';
import {PaintedIcon} from './PaintedIcon';
import {IMPERIVM_TITLE} from '../lib/idos/title';
import {closeImpSwap, IMP_SWAP_URL, loadImpSwapPlugin, mountImpSwap, PurchaseJournal, verifyImpPurchase, type SwapScreen} from '../lib/idos/impPurchase';
import {formatImpAmount} from '../lib/solana/imp';
import styles from './ImpPurchasePanel.module.css';

type SavedPurchase = {txid: string; createdAt: number; amount?: string; status: 'checking' | 'confirmed' | 'unconfirmed'; error?: string};
type PurchaseOperation = {txid: string; phase: 'checking' | 'complete' | 'error'; amount?: string; error?: string};
type VerificationKind = 'current' | 'history';

export function ImpPurchasePanel({disabled, visible = true, onPurchased, onActivity}: {disabled: boolean; visible?: boolean; onPurchased: (amount: string) => void; onActivity?: (active: boolean) => void}) {
  const idos = useIDos(), {t, locale, errorText} = useLocale();
  const container = `imperivm-jupiter-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [loading, setLoading] = useState(false), [widgetRevision, setWidgetRevision] = useState(0);
  const [history, setHistory] = useState<SavedPurchase | null>(null), [historyOpen, setHistoryOpen] = useState(false);
  const [operation, setOperation] = useState<PurchaseOperation | null>(null), [notice, setNotice] = useState('');
  const [screen, setScreen] = useState<SwapScreen>('Initial');
  const generation = useRef(0), verifying = useRef({current: false, history: false});
  const timers = useRef<Partial<Record<VerificationKind, ReturnType<typeof setTimeout>>>>({});
  const current = useRef({owner: idos.session.owner, onPurchased, onActivity}); current.current = {owner: idos.session.owner, onPurchased, onActivity};
  const signedIn = idos.session.status === 'wallet', checking = operation?.phase === 'checking';
  const active = checking || screen === 'Swapping';
  useEffect(() => {onActivity?.(active);}, [active, onActivity]);
  useEffect(() => () => {current.current.onActivity?.(false);}, []);
  // Saved receipts belong to this owner. They never replace the new purchase form.
  useEffect(() => {
    const captured = ++generation.current;
    Object.values(timers.current).forEach(clearTimeout); timers.current = {}; verifying.current = {current: false, history: false};
    setHistory(null); setHistoryOpen(false); setOperation(null); setNotice(''); setScreen('Initial');
    const owner = idos.session.owner;
    if (signedIn && owner) try {
      const saved = new PurchaseJournal(window.localStorage, owner).read();
      if (saved) {setHistory({...saved, status: 'checking'}); void verify(saved.txid, owner, captured, 'history');}
    } catch (error) {setNotice(error instanceof Error ? error.message : t('Проверьте историю Phantom.', 'Check Phantom history.'));}
    return () => {generation.current++; Object.values(timers.current).forEach(clearTimeout);};
  }, [idos.session.owner, idos.session.userId, signedIn]);
  async function verify(txid: string, owner: string, captured: number, kind: VerificationKind, attempt = 0) {
    if (captured !== generation.current || owner !== current.current.owner || verifying.current[kind]) return;
    verifying.current[kind] = true;
    if (kind === 'current') setOperation({txid, phase: 'checking'});
    else setHistory(previous => previous?.txid === txid ? {...previous, status: 'checking', error: undefined} : previous);
    try {
      const amount = await verifyImpPurchase(txid, owner);
      if (captured !== generation.current || owner !== current.current.owner) return;
      setHistory(previous => previous?.txid === txid ? {...previous, amount, status: 'confirmed', error: undefined} : previous);
      if (kind === 'current') {
        setOperation({txid, phase: 'complete', amount}); setScreen('Initial'); setWidgetRevision(value => value + 1);
        window.dispatchEvent(new Event('imperivm:idos-balance'));
      }
    } catch (error) {
      if (captured !== generation.current || owner !== current.current.owner) return;
      if (attempt < 4) timers.current[kind] = setTimeout(() => void verify(txid, owner, captured, kind, attempt + 1), 2500 * (attempt + 1));
      else {
        const message = error instanceof Error ? error.message : t('Проверьте покупку в Phantom.', 'Check the purchase in Phantom.');
        setHistory(previous => previous?.txid === txid ? {...previous, status: 'unconfirmed', error: message} : previous);
        if (kind === 'current') setOperation({txid, phase: 'error', error: message});
      }
    } finally {if (captured === generation.current) verifying.current[kind] = false;}
  }
  useEffect(() => {
    if (!visible || !signedIn || !idos.session.owner || idos.embedded) return;
    let cancelled = false;
    const owner = idos.session.owner, captured = generation.current;
    setLoading(true); setNotice(''); setScreen('Initial');
    const timeout = window.setTimeout(() => {if (!cancelled) {setLoading(false); setNotice(t('Jupiter загружается дольше обычного. Откройте обмен по ссылке ниже.', 'Jupiter is taking longer to load. Open the swap using the link below.'));}}, 30_000);
    void loadImpSwapPlugin().then(async plugin => {
      if (cancelled || captured !== generation.current) return;
      await mountImpSwap(plugin, container, txid => {
        // Keep an owner-scoped receipt even if this panel closed during signing.
        try {new PurchaseJournal(window.localStorage, owner).save(txid);} catch (error) {if (!cancelled) setNotice(error instanceof Error ? error.message : t('Не удалось сохранить чек.', 'Could not save receipt.'));}
        if (cancelled || captured !== generation.current) return;
        setHistory({txid, createdAt: Date.now(), status: 'checking'});
        void verify(txid, owner, captured, 'current');
      }, next => {if (!cancelled) {clearTimeout(timeout); setLoading(false); setScreen(next);}}, message => {if (!cancelled) {setScreen('Error'); setNotice(message);}});
      if (cancelled) closeImpSwap(container);
    }).catch(error => {if (!cancelled) {setLoading(false); setNotice(error instanceof Error ? error.message : t('Jupiter недоступен.', 'Jupiter unavailable.'));}});
    return () => {cancelled = true; clearTimeout(timeout); closeImpSwap(container);};
    // A balance refresh or past receipt must not reset an active swap.
  }, [visible, signedIn, idos.session.owner, idos.session.userId, idos.embedded, container, widgetRevision]);
  const standaloneUrl = typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}#/packs`;
  const blocked = disabled || checking;
  return <div className={styles.purchase}>
    <div className={styles.heading}><PaintedIcon name="rug" size={38}/><div><strong>{t('Купить IMP', 'Buy IMP')}</strong><p>{t('SOL → IMP через Jupiter · покупка поступит в Phantom', 'SOL → IMP via Jupiter · tokens arrive in Phantom')}</p></div><span className={styles.network}>Solana</span></div>
    {idos.embedded ? <div className={styles.actions}><a className={styles.button} href={standaloneUrl} target="_blank" rel="noopener noreferrer">{t('Открыть покупку ↗', 'Open purchase ↗')}</a><p className={styles.hint}>{t('Откройте игру в отдельной вкладке для подключения Phantom.', 'Open the game in a separate tab to connect Phantom.')}</p></div> : !signedIn ? <button className={styles.button} disabled={idos.busy || disabled} onClick={() => void idos.login()}>{t('Подключить Phantom', 'Connect Phantom')}</button> : <>
      <div className={styles.walletHint}><span>{t('Кошелёк покупки', 'Purchase wallet')}</span><b>{idos.session.owner?.slice(0,7)}…{idos.session.owner?.slice(-6)}</b><p>{t('Выберите этот Phantom в Jupiter. Оставьте SOL для комиссии сети.', 'Select this Phantom in Jupiter. Keep SOL for network fees.')}</p></div>
      {(checking || screen === 'Swapping' || operation?.phase === 'complete' || operation?.phase === 'error') && <div className={`${styles.progress} ${operation?.phase === 'complete' ? styles.success : ''}`} role="status">
        {checking || screen === 'Swapping' ? <span className={styles.spinner}/> : <PaintedIcon name={operation?.phase === 'complete' ? 'wallet' : 'history'} size={30}/>}
        <div><strong>{checking ? t('Обмен отправлен · проверяем Solana', 'Swap sent · checking Solana') : screen === 'Swapping' ? t('Подтвердите обмен в Phantom', 'Confirm swap in Phantom') : operation?.phase === 'complete' ? t(`+${formatImpAmount(operation.amount!, locale)} IMP в Phantom`, `+${formatImpAmount(operation.amount!, locale)} IMP in Phantom`) : t('Покупка ещё не подтверждена', 'Purchase is not confirmed yet')}</strong><p>{checking ? t('Чек сохранён. Дождитесь проверки перед новой покупкой.', 'Receipt saved. Wait for verification before buying again.') : screen === 'Swapping' ? t('Результат появится после подтверждения сети.', 'The result appears after network confirmation.') : operation?.phase === 'complete' ? t('Для паков нужен отдельный перевод в игру.', 'Packs require a separate deposit into the game.') : errorText(operation?.error ?? '')}</p>{operation?.phase === 'error' && <button className={styles.quiet} disabled={disabled} onClick={() => void verify(operation.txid, idos.session.owner!, generation.current, 'current')}>{t('Проверить этот обмен', 'Check this swap')} →</button>}</div>
      </div>}
      <fieldset className={styles.swapForm} disabled={blocked} aria-busy={loading || active}>
        <legend className={styles.srOnly}>{t('Новая покупка IMP', 'New IMP purchase')}</legend>
        {loading && <p className={styles.status} role="status"><span className={styles.spinner}/>{t('Загружаем форму Jupiter…', 'Loading Jupiter swap…')}</p>}
        <div className={styles.widget} id={container} aria-label={t('Обмен SOL на IMP через Jupiter', 'Swap SOL for IMP through Jupiter')}/>
        {blocked && !active && <p className={styles.hint}>{t('Завершите текущую операцию перед новой покупкой.', 'Finish the current operation before buying again.')}</p>}
      </fieldset>
      {notice && <p className={styles.notice} role="status">{errorText(notice)} <button className={styles.quiet} disabled={active || disabled} onClick={() => setWidgetRevision(value => value + 1)}>{t('Загрузить форму снова', 'Reload form')}</button></p>}
      <div className={styles.depositBridge}><PaintedIcon name="wallet" size={32}/><div><strong>{t('IMP уже в Phantom?', 'IMP already in Phantom?')}</strong><p>{t('Переведите нужную сумму на игровой счёт.', 'Deposit the amount you need into your game account.')}</p></div><button className={styles.secondary} disabled={disabled || active} onClick={() => current.current.onPurchased('')}>{t('Перевести в игру', 'Deposit in game')} →</button></div>
      {history && <details className={styles.history} open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}>
        <summary><PaintedIcon name="history" size={26}/><span>{t('Последняя покупка', 'Last purchase')}</span><b>{history.status === 'confirmed' && history.amount ? `+${formatImpAmount(history.amount, locale)} IMP` : history.status === 'checking' ? t('Проверяем чек', 'Checking receipt') : t('Проверить чек', 'Check receipt')}</b><span className={styles.chevron} aria-hidden="true">⌄</span></summary>
        <div className={styles.historyBody}><p>{history.status === 'confirmed' ? t('Этот обмен подтверждён в Solana. Токены поступили в Phantom; чек не показывает текущий баланс.', 'This swap is confirmed on Solana. Tokens arrived in Phantom; the receipt is not your current balance.') : history.status === 'checking' ? t('Проверяем сохранённый чек этого кошелька.', 'Checking the saved receipt for this wallet.') : errorText(history.error ?? t('Проверьте чек перед повторной покупкой.', 'Check this receipt before buying again.'))}</p><div className={styles.actions}>{history.status !== 'confirmed' && <button className={styles.quiet} disabled={active || disabled || history.status === 'checking'} onClick={() => void verify(history.txid, idos.session.owner!, generation.current, 'history')}>{t('Проверить покупку', 'Check purchase')} →</button>}{history.status === 'confirmed' && history.amount && <button className={styles.quiet} disabled={disabled || active} onClick={() => current.current.onPurchased(history.amount!)}>{t('Перевести эту сумму в игру', 'Deposit this amount in game')} →</button>}<a className={styles.quiet} href={`https://explorer.solana.com/tx/${encodeURIComponent(history.txid)}`} target="_blank" rel="noopener noreferrer">{t('Чек Solana ↗', 'Solana receipt ↗')}</a></div></div>
      </details>}
    </>}
    {!signedIn && notice && <p className={styles.notice} role="status">{errorText(notice)}</p>}
    <p className={styles.mint}><a href={IMP_SWAP_URL} target="_blank" rel="noopener noreferrer">{t('Открыть Jupiter отдельно', 'Open Jupiter separately')} ↗</a><span>IMP · {IMPERIVM_TITLE.mint.slice(0,8)}…{IMPERIVM_TITLE.mint.slice(-8)}</span></p>
  </div>;
}
