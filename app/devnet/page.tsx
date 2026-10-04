'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import WalletBar from '../../components/WalletBar';
import { useLocale } from '../../components/LocaleContext';
import DevnetApproval from '../../components/DevnetApproval';
import { useImperivmWallet } from '../../components/WalletContext';
import { useNfts, nftScope } from '../../components/NftContext';
import { metadataBase } from '../../lib/solana/metadata';
import { saveDeployment, genesisDeployment, type GenesisDeployment } from '../../lib/solana/deployment';
import { explorerUrl } from '../../lib/solana/devnet';
import type { GenesisSetupPlan } from '../../lib/solana/genesis';
import { isAddress } from '@solana/kit';
type SetupRecovery = { owner: string; scope: string; signature: string; step: GenesisSetupPlan['step']; deployment: GenesisDeployment; status: 'confirmed' | 'unresolved' };
const RECOVERY_KEY = 'imperivm.genesis.recovery.devnet.v1';
function readRecovery(owner: string | null, scope: string): SetupRecovery | null {
  try {
    const raw = JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? '[]');
    const value = (Array.isArray(raw) ? raw : [raw]).find(item => item?.scope === scope && item.owner === owner);
    return value?.owner === owner && value.scope === scope && isAddress(value.deployment?.collection) &&
      (!value.deployment?.candyMachine || isAddress(value.deployment.candyMachine)) &&
      ['collection', 'machine', 'items'].includes(value.step) && ['confirmed', 'unresolved'].includes(value.status) &&
      /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(value.signature) ? value : null;
  } catch { return null; }
}
function saveRecovery(value: SetupRecovery | null, scope = value?.scope) {
  try {
    const raw = JSON.parse(localStorage.getItem(RECOVERY_KEY) ?? '[]');
    const entries = (Array.isArray(raw) ? raw : [raw]).filter(item => item && item.scope !== scope);
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(value ? [...entries, value] : entries));
  }
  catch { /* Public addresses remain in the visible recovery inputs. */ }
}
export default function DevnetSetupPage() {
  const { t, errorText } = useLocale();
  const wallet = useImperivmWallet(), nfts = useNfts(), base = metadataBase();
  const [prepared, setPrepared] = useState<GenesisSetupPlan | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [receipt, setReceipt] = useState<{ signature: string; status: 'confirmed' | 'unresolved' | 'failed' } | null>(null), [loaded, setLoaded] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<SetupRecovery | null>(null);
  const [collectionInput, setCollectionInput] = useState(''), [machineInput, setMachineInput] = useState('');
  const ownerRef = useRef(wallet.owner); ownerRef.current = wallet.owner;
  const scopeRef = useRef(nfts.scope); scopeRef.current = nfts.scope;
  const lock = useRef(false), statusEpoch = useRef(0), preparedScope = useRef(''), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; statusEpoch.current++; }; }, []);
  const isCurrent = (scope: string) => alive.current && scopeRef.current === scope && nftScope(ownerRef.current, genesisDeployment()) === scope;
  useEffect(() => { setReceipt(null); }, [wallet.owner]);
  useEffect(() => {
    statusEpoch.current++; setPrepared(null); setError(null); setLoaded(null); setBusy(false);
    const saved = readRecovery(wallet.owner, nfts.scope);
    setRecovery(saved);
    setCollectionInput(saved?.deployment.collection ?? nfts.deployment?.collection ?? '');
    setMachineInput(saved?.deployment.candyMachine ?? nfts.deployment?.candyMachine ?? '');
    if (saved) setReceipt({ signature: saved.signature, status: saved.status });
    // A saveDeployment event updates inputs/status, but keeps the confirmed receipt for this owner.
  }, [wallet.owner, nfts.scope]);
  async function refreshStatus() {
    if (!wallet.owner || !nfts.deployment) return;
    const owner = wallet.owner, deployment = nfts.deployment, scope = nfts.scope, ticket = ++statusEpoch.current;
    try { const status = await (await import('../../lib/solana/genesis')).genesisStatus(owner, wallet.signTransaction, deployment); if (ticket === statusEpoch.current && isCurrent(scope)) setLoaded(status.loaded); }
    catch (e) { if (ticket === statusEpoch.current && isCurrent(scope)) setError(e instanceof Error ? e.message : 'Devnet state unavailable.'); }
  }
  useEffect(() => { void refreshStatus(); }, [wallet.owner, nfts.deployment]);
  async function prepare(step: 'collection' | 'machine' | 'items') {
    if (!wallet.owner || !base || lock.current || recovery || readRecovery(wallet.owner, nfts.scope)) return;
    if ((step === 'collection' && nfts.deployment?.collection) || (step === 'machine' && nfts.deployment?.candyMachine)) return;
    const owner = wallet.owner, scope = nfts.scope, deployment = nfts.deployment; lock.current = true; setBusy(true); setError(null);
    try {
      const api = await import('../../lib/solana/genesis');
      const result = step === 'collection' ? await api.prepareGenesisCollection(owner, wallet.signTransaction, base) : deployment ? step === 'machine' ? await api.prepareGenesisMachine(owner, wallet.signTransaction, deployment) : await api.prepareGenesisItems(owner, wallet.signTransaction, deployment) : null;
      if (isCurrent(scope) && result) { preparedScope.current = scope; setPrepared(result); }
    } catch (e) { if (isCurrent(scope)) setError(e instanceof Error ? e.message : 'Could not prepare this step.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function approve() {
    if (!prepared || lock.current || recovery || !isCurrent(preparedScope.current)) return;
    const attempt = prepared, scope = preparedScope.current; lock.current = true; setBusy(true); setError(null);
    // Public recovery addresses only; no new-account secret is persisted.
    setCollectionInput(attempt.deployment.collection); setMachineInput(attempt.deployment.candyMachine);
    const remember = (signature: string, status: 'confirmed' | 'unresolved') => {
      const entry: SetupRecovery = { owner: attempt.plan.owner, scope, signature, status, step: attempt.step, deployment: attempt.deployment };
      saveRecovery(entry);
      if (isCurrent(scope)) { setRecovery(entry); setReceipt({ signature, status }); }
    };
    try {
      const api = await import('../../lib/solana/metaplex');
      const signature = await api.sendDevnetPlan(attempt.plan, { isCurrent: () => isCurrent(scope), onSubmitted: value => remember(value, 'unresolved') });
      remember(signature, 'confirmed');
      if (!isCurrent(scope)) return;
      setPrepared(null);
      saveDeployment({ ...attempt.deployment, ...(attempt.step === 'collection' ? { collectionSignature: signature } : attempt.step === 'machine' ? { machineSignature: signature } : {}) });
      saveRecovery(null, scope); setRecovery(null);
      if (ownerRef.current === attempt.plan.owner && nftScope(ownerRef.current, genesisDeployment()) === nftScope(attempt.plan.owner, attempt.deployment)) await wallet.refresh();
    } catch (e) {
      const api = await import('../../lib/solana/metaplex');
      if (e instanceof api.SubmittedDevnetTransactionError) {
        if (e.outcome === 'unresolved') remember(e.signature, 'unresolved');
        else { saveRecovery(null, scope); if (isCurrent(scope)) { setRecovery(null); setReceipt({ signature: e.signature, status: 'failed' }); } }
      }
      if (isCurrent(scope)) { setPrepared(null); setError(e instanceof Error ? e.message : 'Transaction not confirmed. Check the recovery addresses before retrying.'); }
    }
    finally { lock.current = false; setBusy(false); }
  }
  async function resume() {
    if (!wallet.owner || !base || lock.current) return;
    const owner = wallet.owner, scope = nfts.scope;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (recovery?.status === 'unresolved') {
        const state = await (await import('../../lib/solana/metaplex')).readDevnetSignatureState(recovery.signature).catch(() => 'unresolved' as const);
        if (!isCurrent(scope)) return;
        if (state === 'failed') {
          saveRecovery(null, scope); setRecovery(null); setReceipt({ signature: recovery.signature, status: 'failed' });
          setError(t('Транзакция завершилась ошибкой в devnet. Следующий шаг можно подготовить вручную.', 'The devnet transaction failed on chain. You may manually prepare the next step.')); return;
        }
        if (recovery.step === 'items' && state !== 'confirmed') throw new Error(t('Подтверждение партии карт ещё не определено. Повторите проверку позже.', 'The card batch confirmation is still unresolved. Retry this read later.'));
        if (state === 'confirmed') setReceipt({ signature: recovery.signature, status: 'confirmed' });
      }
      const data = { collection: collectionInput.trim(), candyMachine: machineInput.trim(), authority: owner, metadataOrigin: base };
      const status = await (await import('../../lib/solana/genesis')).genesisStatus(owner, wallet.signTransaction, data);
      if (!isCurrent(scope)) return;
      if (status.collectionAuthority !== owner || (data.candyMachine && status.machineAuthority !== owner)) throw new Error('Connect the collection and Candy Machine authority to resume setup.');
      if (recovery && (recovery.deployment.collection !== data.collection || recovery.deployment.candyMachine !== data.candyMachine)) throw new Error('Verify the pending recovery addresses before creating another resource.');
      saveDeployment(data); saveRecovery(null, scope); setRecovery(null); setLoaded(status.loaded);
    } catch (e) { if (isCurrent(scope)) setError(e instanceof Error ? e.message : 'Could not verify these accounts.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="min-h-screen bg-abyss text-parchment"><WalletBar /><main className="collection-page max-w-3xl">
    <nav className="collection-nav"><Link href="/collection">{t('← Коллекция', '← Collection')}</Link><Link href="/packs">{t('Паки', 'Packs')}</Link><a href="https://faucet.solana.com/" target="_blank" rel="noreferrer">{t('Кран devnet ↗', 'Devnet faucet ↗')}</a></nav>
    <p className="eyebrow">{t('Genesis · только devnet', 'Genesis · devnet only')}</p><h1 className="font-display text-4xl gold-text">{t('Подготовьте первое издание', 'Prepare the first edition')}</h1>
    <p className="integration-note">{t('40 оригинальных карт, по одному NFT каждого вида в демо-издании. Core Candy Machine перемешивает порядок минта. Минт бесплатный, кроме аренды аккаунтов и комиссий в тестовых SOL. Каждый шаг показывает симуляцию и требует отдельного подтверждения в Phantom.', '40 original card types, one NFT of each in this demo edition. Core Candy Machine shuffles mint order. Minting is free apart from test SOL account rent and network fees. Each step shows its simulation and requires a separate Phantom approval.')}</p>
    {!base && <div role="status" className="integration-error">{t('Опубликуйте приложение и укажите его реальный публичный HTTPS-адрес в NEXT_PUBLIC_NFT_METADATA_BASE_URL. Метаданные должны быть доступны до создания коллекции.', 'Publish this app and set NEXT_PUBLIC_NFT_METADATA_BASE_URL to its actual public HTTPS origin. Metadata must be reachable before any collection is created.')}</div>}
    {!wallet.owner && <p className="integration-note">{t('Подключите Phantom в верхней панели и пополните его бесплатными SOL devnet для подготовки транзакций. Кошелёк и ресурсы не создаются автоматически.', 'Connect Phantom from the header and fund it with free devnet SOL to prepare transactions. No wallet or resources have been created automatically.')}</p>}
    <div className="genesis-steps">
      <section className="integration-panel"><span className="eyebrow">01 · {t('Коллекция', 'Collection')}</span><h2 className="font-display text-xl text-gold">IMPERIVM Genesis</h2><p className="integration-note">{t('Связывает метаданные всех 40 карт с иллюстрациями в коллекцию Metaplex Core.', 'Links all 40 art-backed card metadata entries to a Metaplex Core collection.')}</p>{nfts.deployment ? <a className="receipt-link" href={explorerUrl(nfts.deployment.collection)} target="_blank" rel="noreferrer">{t('Настроенная коллекция ↗', 'Configured collection ↗')}</a> : <button className="primary-button mt-4" disabled={!wallet.owner || !base || busy || !!recovery} onClick={() => void prepare('collection')}>{t('Подготовить коллекцию', 'Prepare collection')}</button>}</section>
      <section className="integration-panel"><span className="eyebrow">02 · {t('Выпуск', 'Distribution')}</span><h2 className="font-display text-xl text-gold">{t('Бесплатная Candy Machine в devnet', 'Free devnet Candy Machine')}</h2><p className="integration-note">{t('40 мест, без оплаты и налога на ботов, случайный порядок минта. Настройку подтверждает владелец прав коллекции.', '40 slots, no payments or bot tax, non-sequential minting. The collection authority approves setup.')}</p>{nfts.deployment?.candyMachine ? <a className="receipt-link" href={explorerUrl(nfts.deployment.candyMachine)} target="_blank" rel="noreferrer">{t('Настроенная Candy Machine ↗', 'Configured Candy Machine ↗')}</a> : <button className="primary-button mt-4" disabled={!wallet.owner || !nfts.deployment || busy || !!recovery} onClick={() => void prepare('machine')}>{t('Подготовить Candy Machine', 'Prepare Candy Machine')}</button>}</section>
      <section className="integration-panel"><span className="eyebrow">03 · {t('Иллюстрации и карты', 'Art & cards')}</span><h2 className="font-display text-xl text-gold">{t('Загрузите все сорок карт', 'Load all forty entries')}</h2><p className="integration-note">{t('По восемь карт за транзакцию. Прогресс читается из сети, поэтому прерванную настройку можно продолжить. Паки доступны после загрузки всех 40 карт.', 'Eight entries per transaction. Progress is read from chain, so interrupted setup can resume. Packs stay unavailable until all 40 are loaded.')}</p><p className="mt-4 text-sm">{t('Загружено:', 'Loaded:')} {loaded === null ? t('не проверено', 'not checked') : `${loaded}/40`}</p><div className="dialog-actions"><button className="primary-button" disabled={!wallet.owner || !nfts.deployment?.candyMachine || busy || !!recovery || loaded === 40} onClick={() => void prepare('items')}>{t('Подготовить следующую партию', 'Prepare next batch')}</button><button className="secondary-button" disabled={!wallet.owner || !nfts.deployment || busy || !!recovery} onClick={() => void refreshStatus()}>{t('Обновить прогресс', 'Refresh progress')}</button></div>{loaded === 40 && <Link className="receipt-link" href="/packs">{t('Открыть NFT-пак devnet →', 'Open a devnet NFT pack →')}</Link>}</section>
    </div>
    {recovery && <p role="status" className="integration-note">{t('Сначала проверьте ожидающую транзакцию и продолжите по сохранённым публичным адресам. Новый ресурс не создаётся повторно.', 'Check the pending transaction and resume from the saved public addresses before creating another resource.')}</p>}
    <details open={!!recovery} className="integration-panel mt-6"><summary className="text-gold cursor-pointer">{t('Продолжить по публичным адресам аккаунтов', 'Resume with public account addresses')}</summary><p className="integration-note">{t('Используйте после перезагрузки, ошибки хранилища или неопределённого результата подтверждения. Сначала проверьте адреса в Explorer devnet. Читаются существующие аккаунты; дубликаты автоматически не создаются.', 'Use these after a reload, storage failure or unresolved confirmation. Verify on devnet Explorer first. This reads existing accounts and never creates a duplicate automatically.')}</p><label className="setup-label">{t('Адрес коллекции Core', 'Core collection address')}<input disabled={busy} value={collectionInput} onChange={e => setCollectionInput(e.target.value)} /></label><label className="setup-label">{t('Адрес Candy Machine (необязательно)', 'Candy Machine address (optional)')}<input disabled={busy} value={machineInput} onChange={e => setMachineInput(e.target.value)} /></label><button className="secondary-button mt-4" disabled={!wallet.owner || !base || !collectionInput || busy} onClick={() => void resume()}>{t('Проверить и продолжить', 'Verify & resume')}</button></details>
    {receipt && <a className="receipt-link" href={explorerUrl(receipt.signature, 'tx')} target="_blank" rel="noreferrer">{receipt.status === 'confirmed' ? t('Последняя подтверждённая транзакция devnet ↗', 'Last confirmed devnet transaction ↗') : receipt.status === 'failed' ? t('Неуспешная транзакция devnet ↗', 'Failed devnet transaction ↗') : t('Отправка / подтверждение devnet не определены ↗', 'Devnet submission / confirmation unresolved ↗')}</a>}{error && <p className="integration-error" role="status">{errorText(error)}</p>}
    <p className="integration-note">{t('Для публикации скопируйте подтверждённые адреса коллекции и Candy Machine в публичные настройки окружения. Это публичные адреса. Ресурсы mainnet, торговля, сжатый минт и денежные награды не включены.', 'For deployment, copy the confirmed collection and Candy Machine addresses into the public environment configuration. These are addresses, not secrets. No mainnet resources, trading, compressed minting or financial rewards are enabled.')}</p>
  </main>{prepared && <DevnetApproval plan={prepared.plan} busy={busy} onApprove={() => void approve()} onCancel={() => setPrepared(null)} />}</div>;
}
