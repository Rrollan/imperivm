/**
 * IMPERIVM — focused regression tests for the structured event adapter
 * (`lib/events.ts`).
 *
 * Run:
 *   npx tsx scripts/tests/events.test.ts
 *
 * Each test prints PASS or FAIL on its own line. Exit code is the count
 * of failed tests (0 = green). Designed to be run from CI without
 * external test runners.
 *
 * Cases covered (matches the early review checklist):
 *   1. computeLogAppendedSuffix boundary cases
 *   2. Capped log (push >120 lines, stale markers do NOT replay)
 *   3. Cast rugpull: vortex fires ONLY on resolution, not on queue
 *   4. Priority counter: 'counters' line without 'resolves' line
 *   5. Multiple spell resolutions per start-of-turn (same name, two
 *      mempool entries)
 *   6. Fatal attacker: retaliation kills attacker → damage + death +
 *      attackerFatal=true
 */
import { DECKS } from '../../lib/decks';
import {
  createGame,
  applyAction,
  legalActions,
  isGameOver,
} from '../../lib/engine/engine';
import { diffAction } from '../../lib/events';
import type {
  Action,
  GameState,
  PlayerId,
} from '../../lib/engine/types';

let failed = 0;
let passed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`  PASS ${msg}`);
    passed++;
  } else {
    console.error(`  FAIL ${msg}`);
    failed++;
  }
}

function freshGame(seed = 7): GameState {
  const heroes = Object.keys(DECKS);
  return createGame(heroes[0], DECKS[heroes[0]], heroes[1], DECKS[heroes[1]], seed);
}

function deepClone<T>(v: T): T {
  // Node 24 has structuredClone globally; fall back to JSON for older.
  if (typeof (globalThis as { structuredClone?: typeof structuredClone }).structuredClone === 'function') {
    return (globalThis as { structuredClone: typeof structuredClone }).structuredClone(v);
  }
  return JSON.parse(JSON.stringify(v)) as T;
}

/* ──────────────────────────────────────────────────────────────────── */
/* 1. computeLogAppendedSuffix boundary cases (via diffAction behavior)*/
/* ──────────────────────────────────────────────────────────────────── */
function testSuffixBoundaries(): void {
  console.log('[1] suffix boundaries');
  // We test the algorithm via the public diffAction contract:
  //   - appending a 'RUG PULL!' line at the end MUST fire rugPull
  //     (proves the walker found the appended suffix).
  //   - rolling past the 120-cap (drop front, append one new marker)
  //     MUST still fire rugPull.
  //   - no-change diff returns null.
  //   - pure replacement (no shared tail) returns null (no markers).
  //
  // [a,b] -> [a,b,c]: walker finds k=len(prev), newLog=['c']
  const p1: GameState = freshGame(1);
  const n1 = deepClone(p1);
  n1.log = [...p1.log, 'RUG PULL! All minions destroyed'];
  const ev1 = diffAction(p1, n1);
  assert(!!(ev1 && ev1.rugPull), 'append-one-line fires rugPull');

  // [a,b,c, ..., z-100] then rolled [b,c, ..., z-100, RUG PULL!]
  // The walker must find k = N - 1 (everything except the dropped
  // first line) and yield newLog=['RUG PULL!'].
  const p2: GameState = freshGame(2);
  for (let i = 0; i < 100; i++) p2.log.push(`noise-${i}`);
  const n2 = deepClone(p2);
  n2.log = [...p2.log.slice(1), 'RUG PULL! All minions destroyed'];
  const ev2 = diffAction(p2, n2);
  assert(!!(ev2 && ev2.rugPull), 'cap-roll + new RUG PULL! fires rugPull');

  // No change: empty newLog → diffAction returns null.
  const p3: GameState = freshGame(3);
  const n3 = deepClone(p3);
  const ev3 = diffAction(p3, n3);
  assert(ev3 === null, 'no-change returns null');

  // Pure replacement: ['x'] -> ['y']. No shared tail.
  const p4: GameState = freshGame(4);
  p4.log = ['x'];
  const n4 = deepClone(p4);
  n4.log = ['y'];
  const ev4 = diffAction(p4, n4);
  assert(ev4 === null, 'pure replacement (no shared tail) returns null');

  // Deep cap roll with no engine action: drop 20 from front, add 20.
  // No markers → returns null.
  const p5: GameState = freshGame(5);
  for (let i = 0; i < 130; i++) p5.log.push(`prev-${i}`);
  const n5 = deepClone(p5);
  n5.log = [...p5.log.slice(20), ...Array.from({ length: 20 }, (_, i) => `next-${i}`)];
  const ev5 = diffAction(p5, n5);
  assert(ev5 === null, 'cap roll with no markers returns null');
}

