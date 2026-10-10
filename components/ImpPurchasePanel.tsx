'use client';
import {useEffect, useId, useRef, useState} from 'react';
import {useIDos} from './IDosContext';
import {useLocale} from './LocaleContext';
import {PaintedIcon} from './PaintedIcon';
import {IMPERIVM_TITLE} from '../lib/idos/title';
import {closeImpSwap, IMP_SWAP_URL, loadImpSwapPlugin, mountImpSwap, verifyImpPurchase} from '../lib/idos/impPurchase';
import {formatImpAmount} from '../lib/solana/imp';
import styles from './ImpPurchasePanel.module.css';

export function ImpPurchasePanel({disabled, onPurchased}: {disabled: boolean; onPurchased: (amount: string) => void}) {
  const idos = useIDos(), {t, locale, errorText} = useLocale();
  const container = `imperivm-jupiter-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [checking, setChecking] = useState(false);
  const [receipt, setReceipt] = useState(''), [received, setReceived] = useState(''), [notice, setNotice] = useState('');
  const generation = useRef(0), current = useRef({owner: idos.session.owner, onPurchased}); current.current = {owner: idos.session.owner, onPurchased};
  const signedIn = idos.session.status === 'wallet';
  useEffect(() => {generation.current++; setOpen(false); setReceipt(''); setReceived(''); setNotice(''); setChecking(false);}, [idos.session.revision]);
  async function verify(txid: string, owner: string, captured: number) {
    if (captured !== generation.current || owner !== current.current.owner) return;
    setChecking(true); setNotice('');
    try {
      const amount = await verifyImpPurchase(txid, owner);
      if (captured !== generation.current || owner !== current.current.owner) return;
      setReceived(amount); setOpen(false); current.current.onPurchased(amount);
      window.dispatchEvent(new Event('imperivm:idos-balance'));
    } catch (error) {if (captured === generation.current) setNotice(error instanceof Error ? error.message : t('Проверьте покупку в Phantom.', 'Check the purchase in Phantom.'));}
    finally {if (captured === generation.current) setChecking(false);}
  }
  useEffect(() => {
    if (!open || !signedIn || !idos.session.owner || idos.embedded || disabled) return;
    let cancelled = false;
    const owner = idos.session.owner, captured = generation.current;
    setLoading(true); setNotice('');
    const timeout = window.setTimeout(() => {if (!cancelled) {setLoading(false); setNotice(t('Jupiter загружается дольше обычного. Можно открыть обмен в новой вкладке.', 'Jupiter is taking longer to load. You can open the swap in a new tab.'));}}, 30_000);
    void loadImpSwapPlugin().then(async plugin => {
      if (cancelled || captured !== generation.current) return;
      await mountImpSwap(plugin, container, txid => {
        if (cancelled || captured !== generation.current) return;
        setReceipt(txid); void verify(txid, owner, captured);
      }, () => {if (!cancelled) {clearTimeout(timeout); setLoading(false);}});
      if (cancelled) closeImpSwap(container);
    }).catch(error => {if (!cancelled) {setLoading(false); setNotice(error instanceof Error ? error.message : t('Jupiter недоступен.', 'Jupiter unavailable.'));}});
    return () => {cancelled = true; clearTimeout(timeout); closeImpSwap(container);};
  }, [open, signedIn, idos.session.owner, idos.embedded, disabled, container]);
  const standaloneUrl = typeof window === 'undefined' ? undefined : `${window.location.origin}${window.location.pathname}#/packs`;
  return <div className={styles.purchase}>
    <div className={styles.heading}><PaintedIcon name="rug" size={36}/><div><strong>{t('Купить IMP за SOL', 'Buy IMP with SOL')}</strong><p>{t('Сначала покупка в Phantom, затем перевод в iDos.', 'Buy into Phantom, then deposit into iDos.')}</p></div><span className={styles.network}>Solana</span></div>
    {idos.embedded ? <div className={styles.actions}><a className={styles.button} href={standaloneUrl} target="_blank" rel="noopener noreferrer">{t('Открыть игру для покупки ↗', 'Open game to buy ↗')}</a><p className={styles.hint}>{t('Покупка открывается в отдельной вкладке. Вернитесь сюда и пополните игровой счёт через кошелёк iDos.', 'Buying opens in a separate tab. Return here and deposit through the iDos wallet.')}</p></div> : !signedIn ? <button className={styles.button} disabled={idos.busy || disabled} onClick={() => void idos.login()}>{t('Войти и купить IMP', 'Sign in to buy IMP')}</button> : <>
      {!open && <button className={styles.button} disabled={disabled || checking} onClick={() => {setOpen(true); setReceipt(''); setReceived(''); setNotice('');}}>{received ? t('Купить ещё IMP', 'Buy more IMP') : t('Открыть покупку SOL → IMP', 'Open SOL → IMP purchase')} →</button>}
      {open && <>
        <p className={styles.hint}>{t('Подключите в Jupiter тот же Phantom', 'Connect the same Phantom in Jupiter')}: <b>{idos.session.owner?.slice(0,7)}…{idos.session.owner?.slice(-6)}</b>. {t('Курс и комиссия показываются до подтверждения. Оставьте SOL для следующего перевода.', 'Review the rate and fee before confirming. Keep SOL for the next deposit.')}</p>
        {loading && <p className={styles.status} role="status">{t('Загружаем форму обмена…', 'Loading swap form…')}</p>}
        <div className={styles.widget} id={container} aria-label={t('Обмен SOL на IMP через Jupiter', 'Swap SOL for IMP through Jupiter')}/>
        <div className={styles.actions}><button className={styles.quiet} disabled={checking} onClick={() => setOpen(false)}>{t('Закрыть форму', 'Close form')}</button><a className={styles.quiet} href={IMP_SWAP_URL} target="_blank" rel="noopener noreferrer">{t('Открыть Jupiter ↗', 'Open Jupiter ↗')}</a></div>
      </>}
      {received && <div className={styles.success} role="status"><strong>{formatImpAmount(received, locale)} IMP {t('получено в Phantom', 'received in Phantom')}</strong><p>{t('Сумма проверена по чеку Solana и подставлена в пополнение ниже. Подтвердите её перевод в iDos.', 'The Solana receipt was checked and the amount is filled into the deposit below. Confirm its transfer to iDos.')}</p></div>}
      {receipt && <div className={styles.actions}>{!received && <button className={styles.button} disabled={checking || disabled} onClick={() => void verify(receipt, idos.session.owner!, generation.current)}>{checking ? t('Проверяем чек Solana…', 'Checking Solana receipt…') : t('Проверить покупку', 'Check purchase')}</button>}<a className={styles.quiet} href={`https://explorer.solana.com/tx/${encodeURIComponent(receipt)}`} target="_blank" rel="noopener noreferrer">{t('Чек покупки ↗', 'Purchase receipt ↗')}</a></div>}
    </>}
    {notice && <p className={styles.notice} role="status">{errorText(notice)}</p>}
    <p className={styles.mint}>IMP · <a href={`https://explorer.solana.com/address/${IMPERIVM_TITLE.mint}`} target="_blank" rel="noopener noreferrer" title={IMPERIVM_TITLE.mint}>{IMPERIVM_TITLE.mint.slice(0,8)}…{IMPERIVM_TITLE.mint.slice(-8)} ↗</a></p>
  </div>;
}
