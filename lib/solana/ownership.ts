import { isAddress } from '@solana/kit';
import { cardIdFromUri } from './metadata';
export interface OwnedCardNFT { address: string; cardId: string; owner: string; compressed: boolean; source: 'das' | 'core-rpc'; }
type DasAsset = { id?: unknown; interface?: unknown; burnt?: unknown; ownership?: { owner?: unknown }; grouping?: { group_key?: unknown; group_value?: unknown }[]; content?: { json_uri?: unknown }; compression?: { compressed?: unknown }; };
export function validatedDasCard(value: unknown, owner: string, collection: string, base: string): OwnedCardNFT | null {
  if (!value || typeof value !== 'object') return null;
  const asset = value as DasAsset;
  if (typeof asset.id !== 'string' || !isAddress(asset.id) || asset.burnt !== false || asset.ownership?.owner !== owner || !Array.isArray(asset.grouping) || !asset.grouping.some(g => g?.group_key === 'collection' && g.group_value === collection) || typeof asset.content?.json_uri !== 'string') return null;
  const cardId = cardIdFromUri(asset.content.json_uri, base);
  if (!cardId || !['MplCoreAsset', 'V1_NFT', 'ProgrammableNFT', 'V2_NFT'].includes(String(asset.interface))) return null;
  return { address: asset.id, cardId, owner, compressed: asset.compression?.compressed === true, source: 'das' };
}
export function nftCounts(records: readonly OwnedCardNFT[]) {
  const owned: Record<string, number> = {};
  const seen = new Set<string>();
  for (const record of records) if (!seen.has(record.address)) { seen.add(record.address); owned[record.cardId] = (owned[record.cardId] ?? 0) + 1; }
  return owned;
}
