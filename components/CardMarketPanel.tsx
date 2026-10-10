'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import Link from 'next/link';
import {CARDS} from '../lib/cards';
import {CardMarketService, cardMarketPrice, type CardMarketListing, type CardMarketSnapshot} from '../lib/idos/cardMarket';
import {readMarketPrices, syncMarketPrices} from '../lib/idos/cardPriceClient';
import type {CardPriceSnapshot} from '../lib/idos/cardPrice';
import {cryptoAffordable} from '../lib/idos/commerce';
import {formatImpAmount} from '../lib/solana/imp';
import {useIDos} from './IDosContext';
import {useCollection} from './CollectionContext';
import {useLocale} from './LocaleContext';
import {AccountPanel} from './AccountPanel';
import Dialog from './Dialog';
import {CardDialog} from './home/CardDialog';
import {LibraryCardFace} from './home/LibraryCardFace';
import {CardFacts} from './home/CardFacts';
import {PaintedIcon} from './PaintedIcon';
import styles from './CardMarketPanel.module.css';

type Tab = 'browse' | 'sell' | 'my' | 'history';
type Review = {kind: 'buy' | 'cancel'; offer: CardMarketListing} | {kind: 'create'; cardId: string; quantity: number; price: string; hours: number};
function expiredOffer(offer: CardMarketListing) {return offer.status === 'Expired' || offer.status === 'Active' && !!offer.expiresAt && Date.parse(offer.expiresAt) <= Date.now();}
const MARKET_ERRORS_EN: Record<string, string> = {
  'Укажите целую цену от 1 до 1 000 000 000 000 IMP.': 'Enter a whole price from 1 to 1,000,000,000,000 IMP.',
  'Войдите своим кошельком в iDos для рынка карт.': 'Sign in to iDos with your wallet to use the card market.',
  'Статус сделки повреждён. Сверьте историю iDos перед новой сделкой.': 'Trade status is damaged. Check iDos history before a new trade.',
  'Предыдущая сделка не подтверждена. Обновите рынок и проверьте историю.': 'The previous trade is unconfirmed. Refresh the market and check history.',
  'Разрешите сохранение статуса сделки в браузере.': 'Allow this browser to save the trade status.',
  'Не удалось сохранить статус сделки.': 'Could not save the trade status.',
  'Аккаунт iDos изменился.': 'The iDos account changed.',
  'Некорректная комиссия рынка iDos.': 'The iDos trading fee is invalid.',
  'Рынок карт ещё не включён на iDos.': 'The card market has not been enabled on iDos yet.',
  'Настройки комиссии рынка изменились. Сделки приостановлены до проверки.': 'Trading fees have changed. Trading is paused until they are checked.',
  'Рынок должен принимать только IMP без дополнительной платы за выставление.': 'The market must accept IMP only, without additional listing fees.',
  'Сделки за реальные IMP откроются после проверки пополнения и тестовой покупки.': 'Real IMP trading opens after a deposit and test purchase have been verified.',
  'iDos вернул некорректный баланс IMP.': 'iDos returned an invalid IMP balance.',
  'Неизвестная карта.': 'Unknown card.',
  'Сделка уже обрабатывается.': 'A trade is already being processed.',
  'Для сделок нужен браузер с защитой платежей между вкладками.': 'Trading requires a browser with payment protection across tabs.',
  'Для проверки сделки нужен современный браузер.': 'Checking this trade requires a modern browser.',
  'Неизвестное объявление.': 'Unknown listing.',
  'Проверьте карту, количество и срок объявления.': 'Check the card, quantity and listing duration.',
  'Нет нужного количества продаваемых копий. Бесплатный стартовый набор и прежние открытия не выставляются как товары.': 'Not enough tradable copies. Free starter cards and earlier pack openings cannot be listed.',
  'Объявление обработано, но ответ не совпадает. Сверьте мои объявления; повторного выставления не будет.': 'The listing was processed, but its reply could not be verified. Check My listings; it will not be listed twice.',
  'Объявление изменилось или недоступно. Обновите рынок перед покупкой.': 'The listing changed or is unavailable. Refresh the market before buying.',
  'Недостаточно IMP на игровом счёте. Пополните его из Phantom.': 'Not enough IMP in your game account. Fund it from Phantom.',
  'Статус покупки ещё не подтверждён. Сверьте историю; повторной оплаты не будет.': 'Purchase status is not yet confirmed. Check history; payment will not be repeated.',
  'Можно снять только своё активное объявление.': 'Only your own active listing can be cancelled.',
  'Снятие объявления ещё не подтверждено. Обновите мои объявления.': 'Cancellation is not yet confirmed. Refresh My listings.',
  'Можно вернуть карты только из своего непроданного объявления.': 'Cards can only be reclaimed from your own unsold listing.',
  'Карты этого объявления уже возвращены или возврат ещё проверяется. Обновите коллекцию.': 'These cards have already been returned or their return is still being checked. Refresh your collection.',
  'Возврат карт ещё не подтверждён. Обновите мои объявления.': 'Card return is not yet confirmed. Refresh My listings.',
};

