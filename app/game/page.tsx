'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  applyAction,
  createGame,
  legalActions,
  mempoolOf,
  effectivePowerCost,
  mulliganAvailable,
} from '../../lib/engine/engine';
import { chooseAiAction } from '../../lib/ai';
import { CARDS } from '../../lib/cards';
import { DECKS } from '../../lib/decks';
import { HEROES } from '../../lib/heroes';
import type {
  Action,
  CardDef,
  GameState,
  HandCard,
  MempoolEntry,
  Minion,
  PlayerId,
} from '../../lib/engine/types';
import CardView, { CardBack, LungeWrap, MinionToken } from '../../components/CardView';
import {
  DndProvider,
  DraggableHandCard,
  DraggableAttacker,
  DroppableBoard,
  DroppableMinion,
  DroppableFoeHero,
  CardDragOverlay,
  useDragState,
  getDragData,
  minionUidFromDropId,
  DROP_BOARD_ID,
  DROP_FOE_HERO_ID,
} from '../../components/dnd';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import WalletBar from '../../components/WalletBar';
import HeroPortrait from '../../components/HeroPortrait';
import Dialog from '../../components/Dialog';
import ArenaSettings, { useBoardSkin } from '../../components/ArenaSettings';
import MechanicsGuide, { MECHANICS } from '../../components/MechanicsGuide';
import { emptyMatchStats, updateMatchStats, type MatchStats } from '../../lib/ui/matchStats';
import { play as playSound } from '../../lib/audio/sfx';
import {
  diffBattleFx,
  type DyingMinion,
  type UiFloat,
} from '../../components/battleFx';
import MotionFx from '../../components/MotionFx';
import MuteButton from '../../components/MuteButton';
import { diffAction, type BattleEvents } from '../../lib/events';
import { emitSfxFromEvents, markAmbientStarted, shouldStartAmbient } from '../../lib/audio/events';
import { startAmbient } from '../../lib/audio/sfx';
import { useReducedMotion } from '../../lib/prefersReducedMotion';
import { useImperivmWallet } from '../../components/WalletContext';
import type { PlayProof } from '../../lib/solana/proof';
import { saveMatch } from '../../lib/matches';
import { loadCustomDeck } from '../../lib/deckbuilder';

const ME: PlayerId = 0;
const FOE: PlayerId = 1;
const ONBOARDING_KEY = 'imperivm-onboarding-seen';

/** true on md+ screens; used to switch the hand between fan and tap-to-zoom carousel. */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isDesktop;
}

export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-abyss flex items-center justify-center text-gold font-display text-2xl">
          Entering the arena…
        </div>
      }
    >
      <GameBoard />
    </Suspense>
  );
}

