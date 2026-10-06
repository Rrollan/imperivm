'use client';

import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useMemo, useRef, useState, type RefObject} from 'react';
import {CARDS} from '../../lib/cards';
import {cardArtPath} from '../../lib/cardArt';
import {isInstantSpell} from '../../lib/engine/spellTiming';
import type {Action, GameState, HandCard, MempoolEntry, PlayerState} from '../../lib/engine/types';
import type {BattleEvents} from '../../lib/events';
import type {OnlineCommand, OnlineGame, OnlineRoom} from '../../lib/multiplayer/types';
import {useReducedMotion} from '../../lib/prefersReducedMotion';
import {isMuted, onMuteChange, setMuted, unlockAudio} from '../../lib/audio/manager';
import {emitSfxFromEvents} from '../../lib/audio/events';
import {useLocale} from '../LocaleContext';
import type {ArenaRenderer, ArenaTarget} from '../presentation/createArena';
import type {PresentationBatch} from '../presentation/GameSession';
import type {RenderQuality} from '../presentation/renderQuality';
import {ArenaInspection} from '../presentation/ArenaInspection';
import {ArenaCardPreview} from '../presentation/ArenaCardPreview';
import {OpeningHand} from '../presentation/OpeningHand';
import {RomanIcon} from '../presentation/RomanIcon';
import {heroPortraitPath} from '../presentation/heroPortrait';
import {cardKeywords, cardRules, powerRules} from '../presentation/rulesText';
import {rankName, roleName} from '../presentation/cardIdentity';
import {fighterReadiness, readinessText, unavailableCardText} from '../presentation/battleReadability';
import arenaStyles from '../presentation/ArenaLab.module.css';
import styles from './Multiplayer.module.css';

/** A drawing adapter, never an engine session. The local player always faces the camera.
 * Decks expose only their length. Hidden hand entries are inert card backs, excluded
 * from the renderer's optional legality hints: no opponent card identity is invented. */
type ArenaView = GameState & {
  players: [PlayerState & {mempool: MempoolEntry[]}, PlayerState & {mempool: MempoolEntry[]}];
  enableMulligan: boolean;
  mulliganPhase: [boolean, boolean];
  mulliganCount: [number, number];
};
function arenaView(game: OnlineGame, seat: 0 | 1): ArenaView {
  const player = (owner: 0 | 1) => {
    const source = game.players[owner === 0 ? seat : (1 - seat) as 0 | 1];
    const hand = owner === 0 ? [...(source.hand ?? [])] : Array.from({length: source.handCount}, (_, i) => ({uid: `hidden-${i}`, cardId: ''}));
    if (owner === 1) Object.defineProperty(hand, Symbol.iterator, {value: function* (): Generator<HandCard> {}});
    return {id: owner, heroId: source.heroId, treasury: source.treasury,
      gas: source.gas, maxGas: source.maxGas, heroPowerUsed: source.heroPowerUsed, fatigue: source.fatigue,
      deck: Array<string>(source.deckCount).fill(''), hand, board: source.board.map(m => ({...m})),
      mempool: source.edicts.map(e => ({...e, owner}))};
  };
  return {block: game.block, turn: game.turn === seat ? 0 : 1,
    winner: game.winner === null || game.winner === 'draw' ? game.winner : game.winner === seat ? 0 : 1,
    players: [player(0), player(1)], log: [], rng: 0,
    enableMulligan: game.mulliganOpen, mulliganPhase: [game.mulliganOpen, false],
    mulliganCount: [game.players[seat].handCount, game.players[(1 - seat) as 0 | 1].handCount]};
}

/** Animate public changes only after the server confirms a revision. Missing private
 * spell identities/targets are left unknown; they never influence gameplay or effects. */
