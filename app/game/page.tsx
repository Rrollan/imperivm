'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale } from '../../components/LocaleContext';
import { BlockClock, BlockHistory, RivalHand, ScrollDeck } from '../../components/BoardChrome';
import BoardRank, { isBoardSlot } from '../../components/BoardRank';
import AttackAim from '../../components/AttackAim';
import AbilityFx from '../../components/AbilityFx';
import AttackFlight, { type CombatFlight } from '../../components/AttackFlight';
import { CoinPreview } from '../../components/3d/CoinPreview';
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
import BattleIcon from '../../components/BattleIcon';
import CardView, { CardBack, CardPreview, MinionToken } from '../../components/CardView';
import {
  DndProvider,
  DraggableHandCard,
  DraggableAttacker,
  DroppableBoard,
  DroppableMempool,
  DroppableMinion,
  DroppableFoeHero,
  CardDragOverlay,
  useDragState,
  getDragData,
  minionUidFromDropId,
  DROP_BOARD_ID,
  DROP_MEMPOOL_ID,
  DROP_FOE_HERO_ID,
} from '../../components/dnd';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import WalletBar from '../../components/WalletBar';
import HeroPortrait from '../../components/HeroPortrait';
import ManaCrystals from '../../components/ManaCrystals';
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
import { unlockAudio } from '../../lib/audio/manager';
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
  const { t } = useLocale();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-abyss flex items-center justify-center text-gold font-display text-2xl">
          {t('Входим на арену…', 'Entering the arena…')}
        </div>
      }
    >
      <GameBoard />
    </Suspense>
  );
}

