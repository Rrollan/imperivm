import { isAddress } from '@solana/kit';
import { metadataBase } from './metadata';
export const DEPLOYMENT_KEY = 'imperivm.genesis.devnet.v1';
export interface GenesisDeployment { collection: string; candyMachine: string; authority: string; metadataOrigin: string; collectionSignature?: string; machineSignature?: string; }
export function genesisDeployment(): GenesisDeployment | null {
  const origin = metadataBase();
  if (!origin) return null;
  const collection = process.env.NEXT_PUBLIC_GENESIS_COLLECTION || '', candyMachine = process.env.NEXT_PUBLIC_GENESIS_CANDY_MACHINE || '';
  let stored: GenesisDeployment | null = null;
  try {
    const data = JSON.parse(localStorage.getItem(DEPLOYMENT_KEY) || 'null');
    if (data?.version === 1 && data.metadataOrigin === origin && isAddress(data.collection) && isAddress(data.authority) && (!data.candyMachine || isAddress(data.candyMachine))) stored = { collection: data.collection, candyMachine: data.candyMachine || '', authority: data.authority, metadataOrigin: origin, collectionSignature: typeof data.collectionSignature === 'string' ? data.collectionSignature : undefined, machineSignature: typeof data.machineSignature === 'string' ? data.machineSignature : undefined };
  } catch { /* environment configuration still works without storage */ }
  if (isAddress(collection)) return { collection, candyMachine: isAddress(candyMachine) ? candyMachine : stored?.collection === collection ? stored.candyMachine : '', authority: stored?.collection === collection ? stored.authority : '', metadataOrigin: origin };
  return stored;
}
export function saveDeployment(data: GenesisDeployment) {
  if (!isAddress(data.collection) || !isAddress(data.authority) || (data.candyMachine && !isAddress(data.candyMachine)) || metadataBase(data.metadataOrigin) !== metadataBase()) throw new Error('Invalid devnet deployment.');
  localStorage.setItem(DEPLOYMENT_KEY, JSON.stringify({ version: 1, ...data }));
  window.dispatchEvent(new Event('imperivm:deployment'));
}
