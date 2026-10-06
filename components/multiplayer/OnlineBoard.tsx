'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {CARDS} from '../../lib/cards';
import {useLocale} from '../LocaleContext';
import {CardDialog} from '../home/CardDialog';
import type {Action, Minion} from '../../lib/engine/types';
import type {OnlineCommand, OnlinePlayer, OnlineRoom} from '../../lib/multiplayer/types';
import {ArenaCardPreview} from '../presentation/ArenaCardPreview';
import {heroPortraitPath} from '../presentation/heroPortrait';
import {RomanIcon} from '../presentation/RomanIcon';
import styles from './Multiplayer.module.css';
import {OnlineContact} from './OnlineContact';
import {useOnlineEffects} from './useOnlineEffects';

export function OnlineBoard({room, pending, connected, error, send, refresh}: {room: OnlineRoom; pending: boolean; connected: boolean; error: string;
  send: (command: OnlineCommand) => Promise<void>; refresh: () => Promise<void>}) {
  const {t, locale, setLocale, cardName, heroName, powerName} = useLocale();
  const router = useRouter();
  const game = room.game!, me = game.players[room.seat], foe = game.players[(1 - room.seat) as 0 | 1];
  const effects = useOnlineEffects(game, room.revision);
  const [attacker, setAttacker] = useState<string | null>(null), [inspect, setInspect] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]), [confirmConcede, setConfirmConcede] = useState(false), [now, setNow] = useState(Date.now());
  const active = game.turn === room.seat && game.winner === null && !pending && connected;
  const legal = (action: Action) => game.actions.some(a => JSON.stringify(a) === JSON.stringify(action));
  const act = (action: Action) => {setAttacker(null); return send({type: 'action', roomId: room.id, revision: room.revision, action});};
  useEffect(() => {setAttacker(null); setConfirmConcede(false); if (!game.mulliganOpen) setPicks([]);}, [room.revision, game.mulliganOpen]);
  useEffect(() => {const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);}, []);
  useEffect(() => {const cancel = (event: KeyboardEvent) => {if (event.key === 'Escape') setAttacker(null);}; window.addEventListener('keydown', cancel); return () => window.removeEventListener('keydown', cancel);}, []);
  const open = (id: string, element: HTMLElement) => {element.focus({preventScroll: true}); setInspect(id);};
  const close = () => setInspect(null);
  const fighter = (minion: Minion, own: boolean) => {
    const attacking = own && game.actions.some(a => a.type === 'attack' && a.attackerUid === minion.uid);
    const target = !own && !!attacker && legal({type: 'attack', attackerUid: attacker, target: minion.uid});
    return <article key={minion.uid} className={styles.fighter} data-selected={attacker === minion.uid} data-target={target} data-ready={attacking}>
      <button className={styles.card} disabled={pending || !connected || (!attacking && !target)} aria-label={target ? `${t('Атаковать', 'Attack')} ${cardName(minion.cardId)}` : attacking ? `${t('Выбрать для атаки:', 'Choose attacker:')} ${cardName(minion.cardId)}` : cardName(minion.cardId)} onClick={() => target ? void act({type: 'attack', attackerUid: attacker!, target: minion.uid}) : setAttacker(attacker === minion.uid ? null : minion.uid)}>
        <ArenaCardPreview id={minion.cardId} locale={locale} label={cardName(minion.cardId)} stats={{attack: minion.attack, health: minion.health}}/>
      </button>
      {effects[minion.uid] && <OnlineContact key={effects[minion.uid].key} effect={effects[minion.uid]}/>}
      <p className={styles.fighterState}>{minion.staked ? t('В стейкинге', 'Staked') : minion.canAttack ? t('Готов к атаке', 'Ready to attack') : t('Отдыхает', 'Resting')}{minion.taunt ? t(' · Провокация', ' · Taunt') : ''}</p>
      <div className={styles.cardTools}><button onClick={e => open(minion.cardId, e.currentTarget)} aria-label={`${t('Способности:', 'Abilities:')} ${cardName(minion.cardId)}`}><RomanIcon name="scroll"/></button>{own && <button disabled={!active || !legal({type: minion.staked ? 'unstake' : 'stake', uid: minion.uid})} onClick={() => void act({type: minion.staked ? 'unstake' : 'stake', uid: minion.uid})}>{minion.staked ? t('Вернуть', 'Unstake') : t('Стейкинг', 'Stake')}</button>}</div>
    </article>;
  };
  const ruler = (player: OnlinePlayer, own: boolean) => <div className={styles.ruler}>
    <button className={styles.medallion} data-target={!own && !!attacker && legal({type: 'attack', attackerUid: attacker, target: 'hero'})} disabled={own || !attacker || !active || !legal({type: 'attack', attackerUid: attacker!, target: 'hero'})} onClick={() => void act({type: 'attack', attackerUid: attacker!, target: 'hero'})} aria-label={`${t('Атаковать казну:', 'Attack treasury:')} ${heroName(player.heroId)}`}><img src={heroPortraitPath(player.heroId)} alt=""/><b>{player.treasury}</b></button>{effects[`hero-${player.id}`] && <OnlineContact key={effects[`hero-${player.id}`].key} effect={effects[`hero-${player.id}`]}/>}
    <div><strong>{heroName(player.heroId)}</strong><small>{own ? t('Ваша казна', 'Your treasury') : t('Казна противника', 'Enemy treasury')} · {player.treasury} / 30</small><span>{t('Приказы', 'Orders')} <b>{player.gas}</b> / {player.maxGas} · {t('Колода', 'Deck')} {player.deckCount} · {t('Рука', 'Hand')} {player.handCount}</span></div>
  </div>;
  const seconds = Math.min(90, Math.max(0, Math.ceil((game.turnDeadline - now) / 1000)));
  const result = game.winner === 'draw' ? t('Ничья', 'Draw') : game.winner === room.seat ? t('Победа', 'Victory') : t('Поражение', 'Defeat');
  return <main className={styles.page}>
    <header className={styles.header}><Link className={styles.wordmark} href="/">IMPERIVM</Link><span>{room.mode === 'friend' ? t('Закрытый стол', 'Private table') : t('Случайный соперник', 'Random opponent')} · PvP</span><span className={styles.connection} data-online={connected}>{connected ? room.opponentPresent ? t('Оба игрока на связи', 'Both players connected') : t('Соперник переподключается', 'Opponent reconnecting') : t('Переподключение…', 'Reconnecting…')}</span><button className={styles.quiet} aria-label={t('Переключить язык на английский', 'Switch language to Russian')} onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}>{locale === 'ru' ? 'EN' : 'RU'}</button></header>
    <section className={styles.battle} aria-label={t('Онлайн-сражение', 'Online battle')}>
      <div className={styles.battleHead}>{ruler(foe, false)}<div className={styles.turnClock} role="status"><strong>{game.winner !== null ? result : active ? game.mulliganOpen ? t('Выберите стартовую руку', 'Choose your opening hand') : t('Ваш ход', 'Your turn') : t('Ход противника', 'Opponent’s turn')}</strong><span>{t('Блок', 'Turn')} {game.block}{game.winner === null ? ` · ${seconds} ${t('сек.', 'sec.')}` : ''}</span></div></div>
      <div className={styles.edicts} aria-label={t('Указы противника', 'Enemy edicts')}>{foe.edicts.length ? foe.edicts.map(e => <button key={e.uid} onClick={event => open(e.cardId, event.currentTarget)}><RomanIcon name="scroll"/>{cardName(e.cardId)}<small>{t('В начале хода противника', 'At the start of their turn')}</small></button>) : <span>{t('У противника нет ожидающих указов', 'Enemy edict queue is empty')}</span>}</div>
      <div className={styles.boardRow} aria-label={t('Поле противника', 'Enemy field')}>{foe.board.length ? foe.board.map(m => fighter(m, false)) : <span className={styles.emptyCourt}>{t('Поле противника свободно', 'Enemy field is empty')}</span>}</div>
      <div className={styles.courtLine}><span>{attacker ? t('Выберите подсвеченного бойца или казну противника.', 'Choose a highlighted enemy fighter or treasury.') : game.mulliganOpen ? t('Отметьте карты для замены или оставьте все.', 'Select cards to replace, or keep them all.') : active ? t('Разыграйте карту, примените силу или выберите бойца для атаки.', 'Play a card, use your power, or choose an attacker.') : t('Действия соперника появятся на поле.', 'Your opponent’s moves will appear on the board.')}</span>{attacker && <button onClick={() => setAttacker(null)}>{t('Отмена атаки', 'Cancel attack')}</button>}</div>
      <div className={styles.boardRow} aria-label={t('Ваше поле', 'Your field')}>{me.board.length ? me.board.map(m => fighter(m, true)) : <span className={styles.emptyCourt}>{t('Здесь появятся ваши бойцы', 'Your fighters appear here')}</span>}</div>
      <div className={styles.edicts} aria-label={t('Ваши указы', 'Your edicts')}>{me.edicts.length ? me.edicts.map(e => <button key={e.uid} onClick={event => open(e.cardId, event.currentTarget)}><RomanIcon name="scroll"/>{cardName(e.cardId)}<small>{t('В начале вашего следующего хода', 'At the start of your next turn')}</small></button>) : <span>{t('Ваши ожидающие указы', 'Your pending edicts')}</span>}</div>
      <div className={styles.battleControls}>{ruler(me, true)}<div className={styles.actions}>
        {game.mulliganOpen ? <button className={styles.primary} disabled={!active} onClick={() => void act({type: 'mulligan', uids: picks})}>{picks.length ? t(`Заменить карты (${picks.length})`, `Replace cards (${picks.length})`) : t('Оставить все карты', 'Keep all cards')}</button> : <><button className={styles.secondary} disabled={!active || !legal({type: 'hero-power'})} onClick={() => void act({type: 'hero-power'})}>{powerName(me.heroId)} · {me.powerCost} {t('приказа', 'orders')}</button><button className={styles.primary} disabled={!active || !legal({type: 'end-turn'})} onClick={() => void act({type: 'end-turn'})}>{t('Конец хода ', 'End turn ')}<RomanIcon name="hourglass"/></button></>}
      </div></div>
      <div className={styles.hand} aria-label={t('Ваша рука', 'Your hand')}>{(me.hand || []).map(h => {
        const card = CARDS[h.cardId], action: Action = {type: card.type === 'minion' ? 'play-minion' : 'cast-spell', uid: h.uid};
        return <article key={h.uid} className={styles.handCard} data-selected={picks.includes(h.uid)} data-ready={!game.mulliganOpen && legal(action)}><button className={styles.card} disabled={!active || (!game.mulliganOpen && !legal(action))} aria-label={game.mulliganOpen ? `${t('Заменить:', 'Replace:')} ${cardName(h.cardId)}` : `${t('Разыграть:', 'Play:')} ${cardName(h.cardId)}`} aria-pressed={game.mulliganOpen ? picks.includes(h.uid) : undefined} onClick={() => game.mulliganOpen ? setPicks(picks.includes(h.uid) ? picks.filter(uid => uid !== h.uid) : [...picks, h.uid]) : void act(action)}><ArenaCardPreview id={h.cardId} locale={locale} label={cardName(h.cardId)}/></button><button className={styles.inspectButton} onClick={e => open(h.cardId, e.currentTarget)}>{t('Способности ', 'Abilities ')}<RomanIcon name="scroll"/></button></article>;
      })}</div>
      {error && <div className={styles.error} role="alert">{error}<button className={styles.secondary} onClick={() => void refresh()}>{t('Обновить состояние', 'Refresh state')}</button></div>}
      {!room.opponentPresent && game.winner === null && room.disconnectDeadline && <p role="status" className={styles.note}>{t('Ждём возвращения соперника: ещё', 'Waiting for your opponent:')} {Math.max(0, Math.ceil((room.disconnectDeadline - now) / 1000))} {t('сек.', 'sec.')}</p>}
      <footer className={styles.battleFooter}><details><summary>{t('История боя', 'Battle history')}</summary><ol>{room.history.map(e => <li key={e.revision}>{locale === 'en' ? e.textEn ?? e.text : e.text}</li>)}</ol></details>{game.winner !== null ? <div><strong className={styles.result}>{result}</strong><button className={styles.primary} disabled={pending} onClick={() => void send({type: 'cancel'}).then(() => router.replace(`/play?mode=${room.mode}&hero=${me.heroId}`))}>{t('Вернуться в зал', 'Back to the hall')}</button></div> : confirmConcede ? <div><span>{t('Подтвердить поражение?', 'Confirm concession?')}</span><button className={styles.secondary} disabled={pending} onClick={() => void send({type: 'concede', roomId: room.id, revision: room.revision})}>{t('Сдаться', 'Concede')}</button><button className={styles.secondary} onClick={() => setConfirmConcede(false)}>{t('Продолжить бой', 'Continue playing')}</button></div> : <button className={styles.quiet} onClick={() => setConfirmConcede(true)}>{t('Сдаться', 'Concede')}</button>}</footer>
    </section>
    {inspect && <CardDialog id={inspect} onClose={close} />}
  </main>;
}