function GameBoard() {
  const { t, cardName, cardText, heroName, powerName, powerText, mechanicText, logLine, errorText } = useLocale();
  const searchParams = useSearchParams();
  const heroParam = searchParams.get('hero');
  const heroId = heroParam && HEROES[heroParam] ? heroParam : 'whale';
  const aiHeroId = heroId === 'degen' ? 'validator' : 'degen';
  const useCustom = searchParams.get('deck') === 'custom';
  const autoDemo = searchParams.get('demo') === '1';

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
  const reduced = useReducedMotion();
  const [combatFlight, setCombatFlight] = useState<CombatFlight | null>(null);
  const combatBusy = useRef(false);
  const pendingCombat = useRef<GameState | null>(null);
  const commitCombat = useCallback(() => {
    const next = pendingCombat.current;
    pendingCombat.current = null;
    if (next) setState(next);
  }, []);
  const finishCombat = useCallback(() => {
    combatBusy.current = false;
    setCombatFlight(null);
  }, []);
  // Calculate once, but keep the before-state visible until physical contact.
  const presentAction = useCallback((action: Action, game: GameState) => {
    if (combatBusy.current) return;
    const next = applyAction(game, action);
    lastActionRef.current = action;
    stateBeforeActionRef.current = game;
    if (action.type === 'attack' && !reduced) {
      const from = document.querySelector<HTMLElement>(`[data-minion-uid="${action.attackerUid}"]`)?.closest<HTMLElement>('.hs-minion');
      const to = document.querySelector<HTMLElement>(action.target === 'hero' ? game.turn === ME ? '#foe-treasury-target .hero-treasury' : '.combatant.own .hero-treasury' : `[data-minion-uid="${action.target}"]`);
      const minion = game.players[game.turn].board.find(m => m.uid === action.attackerUid);
      if (from && to && minion) {
        combatBusy.current = true;
        pendingCombat.current = next;
        setCombatFlight({ minion, survives: next.players[game.turn].board.some(m => m.uid === minion.uid), from: from.getBoundingClientRect(), to: to.getBoundingClientRect() });
        return;
      }
    }
    setState(next);
  }, [reduced]);


  // battle FX state (all derived from state diffs — engine untouched)
  const [floats, setFloats] = useState<UiFloat[]>([]);
  const [dying, setDying] = useState<(DyingMinion & { key: number; slot: number })[]>([]);
  const [attackAnim, setAttackAnim] = useState<{ attackerUid: string; targetUid: string; key: number } | null>(null);
  const [playedUids, setPlayedUids] = useState<Set<string>>(new Set());
  const [dealtUids, setDealtUids] = useState<Set<string>>(new Set());
  // веер руки: uid карты под курсором (ховер-подъём, только десктоп)
  const [fanHoverUid, setFanHoverUid] = useState<string | null>(null);
  const [handPreviewUid, setHandPreviewUid] = useState<string | null>(null);
  const handPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelHandPreviewTimer = () => {
    if (handPreviewTimer.current) clearTimeout(handPreviewTimer.current);
    handPreviewTimer.current = null;
  };
  useEffect(() => () => { if (handPreviewTimer.current) clearTimeout(handPreviewTimer.current); }, []);
  const [handPreviewPosition, setHandPreviewPosition] = useState({ left: 12, top: 12 });
  const previewHandCard = (uid: string, element: HTMLElement, delay = 0) => {
    cancelHandPreviewTimer();
    const rect = element.getBoundingClientRect();
    setHandPreviewPosition({
      left: Math.max(12, Math.min(rect.left - 70, window.innerWidth - 292)),
      top: Math.max(12, rect.top - Math.min(460, window.innerHeight - 24) - 16),
    });
    setFanHoverUid(uid);
    if (delay) handPreviewTimer.current = setTimeout(() => setHandPreviewUid(uid), delay);
    else setHandPreviewUid(uid);
  };
  // true пока атакующий миньон тащится (стрелка прицеливания следует за курсором)
  const [draggingAttacker, setDraggingAttacker] = useState(false);
  const [mempoolFx, setMempoolFx] = useState<{ kind: 'resolve' | 'counter'; key: number } | null>(null);
  const [screenFx, setScreenFx] = useState<{ kind: 'rug' | 'halving'; key: number } | null>(null);
  // package 2 + 3 wiring
  const [events, setEvents] = useState<BattleEvents | null>(null);
  const [playRects, setPlayRects] = useState<{ from: DOMRect; to: DOMRect } | null>(null);
  const [bodyShakeKey, setBodyShakeKey] = useState(0);
  const lastActionRef = useRef<Action | null>(null);
  const stateBeforeActionRef = useRef<GameState | null>(null);

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
      match.current = { id: crypto.randomUUID(), owner: walletOwner.current ?? 'demo', startedAt: new Date().toISOString(), exhibition: autoDemo };
      setProof(null); setProofError(null); setProofPending(!!walletOwner.current && !autoDemo);
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
      setAutoplay(autoDemo);
      setShowOnboarding(false);
      aiSteps.current = 0;
      setZoomUid(null);
      setInspectUid(null);
      setAttackerUid(null);
      setAiThinking(false);
      setFloats([]);
      setDying([]);
      setAttackAnim(null);
      setCombatFlight(null);
      combatBusy.current = false; pendingCombat.current = null;
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
        if (!autoDemo && !localStorage.getItem(ONBOARDING_KEY)) setShowOnboarding(true);
      } catch {
        /* storage unavailable — show anyway */
        setShowOnboarding(!autoDemo);
      }
    },
    [heroId, aiHeroId, useCustom, autoDemo],
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
      void unlockAudio().then(() => { startAmbient(); markAmbientStarted(true); });
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
    if (!state || combatFlight || combatBusy.current || state.winner !== null || proofPending || !(state.turn === FOE || autoplay)) return;
    const t = setTimeout(() => {
      try {
        aiSteps.current++;
        const action: Action = aiSteps.current > 100 && !mulliganAvailable(state) ? { type: 'end-turn' } : chooseAiAction(state);
        presentAction(action, state);
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
  }, [state, autoplay, showOnboarding, proofPending, combatFlight, presentAction]);

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
      const keyed = fx.deaths.filter(d => d.uid !== combatFlight?.minion.uid).map(d => ({ ...d, key: ++fxKey.current, slot: prev.players[d.owner].board.findIndex(m => m.uid === d.uid) }));
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
    } catch (e) { if (match.current.id === captured) setProofError(e instanceof Error ? e.message : t('Подпись отклонена. Демо остаётся доступным.', 'Signing declined. You can still play the demo.')); }
  }

  if (!state) {
    return (
      <div className="min-h-screen bg-abyss">
        <WalletBar />
        <div className="flex items-center justify-center py-32 text-gold font-display text-2xl">
          {t('Тасуем колоды…', 'Shuffling decks…')}
        </div>
      </div>
    );
  }

  const me = state.players[ME];
  const foe = state.players[FOE];
  const myHero = HEROES[me.heroId];
  const foeHero = HEROES[foe.heroId];
  const myTurn = state.turn === ME && !aiThinking && state.winner === null && !proofPending && !combatFlight;

  const playableUids = new Set<string>();
  for (const a of legal) {
    if (a.type === 'play-minion' || a.type === 'cast-spell') playableUids.add(a.uid);
  }
  const hpAction = legal.find(a => a.type === 'hero-power');

  const act = (action: Action, opts?: { collectPlayRects?: boolean }) => {
    if (!myTurn || combatBusy.current || stateBeforeActionRef.current) return;
    try {
      // For card plays: capture source (hand) and target (board) rects.
      if (opts?.collectPlayRects && state && (action.type === 'play-minion' || action.type === 'cast-spell')) {
        const fromEl = document.querySelector<HTMLElement>(`[data-hand-uid="${action.uid}"]`);
        const toEl = document.querySelector<HTMLElement>(`.own-rank .empty-slot`) ?? document.querySelector<HTMLElement>(`#my-board-slot`);
        if (fromEl && toEl) {
          setPlayRects({ from: fromEl.getBoundingClientRect(), to: toEl.getBoundingClientRect() });
        }
      }

      if (action.type === 'end-turn') { setAiThinking(true); playSound('end-turn'); }
      else if (action.type === 'stake' || action.type === 'unstake') playSound('stake');
      else if (action.type === 'hero-power') playSound('ui-click');
      presentAction(action, state);
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
      setDraggingAttacker(true); // стрелка прицеливания потянется за курсором
      // existing attackable/highlight states pick up the selection automatically,
      // so legal targets are highlighted while dragging
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const data = getDragData(event.active);
    const overId = event.over?.id;
    if (data?.type === 'hand-card' && (overId === DROP_BOARD_ID || overId === DROP_MEMPOOL_ID && data.cardType === 'spell' || isBoardSlot(overId) && data.cardType !== 'spell')) {
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
    setDraggingAttacker(false);
    setFanHoverUid(null);
  };

  const handleDragCancel = () => { setAttackerUid(null); setDraggingAttacker(false); };

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

  const phaseText = state.winner !== null ? t('Матч завершён', 'Game over')
    : mulliganAvailable(state) ? state.turn === ME ? t('Стартовая рука: оставь карты или замени', 'Opening hand: keep or replace') : t('Противник выбирает карты…', 'Rival chooses an opening hand…')
    : myTurn ? selectedAttacker ? t(`Выбери цель для «${cardName(selectedAttacker.cardId)}»`, `Choose a target for ${cardName(selectedAttacker.cardId)}`) : t('ВАШ ХОД', 'YOUR TURN')
    : t('ХОД ПРОТИВНИКА', 'RIVAL’S TURN');

  const foeAttackable = (m: Minion) =>
    !!attackerUid && legal.some(a => a.type === 'attack' && a.attackerUid === attackerUid && a.target === m.uid);

  return (
    <DndProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className={`game-shell board-${skin}`} style={{ ['--board-art' as string]: `url('/boards/${skin}.webp')` }}>
        <WalletBar onSettings={() => setSettingsOpen(true)} onHelp={() => setHelpOpen(true)} />
        <main className="game-content">
          <nav className="arena-toolbar" aria-label={t('Управление матчем', 'Match controls')}>
            <Link href={`/arena?hero=${heroId}`} className="quiet-link">{t('← Врата арены', '← Arena gates')}</Link>
            <BlockClock block={state.block} minions={[...me.board, ...foe.board]} />
            <div className="toolbar-actions">
              <button className="icon-button" onClick={() => startGame(Date.now() & 0x7fffffff)} aria-label={t('Начать матч заново', 'Restart match')}>↻</button>
            </div>
          </nav>
          <div className="battle-table">
          <section className="battlefield" aria-label={t('Поле боя', 'Battlefield')} onPointerMove={e => {
            if (reduced || e.pointerType !== 'mouse') return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--table-x', `${((e.clientX - r.left) / r.width - .5) * 6}px`);
            e.currentTarget.style.setProperty('--table-y', `${((e.clientY - r.top) / r.height - .5) * 4}px`);
          }} onPointerLeave={e => { e.currentTarget.style.setProperty('--table-x', '0px'); e.currentTarget.style.setProperty('--table-y', '0px'); }}>
            <RivalHand count={foe.hand.length} />
            <ScrollDeck count={foe.deck.length} foe />
            <ScrollDeck count={me.deck.length} />
            <BlockHistory lines={state.log} onOpen={() => setLogOpen(true)} />
            {!mulliganAvailable(state) && state.winner === null && <div key={`turn-${state.block}-${state.turn}`} className="turn-banner" role="status">{state.turn === ME ? t('ВАШ ХОД', 'YOUR TURN') : t('ХОД ПРОТИВНИКА', 'RIVAL’S TURN')}<small className="turn-banner-clock" aria-label={t(`Ход ${state.block}`, `Turn ${state.block}`)}><span aria-hidden="true">◷</span> {state.block}</small></div>}
            <button className="gold-button end-turn-button" onClick={endTurn} disabled={!myTurn || autoplay || mulliganAvailable(state)}
              data-turn={state.turn === ME ? 'own' : 'rival'}
              aria-label={state.turn !== ME ? t('Ход противника', "Rival's turn") : t('Завершить ход', 'End turn')}>
              <img className="button-laurel" src="/ornaments/laurel.svg" alt="" /><span>{state.turn !== ME ? t('ХОД ПРОТИВНИКА', "RIVAL'S TURN") : t('ЗАВЕРШИТЬ ХОД', 'END TURN')}</span><img className="button-laurel" src="/ornaments/laurel.svg" alt="" />
            </button>
            <DroppableFoeHero attackable={canHitFoeHero}><div id="foe-treasury-target" className={`combatant rival ${canHitFoeHero ? 'legal-target' : ''}`}>
              <HeroPortrait hero={foeHero} treasury={foe.treasury} foe deckCount={foe.deck.length} handCount={foe.hand.length} showHandBacks
                floats={floatsFor('hero-1')} highlight={canHitFoeHero} shaking={attackAnim?.targetUid === 'hero-1'}
                onClick={canHitFoeHero ? onFoeHeroClick : undefined}
                onKeyDown={canHitFoeHero ? e => { if (e.key === 'Enter' || e.key === ' ') onFoeHeroClick(); } : undefined} />
              <button className="hero-power-medallion rival-power" disabled title={powerText(foeHero.id)} aria-label={`${powerName(foeHero.id)} · ${powerText(foeHero.id)}`}><img src="/ornaments/coin-rug.svg" alt="" /><b>{powerName(foeHero.id)}</b><small>{effectivePowerCost(state, FOE)}</small></button>
              <span className="combatant-label">{t('ПРОТИВНИК · ИИ', 'RIVAL · AI')}</span>
            </div></DroppableFoeHero>
            <div className="rank-row enemy-rank" aria-label={t('Существа противника', 'Rival minions')}>
              <div className="rank-label">{t('Ряды противника', 'Rival ranks')} <span>{foe.board.length}/7</span></div>
              <BoardRank cards={foe.board.map(m => ({ uid: m.uid, node: <DroppableMinion uid={m.uid} foe attackable={foeAttackable(m)}>
                <MinionToken inFlight={combatFlight?.minion.uid === m.uid} minion={m} attackable={foeAttackable(m)} shaking={attackAnim?.targetUid === m.uid}
                  justPlayed={playedUids.has(m.uid)} floats={floatsFor(m.uid)}
                  onClick={() => attackerUid && foeAttackable(m) ? onFoeMinionClick(m) : setInspectUid(m.uid)} />
              </DroppableMinion> }))} ghosts={dying.filter(d => d.owner === FOE).map(d => ({ uid: `dying-${d.key}`, slot: d.slot, node: <MinionToken inFlight={combatFlight?.minion.uid === d.uid} minion={ghostOf(d)} dying floats={floatsFor(d.uid)} /> }))} />
            </div>
            <DroppableMempool><section className={`chain-strip ${mempoolFx ? 'mempool-flash-resolve' : ''}`} aria-label={t('Публичный мемпул', 'Public mempool')}>
              <span className="mempool-runes" aria-hidden>ᚠ · ᚢ · ᚦ · ᚨ · ᚱ · ᚲ · ᚷ · ᚹ</span>
              <button className="chain-label" onClick={() => setHelpOpen(true)} title={mechanicText('Mempool')}><BattleIcon kind="chain" /> {t('МЕМПУЛ', 'MEMPOOL')} <b>{myMempool.length + foeMempool.length}</b></button>
              <div className="chain-entries thin-scroll">
                {!myMempool.length && !foeMempool.length && <span className="chain-empty">{t('Мгновенные заклинания действуют сразу. Указы — в начале следующего своего хода.', 'Instant spells resolve on play. Edicts resolve at the start of your next turn.')}</span>}
                {[...foeMempool, ...myMempool].map(e => <button key={e.uid} className={`queued-spell ${e.owner === ME ? 'mine' : 'theirs'} mempool-glow`}
                  onClick={() => setInspectCardId(e.cardId)} title={cardText(e.cardId)}>
                  <img src={`/cards/${e.cardId}.webp`} alt="" /><span>{cardName(e.cardId)}</span><small>{t('Следующий блок', 'Next block')} · {e.owner === ME ? t('ВАШЕ', 'YOURS') : t('ВРАГ', 'RIVAL')}</small>
                </button>)}
              </div>
            </section></DroppableMempool>
            <div className={`turn-status ${myTurn ? 'your-turn' : ''}`} role="status" aria-live="polite">
              {autoplay ? t('Автобой: пауза вернёт управление', 'Autoplay: pause to take control') : showOnboarding && !attackerUid ? <ContextCoach phase={mulliganAvailable(state) ? 'opening' : me.board.length === 0 ? 'play' : legal.some(a => a.type === 'attack') ? 'attack' : 'end'} onClose={closeOnboarding} /> : phaseText}
              {attackerUid && <button onClick={() => setAttackerUid(null)} className="cancel-target">{t('Отмена', 'Cancel')}</button>}
              {attackerUid && <button className="cancel-target" onClick={() => setInspectUid(attackerUid)}>{t('Карта / стейкинг', 'Card / staking')}</button>}
            </div>
            <DroppableBoard><div id="my-board-slot" className="rank-row own-rank" aria-label={t('Ваши существа', 'Your minions')}>
              <div className="rank-label">{t('Ваш легион', 'Your ranks')} <span>{me.board.length}/7</span>
                {!!me.pavilionBonuses?.length && <b className="pavilion-tag" title={mechanicText('Pavilion')}>{t('Синергия +1 мана', 'Pavilion +1 mana')}</b>}
              </div>
              <BoardRank own cards={me.board.map(m => {
                const ready = myTurn && legal.some(a => a.type === 'attack' && a.attackerUid === m.uid);
                const token = <MinionToken inFlight={combatFlight?.minion.uid === m.uid} minion={m}
                  selected={attackerUid === m.uid} canAct={ready} shaking={attackAnim?.targetUid === m.uid}
                  justPlayed={playedUids.has(m.uid)} floats={floatsFor(m.uid)}
                  onClick={() => ready ? onMyMinionClick(m) : setInspectUid(m.uid)} />;
                return { uid: m.uid, node: ready && isDesktop ? <DraggableAttacker uid={m.uid}>{token}</DraggableAttacker> : token };
              })} ghosts={dying.filter(d => d.owner === ME).map(d => ({ uid: `dying-${d.key}`, slot: d.slot, node: <MinionToken inFlight={combatFlight?.minion.uid === d.uid} minion={ghostOf(d)} dying floats={floatsFor(d.uid)} /> }))} />
            </div></DroppableBoard>
            <div className="combatant own"><HeroPortrait hero={myHero} treasury={me.treasury} deckCount={me.deck.length}
              handCount={me.hand.length} floats={floatsFor('hero-0')} shaking={attackAnim?.targetUid === 'hero-0'} />
              <button className="hero-power-medallion" disabled={!myTurn || !hpAction || autoplay} onClick={() => hpAction && act(hpAction)} title={powerText(myHero.id)} aria-label={`${powerName(myHero.id)} · ${powerText(myHero.id)} · ${effectivePowerCost(state, ME)} ${t('маны', 'mana')}`}><CoinPreview model="coin-rug" size="100%" autoRotate={false} label={t('Монета силы героя', 'Hero power coin')} /><b>{powerName(myHero.id)}</b><small>{effectivePowerCost(state, ME)}</small></button>
              <ManaCrystals gas={me.gas} maxGas={me.maxGas} />
            </div>
          </section>
          <section className="hand-zone" aria-label={t('Ваша рука', 'Your hand')}>
            <div className="hand-heading"><span>{t('ВАША РУКА', 'YOUR HAND')} <b>{me.hand.length}/10</b></span><span>{mulliganAvailable(state) ? t('Выберите карты для замены', 'Select cards to replace') : isDesktop ? t('Наведи — просмотр · клик — детали · перетащи — розыгрыш', 'Hover to preview · click for details · drag to play') : t('Тап — просмотр · «Разыграть» — розыгрыш', 'Tap to inspect · “Play” to play')}</span></div>
            <div className="hand-scroll thin-scroll"><div className="hand-cards">
              {me.hand.length === 0 && <p className="empty-hand">{t('Рука пуста. Легион ещё в строю.', 'An empty hand. Your legion still stands.')}</p>}
              {me.hand.map((hc, i) => {
                const def = CARDS[hc.cardId]; const playable = myTurn && playableUids.has(hc.uid);
                const selecting = mulliganAvailable(state) && state.turn === ME;
                const picked = mulliganPicks.includes(hc.uid);
                // Веер с небольшим нахлёстом; на touch — карусель без поворота.
                // На touch карты не перекрываются и не поворачиваются.
                const total = me.hand.length, middle = (total - 1) / 2, offset = i - middle;
                const fanRot = offset * (isDesktop ? 1.5 : 0);
                const fanY = Math.pow(Math.abs(offset), 1.8) * (isDesktop ? 2 : 0);
                const hovered = isDesktop && fanHoverUid === hc.uid;
                const clearHover = () => { cancelHandPreviewTimer(); setFanHoverUid(cur => cur === hc.uid ? null : cur); setHandPreviewUid(cur => cur === hc.uid ? null : cur); };
                return <DraggableHandCard key={hc.uid} id={hc.uid} cardType={def.type} disabled={!playable}>
                  <div className={`hand-fan${hovered ? ' is-hover' : ''}`}
                    style={{ transform: `rotate(${hovered ? 0 : fanRot}deg) translateY(${hovered ? 0 : fanY}px)` }}
                    onPointerEnter={isDesktop ? e => { if (e.pointerType === 'mouse') previewHandCard(hc.uid, e.currentTarget, 180); } : undefined}
                    onPointerLeave={isDesktop ? clearHover : undefined}
                    onFocus={isDesktop ? e => previewHandCard(hc.uid, e.currentTarget) : undefined}
                    onBlur={isDesktop ? clearHover : undefined}>
                    <div data-hand-uid={hc.uid} className={`hand-card-wrap ${dealtUids.has(hc.uid) ? 'deal-in' : ''}`} style={{ animationDelay: `${i * 45}ms` }}>
                      <div className="hand-card-hover">
                        <CardView card={def} size="sm" playable={playable} disabled={!playable && !selecting} selected={picked}
                          onClick={() => selecting ? setMulliganPicks(old => old.includes(hc.uid) ? old.filter(u => u !== hc.uid) : [...old, hc.uid]) : setZoomUid(hc.uid)} />
                        {selecting && <span className={`mulligan-choice ${picked ? 'replace' : ''}`}>{picked ? t('ЗАМЕНИТЬ', 'REPLACE') : t('ОСТАВИТЬ', 'KEEP')}</span>}
                      </div>
                    </div>
                  </div>
                </DraggableHandCard>;
              })}
            </div></div>
          </section>
          </div>
          <div className="action-dock">
            {mulliganAvailable(state) && state.turn === ME ? <>
              <span className="dock-hint">{t('Собери стартовую руку.', 'Build your opening hand.')}</span>
              <button className="gold-button" onClick={() => { act({ type: 'mulligan', uids: mulliganPicks }); setMulliganPicks([]); }}>
                {mulliganPicks.length ? t(`Заменить ${mulliganPicks.length}`, `Replace ${mulliganPicks.length}`) : t('Оставить руку', 'Keep hand')}
              </button>
            </> : null}
          </div>
          <div className="arena-bottom"><button className="quiet-link" onClick={() => setLogOpen(true)}>{t('Журнал боя ↗', 'Battle log ↗')}</button>
            <button className="quiet-link" onClick={() => setAutoplay(a => !a)}>{autoplay ? t('Ⅱ Пауза автобоя', 'Ⅱ Pause demo') : t('▷ Автобой', '▷ Autoplay demo')}</button>
            <button className="quiet-link" onClick={() => setShowOnboarding(true)}>{t('Подсказки', 'Learn to play')}</button>
          </div>
        </main>
        {myTurn && selectedAttacker && <AttackAim attacker={selectedAttacker} followPointer={draggingAttacker} targets={[...foe.board.filter(foeAttackable).map(m => ({ uid: m.uid, health: m.health, attack: m.attack })), ...(canHitFoeHero ? [{ uid: 'hero', health: foe.treasury, attack: 0 }] : [])]} />}
        {proofPending && <Dialog title={t('Подтверждение игры · devnet', 'Proof of play · devnet')} onClose={() => setProofPending(false)}>
          <p className="text-sm text-parchment/80 leading-relaxed">{t('Подпишите бесплатное сообщение для матча за', 'Sign a free match message as')} <b>{heroName(myHero.id)}</b>. {t('Phantom покажет домен, ID матча, одноразовый код, время и сеть devnet.', 'Phantom shows the domain, match ID, nonce, timestamp and devnet label.')}</p>
          <p className="integration-note">{t('Матч', 'Match')} {match.current.id}<br />{t('Локальный поединок против ИИ.', 'Local duel against AI.')}</p>
          {proofError && <p className="integration-error" role="status">{errorText(proofError)}</p>}
          <div className="dialog-actions"><button className="primary-button" disabled={wallet.busy || !wallet.owner} onClick={() => void approvePlayProof()}>{wallet.busy ? t('Ожидаем Phantom…', 'Waiting for Phantom…') : t('Подписать и играть', 'Sign & play')}</button><button className="secondary-button" onClick={() => setProofPending(false)}>{t('Играть без подписи', 'Continue in demo')}</button></div>
        </Dialog>}
        {settingsOpen && <ArenaSettings skin={skin} onChange={setSkin} onClose={() => setSettingsOpen(false)} />}
        {helpOpen && <MechanicsGuide onClose={() => setHelpOpen(false)} />}
        {logOpen && <Dialog title={t('Журнал боя', 'Battle log')} onClose={() => setLogOpen(false)}><div ref={logBoxRef} className="battle-log thin-scroll">
          {state.log.map((line, i) => <p key={`${state.block}-${i}`}>{logLine(line)}</p>)}
        </div></Dialog>}
        {zoomUid && (() => { const h = me.hand.find(h => h.uid === zoomUid); return h ? <CardZoomModal card={CARDS[h.cardId]}
          playable={myTurn && playableUids.has(h.uid) && !autoplay} onPlay={() => onHandClick(h.uid)} onClose={() => setZoomUid(null)} /> : null; })()}
        {inspectCardId && <CardZoomModal card={CARDS[inspectCardId]} playable={false} onPlay={() => {}} onClose={() => setInspectCardId(null)} />}
        {inspectUid && (() => {
          const m = [...me.board, ...foe.board].find(m => m.uid === inspectUid); if (!m) return null;
          const own = me.board.some(x => x.uid === m.uid); const canAttack = legal.some(a => a.type === 'attack' && a.attackerUid === m.uid);
          return <Dialog title={cardName(m.cardId)} onClose={() => setInspectUid(null)}><div className="minion-detail">
            <CardView card={CARDS[m.cardId]} size="lg" tilt={false} />
            <p>{t('В бою:', 'Current stats:')} <b>{m.attack} {t('атака', 'attack')} · {m.health}/{m.maxHealth} {t('здоровье', 'health')}</b></p>
            <p>{m.staked ? t('В стейкинге: +1 газ за ход. Остаётся целью атак.', 'Staked: +1 gas each turn. Still attackable.') : m.canAttack ? t('Готов к бою.', 'Ready for combat.') : t('Не может атаковать в этом ходу.', 'Cannot attack this turn.')}</p>
            {own && myTurn && !autoplay && <div className="dialog-actions">
              {canAttack && <button className="gold-button" onClick={() => { setAttackerUid(m.uid); setInspectUid(null); }}>{t('Выбрать цель', 'Choose target')}</button>}
              {legal.some(a => a.type === 'stake' && a.uid === m.uid) && <button className="outline-button" onClick={() => { onStake(m.uid); setInspectUid(null); }}>{t('В стейкинг', 'Stake')}</button>}
              {legal.some(a => a.type === 'unstake' && a.uid === m.uid) && <button className="outline-button" onClick={() => { onUnstake(m.uid); setInspectUid(null); }}>{t('Вернуть в строй', 'Unstake')}</button>}
            </div>}
          </div></Dialog>;
        })()}
        {state.winner !== null && !combatFlight && <EndOverlay winner={state.winner} blocks={state.block} stats={stats} onRematch={() => startGame(Date.now() & 0x7fffffff)} />}
        <HandHoverPreview card={isDesktop && handPreviewUid ? CARDS[me.hand.find(h => h.uid === handPreviewUid)?.cardId ?? ''] : undefined} position={handPreviewPosition} />
        <DragPreview hand={me.hand} board={me.board} />
        <AttackFlight flight={combatFlight}
          currentMinion={combatFlight ? [...me.board, ...foe.board].find(m => m.uid === combatFlight.minion.uid) : undefined}
          floats={combatFlight ? floatsFor(combatFlight.minion.uid) : []} onContact={commitCombat} onComplete={finishCombat} />
        <AbilityFx events={events} floats={floats} reduced={reduced} />
        <MotionFx events={events} playRects={playRects} reduced={reduced} />
      </div>
    </DndProvider>
  );
}

/** Full card outside the compact hand styles; never intercepts drag targets. */
function HandHoverPreview({ card, position }: { card?: CardDef; position: { left: number; top: number } }) {
  const { active } = useDragState();
  if (!card || active || typeof document === 'undefined') return null;
  return <CardPreview card={card} position={position} />;
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
function ContextCoach({ phase, onClose }: { phase: 'opening' | 'play' | 'attack' | 'target' | 'end'; onClose: () => void }) {
  const { t } = useLocale();
  const hints = {
    opening: t('Нажми на карты для замены. Затем оставь или обнови руку.', 'Tap cards to replace, then keep or refresh your hand.'),
    play: t('Карта с зелёным свечением доступна. Перетащи её в нишу или открой просмотр и нажми «Разыграть».', 'A card with a green glow is ready. Drag it into a slot or inspect it and press “Play”.'),
    attack: t('Нажми на готовое существо → выбери подсвеченную цель.', 'Tap a ready minion → choose a glowing target.'),
    target: t('Цифры — урон цели и ответный удар. Нажми на цель для атаки.', 'Numbers preview damage and retaliation. Tap a target to attack.'),
    end: t('Существо отдыхает до следующего хода. Заверши ход, когда будешь готов.', 'New minions rest until next turn. End your turn when ready.'),
  };
  return <div className={`context-coach coach-${phase}`} role="status"><span aria-hidden>✧</span><p>{hints[phase]}</p><button onClick={onClose} aria-label={t('Скрыть подсказки', 'Hide hints')}>×</button></div>;
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
  const { t, cardName } = useLocale();
  return <Dialog title={cardName(card.id)} onClose={onClose}>
    <div className="minion-detail"><CardView card={card} size="lg" tilt={false} playable={playable} />
      <div className="dialog-actions"><button className="gold-button" disabled={!playable} onClick={() => { onPlay(); onClose(); }}>{t('Разыграть', 'Play card')}</button>
        <button className="outline-button" onClick={onClose}>{t('Закрыть', 'Close')}</button></div>
      {!playable && <p className="small-note">{t('Можно смотреть в любой момент. Для розыгрыша нужны ваш ход, газ и свободная ниша для существа.', 'Inspect anytime. Playing requires your turn, enough gas and a free minion slot.')}</p>}
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
      className="laurel-shimmer mx-auto w-72 md:w-96 text-gold"
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
  const { t } = useLocale();
  const win = winner === ME;
  const reduced = useReducedMotion();

  // Canvas confetti burst on victory
  useEffect(() => {
    if (!win || reduced) return;
    let cancelled = false;
    import('canvas-confetti').then(({ default: confetti }) => {
      if (cancelled) return;
      const gold = ['#D4AF37', '#F5D76E', '#FFD700', '#FFF8DC'];
      confetti({ particleCount: 120, spread: 100, origin: { y: 0.6 }, colors: gold, disableForReducedMotion: true });
      setTimeout(() => { if (!cancelled) confetti({ particleCount: 60, spread: 120, origin: { y: 0.4 }, colors: gold, disableForReducedMotion: true }); }, 400);
    });
    return () => { cancelled = true; };
  }, [win, reduced]);

  return (
    <div className="end-overlay fixed inset-0 z-[80] flex items-center justify-center bg-abyss/95 backdrop-blur-sm overflow-hidden">
      {win && !reduced && <CoinConfetti />}
      <div className="rise-in text-center px-6 relative z-10 max-w-lg">
        {win ? (
          <>
            <Laurel />
            <div className="font-display text-4xl md:text-7xl font-bold gold-text tracking-[0.12em]">
              {t('ПОБЕДА!', 'VICTORIA!')}
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              Veni. Vidi. Rugi. {t('Казна твоя.', 'The treasury is yours.')}
            </p>
          </>
        ) : winner === 'draw' ? (
          <>
            <div className="font-display text-4xl md:text-7xl font-bold text-lavender tracking-[0.12em]">
              {t('НИЧЬЯ', 'DRAW')}
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              {t('Обе казны опустели. Рим переживёт.', 'Both treasuries fall. Rome shrugs.')}
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
              {t('РАЗОРЕНИЕ', 'RUGGED')}
            </div>
            <p className="mt-3 text-lavender italic font-display text-lg">
              {t('Империя пала. Форум это запомнит.', 'Rugged. The forum will remember this.')}
            </p>
          </>
        )}
        <p className="mt-2 text-xs text-lavender/60 font-mono">{t(`За ${blocks} ходов`, `Decided in ${blocks} turns`)}</p>
        <div className="match-stats">
          {[[stats.cardsPlayed, t('Карт сыграно', 'Cards played')], [stats.attacks, t('Атак', 'Attacks')], [stats.treasuryDamage, t('Урон казне', 'Treasury damage')],
            [stats.treasuryHealed, t('Исцелено', 'HP restored')], [stats.minionsLost, t('Потери', 'Minions lost')], [stats.counters, t('Контрзаклинаний', 'Counters')]].map(([value, label]) =>
            <div key={label}><b>{value}</b><span>{label}</span></div>)}
        </div>
        <div className="mt-7 flex gap-3 justify-center flex-wrap">
          <button
            onClick={onRematch}
            className="px-8 py-3.5 rounded-lg bg-[#D4AF37] text-[#1A0B2E] font-bold text-lg tracking-wide hover:bg-[#F5D76E] active:scale-[0.97] transition shadow-[0_0_28px_rgba(212,175,55,0.45)] border-2 border-[#F5D76E]"
          >
            <BattleIcon kind="attack" /> {t('Ещё матч', 'Play again')}
          </button>
          <Link
            href="/"
            className="px-6 py-3.5 rounded-lg border-2 border-gold/60 text-gold-light font-semibold hover:bg-gold/10 transition"
          >
            {t('Сменить героя', 'Change hero')}
          </Link>
          <Link href="/leaderboard" className="text-mint text-sm w-full mt-2">{t('История и достижения devnet ↗', 'Match history & devnet achievements ↗')}</Link>
        </div>
      </div>
    </div>
  );
}
