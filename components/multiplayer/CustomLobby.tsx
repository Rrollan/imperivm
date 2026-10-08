'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {useEffect, useState} from 'react';
import {HEROES} from '../../lib/heroes';
import {FREE_DECKS as DECKS} from '../../lib/collection/starterDecks';
import {loadCustomDeck, deckError} from '../../lib/deckbuilder';
import {useCollection} from '../CollectionContext';
import {freeCardCounts, needsCollection, deckCardCounts} from '../../lib/collection/access';
import type {Action} from '../../lib/engine/types';
import type {OnlineCommand} from '../../lib/multiplayer/types';
import type {GameIntent} from '../../lib/net/protocol';
import {useNetGame} from '../../lib/net/client';
import {normalizeRoomCode, validRoomCode} from '../../lib/net/roomCode';
import {useLocale} from '../LocaleContext';
import {SiteFooter, SiteHeader} from '../home/SiteChrome';
import {heroPortraitPath} from '../presentation/heroPortrait';
import {powerRules} from '../presentation/rulesText';
import {RomanIcon} from '../presentation/RomanIcon';
import {OnlineBoard} from './OnlineBoard';
import styles from './CustomLobby.module.css';

function actionIntent(action: Action): GameIntent {
  switch (action.type) {
    case 'play-minion': case 'cast-spell': return {type: 'playCard', cardId: action.uid};
    case 'attack': return {type: 'attack', cardId: action.attackerUid, targetId: action.target};
    case 'end-turn': return {type: 'endTurn'};
    case 'buy-card': return {type: 'buyCard'};
    case 'hero-power': return {type: 'heroPower'};
    case 'mulligan': return {type: 'mulligan', cardIds: action.uids};
    case 'stake': case 'unstake': return {type: action.type, cardId: action.uid};
  }
}
export function CustomLobby() {
  const params = useSearchParams(), invitedCode = normalizeRoomCode(params.get('code') || '');
  const {t, locale, heroName, heroTitle, powerName, errorText} = useLocale();
  const collection = useCollection();
  const [deckErrorText, setDeckErrorText] = useState(''), [checkingDeck, setCheckingDeck] = useState(false);
  const net = useNetGame({roomCode: invitedCode || undefined});
  const [hero, setHero] = useState(() => Object.hasOwn(HEROES, params.get('hero') || '') ? params.get('hero')! : 'builder');
  const [name, setName] = useState(''), [code, setCode] = useState(invitedCode), [tab, setTab] = useState<'create' | 'join'>(invitedCode ? 'join' : 'create');
  const [customDeck, setCustomDeck] = useState<string[] | null>(null), [deckSource, setDeckSource] = useState<'starter' | 'saved'>('starter');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null), [copyFailed, setCopyFailed] = useState(false);
  useEffect(() => {const deck = loadCustomDeck(hero); setCustomDeck(deck); setDeckSource('starter');}, [hero]);
  useEffect(() => {if (net.identity) {setName(net.identity.playerName); if (net.identity.heroId && Object.hasOwn(HEROES, net.identity.heroId)) setHero(net.identity.heroId);}}, [net.identity]);
  const busy = net.status === 'connecting' || net.status === 'reconnecting';
  const waiting = net.snapshot?.status === 'waiting', locked = busy || !!net.identity || !!net.snapshot;
  const savedProblem = customDeck ? deckError(customDeck, deckCardCounts(collection.snapshot?.owned ?? freeCardCounts())) : null;
  const localPaidDeck = customDeck && needsCollection(customDeck) && collection.snapshot?.mode !== 'idos';
  async function submit() {
    if (checkingDeck || (collection.busy && deckSource === 'saved')) return;
    const deckList = deckSource === 'saved' && customDeck ? customDeck : DECKS[hero];
    setCheckingDeck(true); setDeckErrorText('');
    try {const collectionAuth = await collection.authorizeDeck(deckList); const details = {playerName: name, heroId: hero, deckList, ...(collectionAuth ? {collectionAuth} : {})}; if (tab === 'create') net.create(details); else net.join(code, details);}
    catch (error) {setDeckErrorText(error instanceof Error ? error.message : t('Колода недоступна.', 'Deck unavailable.'));}
    finally {setCheckingDeck(false);}
  }
  const room = net.snapshot, roomCode = net.identity?.roomCode || room?.roomCode;
  const shareLink = roomCode && typeof window !== 'undefined' ? `${window.location.origin}/play?mode=friend&code=${roomCode}` : '';
  const copy = async (kind: 'code' | 'link') => {
    try {await navigator.clipboard.writeText(kind === 'code' ? roomCode || '' : shareLink); setCopied(kind); setCopyFailed(false);}
    catch {setCopied(null); setCopyFailed(true);}
  };
  const send = async (command: OnlineCommand): Promise<void> => {
    if (command.type === 'action') await net.sendIntent(actionIntent(command.action));
    else if (command.type === 'concede') await net.sendIntent({type: 'concede'});
    else if (command.type === 'cancel') await net.leave();
    else if (command.type === 'session') await net.sync();
  };
  if (room?.game) return <OnlineBoard room={room} pending={net.pending} connected={net.connected} error={net.error} send={send} refresh={net.sync} turnDuration={room.turnDuration} timeOffset={net.timeOffset} roomCode={room.roomCode} playerNames={room.names}/>;
  return <main className={styles.page}>
    <SiteHeader active="play"/>
    <section className={styles.lobby} aria-labelledby="custom-game-title">
      <div className={styles.intro}><Link href="/arena">← {t('Режимы игры', 'Game modes')}</Link><p className={styles.eyebrow}>{t('Зал сражений · бесплатно · 1 на 1', 'Hall of battles · free · 1 vs 1')}</p><h1 id="custom-game-title">{t('Своя игра', 'Custom game')}</h1><p>{t('Позовите друга за стол. На ход — 75 секунд, каждая карта подчиняется общим правилам.', 'Invite a friend to your table. Turns last 75 seconds, with the same rules for every card.')}</p></div>
      {locked ? <section className={styles.waiting} aria-live="polite">
        <div className={styles.waitingTitle}><RomanIcon name="standard"/><div><p className={styles.eyebrow}>{t('Ваш закрытый стол', 'Your private table')}</p><h2>{busy ? t('Переподключение…', 'Reconnecting…') : waiting ? t('Ждём второго игрока', 'Waiting for the second player') : t('Открываем комнату…', 'Opening the room…')}</h2></div></div>
        {roomCode && <><label className={styles.codeLabel} htmlFor="invite-code">{t('Код комнаты', 'Room code')}</label><div className={styles.roomCode}><input id="invite-code" readOnly value={roomCode} onFocus={event => event.currentTarget.select()}/><button type="button" className={styles.secondary} onClick={() => void copy('code')}>{copied === 'code' ? t('Скопирован', 'Copied') : t('Копировать код', 'Copy code')}</button></div><p>{t('Друг выбирает «С другом» и вводит этот код на своём устройстве. Бой начнётся, когда он подключится.', 'Your friend chooses “With a friend” and enters this code on their device. The battle starts when they join.')}</p><div className={styles.share}><input readOnly value={shareLink} aria-label={t('Ссылка на комнату', 'Room link')} onFocus={event => event.currentTarget.select()}/><button type="button" className={styles.secondary} onClick={() => void copy('link')}>{copied === 'link' ? t('Скопирована', 'Copied') : t('Копировать ссылку', 'Copy link')}</button></div>{copyFailed && <p role="status">{t('Выделите код или ссылку и скопируйте вручную.', 'Select the code or link and copy it manually.')}</p>}<div className={styles.seats}><span><b>{net.identity?.playerName || name}</b> · {heroName(net.identity?.heroId || hero)}</span><span>{t('Второе место свободно', 'Second seat is open')}</span></div></>}
        {net.error && <p className={styles.error} role="alert">{net.error}</p>}
        <button type="button" className={styles.secondary} onClick={() => void net.leave()}>{t('Закрыть комнату', 'Close room')}</button>
      </section> : <form onSubmit={event => {event.preventDefault(); void submit();}}>
        <div className={styles.tabs} aria-label={t('Создание или вход в комнату', 'Create or join a room')}><button type="button" aria-pressed={tab === 'create'} onClick={() => setTab('create')}>{t('Создать комнату', 'Create room')}</button><button type="button" aria-pressed={tab === 'join'} onClick={() => setTab('join')}>{t('Войти по коду', 'Join by code')}</button></div>
        <div className={styles.fields}><label>{t('Ваше имя за столом', 'Your name at the table')}<input autoComplete="nickname" name="playerName" required minLength={1} maxLength={32} value={name} onChange={event => setName(event.target.value)} placeholder={t('Например, Марк', 'For example, Marcus')}/><small>{t('Имя видно только сопернику.', 'Your opponent will see this name.')}</small></label>{tab === 'join' && <label>{t('Код комнаты', 'Room code')}<input name="roomCode" required minLength={6} maxLength={6} value={code} onChange={event => setCode(normalizeRoomCode(event.target.value).replace(/[^A-Z0-9]/g, ''))} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABC234" className={styles.codeInput}/><small>{t('6 букв и цифр из приглашения.', '6 letters and numbers from your invitation.')}</small></label>}</div>
        <div className={styles.sectionHeading}><h2>{t('Выберите правителя', 'Choose your ruler')}</h2><span>{t('У каждого своя сила и колода', 'Each has a power and a deck')}</span></div>
        <div className={styles.heroes}>{Object.keys(HEROES).map(id => <button type="button" key={id} className={styles.hero} aria-pressed={hero === id} onClick={() => setHero(id)}><img src={heroPortraitPath(id)} alt=""/><span><strong>{heroName(id)}</strong><small>{heroTitle(id)}</small></span></button>)}</div>
        <div className={styles.power}><RomanIcon name="laurel"/><div><strong>{powerName(hero)} · {HEROES[hero].powerCost} {t('приказа', 'orders')}</strong><p>{powerRules(hero, locale)} {t('Один раз за ход.', 'Once per turn.')}</p></div></div>
        <fieldset className={styles.deckChoice}><legend>{t('Колода для боя', 'Battle deck')}</legend><label><input type="radio" name="deck" checked={deckSource === 'starter'} onChange={() => setDeckSource('starter')}/><span><strong>{t('Стартовая колода', 'Starter deck')}</strong><small>{t('30 бесплатных карт — без покупок', '30 free cards — no purchases')}</small></span></label>{customDeck ? <label><input type="radio" name="deck" checked={deckSource === 'saved'} disabled={!!savedProblem || !!localPaidDeck} onChange={() => setDeckSource('saved')}/><span><strong>{t('Моя сохранённая колода', 'My saved deck')}</strong><small>{savedProblem ? t('Есть неполученные карты; измените колоду в коллекции.', 'Contains unowned cards; edit your collection deck.') : localPaidDeck ? t('Демо-карты: для PvP войдите в iDos.', 'Demo cards: sign in to iDos for PvP.') : t('30 карт из вашей коллекции', '30 cards from your collection')}</small></span></label> : <Link href={`/collection?hero=${hero}`}>{t('Собрать свою колоду', 'Build your own deck')} →</Link>}</fieldset>
        <div className={styles.launch}><button type="submit" className={styles.primary} disabled={net.pending || checkingDeck || (collection.busy && deckSource === 'saved') || (deckSource === 'saved' && (!!savedProblem || !!localPaidDeck)) || !name.trim() || (tab === 'join' && !validRoomCode(code))}>{checkingDeck ? t('Проверяем колоду…', 'Checking deck…') : tab === 'create' ? t('Создать стол для друга', 'Create a table for a friend') : t('Занять второе место', 'Join the table')}<RomanIcon name="gladius"/></button><p>{t('Бесплатный бой. Ставки и кошелёк не нужны.', 'Free match. No bets or wallet required.')}</p></div>
        {deckErrorText && <div className={styles.error} role="alert">{errorText(deckErrorText)}</div>}{net.error && <div className={styles.error} role="alert">{net.error}</div>}
      </form>}
      <div className={styles.otherModes}><Link href={`/arena-lab?hero=${hero}&opening=1`}>{t('Тренировка против ИИ', 'Training against AI')} →</Link><Link href={`/play?mode=random&hero=${hero}`}>{t('Случайный соперник', 'Random opponent')} →</Link></div>
    </section>
    <SiteFooter/>
  </main>;
}
