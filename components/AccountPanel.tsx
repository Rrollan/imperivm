'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {PaintedIcon} from './PaintedIcon';
import {RomanIcon} from './presentation/RomanIcon';
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
  const owner = idos.session.owner ?? wallet.owner;
  const [revision, setRevision] = useState(0);
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
  return <Dialog title={t('Ваш аккаунт', 'Your account')} onClose={onClose} className={styles.dialog}>
    {idos.session.status === 'wallet' ? <WalletProfilePanel/> : <div className={styles.identity}>
      <RomanIcon name="laurel" size={30} className={styles.seal}/>
      <div><strong>{idos.session.status === 'guest' ? t('Гость iDos Games', 'iDos Games guest') : t('Готовы к сражению', 'Ready for battle')}</strong>
        <p>{t('Войдите кошельком, чтобы открыть свою коллекцию на любом устройстве.', 'Sign in with your wallet to access your collection on any device.')}</p>
        {owner && <a className={styles.address} href={`https://explorer.solana.com/address/${encodeURIComponent(owner)}`} target="_blank" rel="noreferrer" title={owner}>{owner.slice(0, 7)}…{owner.slice(-6)} ↗ Solana mainnet</a>}
      </div>
    </div>}
    <div className={styles.balances}>
      <section className={styles.balance} aria-label={t('Баланс кошелька', 'Wallet balance')}>
        <h3>{t('В кошельке Phantom', 'In Phantom wallet')}</h3>
        <div className={styles.amount} aria-live="polite"><strong>{current?.amount !== undefined ? formatImpAmount(current.amount, locale) : '—'}</strong> IMP</div>
        <p>{!owner ? t('Подключите кошелёк для просмотра.', 'Connect your wallet to view it.') : reading ? t('Читаем баланс Solana…', 'Reading Solana balance…') : current?.failed ? t('Сеть временно недоступна. Нажмите «Обновить».', 'Network temporarily unavailable. Press Refresh.') : t('Ваши токены в сети Solana.', 'Your tokens on Solana.')}</p>
      </section>
      <section className={styles.balance} aria-label={t('Игровой баланс', 'Game balance')}>
        <h3>{inIDos ? t('На игровом счёте iDos', 'In your iDos game account') : t('Демо-баланс', 'Demo balance')}</h3>
        <div className={styles.amount}><strong>{gameBalance !== undefined ? formatImpAmount(collection.snapshot?.exactBalance ?? String(gameBalance), locale) : '—'}</strong> IMP</div>
        <p>{inIDos ? t('IMP, которые вы отдельно перевели в iDos. Вход кошельком не переносит токены.', 'IMP you separately transferred to iDos. Signing in does not move tokens.') : t('Только для бесплатной тренировки.', 'For free practice only.')}</p>
      </section>
    </div>
    <div className={styles.actions}>
      {idos.configured && idos.session.status !== 'wallet' && <button className={primary} disabled={idos.busy || wallet.busy || collection.busy} onClick={() => void idos.login()}>{idos.busy ? t('Ожидаем подпись…', 'Waiting for signature…') : t('Войти кошельком', 'Sign in with wallet')}</button>}
      {!idos.configured && !wallet.owner && (wallet.installed ? <button className={primary} disabled={wallet.busy} onClick={() => void wallet.connect()}>{t('Подключить Phantom', 'Connect Phantom')}</button> : <a className={primary} href="https://phantom.com/download" target="_blank" rel="noreferrer">{t('Установить Phantom ↗', 'Install Phantom ↗')}</a>)}
      {owner && <button className={button} disabled={reading || collection.busy} onClick={() => {setRevision(value => value + 1); void collection.refresh();}}>{reading || collection.busy ? t('Обновляем…', 'Refreshing…') : t('Обновить', 'Refresh')}</button>}
      {idos.session.status === 'error' && <button className={button} disabled={idos.busy} onClick={() => void idos.retry()}>{t('Повторить вход', 'Retry sign-in')}</button>}
    </div>
    {idos.configured && <ImpWalletPanel walletBalance={current?.amount} onBalanceChanged={() => setRevision(value => value + 1)}/>}
    <p className={styles.note}>{t('Вход подтверждается подписью сообщения. Бесплатные бои с ИИ и игроками не требуют SOL.', 'Sign-in uses a message signature. Free AI and PvP battles require no SOL.')}</p>
    {idos.session.status === 'restricted' && <p className={styles.notice} role="status">{t('iDos ограничил доступ к аккаунту. Бесплатная тренировка доступна.', 'iDos restricted account access. Free training remains available.')}</p>}
    {(idos.session.error || wallet.error || collection.error) && <p className={styles.notice} role="status">{errorText(idos.session.error ?? wallet.error ?? collection.error ?? '')}</p>}
    <div className={styles.links}>
      <Link href="/packs" onClick={onClose}><PaintedIcon name="pack" size={30}/>{t('Паки и пополнение IMP', 'Packs and IMP deposits')} →</Link>
      <Link href="/leaderboard" onClick={onClose}><PaintedIcon name="heroes" size={30}/>{t('История побед', 'Battle history')} →</Link>
    </div>
    <div className={styles.quiet}>
      {idos.session.status === 'wallet' ? <button className={styles.textButton} disabled={idos.busy || collection.busy} onClick={() => void idos.logout()}>{t('Выйти из iDos', 'Sign out of iDos')}</button> : idos.configured && <button className={styles.textButton} disabled={collection.busy} onClick={() => void collection.useLocalDemo()}>{t('Бесплатная тренировка', 'Free practice')}</button>}
      {wallet.owner && <button className={styles.textButton} disabled={wallet.busy || idos.busy || collection.busy} onClick={() => void wallet.disconnect()}>{t('Отключить Phantom', 'Disconnect Phantom')}</button>}
    </div>
  </Dialog>;
}
