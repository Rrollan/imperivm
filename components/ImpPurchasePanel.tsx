'use client';
import {useEffect, useId, useRef, useState} from 'react';
import {useIDos} from './IDosContext';
import {useLocale} from './LocaleContext';
import {PaintedIcon} from './PaintedIcon';
import {IMPERIVM_TITLE} from '../lib/idos/title';
import {closeImpSwap, IMP_SWAP_URL, loadImpSwapPlugin, mountImpSwap, PurchaseJournal, verifyImpPurchase, type SwapScreen} from '../lib/idos/impPurchase';
import {formatImpAmount} from '../lib/solana/imp';
import styles from './ImpPurchasePanel.module.css';

export function ImpPurchasePanel({disabled, onPurchased, onActivity}: {disabled: boolean; onPurchased: (amount: string) => void; onActivity?: (active: boolean) => void}) {
  const idos = useIDos(), {t, locale, errorText} = useLocale();
  const container = `imperivm-jupiter-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [checking, setChecking] = useState(false);
  const [receipt, setReceipt] = useState(''), [received, setReceived] = useState(''), [notice, setNotice] = useState('');
  const [screen, setScreen] = useState<SwapScreen>('Initial');
  const generation = useRef(0), verifying = useRef(false), timer = useRef<ReturnType<typeof setTimeout>>();
  const current = useRef({owner: idos.session.owner, onPurchased, onActivity}); current.current = {owner: idos.session.owner, onPurchased, onActivity};
  const signedIn = idos.session.status === 'wallet';
  const active = checking || screen === 'Swapping';
  useEffect(() => {onActivity?.(active);}, [active, onActivity]);
  useEffect(() => () => {current.current.onActivity?.(false);}, []);
  // Ordinary balance refreshes must not reset the widget or lose its callbacks.
  useEffect(() => {
    const captured = ++generation.current;
    clearTimeout(timer.current); verifying.current = false;
    setOpen(false); setReceipt(''); setReceived(''); setNotice(''); setChecking(false); setScreen('Initial');
    const owner = idos.session.owner;
    if (signedIn && owner) try {const saved = new PurchaseJournal(window.localStorage, owner).read(); if (saved) {setReceipt(saved.txid); void verify(saved.txid, owner, captured);}} catch (error) {setNotice(error instanceof Error ? error.message : t('Проверьте историю Phantom.', 'Check Phantom history.'));}
    return () => {generation.current++; clearTimeout(timer.current);};
  }, [idos.session.owner, idos.session.userId, signedIn]);
  async function verify(txid: string, owner: string, captured: number, attempt = 0) {
    if (captured !== generation.current || owner !== current.current.owner || verifying.current) return;
    verifying.current = true; setChecking(true); setNotice('');
    try {
      const amount = await verifyImpPurchase(txid, owner);
      if (captured !== generation.current || owner !== current.current.owner) return;
      setReceived(amount); setOpen(false); setScreen('Success'); setChecking(false);
      window.dispatchEvent(new Event('imperivm:idos-balance'));
    } catch (error) {
      if (captured !== generation.current) return;
      if (attempt < 4) {timer.current = setTimeout(() => void verify(txid, owner, captured, attempt + 1), 2500 * (attempt + 1));}
      else {setChecking(false); setNotice(error instanceof Error ? error.message : t('Проверьте покупку в Phantom.', 'Check the purchase in Phantom.'));}
    } finally {if (captured === generation.current) verifying.current = false;}
  }
  useEffect(() => {
    if (!open || !signedIn || !idos.session.owner || idos.embedded) return;
    let cancelled = false;
    const owner = idos.session.owner, captured = generation.current;
    setLoading(true); setNotice(''); setScreen('Initial');
    const timeout = window.setTimeout(() => {if (!cancelled) {setLoading(false); setNotice(t('Форма загружается дольше обычного. Можно открыть Jupiter по ссылке ниже.', 'The form is taking longer to load. Open Jupiter using the link below.'));}}, 30_000);
    void loadImpSwapPlugin().then(async plugin => {
      if (cancelled || captured !== generation.current) return;
      await mountImpSwap(plugin, container, txid => {
        // Save even if the account panel was closed while a signature was pending.
        try {new PurchaseJournal(window.localStorage, owner).save(txid);} catch (error) {if (!cancelled) setNotice(error instanceof Error ? error.message : t('Не удалось сохранить чек.', 'Could not save receipt.'));}
        if (cancelled || captured !== generation.current) return;
        setReceipt(txid); setOpen(false); void verify(txid, owner, captured);
      }, next => {if (!cancelled) {clearTimeout(timeout); setLoading(false); setScreen(next);}}, message => {if (!cancelled) {setScreen('Error'); setNotice(message);}});
      if (cancelled) closeImpSwap(container);
    }).catch(error => {if (!cancelled) {setLoading(false); setNotice(error instanceof Error ? error.message : t('Jupiter недоступен.', 'Jupiter unavailable.'));}});
    return () => {cancelled = true; clearTimeout(timeout); closeImpSwap(container);};
    // disabled controls entry only. Refreshing balances must not unmount Jupiter.
  }, [open, signedIn, idos.session.owner, idos.embedded, container]);
  const standaloneUrl = typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}#/packs`;
  return <div className={styles.purchase}>
    <div className={styles.heading}><PaintedIcon name="rug" size={36}/><div><strong>{t('Купить IMP за SOL', 'Buy IMP with SOL')}</strong><p>{t('Обмен через Jupiter. Токены поступят в ваш Phantom.', 'Swap with Jupiter. Tokens arrive in your Phantom.')}</p></div><span className={styles.network}>Solana</span></div>
    {idos.embedded ? <div className={styles.actions}><a className={styles.button} href={standaloneUrl} target="_blank" rel="noopener noreferrer">{t('Открыть покупку ↗', 'Open purchase ↗')}</a><p className={styles.hint}>{t('Откройте игру в отдельной вкладке для подключения Phantom.', 'Open the game in a separate tab to connect Phantom.')}</p></div> : !signedIn ? <button className={styles.button} disabled={idos.busy || disabled} onClick={() => void idos.login()}>{t('Подключить Phantom', 'Connect Phantom')}</button> : <>
      {received ? <div className={styles.success} role="status"><span className={styles.check} aria-hidden="true">✓</span><div><span className={styles.eyebrow}>{t('Покупка подтверждена', 'Purchase confirmed')}</span><strong>+{formatImpAmount(received, locale)} IMP</strong><p>{t('Уже в Phantom. Для покупки паков переведите нужную сумму на игровой счёт.', 'Now in Phantom. Deposit the amount you need into the game to buy packs.')}</p><button className={styles.button} disabled={disabled} onClick={() => current.current.onPurchased(received)}>{t('Перевести эти IMP в игру', 'Deposit these IMP in game')} →</button></div></div> : checking || screen === 'Swapping' ? <div className={styles.progress} role="status"><span className={styles.spinner}/><div><strong>{checking ? t('Проверяем покупку в Solana', 'Verifying purchase on Solana') : t('Ожидаем подтверждение обмена', 'Waiting for swap confirmation')}</strong><p>{checking ? t('Чек сохранён. Не покупайте повторно — результат появится здесь.', 'Receipt saved. Do not buy again — the result will appear here.') : t('Подтвердите запрос в Phantom. После обмена проверим получение IMP.', 'Confirm in Phantom. After swapping we verify the IMP received.')}</p></div></div> : null}
      {!open && !checking && <button className={received ? styles.quiet : styles.button} disabled={disabled} onClick={() => {setReceived(''); setReceipt(''); setScreen('Initial'); setOpen(true); setNotice('');}}>{received ? t('Купить ещё IMP', 'Buy more IMP') : t('Открыть обмен SOL → IMP', 'Open SOL → IMP swap')} →</button>}
      {open && <>
        <div className={styles.walletHint}><span>{t('Кошелёк для покупки', 'Purchase wallet')}</span><b>{idos.session.owner?.slice(0,7)}…{idos.session.owner?.slice(-6)}</b><p>{t('В Jupiter выберите этот же Phantom. Оставьте немного SOL для перевода в игру.', 'Choose this same Phantom in Jupiter. Keep some SOL for the deposit.')}</p></div>
        {loading && <p className={styles.status} role="status">{t('Загружаем обмен…', 'Loading swap…')}</p>}
        <div className={styles.widget} id={container} aria-label={t('Обмен SOL на IMP через Jupiter', 'Swap SOL for IMP through Jupiter')}/>
        <div className={styles.actions}><button className={styles.quiet} disabled={active} onClick={() => setOpen(false)}>{t('Закрыть обмен', 'Close swap')}</button></div>
      </>}
      {receipt && <div className={styles.actions}>{!received && <button className={styles.button} disabled={checking || disabled} onClick={() => void verify(receipt, idos.session.owner!, generation.current)}>{checking ? t('Проверяем…', 'Checking…') : t('Проверить этот обмен', 'Check this swap')}</button>}<a className={styles.quiet} href={`https://explorer.solana.com/tx/${encodeURIComponent(receipt)}`} target="_blank" rel="noopener noreferrer">{t('Чек покупки ↗', 'Purchase receipt ↗')}</a></div>}
    </>}
    {notice && <p className={styles.notice} role="status">{errorText(notice)}</p>}
    <p className={styles.mint}><a href={IMP_SWAP_URL} target="_blank" rel="noopener noreferrer">{t('Открыть Jupiter отдельно', 'Open Jupiter separately')} ↗</a><span>IMP · {IMPERIVM_TITLE.mint.slice(0,8)}…{IMPERIVM_TITLE.mint.slice(-8)}</span></p>
  </div>;
}
