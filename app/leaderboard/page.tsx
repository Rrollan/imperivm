'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WalletBar from '../../components/WalletBar';
import DevnetApproval from '../../components/DevnetApproval';
import { useImperivmWallet } from '../../components/WalletContext';
import { localLeaderboard, readMatches, winsFor, type MatchRecord } from '../../lib/matches';
import { explorerUrl } from '../../lib/solana/devnet';
import { metadataBase } from '../../lib/solana/metadata';
import type { DevnetPlan } from '../../lib/solana/metaplex';
export default function LeaderboardPage() {
  const wallet = useImperivmWallet();
  const [rows, setRows] = useState<ReturnType<typeof localLeaderboard>>([]), [matches, setMatches] = useState<MatchRecord[]>([]);
  const [plan, setPlan] = useState<DevnetPlan | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [receipt, setReceipt] = useState<string | null>(null);
  useEffect(() => { const update = () => { setRows(localLeaderboard()); setMatches(readMatches()); }; update(); window.addEventListener('imperivm:matches', update); window.addEventListener('storage', update); return () => { window.removeEventListener('imperivm:matches', update); window.removeEventListener('storage', update); }; }, []);
  useEffect(() => { setPlan(null); setReceipt(null); setError(null); }, [wallet.owner]);
  const wins = wallet.owner ? winsFor(wallet.owner) : 0;
  async function prepareBadge() {
    if (!wallet.owner || busy) return;
    const owner = wallet.owner; setBusy(true); setError(null);
    try { const prepared = await (await import('../../lib/solana/achievement')).prepareVictoryBadge(owner, wallet.signTransaction); setPlan(prepared); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not prepare the badge.'); }
    finally { setBusy(false); }
  }
  async function approve() {
    if (!plan || busy) return;
    setBusy(true); setError(null);
    try { const signature = await (await import('../../lib/solana/metaplex')).sendDevnetPlan(plan); setPlan(null); setReceipt(signature); await wallet.refresh(); }
    catch (e) { setPlan(null); setError(e instanceof Error ? e.message : 'Transaction not confirmed.'); }
    finally { setBusy(false); }
  }
  return <div className="min-h-screen bg-abyss text-parchment"><WalletBar /><main className="collection-page">
    <nav className="collection-nav"><Link href="/">← Forum</Link><Link href="/collection">Collection</Link><Link href="/packs">Packs</Link></nav>
    <p className="eyebrow">The empire remembers</p><h1 className="font-display text-4xl sm:text-5xl gold-text">Hall of victories</h1>
    <p className="integration-note">Local standings in this browser. AI matches are self-reported. Autoplay exhibitions are excluded. Online competitive ranking is a future iDos module.</p>
    <div className="leaderboard-table"><div className="leaderboard-row leaderboard-heading"><span>Player</span><span>Wins</span><span>Games</span></div>{rows.length ? rows.map((row, i) => <div className="leaderboard-row" key={row.owner}><span><small>{i + 1}</small> {row.owner === 'demo' ? 'Demo Imperator' : `${row.owner.slice(0, 6)}…${row.owner.slice(-4)}`}</span><strong>{row.wins}</strong><span>{row.games}</span></div>) : <p className="p-6 text-lavender">Your first match starts the story.</p>}</div>
    <section className="integration-panel"><h2 className="font-display text-2xl text-gold">First Victory badge</h2><p className="integration-note">Mint one Metaplex Core NFT to your wallet on devnet, then update its on-chain <code>wins</code> attribute after later victories. Your wallet owns the badge and its update authority. This is a self-reported achievement, not an anti-cheat proof.</p>
      <p className="mt-4 text-sm">{wallet.owner ? `${wins} signed-match wins for this wallet` : 'Connect Phantom and win a signed match to qualify.'}</p>
      {!metadataBase() && <p className="integration-note">Minting is unavailable until a real public HTTPS metadata origin is configured. No NFT has been created by this setup.</p>}
      <button className="primary-button mt-5" disabled={!wallet.owner || !wins || !metadataBase() || busy} onClick={() => void prepareBadge()}>{busy ? 'Preparing…' : 'Mint / sync badge · devnet'}</button>
      {receipt && <a className="receipt-link" href={explorerUrl(receipt, 'tx')} target="_blank" rel="noreferrer">Confirmed devnet transaction ↗</a>}
      {error && <p role="status" className="integration-error">{error}</p>}
    </section>
    <h2 className="font-display text-2xl mt-10 text-gold">Recent campaigns</h2><div className="mt-4 space-y-2">{matches.slice(0, 10).map(m => <div key={m.id} className="recent-match"><span>{m.heroId} · {m.exhibition ? 'exhibition' : m.draw ? 'draw' : m.won ? 'victory' : 'defeat'}</span><span>{m.blocks} blocks · {m.stats.cardsPlayed} cards</span></div>)}</div>
  </main>{plan && <DevnetApproval plan={plan} busy={busy} onApprove={() => void approve()} onCancel={() => setPlan(null)} />}</div>;
}
