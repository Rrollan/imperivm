'use client';
import { useState } from 'react';
import { useLocale } from './LocaleContext';
import { CoinPreview, type ModelKey } from './3d/CoinPreview';
import { play } from '../lib/audio/sfx';
import { unlockAudio } from '../lib/audio/manager';
import { CARDS } from '../lib/cards';
import type { Minion } from '../lib/engine/types';

export function BlockClock({ block, minions }: { block: number; minions: Minion[] }) {
  const { t } = useLocale();
  const periods = minions.map(m => CARDS[m.cardId]?.halvingPeriod).filter((v): v is number => !!v);
  const period = periods.sort((a, b) => (a - block % a) - (b - block % b))[0];
  const remaining = period ? period - block % period : null;
  return <div className="block-clock" title={t('Каждый ход создаёт блок. Халвинг усиливает существ на обоих рядах.', 'Each turn creates a block. Halving strengthens minions in both ranks.')}>
    <span className="block-plaque">{t('БЛОК', 'BLOCK')} <b>#{block.toString().padStart(2, '0')}</b></span>
    <span className="halving-clock">{remaining === null ? t('Халвинг · неактивен', 'Halving · inactive') : t(`Халвинг через ${remaining} бл.`, `Halving in ${remaining} blocks`)}</span>
    <span className="halving-track" aria-hidden><i style={{ width: period ? `${(block % period) / period * 100}%` : '0%' }} /></span>
  </div>;
}

export function RivalHand({ count }: { count: number }) {
  const { t } = useLocale();
  return <div className="rival-hand" aria-label={t(`Рука противника: ${count} карт`, `Rival hand: ${count} cards`)}>
    <div aria-hidden>{Array.from({ length: Math.min(count, 10) }, (_, i) => <img key={i} src="/cards/card-back.webp" alt="" style={{ transform: `rotate(${(i - (count - 1) / 2) * 4}deg)` }} />)}</div>
    <small>{t('РУКА СОПЕРНИКА', 'RIVAL HAND')} · {count}</small>
  </div>;
}

export function ScrollDeck({ count, foe = false }: { count: number; foe?: boolean }) {
  const { t } = useLocale();
  return <div className={`scroll-deck ${foe ? 'foe-deck' : 'own-deck'}`} title={t('Колода: оставшиеся карты', 'Deck: remaining cards')}>
    <span className="deck-scroll" aria-hidden><i /><i /><i /><b>SPQR</b></span>
    <small>{foe ? t('КОЛОДА ИИ', 'RIVAL DECK') : t('КОЛОДА', 'DECK')} <strong>{count}</strong></small>
  </div>;
}

export function BlockHistory({ lines, onOpen }: { lines: string[]; onOpen: () => void }) {
  const { t, logLine } = useLocale();
  return <aside className="block-history" aria-label={t('Лента блоков и событий', 'Block and event history')}>
    <button onClick={onOpen}>{t('ЛЕНТА БЛОКОВ', 'BLOCK HISTORY')} ↗</button>
    <ol>{lines.slice(-5).reverse().map((line, i) => <li key={`${lines.length - i}-${line}`}><b aria-hidden>◆</b><span>{logLine(line)}</span></li>)}</ol>
  </aside>;
}

const DECOR: { model?: ModelKey; kind: string; ru: string; en: string }[] = [
  { model: 'column', kind: 'column', ru: 'Колонна форума', en: 'Forum column' },
  { model: 'bust', kind: 'bust', ru: 'Бюст императора', en: 'Imperator bust' },
  { kind: 'brazier', ru: 'Разжечь жаровню', en: 'Stoke the brazier' },
  { model: 'coin-rug', kind: 'coins', ru: 'Звон монет $RUG', en: '$RUG coin chime' },
];

/** One interactive 3D corner at a time; the battlefield remains a DOM surface. */
export function RomanCorners() {
  const { t } = useLocale();
  const [selected, setSelected] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  return <div className="roman-corners">{DECOR.map(decor => <button key={decor.kind}
    className={`roman-corner corner-${decor.kind} ${selected === decor.kind ? 'awakened' : ''}`}
    aria-label={t(decor.ru, decor.en)} title={t(decor.ru, decor.en)}
    onClick={() => { setSelected(decor.kind); setPulse(p => p + 1); void unlockAudio().then(() => play(decor.kind === 'brazier' ? 'play' : 'card-reveal')); }}>
    {decor.model ? selected === decor.kind ? <CoinPreview model={decor.model} size="100%" autoRotate label={t(decor.ru, decor.en)} /> : <img src={`/ornaments/${decor.model}.svg`} alt="" /> : <span className="brazier" aria-hidden><i className="flame" /><i className="brazier-bowl" /><i className="brazier-foot" /></span>}
    {selected === decor.kind && <span key={pulse} className="corner-spark" aria-hidden>✧</span>}
  </button>)}</div>;
}
