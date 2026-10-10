'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {PaintedIcon} from './PaintedIcon';
import Dialog from './Dialog';
import {useImperivmWallet} from './WalletContext';
import {useIDos} from './IDosContext';
import {useCollection} from './CollectionContext';
import {useLocale} from './LocaleContext';
import {formatImpAmount, readImpWalletBalance} from '../lib/solana/imp';
import {ImpWalletPanel} from './ImpWalletPanel';
import {WalletProfilePanel} from './WalletProfilePanel';
import styles from './AccountPanel.module.css';

export function AccountPanel({onClose}: {onClose: () => void}) {
  const {t, errorText, locale} = useLocale(), wallet = useImperivmWallet(), idos = useIDos(), collection = useCollection();
  const owner = idos.embedded ? idos.session.owner ?? wallet.owner : wallet.owner;
  const signedIn = !!idos.profileIdentity;
  const [revision, setRevision] = useState(0);
  const [fundingOpened, setFundingOpened] = useState(false);
  const [balance, setBalance] = useState<{owner: string; amount?: string; failed?: boolean} | null>(null);
  useEffect(() => {
    let cancelled = false; setBalance(null);
    if (owner) void readImpWalletBalance(owner).then(amount => {if (!cancelled) setBalance({owner, amount});}).catch(() => {if (!cancelled) setBalance({owner, failed: true});});
    return () => {cancelled = true;};
  }, [owner, revision]);
  const current = balance?.owner === owner ? balance : null;
  const reading = !!owner && !current;
  const inIDos = collection.snapshot?.mode === 'idos';
  const gameBalance = collection.snapshot?.rug;
  const button = styles.button, primary = `${button} ${styles.primary}`;
  const refresh = () => {setRevision(value => value + 1); void collection.refresh();};
  return <Dialog title={t('Аккаунт', 'Account')} onClose={onClose} className={styles.dialog}>
    {signedIn ? <WalletProfilePanel/> : <div className={styles.identity}>
      <PaintedIcon name="wallet" size={44}/>
      <div><strong>{t('Войдите кошельком', 'Sign in with your wallet')}</strong>
        <p>{t('Ваш профиль и коллекция на всех устройствах.', 'Your profile and collection across your devices.')}</p>
        {owner && <a className={styles.address} href={`https://explorer.solana.com/address/${encodeURIComponent(owner)}`} target="_blank" rel="noreferrer" title={owner}>{owner.slice(0, 7)}…{owner.slice(-6)} ↗ Solana mainnet</a>}
      </div>
    </div>}
    {!signedIn && <div className={styles.actions}>
      {idos.configured && <button className={primary} disabled={idos.busy || wallet.busy || collection.busy} onClick={() => void idos.login()}>{idos.busy ? t('Ожидаем подпись…', 'Waiting for signature…') : t('Войти кошельком', 'Sign in with wallet')}</button>}
      {!idos.configured && !wallet.owner && (wallet.installed ? <button className={primary} disabled={wallet.busy} onClick={() => void wallet.connect()}>{t('Подключить Phantom', 'Connect Phantom')}</button> : <a className={primary} href="https://phantom.com/download" target="_blank" rel="noreferrer">{t('Установить Phantom ↗', 'Install Phantom ↗')}</a>)}
      {idos.session.status === 'error' && <button className={button} disabled={idos.busy} onClick={() => void idos.retry()}>{t('Повторить', 'Retry')}</button>}
      <p className={styles.signInNote}>{t('Подпись сообщения · без списаний', 'Message signature · no debit')}</p>
    </div>}
    <div className={styles.balances}>
      <section className={styles.balance} aria-label={t('Баланс кошелька', 'Wallet balance')}>
        <div className={styles.balanceHeading}><h3>Phantom</h3>{owner && <button type="button" className={styles.refresh} disabled={reading || collection.busy} onClick={refresh} aria-label={t('Обновить оба баланса', 'Refresh both balances')} title={t('Обновить оба баланса', 'Refresh both balances')}><PaintedIcon name="history" size={24}/></button>}</div>
        <div className={styles.amount} aria-live="polite"><strong>{current?.amount !== undefined ? formatImpAmount(current.amount, locale) : '—'}</strong> IMP</div>
        <p>{!owner ? t('Кошелёк не подключён', 'Wallet disconnected') : reading ? t('Читаем баланс…', 'Loading balance…') : current?.failed ? t('Сеть недоступна · обновите', 'Network unavailable · refresh') : 'Solana mainnet'}</p>
      </section>
      <section className={styles.balance} aria-label={t('Игровой баланс', 'Game balance')}>
        <div className={styles.balanceHeading}><h3>{inIDos ? t('В игре · iDos', 'In game · iDos') : t('Тренировка', 'Practice')}</h3><PaintedIcon name="rug" size={24}/></div>
        <div className={styles.amount}><strong>{gameBalance !== undefined ? formatImpAmount(collection.snapshot?.exactBalance ?? String(gameBalance), locale) : '—'}</strong> IMP</div>
        <p>{inIDos ? t('Для паков и рынка', 'For packs and the market') : t('Демо · без реальных IMP', 'Demo · no real IMP')}</p>
      </section>
    </div>
    {idos.configured && <>
      <p className={styles.note}>{t('Вход не переносит IMP. Пополнение — отдельный перевод в mainnet; SOL нужны для комиссии. iDos ограничивает вывод по возрасту аккаунта — проверьте срок и комиссии перед пополнением.', 'Sign-in does not move IMP. Deposits are separate mainnet transfers, with fees paid in SOL. iDos limits withdrawals by account age — check the waiting period and fees before depositing.')}</p>
      <details className={styles.funding} onToggle={event => {if (event.currentTarget.open) setFundingOpened(true);}}><summary><PaintedIcon name="wallet" size={28}/>{t('Купить, пополнить или вывести IMP', 'Buy, deposit or withdraw IMP')}</summary>{fundingOpened && <ImpWalletPanel walletBalance={current?.amount} onBalanceChanged={() => setRevision(value => value + 1)}/>}</details>
    </>}
    {idos.session.status === 'restricted' && <p className={styles.notice} role="status">{t('iDos ограничил доступ к аккаунту. Бесплатная тренировка доступна.', 'iDos restricted account access. Free training remains available.')}</p>}
    {(idos.session.error || wallet.error || collection.error) && <p className={styles.notice} role="status">{errorText(idos.session.error ?? wallet.error ?? collection.error ?? '')}</p>}
    <div className={styles.links}>
      <Link href="/packs" onClick={onClose}><PaintedIcon name="pack" size={28}/>{t('Паки', 'Packs')}</Link>
      <Link href="/leaderboard" onClick={onClose}><PaintedIcon name="heroes" size={28}/>{t('Мои победы', 'My victories')}</Link>
    </div>
    <div className={styles.quiet}>
      {signedIn ? <button className={styles.textButton} disabled={idos.busy || collection.busy} onClick={() => void idos.logout()}>{t('Выйти из аккаунта', 'Sign out')}</button> : idos.configured && <button className={styles.textButton} disabled={collection.busy} onClick={() => void collection.useLocalDemo()}>{t('Бесплатная тренировка', 'Free practice')}</button>}
      {wallet.owner && <button className={styles.textButton} disabled={wallet.busy || idos.busy || collection.busy} onClick={() => void wallet.disconnect()}>{t('Отключить Phantom', 'Disconnect Phantom')}</button>}
    </div>
  </Dialog>;
}