function GameBoard() {
  const searchParams = useSearchParams();
  const heroParam = searchParams.get('hero');
  const heroId = heroParam && HEROES[heroParam] ? heroParam : 'whale';
  const aiHeroId = heroId === 'degen' ? 'validator' : 'degen';
  const useCustom = searchParams.get('deck') === 'custom';

  const [state, setState] = useState<GameState | null>(null);
  const [attackerUid, setAttackerUid] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [zoomUid, setZoomUid] = useState<string | null>(null);
  const isDesktop = useIsDesktop();
  const [skin, setSkin] = useBoardSkin();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [inspectUid, setInspectUid] = useState<string | null>(null);
  const [inspectCardId, setInspectCardId] = useState<string | null>(null);
  const [mulliganPicks, setMulliganPicks] = useState<string[]>([]);
  const [stats, setStats] = useState<MatchStats>(emptyMatchStats);
  const [autoplay, setAutoplay] = useState(false);
  const wallet = useImperivmWallet();
  const walletOwner = useRef(wallet.owner); walletOwner.current = wallet.owner;
  const [proofPending, setProofPending] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proof, setProof] = useState<PlayProof | null>(null);
  const match = useRef({ id: '', owner: 'demo', startedAt: '', exhibition: false });
  if (autoplay) match.current.exhibition = true;
  const aiSteps = useRef(0);


  // battle FX state (all derived from state diffs — engine untouched)
  const [floats, setFloats] = useState<UiFloat[]>([]);
  const [dying, setDying] = useState<(DyingMinion & { key: number })[]>([]);
  const [attackAnim, setAttackAnim] = useState<{ attackerUid: string; targetUid: string; key: number } | null>(null);
  const [playedUids, setPlayedUids] = useState<Set<string>>(new Set());
  const [dealtUids, setDealtUids] = useState<Set<string>>(new Set());
  const [mempoolFx, setMempoolFx] = useState<{ kind: 'resolve' | 'counter'; key: number } | null>(null);
  const [screenFx, setScreenFx] = useState<{ kind: 'rug' | 'halving'; key: number } | null>(null);
  // package 2 + 3 wiring
  const [events, setEvents] = useState<BattleEvents | null>(null);
  const [playRects, setPlayRects] = useState<{ from: DOMRect; to: DOMRect } | null>(null);
  const [bodyShakeKey, setBodyShakeKey] = useState(0);
  const lastActionRef = useRef<Action | null>(null);
  const stateBeforeActionRef = useRef<GameState | null>(null);
  const reduced = useReducedMotion();

  const prevRef = useRef<GameState | null>(null);
  const fxKey = useRef(0);
  const logBoxRef = useRef<HTMLDivElement>(null);
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.current.delete(timer); callback(); }, delay);
    timers.current.add(timer);
  }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear(); }, []);


  const startGame = useCallback(
    (seed?: number) => {
      match.current = { id: crypto.randomUUID(), owner: walletOwner.current ?? 'demo', startedAt: new Date().toISOString(), exhibition: false };
      setProof(null); setProofError(null); setProofPending(!!walletOwner.current);
      timers.current.forEach(clearTimeout); timers.current.clear();
      const s = createGame(
        heroId,
        (useCustom ? loadCustomDeck(heroId) : null) ?? DECKS[heroId] ?? DECKS.whale,
        aiHeroId,
        DECKS[aiHeroId] ?? DECKS.degen,
        { enableMulligan: true },
        seed,
      );
      prevRef.current = null;
      setState(s);
      setStats(emptyMatchStats());
      setMulliganPicks([]);
      setAutoplay(false);
      aiSteps.current = 0;
      setZoomUid(null);
      setInspectUid(null);
      setAttackerUid(null);
      setAiThinking(false);
      setFloats([]);
      setDying([]);
      setAttackAnim(null);
      setPlayedUids(new Set());
      setMempoolFx(null);
      setScreenFx(null);
      setEvents(null);
      setPlayRects(null);
      lastActionRef.current = null;
      stateBeforeActionRef.current = null;
      // opening hand slides in from the deck
      const opening = new Set(s.players[ME].hand.map(h => h.uid));
      setDealtUids(opening);
      schedule(() => {
        setDealtUids(cur => {
          const n = new Set(cur);
          opening.forEach(u => n.delete(u));
          return n;
        });
      }, 1800);
      // first-game onboarding, shown once (localStorage)
      try {
        if (!localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
      } catch {
        /* storage unavailable — show anyway */
        setShowOnboarding(true);
      }
    },
    [heroId, aiHeroId, useCustom],
  );

  // Create the game client-side only (never during SSR).
  useEffect(() => {
    startGame();
  }, [startGame]);

  // Lazy-start the imperial ambient loop on the first deliberate user
  // gesture, then remember it across navigation (localStorage).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!shouldStartAmbient()) return;
    const handler = () => {
      startAmbient();
      markAmbientStarted(true);
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  // RUG PULL — toggle the body shake class so the whole viewport jolts.
  useEffect(() => {
    if (typeof document === 'undefined' || reduced) return;
    if (bodyShakeKey === 0) return;
    document.body.classList.add('rug-shake-body');
    const t = setTimeout(() => document.body.classList.remove('rug-shake-body'), 720);
    return () => { clearTimeout(t); document.body.classList.remove('rug-shake-body'); };
  }, [bodyShakeKey, reduced]);

  // AI loop: one action every ~600ms until the AI ends its turn.
  useEffect(() => {
    if (!state || state.winner !== null || showOnboarding || proofPending || !(state.turn === FOE || autoplay)) return;
    const t = setTimeout(() => {
      try {
        aiSteps.current++;
        const action: Action = aiSteps.current > 100 && !mulliganAvailable(state) ? { type: 'end-turn' } : chooseAiAction(state);
        lastActionRef.current = action;
        stateBeforeActionRef.current = state;
        setState(applyAction(state, action));
        if (action.type === 'end-turn') { setAiThinking(state.turn === ME); aiSteps.current = 0; }
      } catch {
        const fallback: Action = mulliganAvailable(state) ? { type: 'mulligan', uids: [] } : { type: 'end-turn' };
        lastActionRef.current = fallback;
        stateBeforeActionRef.current = state;
        setState(applyAction(state, fallback));
        setAiThinking(false);
      }
    }, autoplay ? 380 : 520);
    return () => clearTimeout(t);
  }, [state, autoplay, showOnboarding, proofPending]);

  // Derive battle animations from the diff between consecutive states.
  useEffect(() => {
    if (!state) return;
    const prev = prevRef.current;
    prevRef.current = state;
    if (!prev) return;
    // diffBattleFx still takes (prev, next, action) so the engine contract
    // stays unchanged. When the caller forgot to record an action (the
    // AI loop does this), we fall back to a heuristic.
    const action = lastActionRef.current;
    const fx = diffBattleFx(prev, state, action ?? undefined);
    setStats(old => updateMatchStats(old, prev, state, action, diffAction(prev, state, action ?? undefined)));

    // ── structured event payload (lib/events.ts) ──
    if (stateBeforeActionRef.current) {
      try {
        const ev = diffAction(stateBeforeActionRef.current, state, lastActionRef.current ?? ({ type: 'end-turn' } as Action));
        if (ev !== null) {
          // SFX: a single pass per logical action. Same adapter as the
          // visual layer, so motion and audio can never desync.
          emitSfxFromEvents(ev);
          setEvents(ev);
          if (ev.play) {
            // Clear playRects after the flight consumes it (so a stale
            // rect does not animate twice).
            schedule(() => setPlayRects(null), 950);
          }
          // Rug-pull also shakes the entire document so the red vortex
          // is not the only cue — the player feels it.
          if (ev.rugPull && !reduced) {
            setBodyShakeKey(k => k + 1);
          }
        }
      } catch {
        /* keep going with the legacy FX pipeline */
      }
      stateBeforeActionRef.current = null;
      lastActionRef.current = null;
    }

    if (fx.floats.length > 0) {
      const keyed = fx.floats.map(f => ({ ...f, key: ++fxKey.current }));
      const keys = keyed.map(k => k.key);
      setFloats(cur => [...cur.slice(-24), ...keyed]);
      schedule(() => setFloats(cur => cur.filter(f => !keys.includes(f.key))), 1450);
    }
    if (fx.deaths.length > 0) {
      const keyed = fx.deaths.map(d => ({ ...d, key: ++fxKey.current }));
      const keys = keyed.map(k => k.key);
      setDying(cur => [...cur, ...keyed]);
      schedule(() => setDying(cur => cur.filter(d => !keys.includes(d.key))), 900);
    }
    if (fx.attack) {
      const key = ++fxKey.current;
      setAttackAnim({ ...fx.attack, key });
      schedule(() => setAttackAnim(cur => (cur && cur.key === key ? null : cur)), 700);
    }
    if (fx.newBoardUids.length > 0) {
      const uids = fx.newBoardUids;
      setPlayedUids(cur => {
        const n = new Set(cur);
        uids.forEach(u => n.add(u));
        return n;
      });
      schedule(() => {
        setPlayedUids(cur => {
          const n = new Set(cur);
          uids.forEach(u => n.delete(u));
          return n;
        });
      }, 800);
    }
    if (fx.newHandUids.length > 0) {
      const uids = fx.newHandUids;
      setDealtUids(cur => {
        const n = new Set(cur);
        uids.forEach(u => n.add(u));
        return n;
      });
      schedule(() => {
        setDealtUids(cur => {
          const n = new Set(cur);
          uids.forEach(u => n.delete(u));
          return n;
        });
      }, 1700);
    }
    if (fx.resolvedNames.length > 0 || fx.countered) {
      const key = ++fxKey.current;
      setMempoolFx({ kind: fx.countered ? 'counter' : 'resolve', key });
      schedule(() => setMempoolFx(cur => (cur && cur.key === key ? null : cur)), 1400);
    }
    if (fx.rugPull) {
      const key = ++fxKey.current;
      setScreenFx({ kind: 'rug', key });
      schedule(() => setScreenFx(cur => (cur && cur.key === key ? null : cur)), 1300);
    } else if (fx.halving) {
      const key = ++fxKey.current;
      setScreenFx({ kind: 'halving', key });
      schedule(() => setScreenFx(cur => (cur && cur.key === key ? null : cur)), 1300);
    }
  }, [state]);

  // Keep the log pinned to the bottom when open.
  const logLength = state?.log.length ?? 0;
  useEffect(() => {
    const el = logBoxRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state?.log, logOpen]);

  const legal = useMemo<Action[]>(() => (state ? legalActions(state) : []), [state]);
  useEffect(() => {
    if (!state || state.winner === null || proofPending || !match.current.id) return;
    saveMatch({ id: match.current.id, owner: proof?.owner ?? 'demo', heroId, won: state.winner === ME, draw: state.winner === 'draw', blocks: state.block, playedAt: match.current.startedAt, stats, exhibition: match.current.exhibition, proofSignature: proof?.signature });
  }, [state?.winner, state?.block, stats, proof, proofPending, heroId]);
  async function approvePlayProof() {
    const captured = match.current.id;
    setProofError(null);
    try {
      const receipt = await wallet.signPlay(captured, heroId);
      if (match.current.id !== captured) return;
      setProof(receipt); setProofPending(false);
      try { sessionStorage.setItem(`imperivm.proof.${captured}`, JSON.stringify(receipt)); } catch { /* optional receipt */ }
    } catch (e) { if (match.current.id === captured) setProofError(e instanceof Error ? e.message : 'Signing declined. You can still play the demo.'); }
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-abyss">
        <WalletBar />
        <div className="flex items-center justify-center py-32 text-gold font-display text-2xl">
          Shuffling decks…
        </div>
      </div>
    );
  }

  const me = state.players[ME];
  const foe = state.players[FOE];
  const myHero = HEROES[me.heroId];
  const foeHero = HEROES[foe.heroId];
  const myTurn = state.turn === ME && !aiThinking && state.winner === null && !proofPending && !showOnboarding;

  const playableUids = new Set<string>();
  for (const a of legal) {
    if (a.type === 'play-minion' || a.type === 'cast-spell') playableUids.add(a.uid);
  }
  const hpAction = legal.find(a => a.type === 'hero-power');

  const act = (action: Action, opts?: { collectPlayRects?: boolean }) => {
    if (!myTurn || stateBeforeActionRef.current) return;
    try {
      // Capture before-state + the action so the post-state diff can use
      // them. This replaces the old log-slice approach (which broke once
      // the log cap kicked in).
      stateBeforeActionRef.current = state;
      lastActionRef.current = action;

      // For card plays: capture source (hand) and target (board) rects.
      if (opts?.collectPlayRects && state && (action.type === 'play-minion' || action.type === 'cast-spell')) {
        const fromEl = document.querySelector<HTMLElement>(`[data-hand-uid="${action.uid}"]`);
        const toEl = document.querySelector<HTMLElement>(`#my-board-slot`);
        if (fromEl && toEl) {
          setPlayRects({ from: fromEl.getBoundingClientRect(), to: toEl.getBoundingClientRect() });
        }
      }

      const next = applyAction(state, action);
      if (action.type === 'end-turn') { setAiThinking(true); playSound('end-turn'); }
      else if (action.type === 'stake' || action.type === 'unstake') playSound('stake');
      else if (action.type === 'hero-power') playSound('ui-click');
      setState(next);
    } catch {
      stateBeforeActionRef.current = null; lastActionRef.current = null;
    }
  };

  const endTurn = () => {
    if (!myTurn) return;
    act({ type: 'end-turn' });
  };

  const onHandClick = (uid: string) => {
    const action = legal.find(
      a => (a.type === 'play-minion' || a.type === 'cast-spell') && a.uid === uid,
    );
    if (action) {
      act(action, { collectPlayRects: true });
      setAttackerUid(null);
    }
  };

  const onMyMinionClick = (m: Minion) => {
    if (!myTurn) return;
    if (attackerUid === m.uid) {
      setAttackerUid(null);
      return;
    }
    const canAttackNow = legal.some(a => a.type === 'attack' && a.attackerUid === m.uid);
    if (canAttackNow) setAttackerUid(m.uid);
  };

  const onFoeMinionClick = (m: Minion) => {
    if (!myTurn || !attackerUid) return;
    const action = legal.find(
      a => a.type === 'attack' && a.attackerUid === attackerUid && a.target === m.uid,
    );
    if (action) {
      act(action);
      setAttackerUid(null);
    }
  };

  const onFoeHeroClick = () => {
    if (!myTurn || !attackerUid) return;
    const action = legal.find(
      a => a.type === 'attack' && a.attackerUid === attackerUid && a.target === 'hero',
    );
    if (action) {
      act(action);
      setAttackerUid(null);
    }
  };

  // ── drag-and-drop: mapping onto the existing click handlers ──
  const handleDragStart = (event: DragStartEvent) => {
    const data = getDragData(event.active);
    if (data?.type === 'attacker') {
      // same check as onMyMinionClick: the attacker must be able to attack
      const canAttackNow = legal.some(a => a.type === 'attack' && a.attackerUid === data.uid);
      if (canAttackNow) setAttackerUid(data.uid);
      // existing attackable/highlight states pick up the selection automatically,
      // so valid targets glow red while dragging
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = getDragData(event.active);
    const overId = event.over?.id;
    if (data?.type === 'hand-card' && overId === DROP_BOARD_ID) {
      onHandClick(data.uid); // same as click: finds play-minion/cast-spell in legal
    } else if (data?.type === 'attacker') {
      const targetUid = overId ? minionUidFromDropId(overId) : null;
      if (targetUid) {
        const target = foe.board.find(m => m.uid === targetUid);
        if (target) onFoeMinionClick(target); // onMyMinionClick ran in handleDragStart
      } else if (overId === DROP_FOE_HERO_ID) {
        onFoeHeroClick();
      }
    }
    setAttackerUid(null);
  };

  const handleDragCancel = () => setAttackerUid(null);

  const onStake = (uid: string) => {
    const a = legal.find(x => x.type === 'stake' && x.uid === uid);
    if (a) act(a);
  };
  const onUnstake = (uid: string) => {
    const a = legal.find(x => x.type === 'unstake' && x.uid === uid);
    if (a) act(a);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    try {
      localStorage.setItem(ONBOARDING_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const floatsFor = (uid: string) => floats.filter(f => f.targetUid === uid);
  const ghostOf = (d: DyingMinion): Minion => ({
    uid: d.uid,
    cardId: d.cardId,
    name: d.name,
    attack: d.attack,
    health: 0,
    maxHealth: d.health,
    canAttack: false,
    staked: false,
  });

  const myMempool = mempoolOf(state, ME);
  const foeMempool = mempoolOf(state, FOE);
  const selectedAttacker = me.board.find(m => m.uid === attackerUid);
  const canHitFoeHero =
    !!attackerUid && legal.some(a => a.type === 'attack' && a.attackerUid === attackerUid && a.target === 'hero');

  const phaseText =
    state.winner !== null
      ? 'Game over'
      : mulliganAvailable(state)
        ? state.turn === ME ? 'Mulligan · keep or replace your opening cards' : 'Rival chooses an opening hand…'
      : myTurn
        ? attackerUid && selectedAttacker
          ? `Choose a target for ${selectedAttacker.name} — or click it again to cancel`
          : 'Your turn — play cards, attack, stake'
        : 'Rival is thinking…';

  const foeAttackable = (m: Minion) =>
    !!attackerUid && legal.some(a => a.type === 'attack' && a.attackerUid === attackerUid && a.target === m.uid);

  return (
    <DndProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className={`game-shell board-${skin}`} style={{ ['--board-art' as string]: `url('/boards/${skin}.webp')` }}>
        <WalletBar />
        <main className="game-content">
          <nav className="arena-toolbar" aria-label="Match controls">
            <Link href="/" className="quiet-link">← Heroes</Link>
            <span className="block-plaque">BLOCK <b>{state.block.toString().padStart(2, '0')}</b></span>
            <div className="toolbar-actions">
              <button className="icon-button" onClick={() => setHelpOpen(true)} aria-label="Open rulebook">?</button>
              <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Arena settings">⚙</button>
              <button className="icon-button" onClick={() => startGame(Date.now() & 0x7fffffff)} aria-label="Restart match">↻</button>
            </div>
          </nav>
          <section className="battlefield" aria-label="Battlefield">
            <DroppableFoeHero><div className={`combatant rival ${canHitFoeHero ? 'legal-target' : ''}`}>
              <HeroPortrait hero={foeHero} treasury={foe.treasury} foe deckCount={foe.deck.length} handCount={foe.hand.length}
                floats={floatsFor('hero-1')} highlight={canHitFoeHero} shaking={attackAnim?.targetUid === 'hero-1'}
                onClick={canHitFoeHero ? onFoeHeroClick : undefined}
                onKeyDown={canHitFoeHero ? e => { if (e.key === 'Enter' || e.key === ' ') onFoeHeroClick(); } : undefined} />
              <span className="combatant-label">RIVAL · AI</span>
            </div></DroppableFoeHero>
            <div className="rank-row enemy-rank" aria-label="Rival minions">
              <div className="rank-label">Rival ranks <span>{foe.board.length}/7</span></div>
              <div className="rank-scroll thin-scroll">
                {foe.board.length === 0 && <div className="empty-rank">The rival’s ranks are quiet.</div>}
                {foe.board.map(m => <DroppableMinion key={m.uid} uid={m.uid} foe><LungeWrap active={attackAnim?.attackerUid === m.uid} up={false}>
                  <MinionToken minion={m} attackable={foeAttackable(m)} shaking={attackAnim?.targetUid === m.uid}
                    justPlayed={playedUids.has(m.uid)} floats={floatsFor(m.uid)}
                    onClick={() => attackerUid && foeAttackable(m) ? onFoeMinionClick(m) : setInspectUid(m.uid)} />
                </LungeWrap></DroppableMinion>)}
                {dying.filter(d => d.owner === FOE).map(d => <MinionToken key={`dying-${d.key}`} minion={ghostOf(d)} dying floats={floatsFor(d.uid)} />)}
              </div>
            </div>
            <section className={`chain-strip ${mempoolFx ? 'mempool-flash-resolve' : ''}`} aria-label="Public mempool">
              <button className="chain-label" onClick={() => setHelpOpen(true)} title={MECHANICS.Mempool}>⛓ MEMPOOL <b>{myMempool.length + foeMempool.length}</b></button>
              <div className="chain-entries thin-scroll">
                {!myMempool.length && !foeMempool.length && <span className="chain-empty">Cast now. Resolve next own turn.</span>}
                {[...foeMempool, ...myMempool].map(e => <button key={e.uid} className={`queued-spell ${e.owner === ME ? 'mine' : 'theirs'} mempool-glow`}
                  onClick={() => setInspectCardId(e.cardId)} title={CARDS[e.cardId].text}>
                  <img src={`/cards/${e.cardId}.webp`} alt="" /><span>{e.name}</span><small>{e.owner === ME ? 'YOU' : 'RIVAL'}</small>
                </button>)}
              </div>
            </section>
            <div className={`turn-status ${myTurn ? 'your-turn' : ''}`} role="status" aria-live="polite">
              {autoplay ? 'Demo autoplay · pause below to take control' : phaseText}
              {attackerUid && <button onClick={() => setAttackerUid(null)} className="cancel-target">Cancel</button>}
            </div>
            <DroppableBoard><div id="my-board-slot" className="rank-row own-rank" aria-label="Your minions">
              <div className="rank-label">Your ranks <span>{me.board.length}/7</span>
                {!!me.pavilionBonuses?.length && <b className="pavilion-tag" title={MECHANICS.Pavilion}>Pavilion +1 gas</b>}
              </div>
              <div className="rank-scroll thin-scroll">
                {me.board.length === 0 && <div className="empty-rank">Raise your legion. Play a minion.</div>}
                {me.board.map(m => {
                  const ready = myTurn && legal.some(a => a.type === 'attack' && a.attackerUid === m.uid);
                  const token = <LungeWrap active={attackAnim?.attackerUid === m.uid} up><MinionToken minion={m}
                    selected={attackerUid === m.uid} canAct={ready} shaking={attackAnim?.targetUid === m.uid}
                    justPlayed={playedUids.has(m.uid)} floats={floatsFor(m.uid)}
                    onClick={() => ready && attackerUid !== m.uid ? onMyMinionClick(m) : setInspectUid(m.uid)} /></LungeWrap>;
                  return ready && isDesktop ? <DraggableAttacker key={m.uid} uid={m.uid}>{token}</DraggableAttacker> : <div key={m.uid}>{token}</div>;
                })}
                {dying.filter(d => d.owner === ME).map(d => <MinionToken key={`dying-${d.key}`} minion={ghostOf(d)} dying floats={floatsFor(d.uid)} />)}
              </div>
            </div></DroppableBoard>
            <div className="combatant own"><HeroPortrait hero={myHero} treasury={me.treasury} deckCount={me.deck.length}
              handCount={me.hand.length} floats={floatsFor('hero-0')} shaking={attackAnim?.targetUid === 'hero-0'} />
              <div className="gas-meter" title={MECHANICS.Gas}><span>GAS</span><b>{me.gas}<small>/{me.maxGas}</small></b>
                <div aria-hidden>{Array.from({ length: Math.min(me.maxGas, 10) }, (_, i) => <i key={i} className={i < me.gas ? 'filled' : ''} />)}</div>
              </div>
            </div>
          </section>
          <section className="hand-zone" aria-label="Your hand">
            <div className="hand-heading"><span>YOUR HAND <b>{me.hand.length}/10</b></span><span>{mulliganAvailable(state) ? 'Select cards to replace' : 'Tap to inspect · drag to deploy'}</span></div>
            <div className="hand-scroll thin-scroll"><div className="hand-cards">
              {me.hand.length === 0 && <p className="empty-hand">An empty hand. A full empire of possibilities.</p>}
              {me.hand.map((hc, i) => {
                const def = CARDS[hc.cardId]; const playable = myTurn && playableUids.has(hc.uid);
                const selecting = mulliganAvailable(state) && state.turn === ME;
                const picked = mulliganPicks.includes(hc.uid);
                return <DraggableHandCard key={hc.uid} id={hc.uid} disabled={!playable || !isDesktop}>
                  <div data-hand-uid={hc.uid} className={`hand-card-wrap ${dealtUids.has(hc.uid) ? 'deal-in' : ''}`} style={{ animationDelay: `${i * 45}ms` }}>
                    <CardView card={def} size="sm" playable={playable} selected={picked}
                      onClick={() => selecting ? setMulliganPicks(old => old.includes(hc.uid) ? old.filter(u => u !== hc.uid) : [...old, hc.uid]) : setZoomUid(hc.uid)} />
                    {selecting && <span className={`mulligan-choice ${picked ? 'replace' : ''}`}>{picked ? 'REPLACE' : 'KEEP'}</span>}
                  </div>
                </DraggableHandCard>;
              })}
            </div></div>
          </section>
          <div className="action-dock">
            {mulliganAvailable(state) && state.turn === ME ? <>
              <span className="dock-hint">Build your opening hand.</span>
              <button className="gold-button" onClick={() => { act({ type: 'mulligan', uids: mulliganPicks }); setMulliganPicks([]); }}>
                {mulliganPicks.length ? `Replace ${mulliganPicks.length}` : 'Keep hand'}
              </button>
            </> : <>
              <button className={`power-button ${effectivePowerCost(state, ME) === 1 ? 'comeback-power' : ''}`} disabled={!myTurn || !hpAction || autoplay}
                onClick={() => hpAction && act(hpAction)} title={myHero.powerText}>
                <span>⚡ {myHero.powerName}</span><b>{effectivePowerCost(state, ME)} GAS</b>
              </button>
              <button className="gold-button end-turn-button" onClick={endTurn} disabled={!myTurn || autoplay}>
                {aiThinking ? 'Rival’s turn' : 'END TURN'}
              </button>
            </>}
          </div>
          <div className="arena-bottom"><button className="quiet-link" onClick={() => setLogOpen(true)}>Battle log ↗</button>
            <button className="quiet-link" onClick={() => setAutoplay(a => !a)}>{autoplay ? 'Ⅱ Pause demo' : '▷ Autoplay demo'}</button>
            <button className="quiet-link" onClick={() => setShowOnboarding(true)}>Learn to play</button>
          </div>
        </main>
        {showOnboarding && <OnboardingOverlay onClose={closeOnboarding} />}
        {proofPending && !showOnboarding && <Dialog title="Proof of play · devnet" onClose={() => setProofPending(false)}>
          <p className="text-sm text-parchment/80 leading-relaxed">Sign a free message for your match as <b>{myHero.name}</b>. Phantom will show the domain, match ID, nonce, timestamp, and devnet label.</p>
          <p className="integration-note">Match {match.current.id}<br />No transaction or payment. This verifies your wallet signature; gameplay runs locally against AI.</p>
          {proofError && <p className="integration-error" role="status">{proofError}</p>}
          <div className="dialog-actions"><button className="primary-button" disabled={wallet.busy || !wallet.owner} onClick={() => void approvePlayProof()}>{wallet.busy ? 'Waiting for Phantom…' : 'Sign & play'}</button><button className="secondary-button" onClick={() => setProofPending(false)}>Continue in demo</button></div>
        </Dialog>}
        {settingsOpen && <ArenaSettings skin={skin} onChange={setSkin} onClose={() => setSettingsOpen(false)} />}
        {helpOpen && <MechanicsGuide onClose={() => setHelpOpen(false)} />}
        {logOpen && <Dialog title="Battle log" onClose={() => setLogOpen(false)}><div ref={logBoxRef} className="battle-log thin-scroll">
          {state.log.map((line, i) => <p key={`${state.block}-${i}`}>{line}</p>)}
        </div></Dialog>}
        {zoomUid && (() => { const h = me.hand.find(h => h.uid === zoomUid); return h ? <CardZoomModal card={CARDS[h.cardId]}
          playable={myTurn && playableUids.has(h.uid) && !autoplay} onPlay={() => onHandClick(h.uid)} onClose={() => setZoomUid(null)} /> : null; })()}
        {inspectCardId && <CardZoomModal card={CARDS[inspectCardId]} playable={false} onPlay={() => {}} onClose={() => setInspectCardId(null)} />}
        {inspectUid && (() => {
          const m = [...me.board, ...foe.board].find(m => m.uid === inspectUid); if (!m) return null;
          const own = me.board.some(x => x.uid === m.uid); const canAttack = legal.some(a => a.type === 'attack' && a.attackerUid === m.uid);
          return <Dialog title={m.name} onClose={() => setInspectUid(null)}><div className="minion-detail">
            <CardView card={CARDS[m.cardId]} size="lg" tilt={false} />
            <p>Current stats: <b>{m.attack} attack · {m.health}/{m.maxHealth} health</b></p>
            <p>{m.staked ? 'Staked: +1 gas each own turn. Still attackable.' : m.canAttack ? 'Ready for combat.' : 'Cannot attack this turn.'}</p>
            {own && myTurn && !autoplay && <div className="dialog-actions">
              {canAttack && <button className="gold-button" onClick={() => { setAttackerUid(m.uid); setInspectUid(null); }}>Choose target</button>}
              {legal.some(a => a.type === 'stake' && a.uid === m.uid) && <button className="outline-button" onClick={() => { onStake(m.uid); setInspectUid(null); }}>Stake</button>}
              {legal.some(a => a.type === 'unstake' && a.uid === m.uid) && <button className="outline-button" onClick={() => { onUnstake(m.uid); setInspectUid(null); }}>Unstake</button>}
            </div>}
          </div></Dialog>;
        })()}
        {state.winner !== null && <EndOverlay winner={state.winner} blocks={state.block} stats={stats} onRematch={() => startGame(Date.now() & 0x7fffffff)} />}
        <DragPreview hand={me.hand} board={me.board} />
        <MotionFx events={events} playRects={playRects} reduced={reduced} />
      </div>
    </DndProvider>
  );
}

/** Floating preview of the dragged card, rendered in a portal. */
function DragPreview({ hand, board }: { hand: HandCard[]; board: Minion[] }) {
  const { dragType, dragUid } = useDragState();
  const cardId =
    dragType === 'hand-card'
      ? hand.find(h => h.uid === dragUid)?.cardId
      : dragType === 'attacker'
        ? board.find(m => m.uid === dragUid)?.cardId
        : undefined;
  return <CardDragOverlay card={cardId ? CARDS[cardId] : undefined} />;
}

/** A mempool spell: card back with cost pip and owner badge. */
function MempoolCard({ entry, ownerLabel, mine }: { entry: MempoolEntry; ownerLabel: string; mine: boolean }) {
  const def = CARDS[entry.cardId];
  return (
    <div
      className="relative mt-1 mempool-glow rounded-md"
      title={def ? `${entry.name} — ${def.text}` : entry.name}
    >
      <CardBack size="sm" />
      <span className="absolute -top-2 -left-1.5 w-5 h-5 rounded-full bg-solana/25 border border-solana text-solana text-[10px] font-bold flex items-center justify-center font-mono">
        {def?.cost ?? '?'}
      </span>
      <span
        className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] px-1 rounded border uppercase tracking-wider whitespace-nowrap bg-abyss ${
          mine ? 'text-mint border-mint/50' : 'text-blood border-blood/50'
        }`}
      >
        {ownerLabel}
      </span>
    </div>
  );
}

/** First-game onboarding: 3 numbered steps over a dimmed backdrop, shown once
 *  (localStorage key imperivm-onboarding-seen). Replaces the old hint. */
function OnboardingOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const lessons = [
    { icon: 'I', title: 'Raise your legion', body: 'Keep or replace your opening hand. Tap a card to inspect it, then pay its gas cost to deploy. Your gas refills and grows each own turn.' },
    { icon: 'II', title: 'Strike. Or stake.', body: 'Select a ready minion, then a glowing enemy target. Taunt guards must fall first. Tap your selected minion again to inspect or stake it for extra gas.' },
    { icon: 'III', title: 'Read the mempool', body: 'Spells resolve on your next own turn. A rival can counter them first with Priority. Watch for RUG PULL: it destroys both armies. Empty the rival’s 30 HP Treasury to win.' },
  ];
  const lesson = lessons[step];
  return <Dialog title="Welcome, Imperator" onClose={onClose}>
    <div className="onboarding-lesson"><span className="lesson-number">{lesson.icon}</span>
      <h3>{lesson.title}</h3><p>{lesson.body}</p>
      <div className="lesson-progress" aria-label={`Step ${step + 1} of 3`}>{lessons.map((_, i) => <i key={i} className={i === step ? 'active' : ''} />)}</div>
      <button className="gold-button" onClick={() => step < 2 ? setStep(step + 1) : onClose()}>{step < 2 ? 'Next →' : 'Enter the arena'}</button>
      <button className="quiet-link" onClick={onClose}>Skip tutorial</button>
    </div>
  </Dialog>;
}

/** Mobile zoom modal for a hand card: full readable card + Play / Close. */
function CardZoomModal({
  card,
  playable,
  onPlay,
  onClose,
}: {
  card: CardDef;
  playable: boolean;
  onPlay: () => void;
  onClose: () => void;
}) {
  return <Dialog title={card.name} onClose={onClose}>
    <div className="minion-detail"><CardView card={card} size="lg" tilt={false} playable={playable} />
      <div className="dialog-actions"><button className="gold-button" disabled={!playable} onClick={() => { onPlay(); onClose(); }}>Play card</button>
        <button className="outline-button" onClick={onClose}>Close</button></div>
      {!playable && <p className="small-note">Inspect anytime. Playing requires your turn, enough gas and a free minion slot.</p>}
    </div>
  </Dialog>;
}

/** Falling gold coins for the victory screen. */
function CoinConfetti() {
  const coins = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        dur: 2.6 + Math.random() * 2.4,
        size: 8 + Math.random() * 14,
      })),
    [],
  );
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {coins.map(c => (
        <span
          key={c.id}
          className="coin-confetti absolute -top-6"
          style={{
            left: `${c.left}%`,
            width: c.size,
            height: c.size,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            animationIterationCount: 'infinite',
          }}
        />
      ))}
    </div>
  );
}

/** Decorative laurel wreath for the victory screen. */
function Laurel() {
  const leaves = [0.15, 0.32, 0.5, 0.68, 0.85];
  return (
    <svg
      viewBox="0 0 220 70"
      className="laurel-shimmer mx-auto w-56 md:w-72 text-gold"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M110 62 Q 70 55 34 18" />
      <path d="M110 62 Q 150 55 186 18" />
      {leaves.map(t => {
        const lx = 110 - 76 * t;
        const rx = 110 + 76 * t;
        const y = 62 - 44 * t;
        return (
          <g key={t}>
            <ellipse cx={lx} cy={y} rx="10" ry="4.5" fill="currentColor" stroke="none" transform={`rotate(-38 ${lx} ${y})`} opacity="0.9" />
            <ellipse cx={rx} cy={y} rx="10" ry="4.5" fill="currentColor" stroke="none" transform={`rotate(38 ${rx} ${y})`} opacity="0.9" />
          </g>
        );
      })}
    </svg>
  );
}

function EndOverlay({
  winner,
  blocks,
  stats,
  onRematch,
}: {
  winner: PlayerId | 'draw';
  blocks: number;
  stats: MatchStats;
  onRematch: () => void;
}) {
  const win = winner === ME;
  const reduced = useReducedMotion();
  return (
    <div className="end-overlay fixed inset-0 z-[80] flex items-center justify-center bg-abyss/95 backdrop-blur-sm overflow-hidden">
      {win && !reduced && <CoinConfetti />}
      <div className="rise-in text-center px-6 relative z-10 max-w-lg">
        {win ? (
          <>
            <Laurel />
            <div className="font-display text-4xl md:text-7xl font-bold gold-text tracking-[0.12em]">
              VICTORIA!
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              Veni. Vidi. Rugi. The treasury is yours.
            </p>
          </>
        ) : winner === 'draw' ? (
          <>
            <div className="font-display text-4xl md:text-7xl font-bold text-lavender tracking-[0.12em]">
              DRAW
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              Both treasuries fall. Rome shrugs.
            </p>
          </>
        ) : (
          <>
            <div className="relative mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-[#5a5a5a] to-[#232323] border-4 border-blood/60 grayscale float-slow">
              <span className="absolute inset-0 flex items-center justify-center font-display text-4xl font-bold text-blood/70">
                ✕
              </span>
              <svg viewBox="0 0 96 96" className="absolute inset-0 w-full h-full" aria-hidden>
                <line x1="28" y1="6" x2="62" y2="90" stroke="#1a0b2e" strokeWidth="5" />
                <line x1="28" y1="6" x2="62" y2="90" stroke="#FF4D5E" strokeWidth="1.5" opacity="0.8" />
              </svg>
            </div>
            <div className="mt-4 font-display text-4xl md:text-7xl font-bold text-blood tracking-[0.12em]">
              RUGGED
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              Rugged. The forum will remember this.
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-lavender/60 font-mono">decided in {blocks} blocks</p>
        <div className="match-stats">
          {[[stats.cardsPlayed, 'Cards played'], [stats.attacks, 'Attacks'], [stats.treasuryDamage, 'Treasury damage'],
            [stats.treasuryHealed, 'HP restored'], [stats.minionsLost, 'Minions lost'], [stats.counters, 'Counters']].map(([value, label]) =>
            <div key={label}><b>{value}</b><span>{label}</span></div>)}
        </div>
        <div className="mt-7 flex gap-3 justify-center flex-wrap">
          <button
            onClick={onRematch}
            className="px-8 py-3.5 rounded-lg bg-gradient-to-b from-gold-light to-gold-dark text-abyss font-bold text-lg tracking-wide hover:brightness-110 active:scale-[0.97] transition shadow-[0_0_28px_rgba(212,175,55,0.45)]"
          >
            ⚔ Play again
          </button>
          <Link
            href="/"
            className="px-6 py-3.5 rounded-lg border-2 border-gold/60 text-gold-light font-semibold hover:bg-gold/10 transition"
          >
            Change hero
          </Link>
          <Link href="/leaderboard" className="text-mint text-sm w-full mt-2">Match history & devnet achievements ↗</Link>
        </div>
      </div>
    </div>
  );
}