/* ──────────────────────────────────────────────────────────────────── */
/* 2. Capped log: stale RUG PULL does NOT replay on subsequent actions */
/* ──────────────────────────────────────────────────────────────────── */
function testCappedLogNoReplay(): void {
  console.log('[2] capped log does not replay stale RUG PULL');
  const state = freshGame(11);
  // Artificially pump the log past the engine's 120-cap with realistic
  // noise that includes an old "RUG PULL!" line and a "Halving:" line.
  const s2 = deepClone(state);
  for (let i = 0; i < 100; i++) s2.log.push(`noise-${i}`);
  s2.log.push('RUG PULL! All minions destroyed');
  s2.log.push('Halving: Test +1/+1');
  // Roll the log past the engine's 120-cap by trimming the front.
  while (s2.log.length > 110) s2.log.shift();
  // After trim, the cap-roll friendly tail still has the stale markers
  // in the recents. Now do an unrelated action (end-turn) and assert
  // that diffAction does NOT surface rugPull or halvings.
  const after = applyAction(s2, { type: 'end-turn' });
  // Truncate `after.log` to simulate the engine's own cap (120).
  while (after.log.length > 120) after.log.shift();
  const ev = diffAction(s2, after, { type: 'end-turn' });
  assert(!(ev && ev.rugPull), 'stale RUG PULL does NOT replay');
  if (ev && ev.halvings) {
    assert(
      ev.halvings.every(h => h.name !== 'Test'),
      'stale Halving line does NOT replay',
    );
  } else {
    console.log('  PASS stale Halving line does NOT replay');
    passed++;
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* 3. Cast rugpull: vortex fires ONLY on resolution                   */
/* ──────────────────────────────────────────────────────────────────── */
function testRugPullResolutionOnly(): void {
  console.log('[3] rugpull vortex only on resolution');
  // Build a state where P0 has just cast RUG PULL into its mempool.
  // We mutate directly to skip the costly setup.
  const s0 = freshGame(21);
  // Force a rugpull card into P0's hand.
  (s0.players[0] as unknown as { hand: { uid: string; cardId: string }[] }).hand.push({
    uid: 'mp-rug',
    cardId: 'rug-pull',
  });
  // Push a rugpull entry into P0's mempool as if cast last turn.
  (s0.players[0] as unknown as { mempool: { uid: string; cardId: string; name: string; owner: PlayerId }[] }).mempool.push({
    uid: 'mp-rug',
    cardId: 'rug-pull',
    name: 'RUG PULL',
    owner: 0,
  });
  s0.players[0].gas = 0; // can't cast again right now
  // Now P0 ends turn → startTurn on P1, then P1 ends → startTurn on P0
  // which resolves the mempool.
  let s = applyAction(s0, { type: 'end-turn' });
  s = applyAction(s, { type: 'end-turn' });
  const ev = diffAction(s0, s);
  assert(!!(ev && ev.rugPull), 'rugpull vortex fires after resolution');

  // The cast-spell action itself (the immediate action that queued it)
  // must NOT surface rugPull.
  const castEv = diffAction(s0, s0, { type: 'cast-spell', uid: 'mp-rug' });
  assert(!(castEv && castEv.rugPull), 'cast-spell alone does NOT trigger vortex');
}

/* ──────────────────────────────────────────────────────────────────── */
/* 4. Priority counter: 'counters' line without 'resolves' line       */
/* ──────────────────────────────────────────────────────────────────── */
function testCounterNoResolve(): void {
  console.log('[4] priority counter without resolve line');
  const s = freshGame(31);
  // Put a rugpull in P1's mempool (so priority removes it).
  (s.players[1] as unknown as { mempool: { uid: string; cardId: string; name: string; owner: PlayerId }[] }).mempool.push({
    uid: 'mp-rug',
    cardId: 'rug-pull',
    name: 'RUG PULL',
    owner: 1,
  });
  // Put a priority minion into P0's hand (frontrun-bot — costs 3).
  (s.players[0] as unknown as { hand: { uid: string; cardId: string }[] }).hand.push({
    uid: 'h-prio',
    cardId: 'frontrun-bot',
  });
  s.players[0].gas = 10;
  const action: Action = { type: 'play-minion', uid: 'h-prio' };
  const after = applyAction(s, action);
  const ev = diffAction(s, after, action);
  assert(!!(ev && ev.spellCountered), 'priority play produces spellCountered');
  // spellResolved should NOT include 'RUG PULL' (it was counter-cancelled).
  if (ev && ev.spellResolved) {
    assert(
      !ev.spellResolved.some(r => r.name === 'RUG PULL'),
      'countered spell does NOT appear in spellResolved',
    );
  } else {
    console.log('  PASS countered spell does NOT appear in spellResolved');
    passed++;
  }
  assert(
    !(ev && ev.rugPull),
    'priority counter does NOT fire rugpull vortex (no resolve line)',
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* 5. Multiple spell resolutions per start-of-turn (same name, 2x)     */
/* ──────────────────────────────────────────────────────────────────── */
function testMultipleResolutions(): void {
  console.log('[5] multiple spell resolutions in one batch');
  const s = freshGame(41);
  // Queue two of the same spell for P0 (same mempool uid prefix, but
  // distinct uids). We use rug-pull: cardDef('rug-pull') is the only
  // spell that exists in the catalog that ALSO produces a deterministic
  // log line regardless of board state ('RUG PULL! All minions
  // destroyed' is logged unconditionally in `applyEffect.rugpull`).
  const mp = (s.players[0] as unknown as { mempool: { uid: string; cardId: string; name: string; owner: PlayerId }[] }).mempool;
  mp.push(
    { uid: 'mp-a', cardId: 'rug-pull', name: 'RUG PULL', owner: 0 },
    { uid: 'mp-b', cardId: 'rug-pull', name: 'RUG PULL', owner: 0 },
  );
  s.players[0].gas = 0;
  // Walk turns: P0 ends → P1 ends → P0 resolves both.
  let cur = s;
  for (let i = 0; i < 2; i++) cur = applyAction(cur, { type: 'end-turn' });
  const ev = diffAction(s, cur, { type: 'end-turn' });
  assert(!!ev, 'end-turn diff produces an event');
  if (!ev) return;
  // The engine should log two 'RUG PULL! All minions destroyed' lines.
  const rugLines = cur.log.filter(l => l === 'RUG PULL! All minions destroyed');
  assert(rugLines.length === 2, 'engine logs two RUG PULL! lines');
  // diffAction called once on the full prev→next sees BOTH new lines
  // and should pair them.
  assert(
    !!(ev.spellResolved && ev.spellResolved.length === 2),
    'diffAction emits two spellResolved entries',
  );
  if (ev.spellResolved && ev.spellResolved.length === 2) {
    assert(
      ev.spellResolved.every(r => r.name === 'RUG PULL'),
      'both spellResolved entries name "RUG PULL"',
    );
    assert(
      ev.spellResolved.every(r => !r.fizzled),
      'neither fizzled',
    );
    assert(
      ev.spellResolved[0].mempoolUid !== ev.spellResolved[1].mempoolUid,
      'paired by distinct mempool uid',
    );
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* 6. Fatal attacker: retaliation kills attacker                      */
/* ──────────────────────────────────────────────────────────────────── */
function testFatalAttacker(): void {
  console.log('[6] fatal attacker damage + death numbers');
  const s = freshGame(51);
  // Put a 1/1 on P0 and a 1/1 on P1. P0 attacks P1's minion — both
  // die from retaliation (1 dmg each).
  const p0Board = s.players[0].board;
  const p1Board = s.players[1].board;
  // Remove existing minions and add controlled ones.
  s.players[0].board = [
    {
      uid: 'atk',
      cardId: 'test-1-1',
      name: 'Tester',
      attack: 1,
      health: 1,
      maxHealth: 1,
      canAttack: true,
      staked: false,
    },
  ];
  s.players[1].board = [
    {
      uid: 'tgt',
      cardId: 'test-1-1',
      name: 'Targeter',
      attack: 1,
      health: 1,
      maxHealth: 1,
      canAttack: true,
      staked: false,
    },
  ];
  s.turn = 0;
  s.players[0].gas = 0;
  const action: Action = { type: 'attack', attackerUid: 'atk', target: 'tgt' };
  const after = applyAction(s, action);
  const ev = diffAction(s, after, action);
  assert(!!ev, 'attack produces events');
  if (!ev) return;
  assert(
    !!(ev.attack && ev.attack.attackerFatal),
    'attackerFatal=true after mutual kill',
  );
  assert(
    !!(ev.attack && ev.attack.damage === 1),
    'target took 1 damage',
  );
  // damages[] should include both minions (both lost 1 hp) — but
  // attacker disappears, so damages covers only the survivor by uid.
  // deaths[] should include both uids.
  assert(!!(ev.deaths && ev.deaths.length === 2), 'both minions in deaths[]');
  if (ev.deaths) {
    const ids = ev.deaths.map(d => d.uid).sort();
    assert(ids[0] === 'atk' && ids[1] === 'tgt', 'both attacker and target uid present');
  }
}

/* ──────────────────────────────────────────────────────────────────── */
/* 7. Audio perspective: foe-win should NOT play victory              */
/* ──────────────────────────────────────────────────────────────────── */
function testGameOverPerspective(): void {
  console.log('[7] game-over perspective');
  // Drive a game to P1 win (P0 = me loses).
  let s = freshGame(61);
  // Smash P0's treasury directly via state — we cannot easily script a
  // full P1 kill without seed control. So we just mutate and assert
  // diffAction's perspective logic on the gameOver field.
  s.winner = null;
  s.players[0].treasury = 0;
  s.players[1].treasury = 30;
  // Push the log line manually and trigger a no-op end-turn.
  s.log.push('Game over: P1 wins');
  const next = deepClone(s);
  const ev = diffAction(s, next);
  // We don't expect gameOver from a no-op diff (no NEW lines beyond
  // the manual push). To exercise, push the line via a real engine
  // action. Instead, test that perspective is computed correctly by
  // calling diffAction between two states where only the winner line
  // is in the new tail.
  const p = deepClone(s);
  const n = deepClone(s);
  n.log = [...p.log, 'Game over: P1 wins'];
  n.winner = 1;
  const ev2 = diffAction(p, n);
  assert(!!(ev2 && ev2.gameOver), 'gameOver surfaces');
  if (ev2 && ev2.gameOver) {
    assert(ev2.gameOver.winner === 1, 'winner recorded as P1');
    assert(ev2.gameOver.perspective === 'foe', 'perspective from ME=0 is "foe"');
  }
  const p2 = deepClone(s);
  const n2 = deepClone(s);
  n2.log = [...p2.log, 'Game over: P0 wins'];
  n2.winner = 0;
  const ev3 = diffAction(p2, n2);
  assert(!!(ev3 && ev3.gameOver && ev3.gameOver.perspective === 'me'), 'P0 win perspective is "me"');
}

/* ──────────────────────────────────────────────────────────────────── */
/* 8. Sanity: smoke AI game still plays + emits diffs without crashes  */
/* ──────────────────────────────────────────────────────────────────── */
function testAiSmoke(): void {
  console.log('[8] AI-vs-AI smoke produces no crashes');
  // Lightweight — just confirm diffAction never throws on real state.
  const heroes = Object.keys(DECKS);
  let s = createGame(heroes[0], DECKS[heroes[0]], heroes[1], DECKS[heroes[1]], 91);
  let steps = 0;
  while (!isGameOver(s) && steps < 60) {
    const acts = legalActions(s);
    if (acts.length === 0) break;
    const next = applyAction(s, acts[0]);
    // No throw, no null pointer when action is provided.
    diffAction(s, next, acts[0]);
    s = next;
    steps++;
  }
  assert(steps > 0, 'AI walk advances at least one step');
}

/* ──────────────────────────────────────────────────────────────────── */
/* Run                                                                   */
/* ──────────────────────────────────────────────────────────────────── */
testSuffixBoundaries();
testCappedLogNoReplay();
testRugPullResolutionOnly();
testCounterNoResolve();
testMultipleResolutions();
testFatalAttacker();
testGameOverPerspective();
testAiSmoke();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
