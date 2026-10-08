'use client';
import { useState } from 'react';
import Link from 'next/link';
import MuteButton from './MuteButton';
import ArenaSettings, { useBoardSkin } from './ArenaSettings';
import MechanicsGuide from './MechanicsGuide';
import { AccountPanel } from './AccountPanel';
import { LanguageSwitch, useLocale } from './LocaleContext';
import { useImperivmWallet } from './WalletContext';
export default function WalletBar({ onSettings, onHelp }: { onSettings?: () => void; onHelp?: () => void } = {}) {
  const { t } = useLocale();
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
    {open && <AccountPanel onClose={() => setOpen(false)}/>}
  </>;
}