function publicPresentation(before: ArenaView, after: ArenaView, revision: number, requested?: Action): PresentationBatch {
  let action: Action = requested ?? {type: 'end-turn'};
  const events: BattleEvents = {};
  const owner = before.turn, opponent = (1 - owner) as 0 | 1;
  const previous = before.players[owner], next = after.players[owner];
  const added = next.board.filter(m => !previous.board.some(old => old.uid === m.uid));
  const queued = next.mempool.filter(e => !previous.mempool.some(old => old.uid === e.uid));
  if (!requested && before.block === after.block) {
    if (added.length === 1 || queued.length === 1) {
      const revealed = added[0] ?? queued[0];
      const removed = previous.hand.find(h => h.cardId === revealed.cardId && !next.hand.some(n => n.uid === h.uid));
      const uid = removed?.uid ?? `revealed-${revealed.uid}`;
      // This temporary face is already public on the board/queue, not a hidden hand.
      if (!removed) {
        const hand = previous.hand.slice();
        hand[Math.max(0, hand.length - 1)] = {uid, cardId: revealed.cardId};
        Object.defineProperty(hand, Symbol.iterator, {value: function* () {yield* hand.filter(h => h.cardId);}});
        before = {...before, players: [...before.players] as ArenaView['players']};
        before.players[owner] = {...previous, hand};
      }
      action = {type: added.length ? 'play-minion' : 'cast-spell', uid};
    } else {
      const spent = previous.board.filter(m => m.canAttack && !m.staked && next.board.some(n => n.uid === m.uid && !n.canAttack && !n.staked));
      const targets = before.players[opponent].board.filter(m => (after.players[opponent].board.find(n => n.uid === m.uid)?.health ?? 0) < m.health).map(m => m.uid);
      if (after.players[opponent].treasury < before.players[opponent].treasury) targets.push('hero');
      if (spent.length === 1 && targets.length === 1) action = {type: 'attack', attackerUid: spent[0].uid, target: targets[0]};
      else if (!previous.heroPowerUsed && next.heroPowerUsed) action = {type: 'hero-power'};
    }
  }
  for (const pid of [0, 1] as const) {
    const old = before.players[pid], current = after.players[pid];
    if (old.treasury !== current.treasury) (events.damages ??= []).push({uid: `hero-${pid}`, name: old.heroId, prevHealth: old.treasury, health: current.treasury, maxHealth: 30, died: current.treasury <= 0});
    for (const fighter of old.board) {
      const survivor = current.board.find(m => m.uid === fighter.uid);
      if (!survivor) (events.deaths ??= []).push({uid: fighter.uid, name: fighter.name, owner: pid, byRugi: false, cause: 'unknown'});
      if (survivor && fighter.health !== survivor.health || !survivor && action.type === 'attack' && (action.attackerUid === fighter.uid || action.target === fighter.uid)) (events.damages ??= []).push({uid: fighter.uid, name: fighter.name, prevHealth: fighter.health, health: survivor?.health ?? 0, maxHealth: survivor?.maxHealth ?? fighter.maxHealth, died: !survivor});
      if (survivor && survivor.attack !== fighter.attack) (events.statChanges ??= []).push({uid: fighter.uid, owner: pid, attackBefore: fighter.attack, attackAfter: survivor.attack});
    }
    for (const edict of current.mempool) if (!old.mempool.some(e => e.uid === edict.uid)) events.spellQueued = {owner: pid, cardId: edict.cardId, name: edict.name, mempoolUid: edict.uid};
  }
  if (action.type === 'play-minion' || action.type === 'cast-spell') {
    const card = before.players[owner].hand.find(h => h.uid === action.uid);
    if (card && action.type === 'play-minion') events.play = {cardId: card.cardId, name: CARDS[card.cardId].name, fromHandUid: card.uid};
    if (card && action.type === 'cast-spell' && isInstantSpell(CARDS[card.cardId])) events.spellImmediate = {owner, cardId: card.cardId, name: CARDS[card.cardId].name, fromHandUid: card.uid};
  }
  if (action.type === 'attack') {
    const attacker = previous.board.find(m => m.uid === action.attackerUid);
    const oldTarget = before.players[opponent].board.find(m => m.uid === action.target);
    const newTarget = after.players[opponent].board.find(m => m.uid === action.target);
    if (attacker) events.attack = {attackerUid: attacker.uid, attackerName: attacker.name, attackerOwner: owner,
      targetUid: action.target, targetOwner: opponent, targetName: oldTarget?.name ?? 'Treasury',
      damage: Math.max(0, action.target === 'hero' ? before.players[opponent].treasury - after.players[opponent].treasury : (oldTarget?.health ?? 0) - (newTarget?.health ?? 0)),
      attackerFatal: !next.board.some(m => m.uid === attacker.uid)};
  }
  if (after.winner !== null) events.gameOver = {winner: after.winner, perspective: after.winner === 'draw' ? 'draw' : after.winner === 0 ? 'me' : 'foe'};
  return {id: revision, revision, before, after, action, events};
}

