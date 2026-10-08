'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Dialog from './Dialog';
import { useImperivmWallet } from './WalletContext';
import { useIDos } from './IDosContext';
import { useCollection } from './CollectionContext';
import { useLocale } from './LocaleContext';
import { explorerUrl, readDevnetBalance } from '../lib/solana/devnet';
import { readRugBalance, rugMint } from '../lib/solana/rug';

export function AccountPanel({ onClose }: { onClose: () => void }) {
  const { t, errorText, locale } = useLocale(), wallet = useImperivmWallet(), idos = useIDos(), collection = useCollection();
  const owner = idos.session.owner ?? wallet.owner;
  const [balances, setBalances] = useState<{ owner: string; sol: number; rug: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null), [refreshing, setRefreshing] = useState(false), [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false; setBalances(null); setError(null);
    if (!owner) return;
    setRefreshing(true);
    void Promise.all([readDevnetBalance(owner), readRugBalance(owner)]).then(([sol, rug]) => {
      if (!cancelled) setBalances({ owner, sol, rug });
    }).catch(() => { if (!cancelled) setError(t('Не удалось прочитать devnet. Обновите баланс.', 'Devnet is unavailable. Refresh the balance.')); })
      .finally(() => { if (!cancelled) setRefreshing(false); });
    return () => { cancelled = true; };
  }, [owner, revision, locale]);
  return <Dialog title={t('Ваш аккаунт · Solana devnet', 'Your account · Solana devnet')} onClose={onClose}>
    <p className="integration-note">{idos.session.status === 'wallet' ? t('Вы вошли в iDos Games кошельком. Коллекция и игровые $RUG привязаны к этому аккаунту.', 'Signed in to iDos Games with your wallet. Collection and game RUG belong to this account.') : idos.session.status === 'guest' ? t('Гостевой аккаунт iDos. Войдите кошельком для доступа с другого устройства. Гостевая коллекция не переносится автоматически.', 'iDos guest account. Sign in with your wallet to play across devices. Guest collection is not automatically transferred.') : t('Демо доступно без кошелька. Phantom нужен для подписанных матчей и достижений devnet.', 'Demo is available without a wallet. Phantom enables signed matches and devnet achievements.')}</p>
    {owner && <a className="wallet-address" href={explorerUrl(owner)} target="_blank" rel="noreferrer">{owner} ↗</a>}
    {owner && <div className="wallet-balance"><strong>{balances?.owner === owner ? balances.sol.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 5 }) : '—'}</strong> {t('тестовых SOL', 'test SOL')}</div>}
    <div className="wallet-balance"><strong>{collection.snapshot?.rug.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US') ?? '—'}</strong> {t('игровых $RUG', 'game RUG')} <span>{collection.snapshot?.mode === 'idos' ? 'iDos Games' : t('локальное демо', 'local demo')}</span></div>
    <p className="integration-note">{rugMint() ? `${t('$RUG в кошельке · devnet:', 'Wallet RUG · devnet:')} ${balances?.owner === owner ? balances.rug ?? '—' : '—'}` : t('Токен $RUG ещё не создан. Паки используют виртуальную валюту без денежных трат.', 'RUG token has not been created. Packs use virtual currency without monetary spending.')}</p>
    <div className="dialog-actions">
      {idos.configured && idos.session.status !== 'wallet' && <button className="primary-button" disabled={idos.busy || wallet.busy} onClick={() => void idos.login()}>{idos.busy ? t('Ожидаем подпись…', 'Waiting for signature…') : t('Войти в iDos кошельком', 'Sign in to iDos with wallet')}</button>}
      {!idos.configured && !wallet.owner && (wallet.installed ? <button className="primary-button" disabled={wallet.busy} onClick={() => void wallet.connect()}>{t('Подключить Phantom', 'Connect Phantom')}</button> : <a className="primary-button" href="https://phantom.com/download" target="_blank" rel="noreferrer">{t('Установить Phantom ↗', 'Install Phantom ↗')}</a>)}
      {owner && <button className="secondary-button" disabled={refreshing || collection.busy} onClick={() => { setRevision(value => value + 1); void collection.refresh(); }}>{refreshing ? t('Читаем devnet…', 'Reading devnet…') : t('Обновить баланс', 'Refresh balance')}</button>}
      {idos.session.status === 'wallet' && <button className="secondary-button" disabled={idos.busy || collection.busy} onClick={() => void idos.logout()}>{t('Выйти из iDos', 'Sign out of iDos')}</button>}
      {wallet.owner && <button className="secondary-button" disabled={wallet.busy || idos.busy || collection.busy} onClick={() => void wallet.disconnect()}>{t('Отключить Phantom', 'Disconnect Phantom')}</button>}
    </div>
    {idos.session.status === 'restricted' && <p className="integration-error" role="status">{t('Сервер iDos ограничил доступ по настройкам Title. Демо остаётся доступным.', 'The iDos title access policy restricts this account. Demo remains available.')}</p>}
    {(idos.session.error || wallet.error || error) && <p className="integration-error" role="status">{errorText(idos.session.error ?? wallet.error ?? error ?? '')}</p>}
    {idos.session.status === 'error' && <button className="secondary-button" disabled={idos.busy} onClick={() => void idos.retry()}>{t('Повторить подключение iDos', 'Retry iDos connection')}</button>}
    {idos.configured && <button className="secondary-button mt-4" disabled={collection.busy} onClick={() => void collection.useLocalDemo()}>{t('Играть в локальном демо', 'Use local demo')}</button>}
    <div className="dialog-actions"><Link href="/packs" onClick={onClose}>{t('Открыть паки →', 'Open packs →')}</Link><Link href="/leaderboard" onClick={onClose}>{t('Зал побед и NFT →', 'Wins and NFT →')}</Link></div>
    <p className="integration-note">{t('Вход и proof-of-play — бесплатные подписи сообщений. NFT требует отдельного подтверждения транзакции с тестовыми SOL.', 'Login and proof of play are free message signatures. An NFT needs a separately approved transaction with test SOL.')}</p>
  </Dialog>;
}
