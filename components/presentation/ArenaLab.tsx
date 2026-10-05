'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CARDS } from '../../lib/cards';
import { chooseAiAction } from '../../lib/ai';
import { legalActions } from '../../lib/engine/engine';
import { unlockAudio, isMuted, setMuted, onMuteChange } from '../../lib/audio/manager';
import { emitSfxFromEvents } from '../../lib/audio/events';
import type { Action } from '../../lib/engine/types';
import { useLocale } from '../LocaleContext';
import { useReducedMotion } from '../../lib/prefersReducedMotion';
import { createLabGame, GameSession, type SessionSnapshot } from './GameSession';
import type { ArenaRenderer, ArenaTarget, ArenaMetrics } from './createArena';
import styles from './ArenaLab.module.css';
import { cardRules, powerRules } from './rulesText';
import fxRegistry from '../../public/ui/arena-lab/fx/manifest.json';
import type {RenderQuality} from './renderQuality';

function usePanelFocus(open: boolean, panel: React.RefObject<HTMLElement>, modal = false) {
  useEffect(() => {
    if (!open || !panel.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const element = panel.current;
    const focusables = () => Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], summary, [tabindex="0"]'));
    focusables()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (!modal || event.key !== 'Tab') return;
      const items = focusables(), first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    element.addEventListener('keydown', trap);
    return () => { element.removeEventListener('keydown', trap); if (previous?.isConnected) previous.focus(); };
  }, [open, panel, modal]);
}