function usePanelFocus(open: boolean, panel: RefObject<HTMLElement>) {
  useEffect(() => {
    const node = panel.current;
    if (!open || !node) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const items = () => Array.from(node.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],summary,[tabindex="0"]'));
    items()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = items(), first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first?.focus();}
    };
    node.addEventListener('keydown', trap);
    return () => {node.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus();};
  }, [open, panel]);
}

export function OnlineBoard({room, pending, connected, error, send, refresh, turnDuration = 75, timeOffset = 0, roomCode, playerNames}: {
  room: OnlineRoom; pending: boolean; connected: boolean; error: string;
  send: (command: OnlineCommand) => Promise<void>; refresh: () => Promise<void>;
  turnDuration?: number; timeOffset?: number; roomCode?: string; playerNames?: [string, string | null];
}) {
  const {t, locale, setLocale, cardName, heroName, powerName} = useLocale(), router = useRouter(), reduced = useReducedMotion();
  const game = room.game!, me = game.players[room.seat], foe = game.players[(1 - room.seat) as 0 | 1];
  const view = useMemo(() => arenaView(game, room.seat), [game, room.seat]);
  const canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<ArenaRenderer | null>(null);
  const currentView = useRef(view); currentView.current = view;
  const previous = useRef({view, revision: room.revision}), requested = useRef<{revision: number; action: Action} | null>(null);
  const [ready, setReady] = useState(false), [failure, setFailure] = useState(''), [animating, setAnimating] = useState(false);
  const [selected, setSelected] = useState<string | null>(null), selection = useRef<string | null>(null);
  const [inspect, setInspect] = useState<ArenaTarget | null>(null), [help, setHelp] = useState(false), [history, setHistory] = useState(false), [keyboard, setKeyboard] = useState(false);
  const [picks, setPicks] = useState<string[]>([]), [concede, setConcede] = useState(false), [now, setNow] = useState(Date.now());
  const [muted, updateMuted] = useState(true), [quality, setQuality] = useState<RenderQuality>('auto');
  const helpPanel = useRef<HTMLElement>(null), historyPanel = useRef<HTMLElement>(null), actionPanel = useRef<HTMLElement>(null), openingPanel = useRef<HTMLElement>(null), resultPanel = useRef<HTMLElement>(null);
  const showOpening = ready && game.mulliganOpen && game.turn === room.seat && game.winner === null;
  const active = connected && !pending && !animating && game.turn === room.seat && game.winner === null;
  const actions = active ? game.actions : [];
  const callbacks = useRef({pick: (_target: ArenaTarget) => {}, play: (_uid: string) => {}, attack: (_uid: string, _target: string) => {}});
  const select = useCallback((uid: string | null) => {selection.current = uid; setSelected(uid); renderer.current?.select(uid);}, []);
  const act = (action: Action) => {
    // The server's allowlist, never the canvas's visual hints, gates every intent.
    if (!active || !game.actions.some(a => JSON.stringify(a) === JSON.stringify(action))) return;
    requested.current = {revision: room.revision, action}; select(null); setInspect(null); setKeyboard(false);
    void unlockAudio(); void send({type: 'action', roomId: room.id, revision: room.revision, action});
  };
  const play = (uid: string) => {const action = actions.find(a => (a.type === 'play-minion' || a.type === 'cast-spell') && a.uid === uid); if (action) act(action);};
  const attack = (uid: string, target: string) => {const action = actions.find(a => a.type === 'attack' && a.attackerUid === uid && a.target === target); if (action) act(action);};
  callbacks.current = {play, attack, pick: target => {
    if (target.kind === 'command' || target.kind === 'power') {
      const action = actions.find(a => a.type === (target.kind === 'command' ? 'end-turn' : 'hero-power'));
      if (action) act(action); else if (target.kind === 'power') setInspect({kind: 'hero', uid: 'hero-0', owner: 0});
      return;
    }
    if (target.owner === 1 && selection.current && (target.kind === 'minion' || target.kind === 'hero')) {
      attack(selection.current, target.kind === 'hero' ? 'hero' : target.uid); return;
    }
    if (target.kind === 'minion' && target.owner === 0 && actions.some(a => a.type === 'attack' && a.attackerUid === target.uid) && selection.current !== target.uid) {select(target.uid); setInspect(null); return;}
    select(null); setInspect(target);
  }};
  useEffect(() => {
    let cancelled = false;
    if (!canvas.current) return;
    const element = canvas.current;
    void import('../presentation/createArena').then(({createArena}) => {
      if (cancelled) return;
      try {
        const arena = createArena(element, {locale, reducedMotion: reduced,
          onPick: target => callbacks.current.pick(target), onHover: () => {},
          onPlay: uid => callbacks.current.play(uid), onAttack: (uid, target) => callbacks.current.attack(uid, target),
          onMetrics: () => {}, onFailure: setFailure, onReady: () => {if (!cancelled) setReady(true);}});
        renderer.current = arena; arena.sync(currentView.current);
      } catch {setFailure('webgl');}
    }).catch(() => {if (!cancelled) setFailure('load');});
    return () => {cancelled = true; renderer.current?.dispose(); renderer.current = null;};
    // Exactly the offline renderer; changing a snapshot never recreates the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const old = previous.current; previous.current = {view, revision: room.revision};
    select(null); setConcede(false); if (!game.mulliganOpen) setPicks([]);
    if (game.winner !== null) {setInspect(null); setHelp(false); setHistory(false); setKeyboard(false);}
    const arena = renderer.current;
    if (!arena) return;
    arena.cancel();
    if (old.revision + 1 !== room.revision || !connected || !ready) {arena.sync(view); setAnimating(false); requested.current = null; return;}
    const intent = requested.current?.revision === old.revision ? requested.current.action : undefined;
    requested.current = null;
    const batch = publicPresentation(old.view, view, room.revision, intent);
    arena.sync(batch.before); setAnimating(true);
    void arena.present(batch, () => emitSfxFromEvents(batch.events ?? {}, batch)).catch(() => {
      if (previous.current.revision === batch.revision) {arena.cancel(); arena.sync(view); setFailure('presentation');}
    }).finally(() => {if (previous.current.revision === batch.revision) setAnimating(false);});
    // Only authoritative revisions trigger presentation; reconnects resync immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.revision, connected, ready]);
  useEffect(() => {renderer.current?.setLocale(locale);}, [locale, ready]);
  useEffect(() => {renderer.current?.setReducedMotion(reduced);}, [reduced, ready]);
  useEffect(() => {renderer.current?.setQuality(quality);}, [quality, ready]);
  useEffect(() => {renderer.current?.setOverlayOpen(help || history || keyboard || inspect !== null || showOpening || game.winner !== null || !connected || pending);}, [help, history, keyboard, inspect, showOpening, game.winner, connected, pending, ready]);
  useEffect(() => {const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer);}, []);
  useEffect(() => {updateMuted(isMuted()); return onMuteChange(updateMuted);}, []);
  useEffect(() => {try {const saved = localStorage.getItem('imperivm-arena-quality'); if (saved === 'auto' || saved === 'sharp' || saved === 'fast') setQuality(saved);} catch {}}, []);
  useEffect(() => {if (error) requested.current = null;}, [error]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape' && !event.defaultPrevented) {select(null); setInspect(null); setHelp(false); setHistory(false); setKeyboard(false); setConcede(false);}};
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [select]);
  usePanelFocus(help, helpPanel); usePanelFocus(history, historyPanel); usePanelFocus(keyboard, actionPanel); usePanelFocus(showOpening, openingPanel); usePanelFocus(game.winner !== null && !animating, resultPanel);
  const seconds = Math.min(turnDuration, Math.max(0, Math.ceil((game.turnDeadline - now - timeOffset) / 1000)));
  const result = game.winner === 'draw' ? t('Ничья', 'Draw') : game.winner === room.seat ? t('Победа', 'Victory') : t('Поражение', 'Defeat');
  const status = !connected ? t('Переподключение…', 'Reconnecting…') : pending ? t('Отправка…', 'Sending…') : game.winner !== null ? result : game.turn === room.seat ? t('Ваш ход', 'Your turn') : t('Ход соперника', 'Opponent’s turn');
  const close = () => {setInspect(null); select(null);};
  const unavailable = (cardId: string) => !connected ? t('Переподключение…', 'Reconnecting…') : unavailableCardText(view, cardId, locale, pending || animating);
  const card = inspect?.cardId ? CARDS[inspect.cardId] : undefined;
  const minion = inspect?.kind === 'minion' ? view.players[inspect.owner].board.find(m => m.uid === inspect.uid) : undefined;
  const playAction = actions.find(a => (a.type === 'play-minion' || a.type === 'cast-spell') && a.uid === inspect?.uid);
  const stakeAction = actions.find(a => (a.type === 'stake' || a.type === 'unstake') && a.uid === inspect?.uid);
  const attackAction = actions.find(a => a.type === 'attack' && a.attackerUid === inspect?.uid);
  const powerAction = actions.find(a => a.type === 'hero-power');
  const inspectedHero = inspect?.kind === 'hero' ? game.players[inspect.owner === 0 ? room.seat : (1 - room.seat) as 0 | 1] : undefined;
  const inspectionProps = {closeLabel: t('Закрыть просмотр', 'Close inspection'), backLabel: t('Назад к очереди', 'Back to queue'), reduced, onClose: close};
  const actionLabel = (action: Action) => {
    if (action.type === 'end-turn') return t('Завершить ход', 'End turn');
    if (action.type === 'hero-power') return powerName(me.heroId);
    if (action.type === 'mulligan') return action.uids.length ? t('Заменить выбранные карты', 'Replace selected cards') : t('Оставить все', 'Keep all');
    if (action.type === 'attack') {const attacker = me.board.find(m => m.uid === action.attackerUid), target = foe.board.find(m => m.uid === action.target); return `${attacker ? cardName(attacker.cardId) : ''} → ${action.target === 'hero' ? heroName(foe.heroId) : target ? cardName(target.cardId) : ''}`;}
    const source = [...(me.hand ?? []), ...me.board].find(c => c.uid === action.uid);
    return `${action.type === 'stake' ? t('Гарнизон', 'Garrison') : action.type === 'unstake' ? t('Вернуть в бой', 'Return to battle') : t('Разыграть', 'Play')} ${source ? cardName(source.cardId) : ''}`;
  };
  const leave = () => void send({type: 'cancel'}).then(() => router.replace(`/play?mode=${room.mode}&hero=${me.heroId}`));

  return <main className={arenaStyles.shell}>
    <canvas ref={canvas} className={arenaStyles.canvas} aria-label={t('Онлайн-арена IMPERIVM. Управление с клавиатуры доступно в меню игры.', 'IMPERIVM online arena. Keyboard controls are available in the game menu.')}/>
    <div className={styles.netHud} data-online={connected}><span>{roomCode || 'PvP'}</span><strong role="status">{status}</strong>{game.winner === null && <span className={styles.netClock} data-urgent={seconds <= 15} aria-label={`${seconds} ${t('секунд до конца хода', 'seconds until turn end')}`}><RomanIcon name="hourglass"/>{seconds}</span>}</div>
    <header className={arenaStyles.header}><button className={arenaStyles.settingsButton} onClick={() => {select(null); setInspect(null); setHelp(true);}} aria-label={t('Меню игры', 'Game menu')}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6l1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2z"/><circle cx="16" cy="17" r="5"/></svg></button></header>
    {!ready && !failure && <div className={arenaStyles.loading} role="status"><div>IV</div><p>{t('Открываем врата арены…', 'Opening the arena gates…')}</p></div>}
    {showOpening && <div className={arenaStyles.modalBackdrop}><section ref={openingPanel} className={arenaStyles.mulligan} role="dialog" aria-modal="true" aria-labelledby="opening-hand-title"><fieldset className={styles.netOpening} disabled={!active}><OpeningHand hand={me.hand ?? []} selected={picks} locale={locale} onToggle={uid => setPicks(old => old.includes(uid) ? old.filter(p => p !== uid) : [...old, uid])} onConfirm={() => act({type: 'mulligan', uids: (me.hand ?? []).filter(h => picks.includes(h.uid)).map(h => h.uid)})}/></fieldset></section></div>}
    {(error || failure || !connected || !room.opponentPresent) && <div className={arenaStyles.error} role="alert">
      {error || (failure ? t('Не удалось отрисовать арену. Обновите страницу для восстановления графики.', 'Could not render the arena. Reload to restore graphics.') : !connected ? t('Переподключение… Действия временно недоступны.', 'Reconnecting… Actions are temporarily unavailable.') : <>{t('Ждём возвращения соперника.', 'Waiting for your opponent to reconnect.')}{room.disconnectDeadline !== null && <> {Math.max(0, Math.ceil((room.disconnectDeadline - now - timeOffset) / 1000))} {t('сек.', 'sec.')}</>}</>)}
      {(error || failure) && <button onClick={() => {if (failure) window.location.reload(); else void refresh();}} aria-label={t('Обновить состояние', 'Refresh state')}><RomanIcon name="scroll"/></button>}
    </div>}
    {inspect && card && <ArenaInspection key={`${inspect.kind}:${inspect.uid}`} {...inspectionProps} title={cardName(card.id)} eyebrow={roleName(card.id, locale)} kind="card"
      visual={<ArenaCardPreview id={card.id} locale={locale} interactive reduced={reduced} label={`${cardName(card.id)}. ${t('Приказы', 'Orders')}: ${card.cost}${card.type === 'minion' ? `. ${t('Атака', 'Attack')}: ${minion?.attack ?? card.attack}. ${t('Здоровье', 'Health')}: ${minion?.health ?? card.health}` : ''}`} stats={minion ? {attack: minion.attack, health: minion.health} : undefined}/>}
      onBack={inspect.kind === 'queue' ? () => setInspect({kind: 'scroll', uid: 'arena-scroll', owner: 0}) : undefined}
      actions={inspect.owner === 0 && (inspect.kind === 'hand' || stakeAction || attackAction) ? <>
        {inspect.kind === 'hand' && <button className={arenaStyles.primary} disabled={!playAction} onClick={() => {if (playAction) act(playAction);}}>{playAction ? <><span className={arenaStyles.costChip}>{card.cost}</span>{isInstantSpell(card) ? t('Применить сейчас', 'Cast now') : t('Разыграть', 'Play')}</> : unavailable(card.id)}</button>}
        {attackAction && <button className={arenaStyles.primary} onClick={() => {select(inspect.uid); setInspect(null);}}>{t('Атаковать', 'Attack')}</button>}
        {stakeAction && <button onClick={() => act(stakeAction)}>{stakeAction.type === 'stake' ? t('Гарнизон · +1 приказ', 'Garrison · +1 order') : t('Вернуть в бой', 'Return to battle')}</button>}
      </> : undefined}>
      {minion && <p className={arenaStyles.fighterStatus}>{readinessText(fighterReadiness(view, inspect.owner, minion, game.actions), locale)}</p>}
      <p className={arenaStyles.inspectionRules}>{cardRules(card.id, locale, false)}</p>
      <div className={arenaStyles.keywords}>{cardKeywords(card.id, locale).map(keyword => <details key={keyword.name}><summary>{keyword.name}</summary><p>{keyword.description}</p></details>)}</div>
      {card.type === 'spell' && <div className={arenaStyles.edictTiming}><strong>{isInstantSpell(card) ? t('Мгновенно · в этом ходу', 'Instant · this turn') : t('Указ · в начале следующего своего хода', 'Edict · at the start of your next turn')}</strong></div>}
      <details className={arenaStyles.inspectionExtra}><summary>{t('Сведения о карте', 'Card details')}</summary><p>{rankName(card.id, locale)}</p></details>
    </ArenaInspection>}
    {inspect?.kind === 'hero' && inspectedHero && <ArenaInspection key={inspect.uid} {...inspectionProps} title={heroName(inspectedHero.heroId)} eyebrow={inspect.owner === 0 ? t('Ваш правитель', 'Your ruler') : t('Правитель соперника', 'Enemy ruler')} kind="ruler" art={heroPortraitPath(inspectedHero.heroId)}
      actions={inspect.owner === 0 ? <button className={arenaStyles.primary} disabled={!powerAction} onClick={() => {if (powerAction) act(powerAction);}}><span className={arenaStyles.costChip}>{inspectedHero.powerCost}</span>{powerName(inspectedHero.heroId)}</button> : undefined}>
      <dl className={arenaStyles.inspectionStats}><div><dt>{t('Казна', 'Treasury')}</dt><dd>{inspectedHero.treasury}</dd></div><div><dt>{t('Цена силы', 'Power cost')}</dt><dd>{inspectedHero.powerCost}</dd></div></dl>
      <h3>{powerName(inspectedHero.heroId)}</h3><p className={arenaStyles.inspectionRules}>{powerRules(inspectedHero.heroId, locale)}</p><p>{t('Один раз за ход.', 'Once per turn.')}</p>
    </ArenaInspection>}
    {inspect && ['gas', 'block', 'deck', 'scroll'].includes(inspect.kind) && <ArenaInspection key={inspect.kind} {...inspectionProps} title={inspect.kind === 'gas' ? t('Приказы', 'Orders') : inspect.kind === 'block' ? t('Ход', 'Turn') : inspect.kind === 'deck' ? t('Колода', 'Deck') : t('Очередь указов', 'Edict queue')} eyebrow="IMPERIVM"
      actions={inspect.kind === 'scroll' ? <button onClick={() => {close(); setHistory(true);}}>{t('История боя', 'Battle history')}</button> : undefined}>
      {inspect.kind === 'gas' && <dl className={arenaStyles.inspectionStats}><div><dt>{t('Доступно', 'Available')}</dt><dd>{me.gas}</dd></div><div><dt>{t('Вместимость', 'Capacity')}</dt><dd>{me.maxGas}</dd></div></dl>}
      {inspect.kind === 'block' && <><p className={arenaStyles.inspectionRules}>{t('Блок', 'Block')} {game.block} · {seconds} {t('сек.', 'sec.')}</p><p>{t('По истечении таймера сервер завершит ход.', 'The server ends the turn when the timer expires.')}</p></>}
      {inspect.kind === 'deck' && <p className={arenaStyles.inspectionRules}>{t('Карт осталось:', 'Cards remaining:')} {me.deckCount}</p>}
      {inspect.kind === 'scroll' && <><p className={arenaStyles.inspectionRules}>{t('В начале следующего хода владельца, по порядку.', 'At the start of the owner’s next turn, in cast order.')}</p>{([0, 1] as const).map(owner => <section key={owner} className={arenaStyles.queueGroup}><h3>{owner === 0 ? t('Ваши указы', 'Your edicts') : t('Указы соперника', 'Enemy edicts')}</h3>{view.players[owner].mempool.length ? view.players[owner].mempool.map((e, i) => <button className={arenaStyles.queueEntry} key={e.uid} onClick={() => setInspect({kind: 'queue', uid: `queued-${e.uid}`, owner, cardId: e.cardId})}><span>{i + 1}</span><img src={cardArtPath(e.cardId)} alt=""/><strong>{cardName(e.cardId)}</strong></button>) : <p className={arenaStyles.queueEmpty}>{t('Очередь пуста.', 'No pending edicts.')}</p>}</section>)}</>}
    </ArenaInspection>}
    {keyboard && <section ref={actionPanel} className={arenaStyles.actionsPanel} role="dialog" aria-modal="true" aria-label={t('Доступные действия', 'Available actions')}><button className={arenaStyles.close} onClick={() => setKeyboard(false)} aria-label={t('Закрыть действия', 'Close actions')}><RomanIcon name="close"/></button><h2>{t('Доступные действия', 'Available actions')}</h2><p>{t('Tab, Enter — выбрать действие. Esc — закрыть.', 'Tab, Enter to choose an action. Esc to close.')}</p>{actions.filter(a => a.type !== 'mulligan').map((a, i) => <button key={i} onClick={() => act(a)}>{actionLabel(a)}</button>)}{!actions.length && <p>{status}</p>}</section>}
    {help && <div className={arenaStyles.modalBackdrop}><section ref={helpPanel} className={arenaStyles.help} role="dialog" aria-modal="true" aria-label={t('Меню игры', 'Game menu')}><button className={arenaStyles.close} onClick={() => setHelp(false)} aria-label={t('Закрыть меню', 'Close menu')}><RomanIcon name="close"/></button><h2>{t('Меню игры', 'Game menu')}</h2><div className={arenaStyles.helpBody}>
      <p>{roomCode || 'PvP'} · {playerNames?.[room.seat] || heroName(me.heroId)} / {playerNames?.[(1 - room.seat) as 0 | 1] || heroName(foe.heroId)}</p><p>{t('Онлайн-бой продолжается, пока меню открыто.', 'The online battle continues while this menu is open.')}</p>
      <div className={arenaStyles.menuActions}><button onClick={() => setHelp(false)}>{t('Продолжить', 'Resume')}</button><button onClick={() => {setHelp(false); setHistory(true);}}>{t('История боя', 'Battle history')}</button><button onClick={() => {setHelp(false); setKeyboard(true);}}>{t('Доступные действия', 'Available actions')}</button>
        <button onClick={() => {void unlockAudio(); setMuted(!muted);}}>{muted ? t('Звук: выключен', 'Sound: off') : t('Звук: включён', 'Sound: on')}</button><button onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')}>{locale === 'ru' ? 'Язык: Русский' : 'Language: English'}</button>
        <button onClick={() => {const next = quality === 'auto' ? 'sharp' : quality === 'sharp' ? 'fast' : 'auto'; setQuality(next); try {localStorage.setItem('imperivm-arena-quality', next);} catch {}}}>{t('Изображение:', 'Image:')} {quality === 'auto' ? t('авто', 'auto') : quality === 'sharp' ? t('чётче', 'sharper') : t('быстрее', 'faster')}</button>
        {game.winner === null && <button disabled={!connected || pending} onClick={() => setConcede(true)}>{t('Сдаться', 'Concede')}</button>}
      </div>{concede && <div className={styles.netConcede}><p>{t('Подтвердить поражение?', 'Confirm concession?')}</p><button disabled={!connected || pending} onClick={() => void send({type: 'concede', roomId: room.id, revision: room.revision})}>{t('Подтвердить', 'Confirm')}</button><button onClick={() => setConcede(false)}>{t('Продолжить бой', 'Continue playing')}</button></div>}
    </div></section></div>}
    {history && <div className={arenaStyles.modalBackdrop}><section ref={historyPanel} className={arenaStyles.history} role="dialog" aria-modal="true" aria-label={t('История боя', 'Battle history')}><button className={arenaStyles.close} onClick={() => setHistory(false)} aria-label={t('Закрыть историю', 'Close history')}><RomanIcon name="close"/></button><h2>{t('История боя', 'Battle history')}</h2><ol className={styles.netHistory}>{room.history.map(e => <li key={e.revision}>{locale === 'en' ? e.textEn ?? e.text : e.text}</li>)}</ol></section></div>}
    {game.winner !== null && !animating && <div className={arenaStyles.modalBackdrop}><section ref={resultPanel} className={`${arenaStyles.result} ${game.winner === room.seat && !reduced ? arenaStyles.resultWithFx : ''}`} role="dialog" aria-modal="true" aria-label={t('Результат боя', 'Battle result')}><span className={arenaStyles.eyebrow}>IMPERIVM</span><div className={game.winner === room.seat && !reduced ? arenaStyles.victoryBanner : undefined}>{game.winner === room.seat && !reduced && <video src="/ui/arena-lab/fx/06-victory.mp4" autoPlay muted playsInline aria-hidden="true"/>}<h2>{result}</h2></div><p>{room.resultReason === 'concede' ? t('Матч завершён сдачей.', 'Match ended by concession.') : room.resultReason === 'disconnect' ? t('Соперник не вернулся в матч.', 'Your opponent did not return to the match.') : t('Бой завершён.', 'Battle completed.')}</p><button className={arenaStyles.primary} disabled={pending} onClick={leave}>{t('Вернуться в зал', 'Back to the hall')}</button></section></div>}
    {selected && <span className={styles.netAccessible} role="status">{t('Выберите цель для атаки.', 'Choose an attack target.')}</span>}
  </main>;
}
