'use client';
import { useState } from 'react';
import Link from 'next/link';
import MuteButton from './MuteButton';
import ArenaSettings, { useBoardSkin } from './ArenaSettings';
import MechanicsGuide from './MechanicsGuide';
import Dialog from './Dialog';
import { LanguageSwitch, useLocale } from './LocaleContext';
import { useImperivmWallet } from './WalletContext';
import { explorerUrl } from '../lib/solana/devnet';
export default function WalletBar({ onSettings, onHelp }: { onSettings?: () => void; onHelp?: () => void } = {}) {
  const { t, locale, errorText } = useLocale();
  const wallet = useImperivmWallet();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false), [helpOpen, setHelpOpen] = useState(false);
  const [skin, setSkin] = useBoardSkin();
  return <>
    <header className="app-header arena-frieze">
      <div className="frieze-inner">
        <Link href="/arena" className="header-brand" aria-label={t('IMPERIVM · Врата арены', 'IMPERIVM · Arena gates')}>IMPERIVM</Link>
        <div className="wallet-controls">
          <LanguageSwitch className="frieze-control" /><MuteButton className="frieze-control" />
          <button className="icon-button frieze-control" onClick={onSettings ?? (() => setSettingsOpen(true))} aria-label={t('Настройки арены', 'Arena settings')} title={t('Настройки', 'Settings')}>⚙</button>
          <button className="icon-button frieze-control" onClick={onHelp ?? (() => setHelpOpen(true))} aria-label={t('Правила игры', 'Open rulebook')} title={t('Помощь', 'Help')}>?</button>
          <button className="wallet-button frieze-control" onClick={() => setOpen(true)} aria-label={t('Открыть кошелёк', 'Open wallet')} title={wallet.owner ?? t('Кошелёк · devnet', 'Wallet · devnet')}><span aria-hidden>◈</span><span className="frieze-wallet-label">{wallet.owner ? `${wallet.owner.slice(0, 4)}…${wallet.owner.slice(-4)}` : t('Кошелёк', 'Wallet')}</span></button>
        </div>
      </div>
    </header>
    {settingsOpen && <ArenaSettings skin={skin} onChange={setSkin} onClose={() => setSettingsOpen(false)} />}
    {helpOpen && <MechanicsGuide onClose={() => setHelpOpen(false)} />}
    {open && <Dialog title={t('Ваш кошелёк · devnet', 'Your wallet · devnet')} onClose={() => setOpen(false)}>
      {wallet.owner ? <>
        <a className="wallet-address" href={explorerUrl(wallet.owner)} target="_blank" rel="noreferrer">{wallet.owner} ↗</a>
        <div className="wallet-balance"><strong>{wallet.balance === null ? '—' : wallet.balance.toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', { maximumFractionDigits: 5 })}</strong> {t('тестовых SOL', 'test SOL')} <span>{t('только devnet', 'devnet only')}</span></div>
        <div className="dialog-actions"><button className="secondary-button" onClick={() => void wallet.refresh()}>{t('Обновить баланс', 'Refresh balance')}</button><button className="secondary-button" onClick={() => void wallet.disconnect()}>{t('Отключить', 'Disconnect')}</button></div>
        <a className="text-mint text-sm" href="https://faucet.solana.com/" target="_blank" rel="noreferrer">{t('Получить бесплатные SOL в devnet ↗', 'Get free devnet SOL ↗')}</a>
      </> : <>
        <p className="text-parchment/80 text-sm leading-relaxed">{t('Подключите Phantom для подписи записи матча и коллекционных NFT в devnet. Все четыре героя и демо-матчи доступны бесплатно.', 'Connect Phantom for signed proof of play and devnet collectibles. All four heroes and demo matches remain free to play.')}</p>
        {wallet.installed ? <button className="primary-button mt-5" disabled={wallet.busy} onClick={() => void wallet.connect()}>{wallet.busy ? t('Ожидаем Phantom…', 'Waiting for Phantom…') : t('Подключить Phantom', 'Connect Phantom')}</button> : <a className="primary-button inline-block mt-5" href="https://phantom.com/download" target="_blank" rel="noreferrer">{t('Установить Phantom ↗', 'Install Phantom ↗')}</a>}
      </>}
      {wallet.error && <p role="status" className="integration-error">{errorText(wallet.error)}</p>}
      <p className="integration-note">{t('Подпись сообщений бесплатна. Транзакции NFT используют тестовые SOL для комиссий devnet и аренды аккаунтов. Каждую транзакцию вы подтверждаете в кошельке.', 'Message signatures cost nothing. NFT transactions use test SOL for devnet fees and account rent, and always require your wallet approval.')}</p>
    </Dialog>}
  </>;
}
