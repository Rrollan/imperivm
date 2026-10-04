'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CardDef } from '../../lib/engine/types';
import CardView, { CardBack, RARITY_COLORS } from '../../components/CardView';
import WalletBar from '../../components/WalletBar';
import { play } from '../../lib/audio/sfx';
import { markAmbientStarted, shouldStartAmbient } from '../../lib/audio/events';
import { startAmbient } from '../../lib/audio/sfx';
import { unlockAudio } from '../../lib/audio/manager';
import { useCollection } from '../../components/CollectionContext';
import { PACK_COST, RARITY_WEIGHTS } from '../../lib/collection/gateway';
import NftPack from '../../components/NftPack';
import { useLocale } from '../../components/LocaleContext';

export default function PacksPage() {
  const { t, rarityName, errorText } = useLocale();
  const collection = useCollection();
  const [pack, setPack] = useState<CardDef[]>([]);
  const [revealed, setRevealed] = useState(0);
  const [opened, setOpened] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

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
    if (collection.busy || (opened && revealed < pack.length)) return;
    if (timerRef.current) clearInterval(timerRef.current);
    // Unlock audio context inside the user gesture.
    await unlockAudio();
    let cards: CardDef[];
    try { cards = (await collection.openPack()).cards; } catch { return; }
    setPack(cards);
    setRevealed(0);
    setOpened(true);
    play('pack-open');
    let step = 0;
    timerRef.current = setInterval(() => {
      step += 1;
      if (step >= cards.length) {
        if (timerRef.current) clearInterval(timerRef.current);
        setRevealed(cards.length);
        play('card-reveal');
        return;
      }
      setRevealed(step);
      play('card-reveal');
    }, 450);
  };

  return (
    <div className="min-h-screen bg-abyss text-parchment">
      <WalletBar />

      <main className="max-w-5xl mx-auto px-6 py-12 text-center">
        <h1 className="font-display text-5xl font-bold gold-text tracking-widest">{t('ПАКИ', 'PACKS')}</h1>
        <p className="mt-3 text-lavender italic font-display text-lg">
          {collection.snapshot?.mode === 'idos' ? t('Карты и валюта хранятся в iDos Games.', 'Cards and currency managed by iDos Games.') : t('Пять карт. Шансы зависят от редкости. Коллекция сохраняется в этом браузере.', 'Five cards. Weighted by rarity. Yours to keep in this browser.')}
        </p>
        <div className="collection-wallet"><strong>{collection.snapshot?.rug ?? '—'} $RUG</strong><span>{collection.snapshot?.mode === 'idos' ? t('Виртуальная валюта iDos', 'iDos virtual currency') : t('Локальная демо-валюта', 'Local demo currency')} · {t('не имеет денежной стоимости', 'no cash value')}</span><Link href="/collection">{t('Открыть коллекцию →', 'View collection →')}</Link></div>
        {collection.error && <div className="integration-error" role="status"><p>{errorText(collection.error)}</p><div className="dialog-actions"><button className="secondary-button" onClick={() => void collection.refresh()} disabled={collection.busy}>{t('Повторить', 'Retry')}</button><button className="secondary-button" onClick={() => void collection.useLocalDemo()} disabled={collection.busy}>{t('Локальное демо', 'Use local demo')}</button></div></div>}

        <div className="mt-6 flex justify-center gap-4 text-xs">
          {RARITY_WEIGHTS.map(r => (
            <span key={rarityName(r.rarity)} className="flex items-center gap-1.5 text-parchment/70">
              <span
                className="inline-block w-2.5 h-2.5 rotate-45"
                style={{ background: RARITY_COLORS[r.rarity] }}
              />
              {rarityName(r.rarity)} · {r.weight}%
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-4 min-h-[14rem]">
          {opened
            ? pack.map((card, i) =>
                i < revealed ? (
                  <div key={`${card.id}-${i}`} className="flip-in">
                    <CardView card={card} size="md" />
                  </div>
                ) : (
                  <div key={`back-${i}`}>
                    <CardBack />
                  </div>
                ),
              )
            : (
              <div className="flex flex-col items-center gap-4 py-8">
                <CardBack />
                <p className="text-lavender/60 text-sm italic">{t('Пак ждёт вашего приказа, Император.', 'The pack awaits your command, Imperator.')}</p>
              </div>
            )}
        </div>

        <div className="mt-8">
          <button
            onClick={handleOpen}
            disabled={collection.busy || !collection.snapshot || collection.snapshot.rug < PACK_COST || (opened && revealed < pack.length)}
            className="px-10 py-3.5 rounded-lg bg-gradient-to-b from-gold-light to-gold-dark text-abyss font-bold text-lg tracking-wide hover:brightness-110 transition shadow-[0_0_24px_rgba(212,175,55,0.35)]"
          >
            {collection.busy ? t('Открываем…', 'Opening…') : opened ? t('✦ Ещё один пак · 50 $RUG', '✦ Open another · 50 $RUG') : t('✦ Открыть пак · 50 $RUG', '✦ Open pack · 50 $RUG')}
          </button>
        </div>

        <p className="mt-6 text-xs text-lavender/60">{collection.snapshot?.mode === 'idos' ? t('Коллекция и валюта через iDos SDK.', 'Collection and currency via iDos SDK.') : t('Локальное демо · 500 стартовых $RUG · без кошелька и минта.', 'Local fallback · 500 starter $RUG · no wallet or minting required.')}</p>
        <NftPack />

        <div className="mt-4">
          <Link href="/" className="text-sm text-lavender/70 hover:text-lavender">
            {t('← Вернуться на форум', '← Back to the forum')}
          </Link>
        </div>
      </main>
    </div>
  );
}