export function CardMarketPanel() {
  const idos = useIDos(), collection = useCollection(), {t, locale, cardName, rarityName, errorText} = useLocale();
  const service = useMemo(() => idos.runtime && idos.session.status === 'wallet' && idos.session.owner && idos.session.userId ? new CardMarketService(idos.runtime) : null, [idos.runtime, idos.session.status, idos.session.owner, idos.session.userId]);
  const current = useRef(service); current.current = service;
  const lock = useRef<CardMarketService | null>(null), browseSequence = useRef(0), priceSequence = useRef(0);
  const [snapshot, setSnapshot] = useState<CardMarketSnapshot | null>(null), [prices, setPrices] = useState<CardPriceSnapshot | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [success, setSuccess] = useState('');
  const [tab, setTab] = useState<Tab>('browse'), [selected, setSelected] = useState(''), [search, setSearch] = useState('');
  const [offers, setOffers] = useState<CardMarketListing[]>([]), [cursor, setCursor] = useState<string | undefined>(), [readingOffers, setReadingOffers] = useState(false), [offerError, setOfferError] = useState('');
  const [sellCard, setSellCard] = useState<string | null>(null), [quantity, setQuantity] = useState('1'), [price, setPrice] = useState(''), [hours, setHours] = useState(72);
  const [review, setReview] = useState<Review | null>(null), [inspected, setInspected] = useState<string | null>(null), [account, setAccount] = useState(false), [revision, setRevision] = useState(0);
  const money = (amount: string) => formatImpAmount(amount, locale);
  const marketError = (message: string) => locale === 'en' ? MARKET_ERRORS_EN[message] ?? errorText(message) : errorText(message);
  const canTrade = !!snapshot?.ready && !snapshot.pending && !busy;
  const owned = Object.keys(snapshot?.inventory ?? {}).filter(id => CARDS[id] && snapshot!.inventory[id] > 0).sort((a, b) => cardName(a).localeCompare(cardName(b), locale));
  const groups = Array.from(new Set(snapshot?.groups ?? [])).sort((a, b) => cardName(a).localeCompare(cardName(b), locale));
  const filtered = (ids: string[]) => ids.filter(id => `${cardName(id)} ${CARDS[id].faction} ${rarityName(CARDS[id].rarity)}`.toLocaleLowerCase(locale).includes(search.trim().toLocaleLowerCase(locale)));
  const refreshPrices = useCallback((captured: CardMarketService, sync: boolean) => {
    const sequence = ++priceSequence.current;
    const request = sync && idos.runtime ? syncMarketPrices(idos.runtime) : readMarketPrices();
    // An optional statistics request must not keep native trading disabled for its network timeout.
    void request.then(value => {if (current.current === captured && priceSequence.current === sequence) setPrices(value);}).catch(() => {if (current.current === captured && priceSequence.current === sequence) setPrices(null);});
  }, [idos.runtime]);

  const read = useCallback(async (sync = false) => {
    const captured = service;
    if (!captured || lock.current === captured) return;
    lock.current = captured; setBusy(true); setNotice('');
    try {
      const result = await captured.load();
      if (current.current !== captured) return;
      setSnapshot(result); setRevision(value => value + 1);
      // Price reporting is optional. A missing statistics server must not prevent native trading.
      refreshPrices(captured, sync && result.history.length > 0);
    } catch (error) { if (current.current === captured) setNotice(error instanceof Error ? error.message : t('Рынок временно недоступен.', 'Market temporarily unavailable.')); }
    finally { if (lock.current === captured) lock.current = null; if (current.current === captured) setBusy(false); }
  }, [service, refreshPrices, locale]);

  useEffect(() => {
    browseSequence.current++; priceSequence.current++; setSnapshot(null); setPrices(null); setOffers([]); setCursor(undefined); setReadingOffers(false); setOfferError(''); setSelected(''); setSellCard(null); setReview(null); setNotice(''); setSuccess(''); setBusy(false); setSearch('');
    if (service) void read(true);
    return () => {browseSequence.current++; priceSequence.current++;};
  }, [service, read]);
  useEffect(() => {
    if (selected && groups.includes(selected)) return;
    setSelected(groups[0] ?? '');
  }, [snapshot, selected]);

  const browse = useCallback(async (more = false) => {
    const captured = service, id = selected, sequence = ++browseSequence.current;
    if (!captured || !id) {setOffers([]); setCursor(undefined); return;}
    setReadingOffers(true); setOfferError('');
    if (!more) {setOffers([]); setCursor(undefined);}
    try {
      const result = await captured.browse(id, more ? cursor : undefined);
      if (current.current !== captured || sequence !== browseSequence.current) return;
      setOffers(previous => more ? Array.from(new Map([...previous, ...result.offers].map(offer => [offer.offerId, offer])).values()) : result.offers); setCursor(result.cursor);
    } catch (error) {if (current.current === captured && sequence === browseSequence.current) setOfferError(error instanceof Error ? error.message : t('Объявления не загрузились.', 'Offers failed to load.'));}
    finally {if (current.current === captured && sequence === browseSequence.current) setReadingOffers(false);}
  }, [service, selected, cursor, locale]);
  useEffect(() => { if (tab === 'browse') void browse(false); }, [service, selected, revision, tab]);

  function chooseSell(id: string) {setSellCard(id); setQuantity('1'); setPrice(''); setHours(72); setNotice(''); setSuccess('');}
  function prepareListing() {
    try {
      if (!canTrade || !sellCard) return;
      if (!/^[1-9]\d{0,3}$/.test(quantity) || Number(quantity) > 1000 || Number(quantity) > (snapshot?.inventory[sellCard] ?? 0)) throw new Error(t('Выберите доступное количество от 1 до 1000.', 'Choose an available quantity from 1 to 1000.'));
      const valid = cardMarketPrice(price);
      setReview({kind: 'create', cardId: sellCard, quantity: Number(quantity), price: valid, hours}); setSellCard(null);
    } catch (error) {setNotice(error instanceof Error ? error.message : t('Проверьте объявление.', 'Check the listing.'));}
  }
  async function execute() {
    const captured = service, selectedReview = review;
    if (!captured || !selectedReview || lock.current === captured) return;
    if (selectedReview.kind !== 'cancel' && !canTrade) return;
    lock.current = captured; setBusy(true); setNotice(''); setSuccess('');
    try {
      if (selectedReview.kind === 'create') await captured.create(selectedReview.cardId, selectedReview.quantity, selectedReview.price, selectedReview.hours);
      else if (selectedReview.kind === 'buy') await captured.buy(selectedReview.offer.offerId, selectedReview.offer.priceImp);
      else await captured.cancel(selectedReview.offer.offerId);
      if (current.current !== captured) return;
      setReview(null); setSuccess(selectedReview.kind === 'create' ? t('Объявление создано. Карты зарезервированы до продажи или снятия.', 'Listing created. Cards are reserved until sold or cancelled.') : selectedReview.kind === 'buy' ? t('Покупка подтверждена. Карты в вашей коллекции.', 'Purchase confirmed. The cards are in your collection.') : expiredOffer(selectedReview.offer) ? t('Возврат подтверждён. Карты из истёкшего объявления снова в коллекции.', 'Return confirmed. Cards from the expired listing are back in your collection.') : t('Объявление снято. Карты возвращены в коллекцию.', 'Listing cancelled. Cards returned to your collection.'));
      window.dispatchEvent(new Event('imperivm:idos-balance')); void collection.refresh();
      const next = await captured.load();
      if (current.current !== captured) return;
      setSnapshot(next); setRevision(value => value + 1);
      refreshPrices(captured, true);
    } catch (error) {
      if (current.current === captured) {
        setReview(null); setNotice(error instanceof Error ? error.message : t('Статус сделки ещё проверяется.', 'Trade status is still being checked.'));
        try {const next = await captured.load(); if (current.current === captured) setSnapshot(next);} catch {/* Preserve the displayed balance; retry only reads/recovery. */}
      }
    } finally {if (lock.current === captured) lock.current = null; if (current.current === captured) setBusy(false);}
  }
  async function recover() {
    const captured = service;
    if (!captured || lock.current === captured) return;
    lock.current = captured; setBusy(true); setNotice(''); setSuccess('');
    try {
      const confirmed = await captured.recover(), next = await captured.load();
      if (current.current !== captured) return;
      setSnapshot(next); setRevision(value => value + 1);
      setSuccess(confirmed ? t('Статус сделки подтверждён. Баланс и коллекция обновлены.', 'Trade status confirmed. Balance and collection refreshed.') : t('Подтверждения пока нет. Новые сделки заблокированы; проверьте историю iDos.', 'No confirmation yet. New trades remain blocked; check your iDos history.'));
      if (confirmed) {window.dispatchEvent(new Event('imperivm:idos-balance')); void collection.refresh(); refreshPrices(captured, true);}
    } catch (error) {if (current.current === captured) setNotice(error instanceof Error ? error.message : t('Не удалось проверить статус.', 'Could not check the status.'));}
    finally {if (lock.current === captured) lock.current = null; if (current.current === captured) setBusy(false);}
  }
  function stats(id: string) {
    const shared = prices?.ready ? prices.stats[id] : undefined, personal = snapshot?.stats[id], value = shared ?? personal;
    return <div className={styles.stats}>
      <span>{shared ? t('Средняя цена · подтверждённые сделки', 'Average price · verified trades') : t('Ваши завершённые сделки', 'Your completed trades')}</span>
      {value ? <><strong>{money(value.meanImp)} <small>IMP / {t('карта', 'card')}</small></strong><span>{t('Сделок', 'Trades')}: {value.sampleSize} · {t('карт', 'cards')}: {value.units} · {money(value.minImp)}–{money(value.maxImp)} IMP</span></> : <><strong>—</strong><span>{t('Пока нет подтверждённых покупок этой карты.', 'No verified purchases of this card yet.')}</span></>}
    </div>;
  }
  function cardFace(id: string) {return <button type="button" className={styles.cardFace} onClick={() => setInspected(id)} aria-label={t(`Рассмотреть карту «${cardName(id)}»`, `Inspect ${cardName(id)}`)}><LibraryCardFace id={id}/></button>;}
  function listingRow(offer: CardMarketListing, own = false) {
    const active = offer.status === 'Active' && (!offer.expiresAt || Date.parse(offer.expiresAt) > Date.now());
    const expired = expiredOffer(offer);
    const mine = offer.sellerUserId === idos.session.userId;
    return <article key={offer.offerId} className={styles.offer}>
      <div><strong>{own ? cardName(offer.cardId) : offer.sellerName || `${t('Игрок', 'Player')} ${offer.sellerUserId.slice(0, 6)}`}</strong><span>{offer.quantity} {t('шт.', 'cards')} · {own ? active ? t('В продаже', 'Listed') : expired ? t('Срок истёк · заберите карты', 'Expired · reclaim cards') : t('Завершено', 'Closed') : mine ? t('Ваше объявление', 'Your listing') : t('Продавец', 'Seller')}</span>{offer.expiresAt && <small>{t('До', 'Until')} {new Date(offer.expiresAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {dateStyle: 'short', timeStyle: 'short'})}</small>}</div>
      <div className={styles.offerPrice}><strong>{money(offer.priceImp)} <small>IMP</small></strong><span>{t('За весь лот', 'For the entire lot')}</span></div>
      {own ? <button type="button" className={styles.button} disabled={busy || snapshot?.pending || (!active && !expired)} onClick={() => setReview({kind: 'cancel', offer})}>{expired ? t('Вернуть карты', 'Reclaim cards') : t('Снять', 'Cancel')}</button> : <button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canTrade || !active || mine || !cryptoAffordable(snapshot?.balance ?? '', offer.priceImp)} onClick={() => setReview({kind: 'buy', offer})}>{mine ? t('Ваш лот', 'Your lot') : !cryptoAffordable(snapshot?.balance ?? '', offer.priceImp) ? t('Нужны IMP', 'Needs IMP') : t('Купить', 'Buy')}</button>}
    </article>;
  }
  const reviewCard = review?.kind === 'create' ? review.cardId : review?.offer.cardId;
  return <section className={styles.panel} aria-label={t('Торговля картами', 'Card trading')}>
    <div className={styles.toolbar}><div className={styles.balance}><PaintedIcon name="rug" size={38}/><div><span>{t('Игровой счёт iDos', 'iDos game balance')}</span><strong>{snapshot ? money(snapshot.balance) : '—'} <small>IMP</small></strong></div></div><div className={styles.actions}><Link href="/packs" className={styles.button}>{t('Пополнить / вывести', 'Deposit / withdraw')}</Link><button type="button" className={styles.button} onClick={() => setAccount(true)}>{t('Аккаунт', 'Account')}</button><button type="button" className={styles.button} disabled={!service || busy} onClick={() => void read(true)}>{busy ? t('Проверяем…', 'Checking…') : t('Обновить', 'Refresh')}</button></div></div>
    {!service ? <div className={styles.gate}><PaintedIcon name="wallet" size={58}/><div><h2>{t('Войдите своим кошельком', 'Sign in with your wallet')}</h2><p>{t('Рынок использует карты и IMP вашего аккаунта iDos. Токены в Phantom пополняют игровой счёт отдельным переводом.', 'The market uses cards and IMP in your iDos account. Phantom tokens fund the game account through a separate deposit.')}</p><button type="button" className={`${styles.button} ${styles.primary}`} disabled={idos.busy} onClick={() => void idos.login()}>{idos.busy ? t('Ожидаем вход…', 'Signing in…') : t('Войти кошельком', 'Sign in with wallet')}</button></div></div> : !snapshot && busy ? <p className={styles.loading} role="status">{t('Проверяем баланс, коллекцию и объявления…', 'Checking balance, collection and listings…')}</p> : null}
    {snapshot && !snapshot.ready && <div className={styles.notice} role="status"><strong>{t('Сделки пока недоступны', 'Trading is not available yet')}</strong><p>{marketError(snapshot.reason ?? t('Рынок ожидает настройки iDos.', 'The market is awaiting iDos configuration.'))}</p><Link href="/packs">{t('Паки и пополнение IMP', 'Packs and IMP deposits')} →</Link></div>}
    {snapshot?.pending && <div className={styles.pending} role="status"><strong>{t('Предыдущая сделка ещё проверяется', 'Previous trade is still being checked')}</strong><p>{t('Проверим её результат без повторного списания или выставления.', 'Check the result without charging or listing again.')}</p><div className={styles.actions}><button type="button" className={styles.button} disabled={busy} onClick={() => void recover()}>{busy ? t('Проверяем…', 'Checking…') : t('Проверить результат', 'Check result')}</button><button type="button" className={styles.textButton} onClick={() => setTab('history')}>{t('История сделок', 'Trade history')}</button></div></div>}
    {notice && <p className={styles.error} role="alert">{marketError(notice)}</p>}{success && <p className={styles.success} role="status">{success}</p>}
    <div className={styles.tabs} role="tablist" aria-label={t('Разделы рынка', 'Market sections')}>{(['browse', 'sell', 'my', 'history'] as Tab[]).map((value, index) => <button type="button" key={value} role="tab" aria-selected={tab === value} aria-controls={`market-${value}`} id={`market-tab-${value}`} className={tab === value ? styles.selectedTab : ''} onClick={() => {setTab(value); setSearch('');}}><span>0{index + 1}</span>{value === 'browse' ? t('Купить', 'Browse') : value === 'sell' ? t('Продать', 'Sell') : value === 'my' ? t('Мои объявления', 'My listings') : t('История', 'History')}</button>)}</div>
    {tab === 'browse' && <div role="tabpanel" id="market-browse" aria-labelledby="market-tab-browse" className={styles.browse}>
      <aside className={styles.catalogue}><label className={styles.search}><span>{t('Найти карту', 'Find a card')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Название, фракция, редкость', 'Name, faction, rarity')}/></label><div className={styles.cardList}>{filtered(groups).map(id => <button type="button" key={id} aria-pressed={selected === id} className={selected === id ? styles.chosenCard : ''} onClick={() => setSelected(id)}><span>{cardName(id)}</span><small>{CARDS[id].faction} · {rarityName(CARDS[id].rarity)}</small></button>)}</div>{!groups.length && <p className={styles.emptyText}>{t('Активных объявлений пока нет.', 'No active listings yet.')}</p>}{groups.length > 0 && !filtered(groups).length && <p className={styles.emptyText}>{t('Такая карта не найдена.', 'No matching cards.')}</p>}</aside>
      <div className={styles.browseDetail}>{selected ? <><div className={styles.cardSummary}>{cardFace(selected)}<div><CardFacts id={selected}/>{stats(selected)}</div></div><div className={styles.sectionHeading}><h2>{t('Предложения игроков', 'Player offers')}</h2><button type="button" className={styles.textButton} disabled={readingOffers} onClick={() => void browse(false)}>{t('Обновить', 'Refresh')}</button></div>{offers.filter(offer => offer.status === 'Active').map(offer => listingRow(offer))}{readingOffers && <p className={styles.loading} role="status">{t('Загружаем объявления…', 'Loading offers…')}</p>}{offerError && <p className={styles.error} role="alert">{marketError(offerError)}</p>}{!readingOffers && !offerError && !offers.some(offer => offer.status === 'Active') && <p className={styles.emptyText}>{t('Для этой карты сейчас нет предложений. Обновите рынок.', 'This card has no offers right now. Refresh the market.')}</p>}{cursor && <button type="button" className={styles.button} disabled={readingOffers} onClick={() => void browse(true)}>{t('Ещё предложения', 'More offers')}</button>}<p className={styles.hint}>{t('Цена указана за весь лот. Оплата идёт с игрового счёта; карта зачисляется после подтверждения iDos.', 'Prices are for the entire lot. Payment uses your game balance; cards are credited after iDos confirmation.')}</p></> : <div className={styles.empty}><PaintedIcon name="cards" size={80}/><h2>{t('Первое объявление ждёт вас', 'The first listing awaits')}</h2><p>{t('Выставьте полученные из паков карты или вернитесь позже.', 'List cards received from packs or return later.')}</p><button type="button" className={styles.button} onClick={() => setTab('sell')}>{t('Мои карты для продажи', 'My cards to sell')} →</button></div>}</div>
    </div>}
    {tab === 'sell' && <div role="tabpanel" id="market-sell" aria-labelledby="market-tab-sell" className={styles.tabContent}><div className={styles.sectionHeading}><div><h2>{t('Карты для продажи', 'Cards to sell')}</h2><p>{t('Только подтверждённые копии в инвентаре iDos.', 'Only verified copies in your iDos inventory.')}</p></div><label className={styles.search}><span>{t('Найти карту', 'Find a card')}</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder={t('Название карты', 'Card name')}/></label></div><div className={styles.inventory}>{filtered(owned).map(id => <article key={id} className={styles.inventoryCard}>{cardFace(id)}<CardFacts id={id} compact/><span className={styles.stock}>{t('Доступно', 'Available')}: {snapshot!.inventory[id]} {t('шт.', 'cards')}</span>{stats(id)}<button type="button" className={`${styles.button} ${styles.primary}`} disabled={!canTrade} onClick={() => chooseSell(id)}>{t('Выставить на продажу', 'List for sale')}</button></article>)}</div>{!owned.length && <div className={styles.empty}><PaintedIcon name="pack" size={72}/><h2>{t('Нет продаваемых копий', 'No tradable copies')}</h2><p>{t('Бесплатные стартовые карты и прежние открытия остаются доступны для игры. Они не являются товарами рынка. Новые платные паки добавляют продаваемые копии в iDos.', 'Free starter cards and earlier pack openings remain playable. They are not marketplace goods. New paid packs add tradable iDos copies.')}</p><Link className={styles.button} href="/packs">{t('Открыть паки', 'Open packs')} →</Link></div>}{owned.length > 0 && !filtered(owned).length && <p className={styles.emptyText}>{t('Такая карта не найдена.', 'No matching cards.')}</p>}</div>}
    {tab === 'my' && <div role="tabpanel" id="market-my" aria-labelledby="market-tab-my" className={styles.tabContent}><div className={styles.sectionHeading}><h2>{t('Мои объявления', 'My listings')}</h2><p>{t('После истечения срока нажмите «Вернуть карты». Возврат завершён только после подтверждения iDos.', 'After expiry, press Reclaim cards. Cards return only after iDos confirmation.')}</p></div>{snapshot?.myOffers.map(offer => listingRow(offer, true))}{!snapshot?.myOffers.length && <p className={styles.emptyText}>{t('У вас ещё нет объявлений.', 'You have no listings yet.')}</p>}</div>}
    {tab === 'history' && <div role="tabpanel" id="market-history" aria-labelledby="market-tab-history" className={styles.tabContent}><div className={styles.sectionHeading}><div><h2>{t('Ваши завершённые сделки', 'Your completed trades')}</h2><p>{t('До 100 последних сделок, подтверждённых iDos.', 'Up to 100 recent trades confirmed by iDos.')}</p></div></div>{snapshot?.history.map(row => <article key={row.offerId} className={styles.trade}><span className={styles.tradeSide}>{row.buyerUserId === idos.session.userId ? t('Покупка', 'Bought') : t('Продажа', 'Sold')}</span><button type="button" className={styles.textButton} onClick={() => setInspected(row.cardId)}>{cardName(row.cardId)} · {row.quantity} {t('шт.', 'cards')}</button><strong>{money(row.priceImp)} IMP</strong><time dateTime={row.completedAt}>{new Date(row.completedAt).toLocaleString(locale === 'ru' ? 'ru-RU' : 'en-US', {dateStyle: 'short', timeStyle: 'short'})}</time></article>)}{!snapshot?.history.length && <p className={styles.emptyText}>{t('Завершённых сделок пока нет. Неудачные запросы не считаются продажами.', 'No completed trades yet. Failed requests do not count as sales.')}</p>}</div>}
    <footer className={styles.marketFootnote}><p>{prices?.ready ? t('Средняя цена рассчитывается по завершённым сделкам, которые участники синхронизировали с площадкой и сервер проверил в iDos. Покрытие может быть неполным.', 'Average prices use completed trades synced by participants and independently verified with iDos. Coverage may be incomplete.') : t('Общая статистика пока недоступна. Показаны только ваши завершённые сделки; цены объявлений не считаются продажами.', 'Shared statistics are unavailable. Only your completed trades are shown; asking prices are not sales.')}</p>{snapshot && <p>{t('Комиссия iDos с торговли', 'iDos trading fee')}: {snapshot.tradeFeePercent}%. {t('Выручка поступает на игровой счёт. Вывод в Phantom — отдельный перевод.', 'Sale proceeds enter your game account. Withdrawal to Phantom is a separate transfer.')}</p>}</footer>
    {sellCard && <Dialog title={t('Новое объявление', 'New listing')} onClose={() => setSellCard(null)} className={styles.dialog}><div className={styles.reviewCard}>{cardFace(sellCard)}<CardFacts id={sellCard} compact/></div><form className={styles.form} onSubmit={event => {event.preventDefault(); prepareListing();}}><label>{t('Количество копий', 'Number of copies')}<input inputMode="numeric" pattern="[0-9]+" value={quantity} onChange={event => setQuantity(event.target.value)} maxLength={4}/><small>{t('Доступно', 'Available')}: {snapshot?.inventory[sellCard] ?? 0}</small></label><label>{t('Цена за весь лот в IMP', 'Entire lot price in IMP')}<input inputMode="numeric" pattern="[0-9]+" value={price} onChange={event => setPrice(event.target.value)} placeholder="100000" maxLength={13}/><small>{t('Целое число IMP. Цену выбираете вы.', 'Whole IMP. You set the price.')}</small></label><label>{t('Срок объявления', 'Listing duration')}<select value={hours} onChange={event => setHours(Number(event.target.value))}>{[24, 72, 168].map(value => <option key={value} value={value}>{value / 24} {t('дн.', 'days')}</option>)}</select></label>{notice && <p className={styles.error} role="alert">{marketError(notice)}</p>}<button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!canTrade || !price}>{t('Проверить объявление', 'Review listing')}</button></form></Dialog>}
    {review && reviewCard && <Dialog title={review.kind === 'create' ? t('Подтвердите объявление', 'Confirm listing') : review.kind === 'buy' ? t('Подтвердите покупку', 'Confirm purchase') : expiredOffer(review.offer) ? t('Вернуть карты?', 'Reclaim cards?') : t('Снять объявление?', 'Cancel listing?')} onClose={() => {if (!busy) setReview(null);}} className={styles.dialog}><div className={styles.reviewCard}>{cardFace(reviewCard)}<CardFacts id={reviewCard} compact/></div><dl className={styles.reviewDetails}><div><dt>{t('Количество', 'Quantity')}</dt><dd>{review.kind === 'create' ? review.quantity : review.offer.quantity} {t('шт.', 'cards')}</dd></div><div><dt>{t('Цена за весь лот', 'Entire lot price')}</dt><dd>{money(review.kind === 'create' ? review.price : review.offer.priceImp)} IMP</dd></div>{review.kind === 'create' && <div><dt>{t('Срок', 'Duration')}</dt><dd>{review.hours / 24} {t('дн.', 'days')}</dd></div>}{review.kind !== 'cancel' && snapshot && <div><dt>{t('Комиссия iDos с торговли', 'iDos trading fee')}</dt><dd>{snapshot.tradeFeePercent}%</dd></div>}{review.kind === 'buy' && <div><dt>{t('Оплата', 'Pay from')}</dt><dd>{t('Игровой счёт iDos', 'iDos game account')}</dd></div>}</dl><p className={styles.hint}>{review.kind === 'create' ? t('Эти копии будут зарезервированы. Пока они в продаже, ими нельзя пополнять колоду. После продажи выручка за вычетом комиссии iDos поступит на игровой счёт.', 'These copies will be reserved and unavailable for your deck while listed. On sale, proceeds after the iDos fee enter your game account.') : review.kind === 'buy' ? t('iDos спишет указанную цену с игрового счёта и передаст все карты лота. Покупка завершена только после подтверждения сервера.', 'iDos will debit the displayed price from your game account and transfer every card in the lot. The purchase completes only after server confirmation.') : t('Непроданные копии вернутся в инвентарь после подтверждения iDos.', 'Unsold copies return to your inventory after iDos confirmation.')}</p><div className={styles.actions}><button type="button" className={`${styles.button} ${styles.primary}`} disabled={busy || snapshot?.pending || (review.kind !== 'cancel' && !snapshot?.ready)} onClick={() => void execute()}>{busy ? t('Проверяем сделку…', 'Checking trade…') : review.kind === 'create' ? t('Выставить', 'List for sale') : review.kind === 'buy' ? t('Купить за IMP', 'Buy with IMP') : expiredOffer(review.offer) ? t('Вернуть карты', 'Reclaim cards') : t('Снять объявление', 'Cancel listing')}</button><button type="button" className={styles.button} disabled={busy} onClick={() => setReview(null)}>{t('Отмена', 'Back')}</button></div></Dialog>}
    {account && <AccountPanel onClose={() => setAccount(false)}/>} {inspected && <CardDialog id={inspected} onClose={() => setInspected(null)}/>}
  </section>;
}
