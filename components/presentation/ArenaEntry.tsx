'use client';
import {useCollection} from '../CollectionContext';
import {useLocale} from '../LocaleContext';
import {loadCustomDeck} from '../../lib/deckbuilder';
import {freeCardCounts, playableDeck} from '../../lib/collection/access';
import ArenaLab from './ArenaLab';
import {isFreeHero} from '../../lib/heroes';
import Link from 'next/link';
import {ArenaLoading} from './ArenaLoading';

/** Normal training uses owned cards; diagnostic fixtures keep their deterministic full recipes. */
export default function ArenaEntry(props: React.ComponentProps<typeof ArenaLab>) {
  const collection = useCollection(), {t} = useLocale();
  if (props.debug) return <ArenaLab {...props}/>;
  if (!collection.snapshot && !collection.error) return <div style={{position:'fixed',inset:0}}><ArenaLoading/></div>;
  if(!isFreeHero(props.heroId??'builder')&&!collection.snapshot?.heroes?.includes(props.heroId??''))return <main style={{maxWidth:520,margin:'4rem auto',padding:24,color:'#f6dfaa',background:'#352319',border:'1px solid #b69152',borderRadius:16}}><h1>{t('Правитель ещё не открыт','Ruler not unlocked')}</h1><p>{t('Пять бесплатных правителей доступны сразу. Предводители Олимпа открываются из кейсов.','Five free rulers are available immediately. Olympus rulers unlock from cases.')}</p><Link href="/packs#rulers">{t('Кейсы правителей →','Ruler cases →')}</Link><p><Link href="/arena?hero=builder">{t('Выбрать бесплатного','Choose a free ruler')}</Link></p></main>;
  const owned = collection.snapshot?.owned ?? freeCardCounts();
  const deck = playableDeck(props.heroId, owned, typeof window !== 'undefined' ? loadCustomDeck(props.heroId) : null);
  return <ArenaLab {...props} initialDeck={deck}/>;
}