export default function ArenaLab({ heroId, opening, debug }: { heroId: string; opening: boolean; debug: boolean }) {
  const locale = useLocale(), reduced = useReducedMotion();
  const sessionRef = useRef<GameSession>();
  if (!sessionRef.current) sessionRef.current = new GameSession(createLabGame(heroId, opening));
  const session = sessionRef.current;
  const [view, setView] = useState<SessionSnapshot>(() => session.snapshot());
  const [selected, setSelected] = useState<string | null>(null);
  const [inspect, setInspect] = useState<ArenaTarget | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState('');
  const [muted, updateMuted] = useState(true);
  const [quality,setQuality] = useState<RenderQuality>('auto');
  const [help, setHelp] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [metrics, setMetrics] = useState<ArenaMetrics | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ArenaRenderer | null>(null);
  const helpPanel = useRef<HTMLElement>(null), actionPanel = useRef<HTMLElement>(null), resultPanel = useRef<HTMLElement>(null);
  usePanelFocus(help, helpPanel, true);
  usePanelFocus(keyboard, actionPanel);
  usePanelFocus(view.shown.winner !== null, resultPanel, true);
  const selectedRef = useRef<string | null>(null);
  const callbacks = useRef({ pick: (_target: ArenaTarget) => {}, play: (_uid: string) => {}, attack: (_uid: string, _target: string) => {} });
  const shown = view.shown, me = shown.players[0], foe = shown.players[1];
  const legal = view.busy ? [] : legalActions(view.state);
  const victoryClip = !reduced && shown.winner===0 ? (fxRegistry.clips as Partial<Record<string,{src:string}>>)['06-victory'] : undefined;
  const victorySrc = victoryClip?.src==='/ui/arena-lab/fx/06-victory.mp4' ? victoryClip.src : undefined;

  const select = useCallback((uid: string | null) => {
    selectedRef.current = uid; setSelected(uid); renderer.current?.select(uid);
  }, []);

  const dispatch = useCallback((action: Action) => {
    void unlockAudio();
    try {
      const batch = session.dispatch(action); if (!batch) return;
      select(null); setInspect(null); setFailure('');
      const impact = () => { session.impact(batch.id); if (batch.events) emitSfxFromEvents(batch.events); };
      const arena = renderer.current;
      if (arena) void arena.present(batch, impact).then(() => session.complete(batch.id)).catch(() => { session.complete(batch.id); setFailure('presentation'); });
      else { impact(); session.complete(batch.id); }
    } catch (error) {
      setFailure(error instanceof Error ? locale.errorText(error.message) : locale.t('Действие недоступно.', 'Action unavailable.'));
    }
  }, [locale.locale, select, session]);

  const play = (uid: string) => {
    const current = session.snapshot(); if (current.state.turn !== 0 || current.busy) return;
    const action = session.legal().find(a => (a.type === 'play-minion' || a.type === 'cast-spell') && a.uid === uid);
    if (action) dispatch(action);
  };
  const attack = (uid: string, target: string) => {
    const current = session.snapshot(); if (current.state.turn !== 0 || current.busy) return;
    const action = session.legal().find(a => a.type === 'attack' && a.attackerUid === uid && a.target === target);
    if (action) dispatch(action);
  };
  callbacks.current = {
    play, attack,
    pick: target => {
      if (target.kind === 'command' || target.kind === 'power') {
        const current = session.snapshot();
        if (current.busy || current.state.turn !== 0 || current.state.winner !== null) return;
        const action = session.legal().find(a => a.type === (target.kind === 'command' ? 'end-turn' : 'hero-power'));
        if (action) dispatch(action);
        else if (target.kind === 'power') setInspect({ kind: 'hero', uid: 'hero-0', owner: 0 });
        return;
      }
      if (['gas', 'block', 'scroll', 'deck'].includes(target.kind)) { select(null); setInspect(target); return; }
      if (target.owner === 1 && selectedRef.current) {
        const attacker = selectedRef.current;
        const destination = target.kind === 'hero' ? 'hero' : target.uid;
        if (session.legal().some(a => a.type === 'attack' && a.attackerUid === attacker && a.target === destination)) { attack(attacker, destination); return; }
      }
      if (target.kind === 'minion' && target.owner === 0) {
        const canAttack = session.snapshot().state.turn === 0 && session.legal().some(a => a.type === 'attack' && a.attackerUid === target.uid);
        if (canAttack && selectedRef.current !== target.uid) {
          select(target.uid); setInspect(null);
        } else {
          select(null); setInspect(target);
        }
        return;
      }
      select(null); setInspect(target);
    },
  };

  useEffect(() => session.subscribe(setView), [session]);
  useEffect(() => {
    let cancelled = false;
    const element = canvas.current; if (!element) return;
    void import('./createArena').then(({ createArena }) => {
      if (cancelled) return;
      try {
        const arena = createArena(element, {
          locale: locale.locale, reducedMotion: reduced, measure: debug,
          onPick: target => callbacks.current.pick(target), onHover: () => {},
          onPlay: uid => callbacks.current.play(uid), onAttack: (uid, target) => callbacks.current.attack(uid, target),
          onMetrics: setMetrics, onFailure: setFailure,
        });
        renderer.current = arena; arena.sync(session.snapshot().shown); setReady(true);
      } catch { setFailure('webgl'); }
    }).catch(() => { if (!cancelled) setFailure('load'); });
    return () => { cancelled = true; renderer.current?.dispose(); renderer.current = null; };
    // Mount one renderer. Locale/motion changes update it without remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  useEffect(() => { renderer.current?.sync(view.shown); }, [view.shown]);
  useEffect(() => { renderer.current?.setLocale(locale.locale); }, [locale.locale]);
  useEffect(() => { renderer.current?.setReducedMotion(reduced); }, [reduced]);
  useEffect(() => {
    try {const saved=localStorage.getItem('imperivm-arena-quality');if(saved==='auto'||saved==='sharp'||saved==='fast')setQuality(saved);} catch {}
  }, []);
  useEffect(() => {renderer.current?.setQuality(quality);}, [quality,ready]);
  useEffect(() => { updateMuted(isMuted()); return onMuteChange(updateMuted); }, []);
  useEffect(() => {
    if (!ready || help || view.busy || view.state.winner !== null || view.state.turn !== 1) return;
    const timer = window.setTimeout(() => dispatch(chooseAiAction(session.snapshot().state)), reduced ? 180 : 450);
    return () => window.clearTimeout(timer);
  }, [view.revision, view.busy, view.state, ready, help, reduced, dispatch, session]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { select(null); setInspect(null); setHelp(false); setKeyboard(false); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [select]);

  function restart(nextHero = me.heroId, fromOpening = opening) {
    renderer.current?.cancel(); select(null); setInspect(null);
    session.restart(createLabGame(nextHero, fromOpening));
  }

  const card = inspect?.cardId ? CARDS[inspect.cardId] : null;
  const inspectedMinion = inspect?.kind === 'minion' ? shown.players[inspect.owner].board.find(m => m.uid === inspect.uid) : null;
  const playAction = inspect ? legal.find(a => (a.type === 'play-minion' || a.type === 'cast-spell') && a.uid === inspect.uid) : undefined;
  const stakeAction = inspect ? legal.find(a => (a.type === 'stake' || a.type === 'unstake') && a.uid === inspect.uid) : undefined;

  const actionLabel = (action: Action) => {
    if (action.type === 'end-turn') return locale.t('Завершить ход', 'End turn');
    if (action.type === 'hero-power') return locale.powerName(me.heroId);
    if (action.type === 'play-minion' || action.type === 'cast-spell') {
      const hand = view.state.players[view.state.turn].hand.find(c => c.uid === action.uid);
      return `${locale.t('Разыграть', 'Play')} ${hand ? locale.cardName(hand.cardId) : ''}`;
    }
    if (action.type === 'attack') {
      const own = view.state.players[0].board.find(m => m.uid === action.attackerUid);
      const enemy = view.state.players[1].board.find(m => m.uid === action.target);
      return `${own ? locale.cardName(own.cardId) : ''} → ${action.target === 'hero' ? locale.heroName(foe.heroId) : enemy ? locale.cardName(enemy.cardId) : ''}`;
    }
    if (action.type === 'stake' || action.type === 'unstake') {
      const minion = view.state.players[0].board.find(m => m.uid === action.uid);
      return `${locale.t(action.type === 'stake' ? 'Стейкинг' : 'Снять стейкинг', action.type === 'stake' ? 'Stake' : 'Unstake')} ${minion ? locale.cardName(minion.cardId) : ''}`;
    }
    return locale.t('Оставить руку', 'Keep hand');
  };

  return <main className={styles.shell}>
    <canvas ref={canvas} className={styles.canvas} aria-label={locale.t('Объёмный игровой стол IMPERIVM. Клавиатурное управление: меню игры, затем «Доступные действия».', 'IMPERIVM game table. Keyboard controls: open the game menu, then Available actions.')} />
    <header className={styles.header}><button className={styles.settingsButton} onClick={() => { select(null); setInspect(null); setHelp(true); }} aria-label={locale.t('Меню игры', 'Game menu')}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6l1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2z"/><circle cx="16" cy="17" r="5"/></svg></button></header>



    {!ready && !failure && <div className={styles.loading} role="status"><div>IV</div><p>{locale.t('Открываем врата арены…', 'Opening the arena gates…')}</p></div>}
    {failure && <div className={styles.error} role="alert">{failure === 'webgl' || failure === 'load' ? <><strong>{locale.t('Не удалось открыть новую арену', 'Could not open the new arena')}</strong><span>{locale.t('Проверьте поддержку WebGL и обновите страницу.', 'Check WebGL support and reload the page.')}</span><Link href="/game">{locale.t('Открыть текущую игру', 'Open current game')}</Link></> : failure === 'context-lost' ? locale.t('Восстанавливаем графику. Матч сохранён.', 'Restoring graphics. Match preserved.') : failure === 'presentation' ? locale.t('Действие выполнено. Обновите страницу для восстановления графики.', 'Action completed. Reload to restore graphics.') : failure}<button onClick={() => setFailure('')} aria-label={locale.t('Закрыть сообщение', 'Dismiss message')}>×</button></div>}

    {inspect && card && <section className={styles.inspection} role="dialog" aria-label={locale.cardName(card.id)}>
      <button className={styles.close} onClick={() => { setInspect(null); select(null); }} aria-label={locale.t('Закрыть просмотр', 'Close inspection')}>×</button>
      <img src={`/cards/${card.id}.webp`} alt={locale.cardName(card.id)} />
      <div><h2>{locale.cardName(card.id)}</h2><p>{cardRules(card.id, locale.locale)}</p>{inspectedMinion?.staked && <p>{locale.t("Стейкинг: +1 газ в начале хода. Не атакует.", "Staking: +1 gas at turn start. Cannot attack.")}</p>}
        <dl><div><dt>{locale.t('Стоимость', 'Cost')}</dt><dd>{card.cost}</dd></div>{card.type === 'minion' && <><div><dt>{locale.t('Атака', 'Attack')}</dt><dd>{inspectedMinion?.attack ?? card.attack}</dd></div><div><dt>{locale.t('Здоровье', 'Health')}</dt><dd>{inspectedMinion?.health ?? card.health}</dd></div></>}</dl>
        {selected === inspect.uid && <p className={styles.targetHint}>{locale.t('Теперь нажмите на подсвеченную цель на поле.', 'Now click a highlighted target on the board.')}</p>}
        {inspect.owner === 0 && inspect.kind === 'hand' && <button className={styles.primary} disabled={!playAction} onClick={() => { if (playAction) dispatch(playAction); }}>{playAction ? locale.t('Разыграть', 'Play') : locale.t('Недоступно в этом ходу', 'Unavailable this turn')}</button>}
        {inspect.owner === 0 && stakeAction && <button onClick={() => dispatch(stakeAction)}>{stakeAction.type === 'stake' ? locale.t('Стейкинг · +1 газ', 'Stake · +1 gas') : locale.t('Снять стейкинг', 'Unstake minion')}</button>}
      </div>
    </section>}

    {inspect?.kind === 'hero' && <section className={styles.inspection} role="dialog" aria-label={locale.heroName(shown.players[inspect.owner].heroId)}>
      <button className={styles.close} onClick={() => setInspect(null)} aria-label={locale.t('Закрыть просмотр', 'Close inspection')}>×</button>
      <img src={`/heroes/${shown.players[inspect.owner].heroId}.webp`} alt="" />
      <div><h2>{locale.heroName(shown.players[inspect.owner].heroId)}</h2><h3>{locale.powerName(shown.players[inspect.owner].heroId)}</h3><p>{powerRules(shown.players[inspect.owner].heroId,locale.locale)}</p><strong>{locale.t('Казна', 'Treasury')}: {shown.players[inspect.owner].treasury}</strong></div>
    </section>}

    {inspect && ['gas','block','deck','scroll'].includes(inspect.kind) && <section className={styles.inspection} role="dialog" aria-label={locale.t('Предмет арены','Arena object')}><button className={styles.close} onClick={()=>setInspect(null)} aria-label={locale.t('Закрыть просмотр','Close inspection')}>×</button><div>
      {inspect.kind==='gas' && <><h2>{locale.t('Газ','Gas')} {me.gas} / {me.maxGas}</h2><p>{locale.t('Расходуется на карты и силу героя. Кристаллы восстанавливаются в начале вашего хода. Тёмные ячейки уже потрачены.','Spend gas on cards and your hero power. Crystals refill at the start of your turn. Dark sockets have been spent.')}</p></>}
      {inspect.kind==='block' && <><h2>{locale.t('Блок','Block')} {shown.block}</h2><p>{locale.t('Новый ход открывает следующий блок. В начале вашего хода разрешаются заклинания со свитка и восстанавливается газ.','Each turn opens the next block. Your pending spells resolve and gas refills at the start of your turn.')}</p></>}
      {inspect.kind==='deck' && <><h2>{locale.t('Колода','Deck')}</h2><p>{me.deck.length} {locale.t('карт осталось. В начале хода вы берёте следующую карту. Пустая колода наносит урон казне.','cards remain. Draw a card at the start of your turn. An empty deck damages your treasury.')}</p></>}
      {inspect.kind==='scroll' && <><h2>{locale.t('Хроника боя','Battle chronicle')}</h2>{shown.log.slice(-4).map((line,index)=><p key={index}>{locale.logLine(line)}</p>)}</>}
    </div></section>}

    {keyboard && <section ref={actionPanel} className={styles.actionsPanel} role="dialog" aria-label={locale.t('Доступные действия', 'Available actions')}><button className={styles.close} onClick={() => setKeyboard(false)} aria-label={locale.t('Закрыть действия', 'Close actions')}>×</button><h2>{locale.t('Доступные действия', 'Available actions')}</h2><p>{locale.t('Управление с клавиатуры: Tab, Enter. Esc закрывает окно.', 'Keyboard controls: Tab, Enter. Esc closes the panel.')}</p>{view.state.turn === 0 && !view.busy ? legal.map((action, index) => <button key={index} onClick={() => dispatch(action)}>{actionLabel(action)}</button>) : <p>{locale.t('Ожидаем завершения действия соперника.', 'Waiting for the opponent.')}</p>}</section>}

    {help && <div className={styles.modalBackdrop}><section ref={helpPanel} className={styles.help} role="dialog" aria-modal="true" aria-label={locale.t('Меню игры', 'Game menu')}>
      <button className={styles.close} onClick={() => setHelp(false)} aria-label={locale.t('Закрыть меню', 'Close menu')}>×</button>
      <h2>{locale.t('Пауза', 'Pause')}</h2>
      <div className={styles.menuActions}>
        <button className={styles.primary} onClick={() => setHelp(false)}>{locale.t('Продолжить', 'Resume')}</button>
        <button onClick={() => { void unlockAudio(); setMuted(!muted); }}>{muted ? locale.t('Звук: выключен', 'Sound: off') : locale.t('Звук: включён', 'Sound: on')}</button>
        <button onClick={() => locale.setLocale(locale.locale === 'ru' ? 'en' : 'ru')}>{locale.locale === 'ru' ? 'Язык: Русский' : 'Language: English'}</button>
        <button onClick={() => {const next=quality==='auto'?'sharp':quality==='sharp'?'fast':'auto';setQuality(next);try{localStorage.setItem('imperivm-arena-quality',next);}catch{}}}>{locale.t('Изображение: ', 'Image: ')}{quality==='auto'?locale.t('авто','auto'):quality==='sharp'?locale.t('чётче','sharper'):locale.t('быстрее','faster')}</button>
        <button onClick={() => { restart(); setHelp(false); }}>{locale.t('Начать заново', 'New battle')}</button>
      </div>
      <details><summary>{locale.t('Управление', 'Controls')}</summary><p>{locale.t('Перетащите карту на поле. Скрещённые мечи — боец готов атаковать: выберите его и цель. Заклинания ждут следующего блока на свитке слева.', 'Drag a card to the court. Crossed swords mean a fighter can attack: select it and a target. Spells wait for the next block on the left scroll.')}</p><button onClick={() => {setHelp(false);setKeyboard(true);}}>{locale.t('Действия с клавиатуры', 'Keyboard actions')}</button></details>
      <Link className={styles.leaveArena} href="/arena">{locale.t('Покинуть арену', 'Leave arena')}</Link>
    </section></div>}

    {shown.winner !== null && <div className={styles.modalBackdrop}><section ref={resultPanel} className={`${styles.result} ${victorySrc?styles.resultWithFx:''}`} role="dialog" aria-modal="true"><span className={styles.eyebrow}>IMPERIVM</span><div className={victorySrc?styles.victoryBanner:undefined}>{victorySrc&&<video key={view.revision} src={victorySrc} autoPlay muted playsInline aria-hidden="true"/>}<h2>{shown.winner === 0 ? locale.t('Ваша империя устояла', 'Your empire stands') : shown.winner === 'draw' ? locale.t('Империи пали вместе', 'Both empires fell') : locale.t('Казна опустела', 'The treasury is empty')}</h2></div><p>{locale.t('Каждая потеря — урок для следующего блока.', 'Every loss is a lesson for the next block.')}</p><button className={styles.primary} onClick={() => restart()}>{locale.t('Ещё один бой', 'Another battle')}</button></section></div>}
    {debug && metrics && <output className={styles.metrics} hidden data-perf={JSON.stringify(metrics)}>{metrics.drawCalls} draws · {Math.round(metrics.triangles).toLocaleString()} triangles · {metrics.meshes} meshes · {metrics.models} models · {metrics.failedModels} failed · {metrics.frameMedianMs}/{metrics.frameP95Ms} ms median/p95 · 1 canvas</output>}
  </main>;
}
