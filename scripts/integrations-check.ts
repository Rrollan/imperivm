import { spawnSync } from 'node:child_process';
for (const script of ['scripts/tests/integrations.test.ts', 'scripts/tests/idos.test.ts', 'scripts/tests/economy.test.ts', 'scripts/tests/deckWorkshop.test.ts', 'scripts/tests/arenaLegibility.test.ts', 'scripts/tests/aimPath.test.ts', 'scripts/tests/deploymentMotion.test.ts', 'scripts/tests/deploymentReframe.test.ts', 'scripts/tests/rulers.test.ts', 'scripts/tests/metaplex.test.ts']) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
