'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CardDef } from '../../lib/engine/types';
import { RARITY_COLORS } from '../../components/CardView';
import WalletBar from '../../components/WalletBar';
import {SiteHeader, SiteFooter} from '../../components/home/SiteChrome';
import styles from '../../components/home/Home.module.css';
import { play } from '../../lib/audio/sfx';
import { markAmbientStarted, shouldStartAmbient } from '../../lib/audio/events';
import { startAmbient } from '../../lib/audio/sfx';
import { unlockAudio } from '../../lib/audio/manager';
import { useCollection } from '../../components/CollectionContext';
import { PACK_COST, RARITY_WEIGHTS } from '../../lib/collection/gateway';
import NftPack from '../../components/NftPack';
import { useLocale } from '../../components/LocaleContext';
import {CardDialog} from '../../components/home/CardDialog';
import {PackOpening} from '../../components/home/PackOpening';
import {RomanIcon} from '../../components/presentation/RomanIcon';
import {useIDos} from '../../components/IDosContext';
import {PaintedIcon} from '../../components/PaintedIcon';
import {RulerCase} from '../../components/home/RulerCase';
import RugShop from '../../components/RugShop';

export default function PacksPage() {
  const { t, rarityName, errorText, cardName } = useLocale();
  const collection = useCollection();
  const [inspected, setInspected] = useState<string | null>(null);
  const [pack, setPack] = useState<CardDef[]>([]);
  const [duplicates, setDuplicates] = useState<boolean[]>([]);
  const [animating,setAnimating]=useState(false),[openingId,setOpeningId]=useState(0);
  const inFlight=useRef(false);
  const idos=useIDos();
  const [opened, setOpened] = useState(false);
  useEffect(()=>{setPack([]);setDuplicates([]);setOpened(false);setAnimating(false);},[idos.session.revision]);

  // Lazy-start ambient on first gesture.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldStartAmbient()) return;
    const handler = () => {
      void unlockAudio().then(() => { startAmbient(); markAmbientStarted(true); });
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  const handleOpen = async () => {
    if(inFlight.current||collection.busy||animating)return;
    inFlight.current=true;
    try{
      await unlockAudio();
      const result=await collection.openPack();
      setPack(result.cards);setDuplicates(result.duplicates??[]);setOpeningId(i=>i+1);setOpened(true);setAnimating(true);play('pack-open');
    }catch{/* Collection context displays the failed purchase; no reveal is invented. */}
    finally{inFlight.current=false;}
  };

  return (
    <div className={styles.shell}>
      <SiteHeader active="packs" />

      <main className={`${styles.hubMain} ${styles.packMain}`}>
        <header className={styles.pageTitle}><span className={styles.kicker}>AGORA · AFTER HOURS</span><h1>{t('Паки', 'Packs')}</h1><p>{t('Пять карт. Новые связки.','Five cards. New combos.')}</p></header>
        <div className="collection-wallet"><strong>{collection.snapshot?.rug ?? '—'} $IMP</strong><span>{collection.snapshot?.mode === 'idos' ? t('Баланс iDos', 'iDos balance') : t('Демо · без оплаты', 'Demo · no payment')}</span><Link href="/collection">{t('Коллекция →', 'Collection →')}</Link></div>
        {collection.error && <div className="integration-error" role="status"><p>{errorText(collection.error)}</p><div className="dialog-actions"><button className="secondary-button" onClick={() => void collection.refresh()} disabled={collection.busy}>{t('Повторить', 'Retry')}</button><button className="secondary-button" onClick={() => void collection.useLocalDemo()} disabled={collection.busy}>{t('Локальное демо', 'Use local demo')}</button></div></div>}

        {opened?<PackOpening key={openingId} cards={pack} duplicates={duplicates} onInspect={setInspected} onComplete={()=>setAnimating(false)} onReplayStart={()=>setAnimating(true)}/>:<div className="pack-idle"><PaintedIcon name="pack" size={170}/></div>}

        <div className={styles.packPurchase}>
          <button
            onClick={handleOpen}
            disabled={collection.busy || !collection.snapshot || collection.snapshot.rug < PACK_COST || animating}
            className="gold-button"
          >
            <PaintedIcon name="pack" size={36}/>{collection.busy ? t('Открываем…', 'Opening…') : opened ? t('Ещё один пак · 50 $IMP', 'Open another · 50 $IMP') : t('Открыть пак · 50 $IMP', 'Open pack · 50 $IMP')}
          </button>
        </div>
        {!animating&&collection.snapshot&&collection.snapshot.rug<PACK_COST&&<p className={styles.packStatus}>{t('Для пака нужно 50 $IMP.','A pack requires 50 $IMP.')}</p>}
        {!opened&&<Link className={styles.secondaryLink} href="/arena-lab/pack-preview">{t('Предпросмотр анимации','Preview the animation')}<RomanIcon name="next" size={18}/></Link>}

        {opened&&!animating&&<Link href="/collection" className={styles.secondaryLink}><PaintedIcon name="cards" size={30}/>{t('Добавить новые карты в колоду','Build with your new cards')}<RomanIcon name="next" size={20}/></Link>}
        <details className={styles.menuDetails}><summary>{t('Что в паке?', 'What’s inside?')}</summary><p>{t('Пять случайных карт из 50 персонажей Agora. Шансы редкости указаны для одной карты.','Five random cards from 50 Agora characters. Rarity odds apply to each card.')}</p><div className={styles.rarityChances}>
          {RARITY_WEIGHTS.map(r => (
            <span key={rarityName(r.rarity)} >
              <i aria-hidden="true" style={{background:RARITY_COLORS[r.rarity]}}/>
              {rarityName(r.rarity)} · {r.weight}%
            </span>
          ))}
        </div>

        <p >{collection.snapshot?.mode === 'idos' ? t('Коллекция и баланс сохраняются в вашем аккаунте iDos.', 'Collection and balance belong to your iDos account.') : t('Локальное демо · 500 тестовых $IMP. Демо-карты работают в тренировке; для паковых карт в PvP нужен аккаунт iDos.', 'Local demo · 500 test $IMP. Demo cards work in training; pack cards in PvP require an iDos account.')}</p>
        <p >{t('Полученная карта открывает до двух копий в колоде, легендарная — одну. Паки могут содержать повторы; в iDos они превращаются в валюту коллекции, а не в IMP.', 'An obtained card unlocks up to two deck copies, or one for a legendary. Packs may contain duplicates; iDos converts them into collection currency, not IMP.')}</p>
        {collection.snapshot?.mode === 'idos' && <p >{t('Валюта коллекции за повторы', 'Collection currency from duplicates')}: <strong>{collection.snapshot.collectionCurrency ?? 0}</strong> · {t('Обмен на карты готовится; сейчас эта валюта не тратится.', 'Card exchange is in preparation; this currency cannot be spent yet.')}</p>}
        </details>
        <details className={styles.menuDetails}><summary><PaintedIcon name="rug" size={30}/>{t('Пополнить $IMP · SOL / USDC', 'Get $IMP · SOL / USDC')}</summary><RugShop/></details>
        <details className={styles.optionalNft}><summary>{t('Коллекционные NFT · devnet (необязательно)', 'Collectible NFTs · devnet (optional)')}</summary><WalletBar /><NftPack /></details>


        <RulerCase/>
      </main>
      <SiteFooter />
      {inspected && <CardDialog id={inspected} onClose={() => setInspected(null)} />}
    </div>
  );
}
