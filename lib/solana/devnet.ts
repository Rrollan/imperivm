import { address, createSolanaRpc } from '@solana/kit';

// Deliberately not configurable: every wallet/Metaplex operation uses devnet.
export const DEVNET_RPC = 'https://api.devnet.solana.com';
export const DEVNET_CHAIN = 'solana:devnet' as const;
export const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1';
export const devnetRpc = createSolanaRpc(DEVNET_RPC);
export async function assertDevnet() {
  if (await devnetRpc.getGenesisHash().send() !== DEVNET_GENESIS) throw new Error('Wrong network. IMPERIVM only supports Solana devnet.');
}
export async function readDevnetBalance(owner: string): Promise<number> {
  await assertDevnet();
  const result = await devnetRpc.getBalance(address(owner), { commitment: 'confirmed' }).send();
  return Number(result.value) / 1_000_000_000;
}
export function explorerUrl(value: string, kind: 'address' | 'tx' = 'address') {
  return `https://explorer.solana.com/${kind}/${encodeURIComponent(value)}?cluster=devnet`;
}

