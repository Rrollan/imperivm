'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useImperivmWallet } from './WalletContext';
import { useNfts, nftScope } from './NftContext';
import DevnetApproval from './DevnetApproval';
import { useLocale } from './LocaleContext';
import CardView from './CardView';
import { CARDS } from '../lib/cards';
import { play } from '../lib/audio/sfx';
import { explorerUrl } from '../lib/solana/devnet';
import type { DevnetPlan } from '../lib/solana/metaplex';
import type { OwnedCardNFT } from '../lib/solana/ownership';
import { genesisDeployment, type GenesisDeployment } from '../lib/solana/deployment';
import { isAddress } from '@solana/kit';
type MintReceipt = { signature: string; account: string; owner: string; scope: string; status: 'confirmed' | 'unresolved' | 'failed' };
const PENDING_KEY = 'imperivm.pending-genesis.devnet.v1';
function storedMint(scope: string, owner: string | null): MintReceipt | null {
  try {
    const data = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    const item = Array.isArray(data) ? data.find(value => value?.scope === scope && value.owner === owner) : null;
    return item && isAddress(item.account) && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(item.signature) && ['confirmed', 'unresolved'].includes(item.status) ? item : null;
  } catch { return null; }
}
function savePending(receipt: MintReceipt, remove = false) {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]');
    const entries = (Array.isArray(raw) ? raw : []).filter(value => value?.scope !== receipt.scope);
    localStorage.setItem(PENDING_KEY, JSON.stringify(remove ? entries : [...entries, receipt]));
  } catch { /* The in-memory pending address still prevents automatic resubmission. */ }
}
export default function NftPack() {
  const { t, errorText } = useLocale();
  const wallet = useImperivmWallet(), nfts = useNfts();
  const [plan, setPlan] = useState<DevnetPlan | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [receipt, setReceipt] = useState<MintReceipt | null>(null), [card, setCard] = useState<OwnedCardNFT | null>(null), [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const ownerRef = useRef(wallet.owner); ownerRef.current = wallet.owner;
  const scopeRef = useRef(nfts.scope); scopeRef.current = nfts.scope;
  const planScope = useRef(''), pending = useRef<MintReceipt | null>(null);
  const lock = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const isCurrent = (scope: string) => alive.current && scopeRef.current === scope && nftScope(ownerRef.current, genesisDeployment()) === scope;
  useEffect(() => {
    const saved = storedMint(nfts.scope, wallet.owner);
    pending.current = saved; setPlan(null); setCard(null); setReceipt(saved); setPendingAddress(saved?.account ?? null); setError(null); setBusy(false);
  }, [wallet.owner, nfts.scope]);
  async function prepare() {
    if (!wallet.owner || !nfts.deployment?.candyMachine || lock.current || pendingAddress || pending.current) return;
    const saved = storedMint(nfts.scope, wallet.owner);
    if (saved) { pending.current = saved; setReceipt(saved); setPendingAddress(saved.account); return; }
    const owner = wallet.owner, scope = nfts.scope, deployment = nfts.deployment; lock.current = true; setBusy(true); setError(null); setCard(null); setReceipt(null);
    try { const result = await (await import('../lib/solana/genesis')).prepareGenesisPack(owner, wallet.signTransaction, deployment); if (isCurrent(scope)) { planScope.current = scope; setPlan(result); } }
    catch (e) { if (isCurrent(scope)) setError(e instanceof Error ? e.message : 'Could not prepare the devnet pack.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function verify(address: string, owner: string, deployment: GenesisDeployment, scope: string) {
    const result = await (await import('../lib/solana/ownedCore')).verifyMintedCard(address, owner, deployment);
    if (!isCurrent(scope) || !nfts.acceptConfirmed(result, scope)) return;
    if (pending.current?.scope === scope) savePending(pending.current, true);
    pending.current = null; setCard(result); setPendingAddress(null); play('card-reveal');
  }
  async function approve() {
    if (!plan || !nfts.deployment || lock.current || pending.current || !isCurrent(planScope.current)) return;
    const attempt = plan, scope = planScope.current, deployment = nfts.deployment; lock.current = true; setBusy(true); setError(null);
    const remember = (signature: string, status: MintReceipt['status']) => {
      const entry: MintReceipt = { signature, account: attempt.account, owner: attempt.owner, scope, status };
      savePending(entry, status === 'failed');
      if (isCurrent(scope)) { pending.current = status === 'failed' ? null : entry; setReceipt(entry); setPendingAddress(status === 'failed' ? null : entry.account); }
    };
    try {
      play('pack-open');
      const api = await import('../lib/solana/metaplex');
      const signature = await api.sendDevnetPlan(attempt, { isCurrent: () => isCurrent(scope), onSubmitted: value => remember(value, 'unresolved') });
      remember(signature, 'confirmed');
      if (!isCurrent(scope)) return;
      setPlan(null); await verify(attempt.account, attempt.owner, deployment, scope);
      if (isCurrent(scope)) await wallet.refresh();
    } catch (e) {
      const api = await import('../lib/solana/metaplex');
      if (e instanceof api.SubmittedDevnetTransactionError) remember(e.signature, e.outcome);
      if (isCurrent(scope)) { setPlan(null); setError(e instanceof Error ? e.message : 'Mint confirmation or NFT read is unresolved.'); }
    }
    finally { lock.current = false; setBusy(false); }
  }
  async function retryRead() {
    if (!pendingAddress || !wallet.owner || !nfts.deployment || lock.current) return;
    const scope = nfts.scope, deployment = nfts.deployment, owner = wallet.owner, address = pendingAddress;
    lock.current = true; setBusy(true); setError(null);
    try {
      const entry = pending.current;
      if (entry) {
        const state = await (await import('../lib/solana/metaplex')).readDevnetSignatureState(entry.signature).catch(() => 'unresolved' as const);
        if (!isCurrent(scope)) return;
        if (state === 'failed') {
          savePending(entry, true); pending.current = null; setPendingAddress(null); setReceipt({ ...entry, status: 'failed' });
          setError(t('Транзакция завершилась ошибкой в devnet. Новый пак можно подготовить вручную.', 'The devnet transaction failed on chain. You may manually prepare a new pack.')); return;
        }
        if (state === 'confirmed') { const confirmed = { ...entry, status: 'confirmed' as const }; pending.current = confirmed; savePending(confirmed); setReceipt(confirmed); }
      }
      await verify(address, owner, deployment, scope);
    }
    catch { if (isCurrent(scope)) setError(t('Владение NFT пока не читается. Проверьте транзакцию в Explorer и повторите чтение перед новым паком.', 'NFT ownership is not readable yet. Check the transaction in Explorer and retry this read before opening another pack.')); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="integration-panel nft-pack-panel">
    <p className="eyebrow">{t('Один пак · одна карта в сети', 'One pack · one on-chain card')}</p><h2 className="font-display text-2xl gold-text">{t('NFT-пак Genesis · devnet', 'Genesis NFT pack · devnet')}</h2><p className="integration-note">{t('Core Candy Machine выпускает одну псевдослучайную карту прямо в подключённый кошелёк. Минт бесплатный; аренда аккаунта и комиссии в тестовых SOL показаны до подтверждения. Демо-валюта $IMP не расходуется.', 'A Core Candy Machine mints one pseudo-random card directly to your connected wallet. Free mint; test SOL rent and network fees are shown before approval. Demo $IMP is not spent.')}</p>
    {!wallet.owner && <p className="integration-note">{t('Подключите Phantom в верхней панели, чтобы открывать паки devnet.', 'Connect Phantom from the header to use devnet packs.')}</p>}
    {!nfts.deployment?.candyMachine && <p className="integration-note">{t('Genesis пока не настроен.', 'Genesis is not configured.')} <Link className="text-mint" href="/devnet">{t('Настроить коллекцию devnet →', 'Prepare devnet collection →')}</Link></p>}
    <button className="primary-button mt-5" disabled={!wallet.owner || !nfts.deployment?.candyMachine || busy || !!pendingAddress} onClick={() => void prepare()}>{busy ? t('Подготовка / подтверждение…', 'Preparing / confirming…') : t('Подготовить NFT-пак', 'Prepare NFT pack')}</button>
    {receipt && <a className="receipt-link" href={explorerUrl(receipt.signature, 'tx')} target="_blank" rel="noreferrer">{receipt.status === 'confirmed' ? t('Подтверждённая транзакция минта devnet ↗', 'Confirmed devnet mint transaction ↗') : receipt.status === 'failed' ? t('Неуспешная транзакция devnet ↗', 'Failed devnet transaction ↗') : t('Отправка / подтверждение devnet не определены ↗', 'Devnet submission / confirmation unresolved ↗')}</a>}
    {pendingAddress && <a className="receipt-link" href={explorerUrl(pendingAddress)} target="_blank" rel="noreferrer">{t('Публичный адрес ожидающего NFT ↗', 'Pending NFT public address ↗')}</a>}
    {pendingAddress && <button className="secondary-button mt-4" disabled={busy} onClick={() => void retryRead()}>{t('Повторить проверку владения NFT', 'Retry NFT ownership read')}</button>}
    {error && <p className="integration-error" role="status">{errorText(error)}</p>}
    {card && <div className="nft-reveal flip-in"><CardView card={CARDS[card.cardId]} size="lg" /><p className="text-mint text-sm mt-4">{t('Владение подтверждено · карта доступна', 'Ownership verified · card unlocked')}</p><a className="receipt-link" href={explorerUrl(card.address)} target="_blank" rel="noreferrer">{t('NFT в вашем кошельке ↗', 'NFT account in your wallet ↗')}</a><Link className="primary-button inline-block mt-4" href="/collection">{t('Добавить карту в колоду →', 'Use this card in a deck →')}</Link></div>}
    {plan && <DevnetApproval plan={plan} busy={busy} onApprove={() => void approve()} onCancel={() => setPlan(null)} />}
  </section>;
}
