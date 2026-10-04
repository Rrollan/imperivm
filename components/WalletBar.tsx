'use client';
import { useState } from 'react';
import Link from 'next/link';
import MuteButton from './MuteButton';
import Dialog from './Dialog';
import { useImperivmWallet } from './WalletContext';
import { explorerUrl } from '../lib/solana/devnet';
export default function WalletBar() {
  const wallet = useImperivmWallet();
  const [open, setOpen] = useState(false);
  return <>
    <header className="app-header border-b border-gold/20 bg-void/70 backdrop-blur">
      <div className="max-w-6xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2">
        <Link href="/" className="header-brand font-display tracking-[0.18em] gold-text font-bold">IMPERIVM</Link>
        <div className="wallet-controls flex items-center gap-2">
          <MuteButton />
          <span className="hidden sm:inline-block text-[11px] px-2.5 py-1 rounded-full border border-mint/40 text-mint uppercase tracking-widest">{wallet.owner ? 'Solana devnet' : 'Demo · wallet optional'}</span>
          <button className="wallet-button" onClick={() => setOpen(true)}>{wallet.owner ? `${wallet.owner.slice(0, 4)}…${wallet.owner.slice(-4)}` : '◈ Phantom'}</button>
        </div>
      </div>
    </header>
    {open && <Dialog title="Your wallet · devnet" onClose={() => setOpen(false)}>
      {wallet.owner ? <>
        <a className="wallet-address" href={explorerUrl(wallet.owner)} target="_blank" rel="noreferrer">{wallet.owner} ↗</a>
        <div className="wallet-balance"><strong>{wallet.balance === null ? '—' : wallet.balance.toLocaleString('en-US', { maximumFractionDigits: 5 })}</strong> test SOL <span>devnet only</span></div>
        <div className="dialog-actions"><button className="secondary-button" onClick={() => void wallet.refresh()}>Refresh balance</button><button className="secondary-button" onClick={() => void wallet.disconnect()}>Disconnect</button></div>
        <a className="text-mint text-sm" href="https://faucet.solana.com/" target="_blank" rel="noreferrer">Get free devnet SOL ↗</a>
      </> : <>
        <p className="text-parchment/80 text-sm leading-relaxed">Connect Phantom for signed proof of play and devnet collectibles. All four heroes and demo matches remain free to play.</p>
        {wallet.installed ? <button className="primary-button mt-5" disabled={wallet.busy} onClick={() => void wallet.connect()}>{wallet.busy ? 'Waiting for Phantom…' : 'Connect Phantom'}</button> : <a className="primary-button inline-block mt-5" href="https://phantom.com/download" target="_blank" rel="noreferrer">Install Phantom ↗</a>}
      </>}
      {wallet.error && <p role="status" className="integration-error">{wallet.error}</p>}
      <p className="integration-note">Message signatures cost nothing. NFT transactions use test SOL for devnet fees and account rent, and always require your wallet approval.</p>
    </Dialog>}
  </>;
}
