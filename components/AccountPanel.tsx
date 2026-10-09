'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {PaintedIcon} from './PaintedIcon';
import {RomanIcon} from './presentation/RomanIcon';
import Dialog from './Dialog';
import { useImperivmWallet } from './WalletContext';
import { useIDos } from './IDosContext';
import { useCollection } from './CollectionContext';
import { useLocale } from './LocaleContext';
import { explorerUrl, readDevnetBalance } from '../lib/solana/devnet';
import { readRugBalance, rugMint } from '../lib/solana/rug';
import {readImpWalletBalance} from '../lib/solana/imp';
import {playProofEnabled} from '../lib/solana/features';

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const { t, errorText, locale } = useLocale(), wallet = useImperivmWallet(), idos = useIDos(), collection = useCollection();
  const owner = idos.session.owner ?? wallet.owner;
  const achievements = playProofEnabled();
  const [balances, setBalances] = useState<{ owner: string; sol: number; rug: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null), [refreshing, setRefreshing] = useState(false), [revision, setRevision] = useState(0);
  const [imp, setImp] = useState<string | null>(null), [impUnavailable, setImpUnavailable] = useState(false);
  useEffect(() => {
    let cancelled = false; setImp(null); setImpUnavailable(false);
    if (owner) void readImpWalletBalance(owner).then(amount => {if (!cancelled) setImp(amount);}).catch(() => {if (!cancelled) setImpUnavailable(true);});
    return () => {cancelled = true;};
  }, [owner, revision]);
  useEffect(() => {
    let cancelled = false; setBalances(null); setError(null);
    if (!owner || !achievements) {setRefreshing(false);return;}
    setRefreshing(true);
    void Promise.all([readDevnetBalance(owner), readRugBalance(owner)]).then(([sol, rug]) => {
      if (!cancelled) setBalances({ owner, sol, rug });
    }).catch(() => { if (!cancelled) setError(t('Не удалось прочитать devnet. Обновите баланс.', 'Devnet is unavailable. Refresh the balance.')); })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [owner, revision, locale, achievements]);
  return <Dialog title={t('Ваш аккаунт', 'Your account')} onClose={onClose}>
    <p className="integration-note">{idos.session.status === 'wallet' ? t('Вы вошли в iDos Games кошельком. Коллекция и игровые $IMP привязаны к этому аккаунту.', 'Signed in to iDos Games with your wallet. Collection and game IMP belong to this account.') : idos.session.status === 'guest' ? t('Гостевой аккаунт iDos. Войдите кошельком для доступа с другого устройства. Гостевая коллекция не переносится автоматически.', 'iDos guest account. Sign in with your wallet to play across devices. Guest collection is not automatically transferred.') : t('Тренировка доступна без кошелька. Вход в iDos сохраняет коллекцию в вашем аккаунте.', 'Training is available without a wallet. Sign in to iDos to keep your collection in your account.')}</p>
    {owner && <a className="wallet-address" href={achievements ? explorerUrl(owner) : `https://explorer.solana.com/address/${encodeURIComponent(owner)}`} target="_blank" rel="noreferrer">{owner} ↗</a>}
    {owner && achievements && <div className="wallet-balance"><strong>{balances?.owner === owner ? balances.sol.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 5 }) : '—'}</strong> {t('тестовых SOL', 'test SOL')}</div>}
    {owner && <div className="wallet-balance"><strong>{imp ?? '—'}</strong> $IMP <span>{impUnavailable ? t('Не удалось прочитать кошелёк · обновите баланс', 'Wallet balance unavailable · refresh to retry') : t('В кошельке · Solana mainnet', 'In your wallet · Solana mainnet')}</span></div>}
    <div className="wallet-balance"><strong>{collection.snapshot?.rug.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') ?? '—'}</strong> {t('игровых $IMP', 'game IMP')} <span>{collection.snapshot?.mode === 'idos' ? 'iDos Games' : t('локальное демо', 'local demo')}</span></div>
    <p className="integration-note">{achievements && rugMint() ? `${t('$IMP в кошельке · devnet:', 'Wallet IMP · devnet:')} ${balances?.owner === owner ? balances.rug ?? '—' : '—'}` : t('Баланс для паков читается из iDos. Токены в Phantom и токены, внесённые в iDos, показываются отдельно. Тренировка бесплатна.', 'Pack balance is read from iDos. Tokens in Phantom and tokens deposited in iDos are shown separately. Training is free.')}</p>
    <div className="dialog-actions">
      {idos.configured && idos.session.status !== 'wallet' && <button className="primary-button" disabled={idos.busy || wallet.busy} onClick={() => void idos.login()}>{idos.busy ? t('Ожидаем подпись…', 'Waiting for signature…') : t('Войти в iDos кошельком', 'Sign in to iDos with wallet')}</button>}
      {!idos.configured && !wallet.owner && (wallet.installed ? <button className="primary-button" disabled={wallet.busy} onClick={() => void wallet.connect()}>{t('Подключить Phantom', 'Connect Phantom')}</button> : <a className="primary-button" href="https://phantom.com/download" target="_blank" rel="noreferrer">{t('Установить Phantom ↗', 'Install Phantom ↗')}</a>)}
      {owner && <button className="secondary-button" disabled={refreshing || collection.busy} onClick={() => { setRevision(value => value + 1); void collection.refresh(); }}>{refreshing ? t('Обновляем…', 'Refreshing…') : t('Обновить баланс', 'Refresh balance')}</button>}
      {idos.session.status === 'wallet' && <button className="secondary-button" disabled={idos.busy || collection.busy} onClick={() => void idos.logout()}><RomanIcon name="logout" size={18}/>{t('Выйти из iDos', 'Sign out of iDos')}</button>}
      {wallet.owner && <button className="secondary-button" disabled={wallet.busy || idos.busy || collection.busy} onClick={() => void wallet.disconnect()}>{t('Отключить Phantom', 'Disconnect Phantom')}</button>}
    </div>
    {idos.session.status === 'restricted' && <p className="integration-error" role="status">{t('Сервер iDos ограничил доступ по настройкам Title. Демо остаётся доступным.', 'The iDos title access policy restricts this account. Demo remains available.')}</p>}
    {(idos.session.error || wallet.error || error) && <p className="integration-error" role="status">{errorText(idos.session.error ?? wallet.error ?? error ?? '')}</p>}
    {idos.session.status === 'error' && <button className="secondary-button" disabled={idos.busy} onClick={() => void idos.retry()}>{t('Повторить подключение iDos', 'Retry iDos connection')}</button>}
    {idos.configured && <button className="secondary-button mt-4" disabled={collection.busy} onClick={() => void collection.useLocalDemo()}>{t('Играть в локальном демо', 'Use local demo')}</button>}
    <div className="dialog-actions"><Link href="/packs" onClick={onClose}><PaintedIcon name="pack" size={32}/>{t('Паки и пополнение IMP', 'Packs and IMP top-ups')}</Link><Link href="/leaderboard" onClick={onClose}><PaintedIcon name="heroes" size={32}/>{t('История побед', 'Battle history')}</Link></div>
    <p className="integration-note">{t('Вход в iDos использует подпись сообщения. Для боя с ИИ дополнительные подписи и SOL не нужны.', 'iDos sign-in uses a message signature. AI battles need no additional signatures or SOL.')}</p>
  </Dialog>;
}
