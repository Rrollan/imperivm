/**
 * Headless smoke test: plays a full AI-vs-AI game to completion, then
 * spawns the package 4A deterministic regression suite as a child
 * process so both can be exercised via `npm run smoke`.
 * Run: npm run smoke
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGame, applyAction, isGameOver } from '../lib/engine/engine';
import { DECKS } from '../lib/decks';
import { chooseAiAction } from '../lib/ai';

const heroes = Object.keys(DECKS);
if (heroes.length < 2) {
  console.error('SMOKE FAIL: need at least 2 decks');
  process.exit(1);
}

let state = createGame(heroes[0], DECKS[heroes[0]], heroes[1], DECKS[heroes[1]], 42);
let steps = 0;
const MAX_STEPS = 3000;

while (!isGameOver(state) && steps < MAX_STEPS) {
  const action = chooseAiAction(state);
  state = applyAction(state, action);
  steps++;
  if (steps % 200 === 0) {
    console.log(
      `... step ${steps} block ${state.block} treasuries ${state.players[0].treasury}/${state.players[1].treasury}`
    );
  }
}

console.log(`finished: steps=${steps} blocks=${state.block} winner=${state.winner}`);
console.log(
  `treasuries: ${state.players[0].treasury} vs ${state.players[1].treasury}`
);

if (!isGameOver(state) || state.winner === null) {
  console.error('SMOKE FAIL: game did not reach a result');
  process.exit(1);
}
console.log('SMOKE OK');

// package 4A: chain the deterministic regression suite as a subprocess
// so the smoke script stays synchronous. tsx is in devDependencies.
console.log('\n--- package 4A regressions ---');
const reg = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)), 'scripts/regressions.ts'], {
  stdio: 'inherit',
});
if (reg.status !== 0) {
  console.error(`REGRESSIONS FAIL: exit ${reg.status}`);
  process.exit(reg.status ?? 1);
}
