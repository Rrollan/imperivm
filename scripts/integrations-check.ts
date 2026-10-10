import { spawnSync } from 'node:child_process';
for (const script of ['scripts/tests/packGateway.test.ts', 'scripts/tests/packPayment.test.ts', 'scripts/tests/walletTransfer.test.ts', 'scripts/tests/impPurchase.test.ts', 'scripts/tests/integrations.test.ts', 'scripts/tests/idos.test.ts', 'scripts/tests/session.test.ts', 'scripts/tests/economy.test.ts', 'scripts/tests/profile.test.ts', 'scripts/tests/cardMarket.test.ts', 'scripts/tests/deckWorkshop.test.ts', 'scripts/tests/cardHint.test.ts', 'scripts/tests/arenaLegibility.test.ts', 'scripts/tests/arenaImage.test.ts', 'scripts/tests/aimPath.test.ts', 'scripts/tests/deploymentMotion.test.ts', 'scripts/tests/deploymentReframe.test.ts', 'scripts/tests/legendaryContact.test.ts', 'scripts/tests/rulers.test.ts', 'scripts/tests/metaplex.test.ts']) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
