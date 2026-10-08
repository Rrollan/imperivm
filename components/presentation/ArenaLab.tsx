'use client';
import {ArenaFeedbackSettings} from './ArenaFeedbackSettings';
import {ArenaOrientationHint} from './ArenaOrientationHint';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CARDS } from '../../lib/cards';
import {isInstantSpell} from '../../lib/engine/spellTiming';
import { chooseAiAction } from '../../lib/ai';
import { effectivePowerCost,legalActions,mempoolOf,mulliganAvailable } from '../../lib/engine/engine';
import { unlockAudio, isMuted, setMuted, onMuteChange } from '../../lib/audio/manager';
import { emitSfxFromEvents } from '../../lib/audio/events';
import type { Action } from '../../lib/engine/types';
import { useLocale } from '../LocaleContext';
import { useReducedMotion } from '../../lib/prefersReducedMotion';
import { createLabGame, GameSession, type SessionSnapshot } from './GameSession';
import type { ArenaRenderer, ArenaTarget, ArenaMetrics } from './createArena';
import styles from './ArenaLab.module.css';
import {RomanIcon} from './RomanIcon';
import { cardKeywords, cardRules, powerRules } from './rulesText';
import { battleCommand, fighterReadiness, nextHalvingBlock, readinessText, unavailableCardText } from './battleReadability';
import {BattleResultEmblem} from './BattleResultEmblem';
import {ultimateProgress,ultimateReady,boardCapacity} from '../../lib/engine/tactics';
import type {RenderQuality} from './renderQuality';
import {roleName,rankName} from './cardIdentity';
import {ordersView} from './ordersView';
import {cardArtPath} from '../../lib/cardArt';
import {OpeningHand} from './OpeningHand';
import {BattleChronicle} from './BattleChronicle';
import {ArenaInspection} from './ArenaInspection';
import {ArenaCardPreview} from './ArenaCardPreview';
import {heroPortraitPath} from './heroPortrait';
import {factionLink} from './factionLink';
import {rulesetOf,pendingValidatorOrders,type RulesetId} from '../../lib/engine/ruleset';
import {usePracticeMatch} from './usePracticeMatch';
import Dialog from '../Dialog';

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

