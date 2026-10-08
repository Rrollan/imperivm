'use client';

import { useEffect, useId, useRef, useState } from 'react';
import catalogue from '../../public/ui/arena-lab/character-art-50/catalogue.json';
import { useLocale } from '../LocaleContext';
import styles from './Home.module.css';

// These are expansion illustrations, deliberately separate from the playable CardDef catalogue.
const characters = catalogue.characters.map(({ id, index, art, nameRu, nameEn, faction, roleRu, hookRu }) =>
  ({ id, index, art: `/ui/arena-lab/character-art-50/${art}`, nameRu, nameEn, faction, roleRu, hookRu }));
type Character = typeof characters[number];
export const CHARACTER_ART_COUNT = characters.length;

function CharacterDialog({ character, onClose }: { character: Character; onClose: () => void }) {
  const { t, locale } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null), title = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element.showModal();
    return () => { element.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className={styles.cardDialog} aria-labelledby={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <button className={styles.closeButton} autoFocus type="button" aria-label={t('Закрыть просмотр персонажа', 'Close character inspection')} onClick={onClose}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
    </button>
    <div className={styles.dialogInterior}>
      <img className={styles.characterDialogArt} src={character.art} width="768" height="1152" alt={locale === 'ru' ? character.nameRu : character.nameEn} />
      <div className={styles.dialogCopy}>
        <p className={styles.kicker}>{character.faction} · {String(character.index).padStart(2, '0')} / {CHARACTER_ART_COUNT}</p>
        <h2 id={title}>{locale === 'ru' ? character.nameRu : character.nameEn}</h2>
        <p className={styles.characterStatus}>{t('Будущее расширение', 'Upcoming expansion')}</p>
        {locale === 'ru' && <><h3 className={styles.characterRole}>{character.roleRu}</h3><p className={styles.cardRuleText}>{character.hookRu}</p></>}
        <p className={styles.libraryHint}>{t('Это готовый арт и замысел персонажа. Боевые характеристики, способности и связки ещё в разработке. Пока его нельзя положить в колоду или получить из пака.', 'This is a finished illustration and character concept. Combat stats, abilities and synergies are still in development. It cannot be added to a deck or obtained from a pack yet.')}</p>
      </div>
    </div>
  </dialog>;
}

export function CharacterArtGallery({ faction, query }: { faction: string; query: string }) {
  const { t, locale } = useLocale();
  const [inspected, setInspected] = useState<Character | null>(null);
  const search = query.trim().toLowerCase();
  const visible = characters.filter(c => (faction === 'All' || c.faction === faction) && `${c.nameRu} ${c.nameEn} ${c.roleRu} ${c.hookRu}`.toLowerCase().includes(search));
  return <section aria-label={t('Новые персонажи', 'New characters')}>
    <div className={styles.expansionNotice}><strong>{t('50 новых персонажей · четыре фракции', '50 new characters · four factions')}</strong>
      <p>{t('Иллюстрации готовы. Нажмите на персонажа, чтобы рассмотреть его и прочитать задумку. Способности и баланс расширения ещё в разработке.', 'The illustrations are ready. Select a character to inspect it. Expansion abilities and balance are still in development.')}</p>
      <span>{t(`Показано ${visible.length} из ${CHARACTER_ART_COUNT}`, `Showing ${visible.length} of ${CHARACTER_ART_COUNT}`)}</span>
    </div>
    <div className={styles.characterGrid}>{visible.map(character => <button key={character.id} type="button" className={styles.characterTile}
      aria-label={t(`Рассмотреть персонажа «${character.nameRu}»`, `Inspect character ${character.nameEn}`)}
      onClick={event => { event.currentTarget.focus({ preventScroll: true }); setInspected(character); }}>
      <img src={character.art} width="768" height="1152" loading="lazy" decoding="async" alt="" />
      <span className={styles.kicker}>{character.faction}</span>
      <strong>{locale === 'ru' ? character.nameRu : character.nameEn}</strong>
      <span className={styles.characterStatus}>{t('Будущее расширение', 'Upcoming expansion')}</span>
    </button>)}</div>
    {!visible.length && <p className="integration-note">{t('Нет персонажей по этому запросу. Измените поиск или фракцию.', 'No characters match. Change the search or faction.')}</p>}
    {inspected && <CharacterDialog character={inspected} onClose={() => setInspected(null)} />}
  </section>;
}
