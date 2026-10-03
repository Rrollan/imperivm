'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  applyAction,
  createGame,
  legalActions,
  mempoolOf,
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
import GasColumn from '../../components/GasColumn';
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

  const [state, setState] = useState<GameState | null>(null);
  const [attackerUid, setAttackerUid] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [zoomUid, setZoomUid] = useState<string | null>(null);
  const isDesktop = useIsDesktop();

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
      timers.current.forEach(clearTimeout); timers.current.clear();
      const s = createGame(
        heroId,
        DECKS[heroId] ?? DECKS.whale,
        aiHeroId,
        DECKS[aiHeroId] ?? DECKS.degen,
        seed,
      );
      prevRef.current = null;
      setState(s);
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
    [heroId, aiHeroId],
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
    if (!state || state.winner !== null || state.turn !== FOE || !aiThinking) return;
    const t = setTimeout(() => {
      try {
        const action = chooseAiAction(state);
        lastActionRef.current = action;
        stateBeforeActionRef.current = state;
        setState(applyAction(state, action));
        if (action.type === 'end-turn') setAiThinking(false);
      } catch {
        const fallback: Action = { type: 'end-turn' };
        lastActionRef.current = fallback;
        stateBeforeActionRef.current = state;
        setState(applyAction(state, fallback));
        setAiThinking(false);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [state, aiThinking]);

  // Derive battle animations from the diff between consecutive states.
  useEffect(() => {
    if (!state) return;
    const prev = prevRef.current;
    prevRef.current = state;
    if (!prev) return;
    // diffBattleFx still takes (prev, next, action) so the engine contract
    // stays unchanged. When the caller forgot to record an action (the
    // AI loop does this), we fall back to a heuristic.
    const fx = diffBattleFx(prev, state, lastActionRef.current ?? undefined);

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
  }, [logLength, logOpen]);

  const legal = useMemo<Action[]>(() => (state ? legalActions(state) : []), [state]);

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
  const myTurn = state.turn === ME && !aiThinking && state.winner === null;

  const playableUids = new Set<string>();
  for (const a of legal) {
    if (a.type === 'play-minion' || a.type === 'cast-spell') playableUids.add(a.uid);
  }
  const hpAction = legal.find(a => a.type === 'hero-power');

  const act = (action: Action, opts?: { collectPlayRects?: boolean }) => {
    if (!myTurn) return;
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

      setState(applyAction(state, action));
    } catch {
      /* illegal action — ignore */
    }
  };

  const endTurn = () => {
    if (!myTurn) return;
    setAiThinking(true);
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
      : myTurn
        ? attackerUid && selectedAttacker
          ? `Choose a target for ${selectedAttacker.name} — or click it again to cancel`
          : 'Your turn — play cards, attack, stake'
        : 'Rival is thinking…';

  const foeAttackable = (m: Minion) =>
    !!attackerUid && legal.some(a => a.type === 'attack' && a.attackerUid === attackerUid && a.target === m.uid);

  return (
    <DndProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
    <div className={`min-h-screen arena-bg text-parchment select-none ${screenFx?.kind === 'rug' ? 'rug-shake' : ''}`}>
      <WalletBar />

      {/* screen-wide flashes */}
      {screenFx?.kind === 'rug' && (
        <div key={screenFx.key} className="rug-flash fixed inset-0 z-40 pointer-events-none" />
      )}
      {screenFx?.kind === 'halving' && (
        <div key={screenFx.key} className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="halving-flash absolute inset-0" />
          <div className="relative font-display text-3xl md:text-5xl font-bold gold-text tracking-[0.2em] drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            ◈ HALVING +1/+1
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl px-2 md:px-4 pb-28 md:pb-10">
        {/* ── top bar: brand · block plaque · restart ── */}
        <div className="flex items-center justify-between gap-2 pt-3 pb-2">
          <Link href="/" className="font-display text-lg md:text-xl font-bold gold-text tracking-[0.25em] shrink-0">
            IMPERIVM
          </Link>
          <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-5 py-1.5 rounded-md border-2 border-gold/60 bg-gradient-to-b from-[#2a1745] to-abyss shadow-[0_0_14px_rgba(212,175,55,0.25)]">
            <span className="text-gold text-sm">❧</span>
            <span className="font-mono font-bold text-gold-light tracking-[0.2em] text-xs md:text-sm">
              BLOCK #{state.block}
            </span>
            <span className="text-gold text-sm">❧</span>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <MuteButton className="hidden sm:inline-flex" />
            <button
              onClick={() => startGame(Date.now() & 0x7fffffff)}
              className="text-xs px-2.5 py-1.5 rounded border border-lavender/40 text-lavender hover:bg-lavender/10 shrink-0"
              title="Restart the game"
            >
              ↺ <span className="hidden sm:inline">Restart</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:gap-3">
          {/* ── gas column (left on desktop, strip on mobile) ── */}
          <GasColumn gas={me.gas} maxGas={me.maxGas} />

          <div className="flex-1 min-w-0 space-y-2 md:space-y-2.5">
            {/* ── foe hero ── */}
            <DroppableFoeHero>
            <div className="rounded-xl border border-blood/25 bg-void/70 px-3 py-2.5 md:px-4 md:py-3">
              <HeroPortrait
                hero={foeHero}
                treasury={foe.treasury}
                foe
                deckCount={foe.deck.length}
                handCount={foe.hand.length}
                showHandBacks
                floats={floatsFor('hero-1')}
                highlight={canHitFoeHero}
                shaking={attackAnim?.targetUid === 'hero-1'}
                onClick={canHitFoeHero ? onFoeHeroClick : undefined}
                onKeyDown={canHitFoeHero ? e => (e.key === 'Enter' ? onFoeHeroClick() : undefined) : undefined}
              />
            </div>
            </DroppableFoeHero>

            {/* ── foe board on marble ── */}
            <div className="marble marble-edge rounded-xl px-2 py-2.5 md:py-3 min-h-[6.5rem] md:min-h-[7.5rem]">
              {foe.board.length === 0 && dying.filter(d => d.owner === FOE).length === 0 ? (
                <div className="text-center text-[#6b5a35]/70 text-xs md:text-sm italic py-5">
                  No enemy minions on the field.
                </div>
              ) : (
                <div className="flex flex-wrap justify-center items-start gap-x-1.5 gap-y-5 md:gap-x-2.5">
                  {foe.board.map(m => (
                    <DroppableMinion key={m.uid} uid={m.uid} foe>
                    <LungeWrap active={attackAnim?.attackerUid === m.uid} up={false}>
                      <MinionToken
                        minion={m}
                        attackable={foeAttackable(m)}
                        shaking={attackAnim?.targetUid === m.uid}
                        justPlayed={playedUids.has(m.uid)}
                        floats={floatsFor(m.uid)}
                        onClick={attackerUid ? () => onFoeMinionClick(m) : undefined}
                      />
                    </LungeWrap>
                    </DroppableMinion>
                  ))}
                  {dying
                    .filter(d => d.owner === FOE)
                    .map(d => (
                      <MinionToken key={`dying-${d.key}`} minion={ghostOf(d)} dying />
                    ))}
                </div>
              )}
            </div>

            {/* ── mempool band ── */}
            <section
              title="Spells resolve next block — both sides see everything"
              className={`mempool-band rounded-lg px-3 py-2 ${mempoolFx ? 'mempool-flash-resolve' : ''}`}
              key={mempoolFx ? `flash-${mempoolFx.key}` : 'idle'}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] uppercase tracking-[0.25em] text-[#7df9e8] font-bold">
                  ⛓ Mempool
                </span>
                <span className="text-[10px] text-lavender/80 italic">
                  resolves next block — both sides see everything
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-3 min-h-[3rem]">
                {myMempool.length === 0 && foeMempool.length === 0 ? (
                  <span className="text-[11px] text-lavender/50 italic">
                    Empty — the chain is quiet… for now.
                  </span>
                ) : (
                  <>
                    {foeMempool.map(e => (
                      <MempoolCard key={e.uid} entry={e} ownerLabel={foeHero.name} mine={false} />
                    ))}
                    {myMempool.map(e => (
                      <MempoolCard key={e.uid} entry={e} ownerLabel="you" mine />
                    ))}
                  </>
                )}
                {mempoolFx?.kind === 'resolve' && (
                  <span className="text-[10px] text-mint font-bold uppercase tracking-widest animate-pulse">
                    ✓ resolving
                  </span>
                )}
                {mempoolFx?.kind === 'counter' && (
                  <span className="text-[10px] text-blood font-bold uppercase tracking-widest animate-pulse">
                    ⚡ countered
                  </span>
                )}
              </div>
            </section>

            {/* ── phase label ── */}
            <div className="text-center">
              <span
                className={`inline-block text-xs md:text-sm font-semibold px-3 py-1 rounded-full border ${
                  state.winner !== null
                    ? 'text-lavender border-lavender/30'
                    : myTurn
                      ? 'text-mint border-mint/40 bg-mint/5'
                      : 'text-gold-light border-gold/40 bg-gold/5'
                }`}
              >
                {phaseText}
              </span>
            </div>

            {/* ── my board on marble ── */}
            <DroppableBoard>
            <div id="my-board-slot" className="marble marble-edge rounded-xl px-2 py-2.5 md:py-3 min-h-[7rem] md:min-h-[8rem]">
              {me.board.length === 0 && dying.filter(d => d.owner === ME).length === 0 ? (
                <div className="text-center text-[#6b5a35]/70 text-xs md:text-sm italic py-6">
                  Your ranks are empty. Play a minion!
                </div>
              ) : (
                <div className="flex flex-wrap justify-center items-start gap-x-1.5 gap-y-5 md:gap-x-2.5">
                  {me.board.map(m => {
                    const canActNow = myTurn && m.canAttack && !m.staked;
                    const token = (
                      <LungeWrap key={m.uid} active={attackAnim?.attackerUid === m.uid} up>
                        <MinionToken
                          minion={m}
                          selected={attackerUid === m.uid}
                          canAct={canActNow}
                          shaking={attackAnim?.targetUid === m.uid}
                          justPlayed={playedUids.has(m.uid)}
                          floats={floatsFor(m.uid)}
                          onClick={() => onMyMinionClick(m)}
                          onStake={
                            myTurn && !m.staked && legal.some(a => a.type === 'stake' && a.uid === m.uid)
                              ? () => onStake(m.uid)
                              : undefined
                          }
                          onUnstake={
                            myTurn && m.staked && legal.some(a => a.type === 'unstake' && a.uid === m.uid)
                              ? () => onUnstake(m.uid)
                              : undefined
                          }
                        />
                      </LungeWrap>
                    );
                    return canActNow ? (
                      <DraggableAttacker key={m.uid} uid={m.uid}>{token}</DraggableAttacker>
                    ) : (
                      token
                    );
                  })}
                  {dying
                    .filter(d => d.owner === ME)
                    .map(d => (
                      <MinionToken key={`dying-${d.key}`} minion={ghostOf(d)} dying />
                    ))}
                </div>
              )}
            </div>
            </DroppableBoard>

            {/* ── my hero row: portrait · hero power · END TURN ── */}
            {/* mobile: vertical stack (portrait + treasury); hero power + END TURN
                live in the fixed bottom action bar so they are always reachable.
                desktop: classic row with portrait · hero power · END TURN. */}
            <div className="rounded-xl border border-gold/25 bg-void/70 px-3 py-2.5 md:px-4 md:py-3 flex flex-col md:flex-row md:items-center gap-2.5 md:gap-4">
              <div className="min-w-0 md:flex-1">
                <HeroPortrait
                  hero={myHero}
                  treasury={me.treasury}
                  deckCount={me.deck.length}
                  handCount={me.hand.length}
                  floats={floatsFor('hero-0')}
                  shaking={attackAnim?.targetUid === 'hero-0'}
                />
              </div>
              <div className="hidden md:flex items-center gap-4">
                <button
                  onClick={() => hpAction && act(hpAction)}
                  disabled={!myTurn || !hpAction}
                  title={myHero.powerText}
                  className="px-3 md:px-4 py-2.5 rounded-lg border-2 border-gold/60 text-gold-light font-semibold text-xs md:text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gold/10 transition shrink-0"
                >
                  ⚡ {myHero.powerName}{' '}
                  <span className="text-lavender font-mono">(2)</span>
                  {me.heroPowerUsed && <span className="block text-[9px] text-lavender/60 font-normal">used</span>}
                </button>
                <button
                  onClick={endTurn}
                  disabled={!myTurn}
                  className="px-6 md:px-10 py-3 md:py-4 rounded-xl bg-gradient-to-b from-gold-light via-gold to-gold-dark text-abyss font-display font-bold text-base md:text-xl tracking-[0.15em] disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.97] transition shadow-[0_0_28px_rgba(212,175,55,0.45)] border-2 border-[#6b4e12] shrink-0"
                >
                  {aiThinking ? 'Ending…' : 'END TURN'}
                </button>
              </div>
            </div>

            {/* ── hand fan ── */}
            {/* mobile: horizontal snap carousel — every card fully visible, no
                overlap; tap a card to open the zoom modal (hover tooltips are
                disabled on touch). desktop: classic fan, tap/click plays. */}
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-lavender mb-0.5 px-1">
                Your hand ({me.hand.length})
              </div>
              {me.hand.length === 0 ? (
                <div className="text-lavender/40 text-xs md:text-sm italic px-1 py-2">
                  Empty hand — top-deck like a degen.
                </div>
              ) : (
                <div className="overflow-x-auto thin-scroll snap-x snap-mandatory md:snap-none">
                  <div className="hand-fan mx-auto flex w-max items-end gap-3 px-4 pb-8 pt-5 md:gap-0 md:px-3 md:pb-9 md:pt-6">
                    {me.hand.map((hc, i) => {
                      const def = CARDS[hc.cardId];
                      if (!def) return null;
                      const playable = myTurn && playableUids.has(hc.uid);
                      const spread = me.hand.length > 1 ? i - (me.hand.length - 1) / 2 : 0;
                      const dealt = dealtUids.has(hc.uid);
                      return (
                        <DraggableHandCard key={hc.uid} id={hc.uid} disabled={!playable}>
                        <div
                          data-hand-uid={hc.uid}
                          style={
                            isDesktop
                              ? {
                                  transform: `rotate(${(spread * 3.2).toFixed(1)}deg) translateY(${Math.abs(spread) * 3}px)`,
                                  transformOrigin: 'bottom center',
                                  zIndex: i,
                                }
                              : undefined
                          }
                          className="shrink-0 snap-start"
                        >
                          <div
                            className={dealt ? 'deal-in' : ''}
                            style={dealt ? { animationDelay: `${Math.min(i, 9) * 70}ms` } : undefined}
                          >
                            <CardView
                              card={def}
                              size="sm"
                              playable={playable}
                              disabled={!playable}
                              onClick={
                                isDesktop
                                  ? playable
                                    ? () => onHandClick(hc.uid)
                                    : undefined
                                  : () => setZoomUid(hc.uid)
                              }
                            />
                          </div>
                        </div>
                        </DraggableHandCard>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── battle log (collapsible) ── */}
            <div className="rounded-xl border border-white/10 bg-black/30">
              <button
                onClick={() => setLogOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-lavender hover:text-parchment transition"
                aria-expanded={logOpen}
              >
                <span>Battle log</span>
                <span>{logOpen ? '▾ collapse' : '▸ expand'}</span>
              </button>
              {logOpen && (
                <div ref={logBoxRef} className="thin-scroll max-h-36 overflow-y-auto px-4 pb-3 space-y-0.5">
                  {state.log.slice(-60).map((line, i) => (
                    <div key={i} className="text-[11px] text-parchment/70 font-mono">
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-center pt-1">
              <Link href="/" className="text-xs text-lavender/60 hover:text-lavender">
                ← Back to hero select
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── mobile action bar: gas · hero power · END TURN ──
          fixed to the viewport bottom on phones so END TURN is always
          reachable without scrolling; hidden on md+ (buttons live in the
          hero row there). */}
      <div className="fixed inset-x-0 bottom-0 z-30 md:hidden border-t-2 border-gold/30 bg-void/95 backdrop-blur px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-solana/40 bg-void px-2 py-2"
            title="Gas: mana for this block. Refills each block."
          >
            <span className="gas-crystal gas-crystal-lit w-4 h-5" aria-hidden />
            <span className="font-mono text-sm font-bold text-solana">
              {me.gas}
              <span className="text-xs text-lavender/60">/{me.maxGas}</span>
            </span>
          </div>
          <button
            onClick={() => hpAction && act(hpAction)}
            disabled={!myTurn || !hpAction}
            title={myHero.powerText}
            className="min-w-0 flex-1 truncate rounded-lg border-2 border-gold/60 px-2 py-2.5 text-xs font-semibold text-gold-light disabled:cursor-not-allowed disabled:opacity-30"
          >
            ⚡ {myHero.powerName} <span className="font-mono text-lavender">(2)</span>
          </button>
          <button
            onClick={endTurn}
            disabled={!myTurn}
            className="flex-1 rounded-lg border-2 border-[#6b4e12] bg-gradient-to-b from-gold-light via-gold to-gold-dark px-4 py-2.5 font-display text-sm font-bold tracking-[0.12em] text-abyss shadow-[0_0_20px_rgba(212,175,55,0.45)] transition hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {aiThinking ? 'Ending…' : 'END TURN'}
          </button>
        </div>
      </div>

      {/* ── first-game onboarding ── */}
      {showOnboarding && myTurn && <OnboardingOverlay onClose={closeOnboarding} />}

      {/* ── card zoom modal (mobile tap on a hand card) ── */}
      {(() => {
        const zoomHc = zoomUid ? me.hand.find(h => h.uid === zoomUid) : undefined;
        const zoomDef = zoomHc ? CARDS[zoomHc.cardId] : undefined;
        if (!zoomDef || !zoomHc) return null;
        return (
          <CardZoomModal
            card={zoomDef}
            playable={myTurn && playableUids.has(zoomHc.uid)}
            onPlay={() => onHandClick(zoomHc.uid)}
            onClose={() => setZoomUid(null)}
          />
        );
      })()}

      {/* ── end-of-game overlay ── */}
      {state.winner !== null && (
        <EndOverlay winner={state.winner} blocks={state.block} onRematch={() => startGame(Date.now() & 0x7fffffff)} />
      )}

      {/* ── drag preview (portal) ── */}
      <DragPreview hand={me.hand} board={me.board} />

      {/* ── package 2: motion overlay (play-flight, halving +1/+1, RUG PULL
            vortex + screen shake, VICTORIA laurels + coin confetti, RUGGED
            crack). Driven by the same structured event adapter as audio. */}
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
  const steps = [
    'Tap a card in your hand to play it',
    'Tap your minion, then tap an enemy to attack',
    'Empty the enemy Treasury (30 HP) to win',
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/70 backdrop-blur-[2px] p-6"
      onClick={onClose}
    >
      <div
        className="rise-in w-full max-w-sm rounded-2xl border-2 border-gold/60 bg-void/95 p-6 text-center shadow-[0_0_40px_rgba(212,175,55,0.3)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="font-display text-2xl font-bold gold-text">How to play</div>
        <ol className="mt-5 space-y-3.5 text-left">
          {steps.map((step, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-gold bg-gold/15 font-display text-base font-bold text-gold-light">
                {i + 1}
              </span>
              <span className="text-sm leading-snug text-parchment/90">{step}</span>
            </li>
          ))}
        </ol>
        <button
          className="mt-6 w-full px-8 py-3 rounded-lg bg-gradient-to-b from-gold-light to-gold-dark text-abyss font-bold hover:brightness-110 transition"
          onClick={onClose}
        >
          Got it, let&apos;s play
        </button>
      </div>
    </div>
  );
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/80 backdrop-blur-[2px] p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
    >
      <div
        className="rise-in thin-scroll flex max-h-full flex-col items-center overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <CardView card={card} size="lg" tilt={false} playable={playable} />
        <div className="mt-4 flex w-full max-w-[16rem] gap-3 pb-1">
          <button
            onClick={() => {
              onPlay();
              onClose();
            }}
            disabled={!playable}
            title={playable ? 'Play this card' : 'Not enough gas or not your turn'}
            className="flex-1 rounded-lg bg-gradient-to-b from-gold-light to-gold-dark px-4 py-3 font-bold text-abyss transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Play
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border-2 border-lavender/50 px-4 py-3 font-semibold text-lavender transition hover:bg-lavender/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
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
  onRematch,
}: {
  winner: PlayerId | 'draw';
  blocks: number;
  onRematch: () => void;
}) {
  const win = winner === ME;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/92 backdrop-blur-sm overflow-hidden">
      {win && <CoinConfetti />}
      <div className="rise-in text-center px-6 relative z-10 max-w-lg">
        {win ? (
          <>
            <Laurel />
            <div className="font-display text-6xl md:text-8xl font-bold gold-text tracking-[0.12em]">
              VICTORIA!
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              Veni. Vidi. Rugi. The treasury is yours.
            </p>
          </>
        ) : winner === 'draw' ? (
          <>
            <div className="font-display text-6xl md:text-8xl font-bold text-lavender tracking-[0.12em]">
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
            <div className="mt-4 font-display text-6xl md:text-8xl font-bold text-blood tracking-[0.12em]">
              RUGGED
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              Rugged. The forum will remember this.
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-lavender/60 font-mono">decided in {blocks} blocks</p>
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
        </div>
      </div>
    </div>
  );
}
