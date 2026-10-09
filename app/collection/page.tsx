'use client';
import { useState } from 'react';
import Link from 'next/link';
import {DeckWorkshop} from '../../components/home/DeckWorkshop';
import {RomanIcon} from '../../components/presentation/RomanIcon';
import WalletBar from '../../components/WalletBar';
import {SiteHeader, SiteFooter} from '../../components/home/SiteChrome';
import styles from '../../components/home/Home.module.css';
import { useLocale } from '../../components/LocaleContext';
import {CardDialog} from '../../components/home/CardDialog';
import {CardFacts} from '../../components/home/CardFacts';
import {LibraryCardFace} from '../../components/home/LibraryCardFace';
import { CHARACTER_CARDS } from '../../lib/characterCards';
const CHARACTER_CARD_COUNT = Object.keys(CHARACTER_CARDS).length;
import Dialog from '../../components/Dialog';
import { useCollection } from '../../components/CollectionContext';
import { CARDS } from '../../lib/cards';
import {FREE_CARD_IDS, PACK_CARD_IDS, freeCardCounts, isFreeCard} from '../../lib/collection/access';
import { useNfts } from '../../components/NftContext';
import { useImperivmWallet } from '../../components/WalletContext';
import { explorerUrl } from '../../lib/solana/devnet';
export default function CollectionPage() {
  const { t, cardName, cardText, heroName, errorText } = useLocale();
  const collection = useCollection();
  const nfts = useNfts(), wallet = useImperivmWallet();
  const [inspected, setInspected] = useState<string | null>(null);
  const [filter, setFilter] = useState('All'), [query, setQuery] = useState(''), [mode, setMode] = useState<'catalog' | 'owned' | 'nft' | 'characters'>('catalog');
  const [building, setBuilding] = useState(true), [trade, setTrade] = useState(false);
  const localOwned = collection.snapshot?.owned ?? freeCardCounts();
  const owned = localOwned;
  const inventory = mode === 'nft' ? nfts.counts : owned;
  const catalogMode = mode === 'catalog' || mode === 'characters';
  const visible = Object.values(CARDS).filter(c => (filter === 'All' || c.faction === filter) && (catalogMode || inventory[c.id] > 0) && (mode !== 'characters' || !!CHARACTER_CARDS[c.id]) && `${cardName(c.id)} ${cardText(c.id)} ${c.name} ${c.text}`.toLowerCase().includes(query.toLowerCase()));
  if(building)return <div className={styles.shell}><DeckWorkshop onClose={()=>setBuilding(false)} onInspect={setInspected}/>{inspected&&<CardDialog id={inspected} onClose={()=>setInspected(null)}/>}</div>;
  return <div className={styles.shell}><SiteHeader active="collection" /><main className={`${styles.hubMain} collection-page`}>
    <nav className="collection-nav"><Link href="/"><RomanIcon name="temple" size={18}/>{t('Главная', 'Home')}</Link><Link href="/packs"><RomanIcon name="pack" size={18}/>{t('Паки', 'Packs')}</Link><Link href="/leaderboard"><RomanIcon name="crown" size={18}/>{t('Победы', 'Victories')}</Link><button onClick={() => setTrade(true)}>{t('Обмен ↗', 'Trade ↗')}</button></nav>
    <p className="eyebrow">{t('Соберите свой легион', 'Assemble your legion')}</p><h1 className="font-display text-4xl sm:text-5xl gold-text">{t('Коллекция', 'The collection')}</h1>
    <p className="integration-note">{t(`${FREE_CARD_IDS.length} бесплатных · ${PACK_CARD_IDS.length} из паков`, `${FREE_CARD_IDS.length} free · ${PACK_CARD_IDS.length} from packs`)}</p>
    <div className="collection-wallet"><strong>{collection.snapshot?.rug ?? '—'} $IMP</strong><span>{Object.keys(owned).length}/{Object.keys(CARDS).length} {t('видов карт собрано', 'card types collected')}</span><button className="secondary-button" onClick={() => { setBuilding(true); }}><RomanIcon name="cards" size={20}/>{t('Собрать колоду', 'Build a deck')}</button></div>
    {collection.error && <p className="integration-error" role="status">{errorText(collection.error)} <button onClick={() => void collection.refresh()}>{t('Повторить', 'Retry')}</button> · <button onClick={() => void collection.useLocalDemo()}>{t('Локальное демо', 'Use local demo')}</button></p>}
    <details className={styles.optionalNft}><summary>{t('Коллекционные NFT · devnet (необязательно)', 'Collectible NFTs · devnet (optional)')}</summary><WalletBar /><div className="integration-panel mt-5"><p className="text-mint text-sm">{t('Владение NFT в devnet', 'Devnet NFT ownership')} · {nfts.cards.length} {t('подтверждённых карт', 'verified cards')}</p><p className="integration-note">{wallet.owner ? nfts.deployment ? t('Здесь показаны NFT этого кошелька из Genesis. Игровой бесплатный набор уже доступен; новые персонажи открываются через паки Agora.', 'This view shows Genesis NFTs owned by your wallet. The free gameplay set is already available; new characters unlock through Agora packs.') : t('Коллекция Genesis пока не настроена.', 'Genesis collection is not configured yet.') : t('Подключите Phantom для проверки NFT Genesis. Демо всегда доступно.', 'Connect Phantom to read Genesis NFTs. Demo play stays available.')}</p><div className="dialog-actions"><button className="secondary-button" disabled={!wallet.owner || !nfts.deployment || nfts.busy} onClick={() => void nfts.refresh()}>{nfts.busy ? t('Чтение NFT…', 'Reading NFTs…') : t('Проверить владение NFT', 'Refresh NFT ownership')}</button><Link href="/devnet" className="secondary-button">{t('Настройка Genesis', 'Genesis setup')}</Link></div>{nfts.error && <p className="integration-error" role="status">{errorText(nfts.error)}</p>}</div></details>
    <div className="collection-filters"><div className="mode-tabs"><button aria-pressed={mode === 'catalog'} onClick={() => setMode('catalog')}>{t(`Игровые карты · ${Object.keys(CARDS).length}`, `Playable cards · ${Object.keys(CARDS).length}`)}</button><button aria-pressed={mode === 'characters'} onClick={() => setMode('characters')}>{t(`Новые персонажи · ${CHARACTER_CARD_COUNT}`, `New characters · ${CHARACTER_CARD_COUNT}`)}</button><button aria-pressed={mode === 'owned'} onClick={() => setMode('owned')}>{t('Моя коллекция', 'My collection')}</button><button aria-pressed={mode === 'nft'} onClick={() => setMode('nft')}>{t('NFT в devnet', 'Devnet NFTs')}</button></div><input aria-label={t('Поиск карт', 'Search cards')} placeholder={t('Поиск по легиону…', 'Search your legion…')} value={query} onChange={e => setQuery(e.target.value)} /><select aria-label={t('Фильтр фракций', 'Filter faction')} value={filter} onChange={e => setFilter(e.target.value)}>{['All', 'DeFi', 'NFT', 'DePIN', 'Meme'].map(f => <option key={f} value={f}>{f === 'All' ? t('Все', 'All') : f}</option>)}</select></div>
    {mode === 'characters' && <div className={styles.expansionNotice}><strong>{t('Agora After Hours · 50 игровых персонажей', 'Agora After Hours · 50 playable characters')}</strong><p>{t('Нажми на карту — изучи её связки. Полученные карты доступны в колодах.','Tap a card to explore its combos. Obtained cards are available for your decks.')}</p><span>{t(`Показано ${visible.length} из ${CHARACTER_CARD_COUNT}`, `Showing ${visible.length} of ${CHARACTER_CARD_COUNT}`)}</span></div>}<div><div className={styles.nativeCollectionGrid}>{visible.map(card => <div key={card.id} className={styles.nativeCollectionCard}><button type="button" className={styles.hubCard} aria-label={t(`Рассмотреть карту «${cardName(card.id)}»`, `Inspect ${cardName(card.id)}`)} onClick={event => {event.currentTarget.focus({preventScroll:true}); setInspected(card.id);}}><LibraryCardFace id={card.id}/><CardFacts compact id={card.id}/></button><div className="collection-card-caption"><span>{isFreeCard(card.id) ? t('Бесплатный набор', 'Free set') : owned[card.id] ? t(`Получена из паков`, `Obtained from packs`) : t('Только из паков · ещё не получена', 'Packs only · not obtained')}{nfts.counts[card.id] > 0 && <><br /><a className="nft-owned-tag" href={explorerUrl(nfts.cards.find(nft => nft.cardId === card.id)!.address)} target="_blank" rel="noreferrer">NFT ×{nfts.counts[card.id]} · {t('проверено', 'verified')} ↗</a></>}</span></div></div>)}</div>
</div>
    {!visible.length && <p className="py-12 text-center text-lavender">{t('Нет карт по этому запросу. Измените поиск или откройте каталог.', 'No cards match this filter. Change the search or explore the catalog.')}</p>}
  </main><SiteFooter />{inspected && <CardDialog id={inspected} onClose={() => setInspected(null)} />}{trade && <Dialog title={t('Обмен · предпросмотр devnet', 'Trade · devnet preview')} onClose={() => setTrade(false)}><p className="text-sm text-parchment/80">{t('IMPERIVM Genesis пока не представлен на маркетплейсе. Реальный обмен в этом предпросмотре devnet недоступен.', 'IMPERIVM Genesis has no marketplace listing yet. This devnet preview does not support real trading.')}</p><Link className="secondary-button inline-block mt-5" href="/devnet">{t('Посмотреть настройку devnet →', 'View devnet setup →')}</Link></Dialog>}</div>;
}
