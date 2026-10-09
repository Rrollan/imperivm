'use client';
import Link from 'next/link';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useState} from 'react';
import {HEROES,isFreeHero} from '../../lib/heroes';
import {useCollection} from '../CollectionContext';
import {FREE_DECKS} from '../../lib/collection/starterDecks';
import {PaintedIcon} from '../PaintedIcon';
import {useLocale} from '../LocaleContext';
import {SiteHeader, SiteFooter} from '../home/SiteChrome';
import {heroPortraitPath} from '../presentation/heroPortrait';
import {powerRules} from '../presentation/rulesText';
import {RomanIcon} from '../presentation/RomanIcon';
import {useOnlineSession} from './useOnlineSession';
import {OnlineBoard} from './OnlineBoard';
import {CustomLobby} from './CustomLobby';
import styles from './Multiplayer.module.css';

const modeDefinitions = [
  {id: 'ai', icon: 'temple', title: 'С искусственным интеллектом', copy: 'Знакомьтесь с колодой и пробуйте связки в своём темпе.'},
  {id: 'friend', icon: 'standard', title: 'С другом', copy: 'Создайте закрытый стол и отправьте ссылку на второе место.'},
  {id: 'random', icon: 'gladius', title: 'Случайный соперник', copy: 'Встретьтесь с другим игроком, который сейчас ищет бой.'},
] as const;
export function PlayLobby() {
  const params = useSearchParams();
  return !params.get('room') && (params.get('mode') === 'friend' || params.has('code')) ? <CustomLobby/> : <MatchmakingLobby/>;
}
function MatchmakingLobby() {
  const {t, locale, heroName, heroTitle, powerName} = useLocale();
  const MODES = modeDefinitions.map((item, index) => ({...item, title: t(item.title, ['Against AI', 'With a friend', 'Random opponent'][index]), copy: t(item.copy, ['Learn your deck and try combos at your own pace.', 'Create a private table and invite a friend.', 'Meet another player who is looking for a match.'][index])}));
  const collection=useCollection();
  const [authorizing,setAuthorizing]=useState(false),[accessError,setAccessError]=useState('');
  async function launchOnline(){
    if(authorizing)return;setAuthorizing(true);setAccessError('');
    try{const collectionAuth=await collection.authorizeDeck(FREE_DECKS[hero],hero);
      const registration={heroId:hero,...(collectionAuth?{collectionAuth}:{})};
      await send(invite?{type:'join',roomId:invite,...registration}:mode==='friend'?{type:'create',...registration}:{type:'queue',...registration});
    }catch(cause){setAccessError(cause instanceof Error?cause.message:'Коллекция не подтверждена.');}
    finally{setAuthorizing(false);}
  }
  const params = useSearchParams(), invite = params.get('room'), router = useRouter();
  const initial = params.get('mode');
  const [mode, setMode] = useState<'ai' | 'friend' | 'random'>(invite ? 'friend' : initial === 'friend' || initial === 'random' ? initial : 'ai');
  const [hero, setHero] = useState(() => Object.hasOwn(HEROES, params.get('hero') || '') ? params.get('hero')! : 'builder');
  const {session, error, pending, connected, send, refresh} = useOnlineSession(true);
  const [now, setNow] = useState(() => Date.now()), [copied, setCopied] = useState(false);
  useEffect(() => {const id = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id);}, []);
  const room = session?.room, queued = session?.queue, locked = !!room || !!queued;
  useEffect(() => {if (room?.heroId || queued?.heroId) setHero(room?.heroId || queued!.heroId); if (room?.mode) setMode(room.mode); else if (queued) setMode('random');}, [room?.heroId, room?.mode, queued?.heroId]);
  const share = room ? `${typeof window === 'undefined' ? '' : window.location.origin}/play?mode=friend&room=${room.id}` : '';
  const copy = async () => {try {await navigator.clipboard.writeText(share); setCopied(true);} catch {setCopied(false);}};
  if (room?.game) return <OnlineBoard room={room} pending={pending} connected={connected} error={error} send={send} refresh={refresh}/>;
  return <main className={styles.page} data-lobby>
    <SiteHeader active="play" />
    <section className={styles.lobby}>
      <div className={styles.intro}><p className={styles.eyebrow}>{t('Зал сражений · все стартовые колоды доступны', 'Hall of battles · all starter decks available')}</p><h1>{invite ? t('Вас пригласили за стол', 'You have been invited') : t('Выберите своё сражение', 'Choose your battle')}</h1><p>{t('Одна колода. Один предводитель. Ваш следующий ход.', 'One deck. One ruler. Your next move.')}</p></div>
      <div className={styles.modeGrid} aria-label={t('Режим игры', 'Game mode')}>{MODES.map(item => <button key={item.id} className={styles.mode} data-active={mode === item.id} disabled={locked || !!invite} aria-pressed={mode === item.id} onClick={() => item.id === 'friend' ? router.push(`/play?mode=friend&hero=${hero}`) : setMode(item.id)}><RomanIcon name={item.icon}/><span><strong>{item.title}</strong><small>{item.copy}</small></span></button>)}</div>
      <div className={styles.sectionHeading}><h2>{t('Кто поведёт вашу колоду?', 'Who will lead your deck?')}</h2><span>{t('30 карт · без покупки паков', '30 cards · no packs required')}</span></div>
      <div className={styles.heroes}>{Object.keys(HEROES).map(id => <button key={id} className={styles.heroChoice} data-active={hero === id} disabled={locked||(!isFreeHero(id)&&!collection.snapshot?.heroes?.includes(id))} aria-pressed={hero === id} onClick={() => setHero(id)}><img src={heroPortraitPath(id)} alt=""/><span><strong>{heroName(id)}</strong><small>{heroTitle(id)}</small></span></button>)}</div>
      <div className={styles.power}><RomanIcon name="laurel"/><div><strong>{powerName(hero)}</strong><p>{powerRules(hero, locale)}{t(` Цена — ${HEROES[hero].powerCost} приказа, один раз за ход.`, ` Cost: ${HEROES[hero].powerCost} orders, once per turn.`)}</p></div><Link href="/library#rulers">{t('Правители и способности →', 'Rulers and abilities →')}</Link></div>
      <div className={styles.launch}>
        {room?.status === 'waiting' ? <><div role="status"><span className={styles.pulse}/>{t('Ваш стол открыт. Ждём друга.', 'Your table is open. Waiting for a friend.')}<small>{t('Приглашение действует ещё', 'Invite expires in')} {Math.min(10, Math.max(0, Math.ceil((room.expiresAt - now) / 60_000)))} {t('мин.', 'min.')}</small></div><div className={styles.invite}><input readOnly aria-label={t('Ссылка приглашения', 'Invitation link')} value={share} onFocus={e => e.target.select()}/><button disabled={pending} onClick={copy}>{copied ? t('Скопировано', 'Copied') : t('Копировать', 'Copy')}</button></div><p className={styles.note}>{t('Друг открывает ссылку в своём браузере. Для проверки вдвоём на одном устройстве используйте приватное окно.', 'Your friend opens this link in their browser. To test on one device, use a private window.')}</p><button className={styles.secondary} disabled={pending} onClick={() => void send({type: 'cancel'})}>{t('Закрыть стол', 'Close table')}</button></>
          : queued ? <><div role="status"><span className={styles.pulse}/>{t('Ищем другого игрока ', 'Looking for another player ')}<small>{t('В очереди', 'In queue')} {Math.max(0, Math.floor((now - queued.enteredAt) / 1000))} {t('сек. · До конца поиска', 'sec. · Search expires in')} {Math.min(5, Math.max(0, Math.ceil((queued.expiresAt - now) / 60_000)))} {t('мин.', 'min.')}</small></div><p>{t('Бой начнётся, когда другой игрок также нажмёт поиск. Оставьте эту страницу открытой.', 'The match starts when another player joins the queue. Keep this page open.')}</p><button className={styles.secondary} disabled={pending} onClick={() => void send({type: 'cancel'})}>{t('Отменить поиск', 'Cancel search')}</button></>
            : mode === 'ai' ? <><Link className={styles.primary} href={`/arena-lab?hero=${hero}&opening=1`}>{t('Начать тренировку ', 'Start training ')}<PaintedIcon name="play" size={32}/></Link><p className={styles.note}>{t('Стартовая рука с заменой карт. Соперник — искусственный интеллект.', 'Replace your opening cards. Your opponent is AI.')}</p></>
              : <><button className={styles.primary} disabled={pending || authorizing || !session || !connected||(!isFreeHero(hero)&&!collection.snapshot?.heroes?.includes(hero))} onClick={() => void launchOnline()}>{pending ? t('Подключаемся…', 'Connecting…') : invite ? t('Занять второе место', 'Join the table') : mode === 'friend' ? t('Создать стол для друга', 'Create a table') : t('Найти соперника', 'Find an opponent')}<PaintedIcon name="play" size={32}/></button><p className={styles.note}>{mode === 'random' ? t('Подбор по наличию свободного игрока. Рейтинга пока нет.', 'Matchmaking finds an available player. There is no ranking yet.') : t('В закрытом столе два места, без зрителей.', 'A private table has two seats, with no spectators.')}</p></>}
        {(error||accessError) && <div className={styles.error} role="alert">{error||accessError}<button className={styles.secondary} onClick={() => void refresh()}>{t('Обновить соединение', 'Reconnect')}</button></div>}
      </div>
    </section>
    <SiteFooter />
  </main>;
}
