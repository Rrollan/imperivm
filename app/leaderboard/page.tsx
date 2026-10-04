'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import WalletBar from '../../components/WalletBar';
import { useLocale } from '../../components/LocaleContext';
import DevnetApproval from '../../components/DevnetApproval';
import { useImperivmWallet } from '../../components/WalletContext';
import { localLeaderboard, readMatches, winsFor, type MatchRecord } from '../../lib/matches';
import { explorerUrl } from '../../lib/solana/devnet';
import { metadataBase } from '../../lib/solana/metadata';
import type { DevnetPlan } from '../../lib/solana/metaplex';
export default function LeaderboardPage() {
  const { t, heroName, errorText } = useLocale();
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
    <nav className="collection-nav"><Link href="/">{t('← Форум', '← Forum')}</Link><Link href="/collection">{t('Коллекция', 'Collection')}</Link><Link href="/packs">{t('Паки', 'Packs')}</Link></nav>
    <p className="eyebrow">{t('Империя помнит', 'The empire remembers')}</p><h1 className="font-display text-4xl sm:text-5xl gold-text">{t('Зал побед', 'Hall of victories')}</h1>
    <p className="integration-note">{t('Результаты хранятся в этом браузере. Матчи с ИИ записываются самим приложением. Показательные матчи в автобое не учитываются. Онлайн-рейтинг появится в будущем модуле iDos.', 'Local standings in this browser. AI matches are self-reported. Autoplay exhibitions are excluded. Online competitive ranking is a future iDos module.')}</p>
    <div className="leaderboard-table"><div className="leaderboard-row leaderboard-heading"><span>{t('Игрок', 'Player')}</span><span>{t('Победы', 'Wins')}</span><span>{t('Матчи', 'Games')}</span></div>{rows.length ? rows.map((row, i) => <div className="leaderboard-row" key={row.owner}><span><small>{i + 1}</small> {row.owner === 'demo' ? t('Демо-Император', 'Demo Imperator') : `${row.owner.slice(0, 6)}…${row.owner.slice(-4)}`}</span><strong>{row.wins}</strong><span>{row.games}</span></div>) : <p className="p-6 text-lavender">{t('Ваша история начинается с первого матча.', 'Your first match starts the story.')}</p>}</div>
    <section className="integration-panel"><h2 className="font-display text-2xl text-gold">{t('Значок «Первая победа»', 'First Victory badge')}</h2><p className="integration-note">{t('Создайте Metaplex Core NFT в своём кошельке devnet, затем обновляйте его атрибут ', 'Mint one Metaplex Core NFT to your wallet on devnet, then update its on-chain ')}<code>wins</code>{t(' после следующих побед. Кошелёк владеет значком и правом его обновления. Достижение основано на локальных результатах и не служит доказательством против читов.', ' attribute after later victories. Your wallet owns the badge and its update authority. This is a self-reported achievement, not an anti-cheat proof.')}</p>
      <p className="mt-4 text-sm">{wallet.owner ? t(`Побед в подписанных матчах этого кошелька: ${wins}`, `${wins} signed-match wins for this wallet`) : t('Подключите Phantom и победите в подписанном матче, чтобы получить значок.', 'Connect Phantom and win a signed match to qualify.')}</p>
      {!metadataBase() && <p className="integration-note">{t('Минт недоступен до настройки реального публичного HTTPS-адреса метаданных. Эта настройка ещё не создала NFT.', 'Minting is unavailable until a real public HTTPS metadata origin is configured. No NFT has been created by this setup.')}</p>}
      <button className="primary-button mt-5" disabled={!wallet.owner || !wins || !metadataBase() || busy} onClick={() => void prepareBadge()}>{busy ? t('Подготовка…', 'Preparing…') : t('Создать / обновить значок · devnet', 'Mint / sync badge · devnet')}</button>
      {receipt && <a className="receipt-link" href={explorerUrl(receipt, 'tx')} target="_blank" rel="noreferrer">{t('Подтверждённая транзакция devnet ↗', 'Confirmed devnet transaction ↗')}</a>}
      {error && <p role="status" className="integration-error">{errorText(error)}</p>}
    </section>
    <h2 className="font-display text-2xl mt-10 text-gold">{t('Последние кампании', 'Recent campaigns')}</h2><div className="mt-4 space-y-2">{matches.slice(0, 10).map(m => <div key={m.id} className="recent-match"><span>{heroName(m.heroId)} · {m.exhibition ? t('показательный матч', 'exhibition') : m.draw ? t('ничья', 'draw') : m.won ? t('победа', 'victory') : t('поражение', 'defeat')}</span><span>{m.blocks} {t('блоков', 'blocks')} · {m.stats.cardsPlayed} {t('карт', 'cards')}</span></div>)}</div>
  </main>{plan && <DevnetApproval plan={plan} busy={busy} onApprove={() => void approve()} onCancel={() => setPlan(null)} />}</div>;
}