export default function ArenaLab({ heroId, opening, debug, seed=2718,opponent,ruleset='classic-v1' }: { heroId: string; opening: boolean; debug: boolean; seed?:number;opponent?:string;ruleset?:RulesetId }) {
  const locale = useLocale(), reduced = useReducedMotion();
  const sessionRef = useRef<GameSession>();
  if (!sessionRef.current) sessionRef.current = new GameSession(createLabGame(heroId, opening,seed,opponent,ruleset));
  const session = sessionRef.current;
  const [view, setView] = useState<SessionSnapshot>(() => session.snapshot());
  const practice = usePracticeMatch(heroId, debug || !opening, view.shown, view.busy);
  const [selected, setSelected] = useState<string | null>(null);
  const [inspect, setInspect] = useState<ArenaTarget | null>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState('');
  const [muted, updateMuted] = useState(true);
  const [quality,setQuality] = useState<RenderQuality>('auto');
  const [help, setHelp] = useState(false);
  const [historyOpen,setHistoryOpen]=useState(false);
  const pausedPanel=useRef(false);pausedPanel.current=help||historyOpen||inspect!==null||practice.pending;
  const [keyboard, setKeyboard] = useState(false);
  const [metrics, setMetrics] = useState<ArenaMetrics | null>(null);
  const [lastAction,setLastAction] = useState<{type:string;owner:number;revision:number}|null>(null);
  const [mulliganUids,setMulliganUids] = useState<string[]>([]);
  const [pageVisible,setPageVisible] = useState(true);
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ArenaRenderer | null>(null);
  const helpPanel = useRef<HTMLElement>(null), actionPanel = useRef<HTMLElement>(null), resultPanel = useRef<HTMLElement>(null), mulliganPanel=useRef<HTMLElement>(null),historyPanel=useRef<HTMLElement>(null);
  const showMulligan=ready&&!view.busy&&!practice.pending&&view.state.turn===0&&mulliganAvailable(view.state);
  usePanelFocus(help, helpPanel, true);
  usePanelFocus(keyboard, actionPanel);
  usePanelFocus(view.shown.winner !== null&&!view.busy, resultPanel, true);
  usePanelFocus(showMulligan,mulliganPanel,true);
  usePanelFocus(historyOpen,historyPanel,true);
  const selectedRef = useRef<string | null>(null);
  const callbacks = useRef({ pick: (_target: ArenaTarget) => {}, play: (_uid: string) => {}, attack: (_uid: string, _target: string) => {} });
  const shown = view.shown, me = shown.players[0], foe = shown.players[1];
  const legal = view.busy || practice.pending ? [] : legalActions(view.state);


  const select = useCallback((uid: string | null) => {
    selectedRef.current = uid; setSelected(uid); renderer.current?.select(uid);
  }, []);

  const dispatch = useCallback((action: Action) => {
    if (practice.pending) return;
    void unlockAudio();
    try {
      const batch = session.dispatch(action); if (!batch) return;
      practice.track(batch);
      if(debug)setLastAction({type:action.type,owner:batch.before.turn,revision:batch.revision});
      select(null); setInspect(null); setKeyboard(false); setMulliganUids([]); setFailure('');
      const impact = () => { session.impact(batch.id); emitSfxFromEvents(batch.events ?? {}, batch); };
      const arena = renderer.current;
      if (arena) void arena.present(batch, impact).then(() => session.complete(batch.id)).catch(() => { session.complete(batch.id); setFailure('presentation'); });
      else { impact(); session.complete(batch.id); }
    } catch (error) {
      setFailure(error instanceof Error ? locale.errorText(error.message) : locale.t('Действие недоступно.', 'Action unavailable.'));
    }
  }, [locale.locale, select, session, debug, practice.pending]);

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
          onMetrics: setMetrics, onFailure: setFailure,onReady:()=>{if(!cancelled)setReady(true);},
        });
        renderer.current = arena; arena.sync(session.snapshot().shown);
      } catch { setFailure('webgl'); }
    }).catch(() => { if (!cancelled) setFailure('load'); });
    return () => { cancelled = true; renderer.current?.dispose(); renderer.current = null; };
    // Mount one renderer. Locale/motion changes update it without remounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);
  useEffect(() => { renderer.current?.sync(view.shown); }, [view.shown]);
  useEffect(() => { renderer.current?.setLocale(locale.locale); }, [locale.locale]);
  useEffect(() => { renderer.current?.setReducedMotion(reduced); }, [reduced]);
  useEffect(()=>{renderer.current?.setPaused(help||historyOpen||inspect!==null);},[help,historyOpen,inspect,ready]);
  useEffect(()=>{const visibility=()=>setPageVisible(!document.hidden);visibility();document.addEventListener('visibilitychange',visibility);return()=>document.removeEventListener('visibilitychange',visibility);},[]);
  useEffect(() => {renderer.current?.setOverlayOpen(help||historyOpen||keyboard||inspect!==null||showMulligan||shown.winner!==null||practice.pending);},[help,historyOpen,keyboard,inspect,ready,showMulligan,shown.winner,practice.pending]);
  useEffect(() => {
    try {const saved=localStorage.getItem('imperivm-arena-quality');if(saved==='auto'||saved==='sharp'||saved==='fast')setQuality(saved);} catch {}
  }, []);
  useEffect(() => {renderer.current?.setQuality(quality);}, [quality,ready]);
  useEffect(() => { updateMuted(isMuted()); return onMuteChange(updateMuted); }, []);
  useEffect(() => {
    if (!ready || !pageVisible || help || historyOpen || inspect || practice.pending || view.busy || view.state.winner !== null || view.state.turn !== 1) return;
    const timer = window.setTimeout(() => {
      const current=session.snapshot();
      if(document.hidden||pausedPanel.current||current.busy||current.state.winner!==null||current.state.turn!==1)return;
      dispatch(chooseAiAction(current.state));
    }, reduced ? 180 : 450);
    return () => window.clearTimeout(timer);
  }, [view.revision, view.busy, view.state, ready, pageVisible, help, historyOpen, inspect, practice.pending, reduced, dispatch, session]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape'&&!event.defaultPrevented) { select(null); setInspect(null); setHelp(false); setHistoryOpen(false); setKeyboard(false); setMulliganUids([]); } };
    window.addEventListener('keydown', escape); return () => window.removeEventListener('keydown', escape);
  }, [select]);

  function restart(nextHero = me.heroId, fromOpening = true) {
    renderer.current?.cancel(); select(null); setInspect(null);
    setHelp(false);setHistoryOpen(false);setKeyboard(false);setMulliganUids([]);setLastAction(null);setFailure('');
    practice.reset(nextHero, debug || !fromOpening);
    session.restart(createLabGame(nextHero, fromOpening,seed,opponent,ruleset));
  }

  const card = inspect?.cardId ? CARDS[inspect.cardId] : null;
  const inspectedMinion = inspect?.kind === 'minion' ? shown.players[inspect.owner].board.find(m => m.uid === inspect.uid) : null;
  const playAction = inspect ? legal.find(a => (a.type === 'play-minion' || a.type === 'cast-spell') && a.uid === inspect.uid) : undefined;
  const stakeAction = inspect ? legal.find(a => (a.type === 'stake' || a.type === 'unstake') && a.uid === inspect.uid) : undefined;
  const attackAction = inspect ? legal.find(a => a.type === 'attack' && a.attackerUid === inspect.uid) : undefined;
  const inspectedReadiness = inspectedMinion && inspect ? fighterReadiness(shown,inspect.owner,inspectedMinion) : null;
  const keywords = card ? cardKeywords(card.id,locale.locale) : [];
  const rules = card ? cardRules(card.id,locale.locale,false) : '';
  const inspectedHero=inspect?.kind==='hero'?shown.players[inspect.owner]:null;
  const powerAction=inspect?.owner===0?legal.find(a=>a.type==='hero-power'):undefined;
  const inspectionProps={closeLabel:locale.t('Закрыть просмотр','Close inspection'),backLabel:locale.t('Назад к очереди','Back to queue'),reduced,onClose:()=>{setInspect(null);select(null);}};

  const actionLabel = (action: Action) => {
    if (action.type === 'end-turn') return locale.t('Завершить ход', 'End turn');
    if (action.type === 'hero-power') return locale.powerName(me.heroId);
    if (action.type === 'play-minion' || action.type === 'cast-spell') {
      const hand = view.state.players[view.state.turn].hand.find(c => c.uid === action.uid);
      return `${hand&&isInstantSpell(CARDS[hand.cardId])?locale.t('Применить сейчас', 'Cast now'):locale.t('Разыграть', 'Play')} ${hand ? locale.cardName(hand.cardId) : ''}`;
    }
    if (action.type === 'attack') {
      const own = view.state.players[0].board.find(m => m.uid === action.attackerUid);
      const enemy = view.state.players[1].board.find(m => m.uid === action.target);
      return `${own ? locale.cardName(own.cardId) : ''} → ${action.target === 'hero' ? locale.heroName(foe.heroId) : enemy ? locale.cardName(enemy.cardId) : ''}`;
    }
    if (action.type === 'stake' || action.type === 'unstake') {
      const minion = view.state.players[0].board.find(m => m.uid === action.uid);
      return `${locale.t(action.type === 'stake' ? 'Гарнизон' : 'Вернуть в бой', action.type === 'stake' ? 'Garrison' : 'Return to battle')} ${minion ? locale.cardName(minion.cardId) : ''}`;
    }
    return locale.t('Оставить руку', 'Keep hand');
  };

  return <main className={styles.shell}>
    <ArenaOrientationHint/>
    {rulesetOf(shown)==='validator-investment-v1'&&<div className={styles.rulesetBadge}>{locale.t('Эксперимент · Инвестиция Валидатора','Experiment · Validator investment')}</div>}
    <canvas ref={canvas} className={styles.canvas} aria-label={locale.t('Объёмный игровой стол IMPERIVM. Клавиатурное управление: меню игры, затем «Доступные действия».', 'IMPERIVM game table. Keyboard controls: open the game menu, then Available actions.')} />
    <header className={styles.header}><button className={styles.settingsButton} onClick={() => { select(null); setInspect(null); setHelp(true); }} aria-label={locale.t('Меню игры', 'Game menu')}><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M13 3h6l1 4 3 2 4-1 3 5-3 3v3l3 3-3 5-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2z"/><circle cx="16" cy="17" r="5"/></svg></button></header>



    {!ready && !failure && <div className={styles.loading} role="status"><div>IV</div><p>{locale.t('Открываем врата арены…', 'Opening the arena gates…')}</p></div>}
    {showMulligan&&<div className={styles.modalBackdrop}><section ref={mulliganPanel} className={styles.mulligan} role="dialog" aria-modal="true" aria-labelledby="opening-hand-title"><OpeningHand hand={view.state.players[0].hand} selected={mulliganUids} locale={locale.locale} onToggle={uid=>setMulliganUids(previous=>previous.includes(uid)?previous.filter(value=>value!==uid):[...previous,uid])} onConfirm={()=>dispatch({type:'mulligan',uids:mulliganUids})}/></section></div>}
    {failure && <div className={styles.error} role="alert">{failure === 'webgl' || failure === 'load' ? <><strong>{locale.t('Не удалось открыть новую арену', 'Could not open the new arena')}</strong><span>{locale.t('Проверьте поддержку WebGL и обновите страницу.', 'Check WebGL support and reload the page.')}</span><Link href="/game">{locale.t('Открыть текущую игру', 'Open current game')}</Link></> : failure === 'context-lost' ? locale.t('Восстанавливаем графику. Матч сохранён.', 'Restoring graphics. Match preserved.') : failure === 'presentation' ? locale.t('Действие выполнено. Обновите страницу для восстановления графики.', 'Action completed. Reload to restore graphics.') : failure}<button onClick={() => setFailure('')} aria-label={locale.t('Закрыть сообщение', 'Dismiss message')}><RomanIcon name="close"/></button></div>}

    {inspect && card && <ArenaInspection key={`${inspect.kind}:${inspect.uid}`} {...inspectionProps}
      title={locale.cardName(card.id)} eyebrow={roleName(card.id,locale.locale)} kind="card"
      visual={<ArenaCardPreview id={card.id} locale={locale.locale} interactive reduced={reduced} label={`${locale.cardName(card.id)}. ${locale.t('Приказы','Orders')}: ${card.cost}${card.type==='minion'?`. ${locale.t('Атака','Attack')}: ${inspectedMinion?.attack??card.attack}. ${locale.t('Здоровье','Health')}: ${inspectedMinion?.health??card.health}`:''}`} stats={inspectedMinion?{attack:inspectedMinion.attack,health:inspectedMinion.health}:undefined}/>}
      onBack={inspect.kind==='queue'&&inspect.uid!=='historical-card'?()=>setInspect({kind:'scroll',uid:'arena-scroll',owner:0}):undefined}
      actions={inspect.owner===0&&(inspect.kind==='hand'||stakeAction||attackAction)?<>
        {inspect.kind==='hand'&&<button className={styles.primary} aria-label={playAction?(isInstantSpell(card)?locale.t('Применить сейчас','Cast now'):locale.t('Разыграть','Play')):undefined} disabled={!playAction} onClick={()=>{if(playAction)dispatch(playAction);}}>{playAction?<><span className={styles.costChip}>{card.cost}</span>{isInstantSpell(card)?locale.t('Применить сейчас','Cast now'):locale.t('Разыграть','Play')}</>:unavailableCardText(view.state,card.id,locale.locale,view.busy)}</button>}
        {attackAction&&<button className={styles.primary} onClick={()=>{select(inspect.uid);setInspect(null);}}>{locale.t('Атаковать','Attack')}</button>}
        {stakeAction&&<button onClick={()=>dispatch(stakeAction)}>{stakeAction.type==='stake'?locale.t('Гарнизон · +1 приказ','Garrison · +1 order'):locale.t('Вернуть в бой','Return to battle')}</button>}
      </>:undefined}>
      {inspectedReadiness&&<p className={styles.fighterStatus}>{readinessText(inspectedReadiness,locale.locale)}</p>}
      {rules&&<p className={styles.inspectionRules}>{rules}</p>}
      {card.ultimate&&inspect.kind==='hand'&&<div className={styles.factionLink} data-link-step={ultimateReady(shown,inspect.owner,card)?2:0}><strong>{locale.t('Ультимейт','Ultimate')} · {Math.min(card.ultimate.count,ultimateProgress(shown,inspect.owner,card))}/{card.ultimate.count}</strong><p>{ultimateReady(shown,inspect.owner,card)?locale.t('Готов при розыгрыше.','Ready on play.'):locale.t('Условие ещё не выполнено.','Preparation incomplete.')}</p></div>}
      {inspect.kind==='hand'&&inspect.owner===0&&shown.turn===0&&<div className={styles.factionLink} data-link-step={factionLink(me,card.faction).step}>
        <strong>{card.faction} · {locale.t('Связка','Link')} {factionLink(me,card.faction).step}/2</strong>
        <p>{factionLink(me,card.faction).earned?locale.t('Возврат +1 приказа за эту фракцию уже получен в этом ходу.','The +1 order refund for this faction has already been earned this turn.'):factionLink(me,card.faction).refundOnNext?locale.t('При розыгрыше этой карты: +1 приказ после оплаты полной цены.','On playing this card: refund +1 order after paying its full cost.'):locale.t('Вторая карта этой фракции за один ход возвращает +1 приказ.','The second card of this faction in one turn refunds +1 order.')}</p>
      </div>}
      {keywords.length>0&&<div className={styles.keywords}>{keywords.map(keyword=><details key={keyword.name}><summary>{keyword.name}</summary><p>{keyword.description}</p></details>)}</div>}
      {card.type==='spell'&&<div className={styles.edictTiming}><strong>{isInstantSpell(card)?locale.t('Мгновенно · в этом ходу','Instant · this turn'):locale.t('Указ · в начале следующего своего хода','Edict · at the start of your next turn')}</strong><details><summary>{locale.t('Когда сработает','When it takes effect')}</summary><p>{isInstantSpell(card)?locale.t('Эффект срабатывает сразу при розыгрыше. Карта не попадает в очередь указов. Добранные карты и усиленные бойцы доступны в этом же ходу по обычным правилам.','The effect resolves immediately on play, without entering the edict queue. Drawn cards and buffed fighters are available this turn under the normal rules.'):locale.t('Основной эффект ждёт в очереди до начала следующего хода владельца. Приоритет отменяет вражеский указ сразу при розыгрыше.','The main effect waits in the queue until the owner’s next turn. Priority counters an enemy edict immediately on play.')}</p></details></div>}
      <details className={styles.inspectionExtra}><summary>{locale.t('Сведения о карте','Card details')}</summary><p>{rankName(card.id,locale.locale)}</p>
        {inspectedMinion&&((inspectedMinion.attack!==card.attack)||(inspectedMinion.maxHealth!==card.health))&&<p>{locale.t('Базовые характеристики: ','Base stats: ')}{card.attack}/{card.health}. {locale.t('Сейчас: ','Now: ')}{inspectedMinion.attack}/{inspectedMinion.maxHealth}.</p>}
        {inspectedMinion&&card.halvingPeriod&&<p>{locale.t('Следующее усиление: блок ','Next growth: block ')}{nextHalvingBlock(shown.block,card.halvingPeriod)}.</p>}
      </details>
    </ArenaInspection>}

    {inspect?.kind==='hero'&&inspectedHero&&<ArenaInspection key={inspect.uid} {...inspectionProps}
      title={locale.heroName(inspectedHero.heroId)} eyebrow={inspect.owner===0?locale.t('Ваш правитель','Your ruler'):locale.t('Правитель противника','Enemy ruler')}
      kind="ruler"
      art={heroPortraitPath(inspectedHero.heroId)}
      actions={inspect.owner===0?<button className={styles.primary} disabled={!powerAction} onClick={()=>{if(powerAction)dispatch(powerAction);}}>{powerAction?<><span className={styles.costChip}>{effectivePowerCost(shown,0)}</span>{locale.powerName(inspectedHero.heroId)}</>:view.busy?locale.t('Действие завершается','Action in progress'):shown.turn!==0?locale.t('Ход противника','Enemy turn'):inspectedHero.heroPowerUsed?locale.t('Сила уже использована','Power already used'):locale.t('Недостаточно приказов','Not enough orders')}</button>:undefined}>
      <dl className={styles.inspectionStats}><div><dt>{locale.t('Казна','Treasury')}</dt><dd>{Math.max(0,inspectedHero.treasury)}</dd></div><div><dt>{locale.t('Цена силы','Power cost')}</dt><dd>{effectivePowerCost(shown,inspect.owner)}</dd></div></dl>
      <section className={styles.powerDescription}><h3>{locale.powerName(inspectedHero.heroId)}</h3><p className={styles.inspectionRules}>{powerRules(inspectedHero.heroId,locale.locale,rulesetOf(shown))}</p><p>{locale.t('Один раз за ход.','Once per turn.')}</p>{pendingValidatorOrders(shown,inspect.owner)>0&&<p className={styles.investmentPending}>{locale.t('+2 приказа в начале следующего своего хода.','+2 orders at the start of the next own turn.')}</p>}</section>
    </ArenaInspection>}

    {inspect&&['gas','block','deck','scroll'].includes(inspect.kind)&&<ArenaInspection key={inspect.kind} {...inspectionProps}
      title={inspect.kind==='gas'?locale.t('Приказы','Orders'):inspect.kind==='block'?locale.t('Ход','Turn'):inspect.kind==='deck'?locale.t('Колода','Deck'):locale.t('Очередь указов','Edict queue')}
      eyebrow={locale.t('Арена IMPERIVM','IMPERIVM arena')}
      actions={inspect.kind==='scroll'?<button onClick={()=>{setInspect(null);setHistoryOpen(true);}}>{locale.t('История боя','Battle history')}</button>:undefined}>
      {inspect.kind==='gas'&&<><dl className={styles.inspectionStats}><div><dt>{locale.t('Доступно','Available')}</dt><dd>{me.gas}</dd></div><div><dt>{locale.t('Запас','Capacity')}</dt><dd>{me.maxGas}</dd></div><div><dt>{locale.t('Бонус','Bonus')}</dt><dd>+{ordersView(me.gas,me.maxGas).bonus}</dd></div></dl><p className={styles.inspectionRules}>{locale.t('Карты и сила правителя расходуют приказы. Каждый светящийся камень — один доступный приказ.','Cards and the ruler’s power spend orders. Each lit stone is one available order.')}</p><details className={styles.inspectionExtra}><summary>{locale.t('Пополнение и бонусы','Refill and bonuses')}</summary><p>{locale.t('Запас пополняется в начале вашего хода. Золотистые камни — бонусные. За пределами десяти ячеек остаток указан числом.','Refill at the start of your turn. Gold stones are bonuses. Extra orders beyond ten sockets are counted numerically.')}</p></details></>}
      {inspect.kind==='gas'&&<div className={styles.factionLink}><strong>{locale.t('Связка фракции · +1 приказ','Faction link · +1 order')}</strong><p>{locale.t('Разыграйте две карты одной фракции за один ход. Вторая вернёт один приказ, один раз за ход для каждой фракции. Сначала нужно оплатить полную цену карты.','Play two cards of the same faction in one turn. The second refunds one order, once per turn per faction. Pay the full card cost first.')}</p></div>}
      {inspect.kind==='block'&&<><dl className={styles.inspectionStats}><div><dt>{locale.t('Блок','Block')}</dt><dd>{shown.block}</dd></div></dl><p className={styles.inspectionRules}>{locale.t('В начале вашего хода срабатывают ваши указы и восстанавливается запас приказов.','Your edicts resolve and orders refill at the start of your turn.')}</p></>}
      {inspect.kind==='deck'&&<><dl className={styles.inspectionStats}><div><dt>{locale.t('Карт осталось','Cards remaining')}</dt><dd>{me.deck.length}</dd></div></dl><p>{locale.t('Строй: ','Court: ')}{me.board.length}/{boardCapacity(me)} · {locale.t('Расширение агоры добавляет место, максимум до 7.','Agora Expansion adds a slot, up to 7.')}</p><p className={styles.inspectionRules}>{locale.t('В начале хода вы берёте следующую карту.','Draw the next card at the start of your turn.')}</p><p>{locale.t('Пустая колода наносит урон казне.','An empty deck damages your treasury.')}</p></>}
      {inspect.kind==='scroll'&&<><p className={styles.inspectionRules}>{locale.t('В начале следующего хода владельца, по порядку.','At the start of the owner’s next turn, in cast order.')}</p>{([0,1] as const).map(owner=><section className={styles.queueGroup} key={owner}><h3>{owner===0?locale.t('Ваши указы','Your edicts'):locale.t('Указы соперника','Enemy edicts')}</h3>{mempoolOf(shown,owner).length?mempoolOf(shown,owner).map((entry,index)=><button className={styles.queueEntry} key={entry.uid} onClick={()=>setInspect({kind:'queue',uid:`queued-${entry.uid}`,owner,cardId:entry.cardId})}><span>{index+1}</span><img src={cardArtPath(entry.cardId)} alt=""/><strong>{locale.cardName(entry.cardId)}</strong></button>):<p className={styles.queueEmpty}>{locale.t('Очередь пуста.','No pending edicts.')}</p>}</section>)}</>}
    </ArenaInspection>}

    {keyboard && <section ref={actionPanel} className={styles.actionsPanel} role="dialog" aria-label={locale.t('Доступные действия', 'Available actions')}><button className={styles.close} onClick={() => setKeyboard(false)} aria-label={locale.t('Закрыть действия', 'Close actions')}><RomanIcon name="close"/></button><h2>{locale.t('Доступные действия', 'Available actions')}</h2><p>{locale.t('Управление с клавиатуры: Tab, Enter. Esc закрывает окно.', 'Keyboard controls: Tab, Enter. Esc closes the panel.')}</p>{view.state.turn === 0 && !view.busy ? legal.map((action, index) => <button key={index} onClick={() => dispatch(action)}>{actionLabel(action)}</button>) : <p>{view.busy ? locale.t('Завершаем действие…', 'Resolving the action…') : locale.t('Сейчас ход соперника.', 'It is the opponent’s turn.')}</p>}</section>}

    {help && <div className={styles.modalBackdrop}><section ref={helpPanel} className={styles.help} role="dialog" aria-modal="true" aria-label={locale.t('Меню игры', 'Game menu')}>
      <button className={styles.close} onClick={() => setHelp(false)} aria-label={locale.t('Закрыть меню', 'Close menu')}><RomanIcon name="close"/></button>
      <h2>{locale.t('Пауза', 'Pause')}</h2>
      <div className={styles.helpBody}><div className={styles.menuActions}>
        <button className={styles.primary} onClick={() => setHelp(false)}>{locale.t('Продолжить', 'Resume')}</button>
        <button onClick={()=>{setHelp(false);setHistoryOpen(true);}}>{locale.t('История боя','Battle history')}</button>
        <ArenaFeedbackSettings/>
        <button onClick={() => { void unlockAudio(); setMuted(!muted); }}>{muted ? locale.t('Звук: выключен', 'Sound: off') : locale.t('Звук: включён', 'Sound: on')}</button>
        <button onClick={() => locale.setLocale(locale.locale === 'ru' ? 'en' : 'ru')}>{locale.locale === 'ru' ? 'Язык: Русский' : 'Language: English'}</button>
        <button onClick={() => {const next=quality==='auto'?'sharp':quality==='sharp'?'fast':'auto';setQuality(next);try{localStorage.setItem('imperivm-arena-quality',next);}catch{}}}>{locale.t('Изображение: ', 'Image: ')}{quality==='auto'?locale.t('авто','auto'):quality==='sharp'?locale.t('чётче','sharper'):locale.t('быстрее','faster')}</button>
        <button onClick={() => { restart(); setHelp(false); }}>{locale.t('Начать заново', 'New battle')}</button>
      </div>
      <details><summary>{locale.t('Управление', 'Controls')}</summary><p>{locale.t('Перетащите карту на поле. Скрещённые мечи — боец готов атаковать: выберите его и цель. Z — боец только вступил в строй. Перечёркнутый круг — действие потрачено. Тёплый свет на кнопке хода — доступных карт, атак и силы правителя больше нет; гарнизон остаётся по вашему выбору. Мгновенные заклинания действуют сразу. Указы ждут начала следующего своего хода в очереди слева.', 'Drag a card to the court. Crossed swords mean a fighter can attack: select it and a target. Z marks a newly deployed fighter. A crossed circle means its action is spent. A warm turn button means no cards, attacks or ruler power remain; garrison is optional. Instant spells resolve on play. Edicts wait in the left queue until the owner’s next turn.')}</p><button onClick={() => {setHelp(false);setKeyboard(true);}}>{locale.t('Действия с клавиатуры', 'Keyboard actions')}</button></details>
      <Link className={styles.leaveArena} href="/arena">{locale.t('Покинуть арену', 'Leave arena')}</Link></div>
    </section></div>}

    {historyOpen&&<div className={styles.modalBackdrop}><section ref={historyPanel} className={styles.history} role="dialog" aria-modal="true" aria-label={locale.t('История боя','Battle history')}><button className={styles.close} onClick={()=>setHistoryOpen(false)} aria-label={locale.t('Закрыть историю','Close history')}><RomanIcon name="close"/></button><BattleChronicle entries={view.history} locale={locale.locale} cardName={locale.cardName} heroName={locale.heroName} powerName={locale.powerName} onCard={(cardId,owner)=>{setHistoryOpen(false);setInspect({kind:'queue',uid:'historical-card',owner,cardId});}}/></section></div>}

    {practice.pending && <Dialog title={locale.t('Подписать начало матча · devnet','Sign match start · devnet')} onClose={practice.demo}>
      <p className="integration-note">{locale.t('Бесплатная подпись Phantom подтвердит участие вашего кошелька в этом матче с ИИ. Победа откроет создание NFT-бейджа. Можно продолжить без подписи.', 'A free Phantom message signature records wallet participation in this AI match. Winning unlocks the NFT badge. You can continue without signing.')}</p>
      <div className="dialog-actions"><button className="primary-button" disabled={practice.signing} onClick={() => void practice.sign()}>{practice.signing ? locale.t('Ожидаем Phantom…','Waiting for Phantom…') : locale.t('Подписать и играть','Sign & play')}</button><button className="secondary-button" disabled={practice.signing} onClick={practice.demo}>{locale.t('Продолжить в демо','Continue in demo')}</button></div>
      {practice.error && <p className="integration-error" role="status">{locale.errorText(practice.error)}</p>}
    </Dialog>}
    {shown.winner !== null && !view.busy && <div className={styles.modalBackdrop}><section ref={resultPanel} className={`${styles.result} ${styles.resultWithFx}`} role="dialog" aria-modal="true" aria-label={locale.t('Результат боя','Battle result')}><span className={styles.eyebrow}>IMPERIVM</span><BattleResultEmblem outcome={shown.winner===0?'win':shown.winner==='draw'?'draw':'loss'} reduced={reduced} title={shown.winner===0?locale.t('Ваша империя устояла','Your empire stands'):shown.winner==='draw'?locale.t('Империи пали вместе','Both empires fell'):locale.t('Казна опустела','The treasury is empty')} replayLabel={locale.t('Повторить триумф','Replay triumph')}/><p>{shown.winner===0?locale.t('Венец заслужен. Империя помнит победу.','Your laurel is earned. The empire remembers.'):locale.t('Каждая потеря — урок для следующего боя.','Every loss is a lesson for the next battle.')}</p><button className={styles.primary} onClick={()=>restart()}>{locale.t('Ещё один бой','Another battle')}</button></section></div>}
    {debug && <output hidden data-action={JSON.stringify({last:lastAction,turn:shown.turn,block:shown.block,busy:view.busy,command:view.busy?'busy':battleCommand(shown),history:view.history.length,orders:me.gas,capacity:me.maxGas,pendingOrders:pendingValidatorOrders(shown,0),ruleset:rulesetOf(shown),queued:mempoolOf(shown,0).map(entry=>entry.cardId)})}/>}
    {debug && metrics && <output className={styles.metrics} hidden data-perf={JSON.stringify(metrics)}>{metrics.drawCalls} draws · {Math.round(metrics.triangles).toLocaleString()} triangles · {metrics.meshes} meshes · {metrics.models} models · {metrics.failedModels} failed · {metrics.frameMedianMs}/{metrics.frameP95Ms} ms median/p95 · 1 canvas</output>}
  </main>;
}
