'use client';
import {useCollection} from '../CollectionContext';
import {useLocale} from '../LocaleContext';
import {loadCustomDeck} from '../../lib/deckbuilder';
import {freeCardCounts, playableDeck} from '../../lib/collection/access';
import ArenaLab from './ArenaLab';

/** Normal training uses owned cards; diagnostic fixtures keep their deterministic full recipes. */
export default function ArenaEntry(props: React.ComponentProps<typeof ArenaLab>) {
  const collection = useCollection(), {t} = useLocale();
  if (props.debug) return <ArenaLab {...props}/>;
  if (!collection.snapshot && !collection.error) return <main style={{padding: '4rem', color: '#f6dfaa'}} role="status">{t('Готовим бесплатную колоду и коллекцию…', 'Preparing your free deck and collection…')}</main>;
  const owned = collection.snapshot?.owned ?? freeCardCounts();
  const deck = playableDeck(props.heroId, owned, typeof window !== 'undefined' ? loadCustomDeck(props.heroId) : null);
  return <ArenaLab {...props} initialDeck={deck}/>;
}
