'use client';

import { useEffect, useId, useRef } from 'react';
import { CARDS } from '../../lib/cards';
import { isInstantSpell } from '../../lib/engine/spellTiming';
import { useReducedMotion } from '../../lib/prefersReducedMotion';
import { useLocale } from '../LocaleContext';
import { ArenaCardPreview } from '../presentation/ArenaCardPreview';
import { roleName } from '../presentation/cardIdentity';
import { cardKeywords, cardRules, retaliationRules } from '../presentation/rulesText';
import styles from './Home.module.css';
import {isFreeCard} from '../../lib/collection/access';

export function CardDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, locale, cardName, rarityName } = useLocale();
  const reduced = useReducedMotion(), dialog = useRef<HTMLDialogElement>(null), title = useId();
  const card = CARDS[id], keywords = cardKeywords(id, locale);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = previousOverflow; previous?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className={styles.cardDialog} aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className={styles.closeButton} autoFocus type="button" aria-label={t('Закрыть просмотр карты', 'Close card inspection')} onClick={onClose}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg></button>
    <div className={styles.dialogInterior}>
      <div className={styles.dialogCard}><ArenaCardPreview id={id} locale={locale} label={cardName(id)} interactive reduced={reduced} /></div>
      <div className={styles.dialogCopy}>
        <p className={styles.kicker}>{card.faction} · {roleName(id, locale)}</p><h2 id={title}>{cardName(id)}</h2><span className={styles.rarityLabel} data-rarity={card.rarity}>{rarityName(card.rarity)}</span>
        <dl className={styles.cardStats}><div><dt>{t('Приказы', 'Orders')}</dt><dd>{card.cost}</dd></div>{card.type === 'minion' && <><div><dt>{t('Атака', 'Attack')}</dt><dd>{card.attack}</dd></div><div><dt>{t('Здоровье', 'Health')}</dt><dd>{card.health}</dd></div></>}</dl>
        {card.type === 'spell' && <div className={styles.timingLabel} data-instant={isInstantSpell(card)}><strong>{isInstantSpell(card) ? t('Действует сразу', 'Resolves immediately') : t('Указ на следующий свой ход', 'Edict for your next turn')}</strong><p>{isInstantSpell(card) ? t('Эффект срабатывает при розыгрыше. Карта не попадает в очередь указов.', 'The effect resolves when you play it. This card does not enter the edict queue.') : card.priority ? t('Приоритет отменяет вражеский указ сразу. Основной эффект сработает в начале следующего вашего хода.', 'Priority counters an enemy edict immediately. The main effect resolves at the start of your next turn.') : t('Соперник получает ход, чтобы ответить. Затем указ исполняется в начале вашего следующего хода.', 'Your opponent gets a turn to respond. The edict then resolves at the start of your next turn.')}</p></div>}
        <p className={styles.cardRuleText}>{cardRules(id, locale)}</p>
        {card.type === 'minion' && <p className={styles.libraryHint}>{retaliationRules(card.attack ?? 0,locale)}</p>}
        {!!keywords.length && <div className={styles.keywordList}>{keywords.map(keyword => <details key={keyword.name}><summary>{keyword.name}</summary><p>{keyword.description}</p></details>)}</div>}
        <p className={styles.libraryHint}>{isFreeCard(id) ? t('Бесплатный набор: карта уже доступна каждому игроку для сборки колоды.', 'Free set: this card is already available to every player for deckbuilding.') : t('Только из паков Agora. Получите карту в паке за IMP, чтобы добавить её в свою колоду.', 'Agora packs only. Obtain this card in a IMP pack to add it to your deck.')}</p>
      </div>
    </div>
  </dialog>;
}
