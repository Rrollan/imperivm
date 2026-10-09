'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import {PaintedIcon} from './PaintedIcon';
import {RomanIcon} from './presentation/RomanIcon';
import Dialog from './Dialog';
import {useIDos} from './IDosContext';
import {IMPERIVM_TITLE} from '../lib/idos/title';
import {IDOS_CONFIG} from '../lib/collection/gateway';
import {useCollection} from './CollectionContext';
import {useLocale} from './LocaleContext';
import {ImpWalletPanel} from './ImpWalletPanel';
import {COMMERCE_CONFIG, cryptoAffordable, RugCommerce, type RugOffer} from '../lib/idos/commerce';
import styles from './RugShop.module.css';

export default function RugShop() {
  const idos = useIDos(), collection = useCollection(), {t, errorText} = useLocale();
  const [offers, setOffers] = useState<RugOffer[]>([]), [selected, setSelected] = useState<RugOffer | null>(null);
  const [pending, setPending] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [tokenError, setTokenError] = useState('');
  const gateway = useRef<RugCommerce | null>(null), scope = useRef(0), locked = useRef(false);
  const active = IDOS_CONFIG.currencyType === 'VirtualCurrency' && COMMERCE_CONFIG.enabled && collection.snapshot?.mode === 'idos' && idos.session.status === 'wallet';
  useEffect(() => {
    let cancelled = false; setTokenError('');
    if (!idos.runtime || !['guest', 'wallet'].includes(idos.session.status)) return;
    void idos.runtime.tokenBalance().catch(error => {if (!cancelled) setTokenError(error instanceof Error ? error.message : 'iDos token unavailable.');});
    return () => {cancelled = true;};
  }, [idos.runtime, idos.session.revision, idos.session.status]);
  const refresh = useCallback(async () => {
    const service = gateway.current, captured = scope.current;
    if (!service || locked.current) return;
    locked.current = true; setBusy(true);
    try { const result = await service.load(); if (captured === scope.current) {setOffers(result); setPending(!!service.pending()); setMessage('');} }
    catch (error) { if (captured === scope.current) setMessage(error instanceof Error ? error.message : 'Shop unavailable.'); }
    finally { if (captured === scope.current) {locked.current = false; setBusy(false);} }
  }, []);
  useEffect(() => {
    scope.current++; gateway.current = null; locked.current = false; setOffers([]); setSelected(null); setPending(false); setMessage(''); setBusy(false);
    if (!active || !idos.runtime) return;
    try {gateway.current = new RugCommerce(idos.runtime, window.localStorage); void refresh();}
    catch {setMessage('Purchase recovery storage is unavailable.');}
  }, [active, idos.runtime, idos.session.revision, refresh]);
  useEffect(() => {const changed = () => {void refresh(); void collection.refresh();}; window.addEventListener('imperivm:idos-balance', changed); window.addEventListener('focus', changed); window.addEventListener('storage', changed); return () => {window.removeEventListener('imperivm:idos-balance', changed); window.removeEventListener('focus', changed); window.removeEventListener('storage', changed);};}, [refresh, collection.refresh]);
  async function buy() {
    const service = gateway.current, quote = selected, captured = scope.current;
    if (!service || !quote || locked.current || collection.busy) return;
    locked.current = true; setBusy(true); setMessage('');
    try {await service.buy(quote); if (scope.current === captured) {setMessage(t(`${quote.rug} $IMP зачислено iDos.`, `${quote.rug} $IMP credited by iDos.`)); setSelected(null); await collection.refresh();} }
    catch (error) {if (scope.current === captured) {setMessage(error instanceof Error ? error.message : 'Purchase unavailable.'); setSelected(null);} }
    finally {if (scope.current === captured) {locked.current = false; setBusy(false); try {setPending(!!service.pending()); const next = await service.load(); if (scope.current === captured) {setOffers(next); setPending(!!service.pending());}} catch {if (scope.current === captured) setPending(true); /* Keep the last result; never repeat a payment automatically. */}}}
  }
  async function walletPanel() {
    try {
      const {openPlatformWalletPanel} = await import('@idosgames/wallet');
      if (!await openPlatformWalletPanel()) setMessage(t('Откройте кошелёк на странице игры в iDos, затем вернитесь и обновите баланс.', 'Open the wallet on the iDos game page, then return and refresh your balance.'));
    } catch (error) {setMessage(error instanceof Error ? error.message : 'Shop unavailable.');}
  }
  if (IDOS_CONFIG.title === IMPERIVM_TITLE.id && IDOS_CONFIG.currencyType === 'CryptoCurrency') return <section className={styles.shop} aria-labelledby="rug-shop-title">
    <div className={styles.heading}><span className={styles.coin} aria-hidden="true"><PaintedIcon name="rug" size={66}/></span><div><span className={styles.label}>iDos Games · Solana mainnet</span><h2 id="rug-shop-title">{t('Кошелёк $IMP', '$IMP wallet')}</h2><p>{t('Токен IMPERIVM для паков и правителей.', 'The IMPERIVM token for card packs and rulers.')}</p></div></div>
    <div className={styles.empty}><p>{collection.snapshot?.mode === 'local' ? t('Сейчас вы в бесплатном демо. Для настоящего $IMP войдите в iDos кошельком.', 'You are in the free demo. Sign in to iDos to use real $IMP.') : t('Паки оплачиваются с игрового счёта iDos. Переведите нужную сумму своих IMP из Phantom; покупка пака подтверждается отдельно.', 'Packs use your iDos game balance. Transfer the IMP amount you need from Phantom; buying a pack is a separate confirmation.')}</p><div className={styles.actions}>
      <button disabled={collection.busy} onClick={() => void collection.refresh()}>{t('Обновить баланс', 'Refresh balance')}</button>
    </div></div>
    <ImpWalletPanel/>
    {message && <p className={styles.notice} role="status">{errorText(message)}</p>}
    {tokenError && <p className={styles.notice} role="status">{errorText(tokenError)}</p>}
    <p className={styles.footer}>{t('Solana mainnet · реальные IMP. Подключение кошелька бесплатно. Сумму каждого перевода и комиссию сети вы подтверждаете в Phantom.', 'Solana mainnet · real IMP. Connecting a wallet is free. You confirm each transfer amount and network fee in Phantom.')}</p>
  </section>;
  return <section className={styles.shop} aria-labelledby="rug-shop-title">
    <div className={styles.heading}><span className={styles.coin} aria-hidden="true"><PaintedIcon name="rug" size={66}/></span><div><span className={styles.label}>iDos Games · Solana</span><h2 id="rug-shop-title">{t('Пополнить $IMP', 'Get more $IMP')}</h2><p>{t('SOL / USDC → $IMP → паки с новыми картами.', 'SOL / USDC → $IMP → packs with new cards.')}</p></div></div>
    {!COMMERCE_CONFIG.enabled || !idos.configured ? <div className={styles.empty}><p>{t('Пополнение пока не открыто. Бесплатный набор уже доступен; демо-паки можно попробовать без оплаты.', 'Top-ups are not open yet. Your free set is ready, and demo packs can be tried without payment.')}</p></div> : !active ? <div className={styles.empty}><p>{t('Войдите в iDos своим кошельком. Покупки будут привязаны к этому аккаунту и доступны на других устройствах.', 'Sign in to iDos with your wallet. Purchases belong to this account and follow you across devices.')}</p><div className={styles.actions}><button disabled={idos.busy || collection.busy} onClick={() => void idos.login()}>{t('Войти кошельком в iDos', 'Sign in to iDos with wallet')}</button></div></div> : <>
      {pending && <p className={styles.notice} role="status">{t('Предыдущая покупка ещё проверяется. Обновите статус; повторная оплата заблокирована.', 'The previous purchase is still being checked. Refresh its status; another payment is blocked.')}</p>}
      <div className={styles.rows}>{offers.map(offer => <article className={styles.offer} key={offer.key}><strong>{offer.rug.toLocaleString()} $IMP</strong><span>{Math.floor(offer.rug / 50)} {t('паков по 5 карт', 'packs of 5 cards')}</span><span>{t('Цена', 'Price')}: {offer.amount} {offer.symbol}</span><span>{t('В кошельке iDos', 'iDos balance')}: {offer.balance} {offer.symbol}</span><button disabled={busy || pending || collection.busy || offer.soldOut || !cryptoAffordable(offer.balance, offer.amount)} onClick={() => setSelected(offer)}>{offer.soldOut ? t('Недоступно', 'Unavailable') : !cryptoAffordable(offer.balance, offer.amount) ? t('Сначала пополните iDos', 'Top up iDos first') : t('Выбрать', 'Choose')}</button></article>)}</div>
      {!offers.length && !busy && <p>{t('Предложения пополнения пока недоступны.', 'Top-up offers are not available yet.')}</p>}
      <div className={styles.actions}><button disabled={busy || collection.busy} onClick={() => {void refresh(); void collection.refresh();}}>{busy ? t('Проверяем…', 'Checking…') : t('Обновить баланс и статус', 'Refresh balance and status')}</button>{idos.embedded ? <button disabled={busy} onClick={() => void walletPanel()}>{t('Пополнить SOL / USDC в iDos', 'Deposit SOL / USDC in iDos')}</button> : COMMERCE_CONFIG.appUrl && <a href={COMMERCE_CONFIG.appUrl} target="_blank" rel="noopener noreferrer">{t('Открыть кошелёк iDos ↗', 'Open iDos wallet ↗')}</a>}</div>
    </>}
    {message && <p className={styles.notice} role="status">{errorText(message)}</p>}
    <p className={styles.footer}>{t('$IMP — внутриигровая валюта для паков, без вывода и обмена обратно в SOL/USDC. Пополнение использует реальные средства в Solana mainnet. NFT и proof-of-play остаются в devnet.', '$IMP is in-game currency for packs, with no withdrawal or conversion back to SOL/USDC. Top-ups use real funds on Solana mainnet. NFTs and proof-of-play stay on devnet.')}</p>
    {selected && <Dialog title={t('Подтвердить покупку $IMP', 'Confirm $IMP purchase')} onClose={() => {if (!busy) setSelected(null);}}><div className={styles.confirmation}><strong>{selected.rug.toLocaleString()} $IMP</strong><p>{t('Будет списано из баланса iDos', 'Charged from your iDos balance')}: <b>{selected.amount} {selected.symbol}</b><br/>Solana mainnet · {t('реальные средства', 'real funds')}</p><p>{t('Покупка пополняет только игровой баланс IMP. Паки открываются отдельным действием.', 'This purchase only adds in-game IMP. Opening packs is a separate action.')}</p><div className={styles.actions}><button disabled={busy || collection.busy} onClick={() => void buy()}>{busy ? t('Покупка проверяется…', 'Processing purchase…') : t(`Купить за ${selected.amount} ${selected.symbol}`, `Buy for ${selected.amount} ${selected.symbol}`)}</button><button disabled={busy} onClick={() => setSelected(null)}>{t('Отмена', 'Cancel')}</button></div></div></Dialog>}
  </section>;
}
