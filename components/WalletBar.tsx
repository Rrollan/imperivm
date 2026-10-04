'use client';
import { useState } from 'react';
import Link from 'next/link';
import MuteButton from './MuteButton';
import Dialog from './Dialog';
import { LanguageSwitch, useLocale } from './LocaleContext';
import { useImperivmWallet } from './WalletContext';
import { explorerUrl } from '../lib/solana/devnet';
export default function WalletBar() {
  const { t, locale, errorText } = useLocale();
  const wallet = useImperivmWallet();
  const [open, setOpen] = useState(false);
  return <>
    <header className="app-header border-b border-gold/20 bg-void/70 backdrop-blur">
      <div className="max-w-6xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2">
        <Link href="/" className="header-brand font-display tracking-[0.18em] gold-text font-bold">IMPERIVM</Link>
        <div className="wallet-controls flex items-center gap-2">
          <LanguageSwitch className="!px-2 !py-1 text-[10px]" /><MuteButton />
          <span className="hidden sm:inline-block text-[11px] px-2.5 py-1 rounded-full border border-mint/40 text-mint uppercase tracking-widest">{wallet.owner ? 'Solana devnet' : t('Демо · кошелёк по желанию', 'Demo · wallet optional')}</span>
          <button className="wallet-button" onClick={() => setOpen(true)}>{wallet.owner ? `${wallet.owner.slice(0, 4)}…${wallet.owner.slice(-4)}` : '◈ Phantom'}</button>
        </div>
      </div>
    </header>
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
