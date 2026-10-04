import { NextResponse } from 'next/server';
import { isAddress } from '@solana/kit';
import { metadataBase } from '../../../../lib/solana/metadata';
import { validatedDasCard, type OwnedCardNFT } from '../../../../lib/solana/ownership';
export const dynamic = 'force-dynamic';
const recent = new Map<string, { expires: number; cards: OwnedCardNFT[]; partial: boolean }>();
const inflight = new Map<string, Promise<{ cards: OwnedCardNFT[]; partial: boolean }>>();
const clients = new Map<string, { expires: number; count: number }>();
const WINDOW_MS = 60_000, MAX_INFLIGHT = 3, MAX_UPSTREAM_REQUESTS = 30;
let upstreamWindow = { expires: 0, count: 0 };
class QuotaError extends Error {}
function clientAllowed(request: Request): boolean {
  const now = Date.now(), raw = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const client = raw.length <= 64 && /^[0-9a-f:.]+$/i.test(raw) ? raw : 'unknown';
  clients.forEach((value, key) => { if (value.expires <= now) clients.delete(key); });
  let entry = clients.get(client);
  if (!entry) {
    if (clients.size >= 256) return false;
    entry = { expires: now + WINDOW_MS, count: 0 }; clients.set(client, entry);
  }
  return ++entry.count <= 8;
}
function reserveUpstream() {
  const now = Date.now();
  if (upstreamWindow.expires <= now) upstreamWindow = { expires: now + WINDOW_MS, count: 0 };
  if (upstreamWindow.count >= MAX_UPSTREAM_REQUESTS) throw new QuotaError();
  upstreamWindow.count++;
}
async function readJson(response: Response): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty DAS response');
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.length; if (bytes > 1_048_576) throw new Error('DAS response too large');
      chunks.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const joined = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(joined));
}
export async function GET(request: Request) {
  const url = new URL(request.url), owner = url.searchParams.get('owner') ?? '', collection = process.env.NEXT_PUBLIC_GENESIS_COLLECTION ?? '', base = metadataBase(), key = process.env.HELIUS_DEVNET_API_KEY;
  if (!isAddress(owner)) return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 });
  if (!key || !isAddress(collection) || !base) return NextResponse.json({ error: 'Devnet DAS is not configured. Core RPC fallback is available.' }, { status: 503 });
  if (!clientAllowed(request)) return NextResponse.json({ error: 'Devnet ownership requests are throttled. Core RPC fallback is available.' }, { status: 429, headers: { 'Retry-After': '60' } });
  const scope = JSON.stringify([owner, collection, base]);
  const hit = recent.get(scope);
  if (hit && hit.expires > Date.now()) return NextResponse.json({ cards: hit.cards, partial: hit.partial }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    let pending = inflight.get(scope);
    if (!pending && inflight.size >= MAX_INFLIGHT) throw new QuotaError();
    if (!pending) {
      pending = (async () => {
    const cards: OwnedCardNFT[] = []; let partial = false;
    for (let page = 1; page <= 5; page++) {
      reserveUpstream();
      const response = await fetch(`https://devnet.helius-rpc.com/?api-key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: `imperivm-${page}`, method: 'getAssetsByOwner', params: { ownerAddress: owner, page, limit: 100, displayOptions: { showCollectionMetadata: false, showUnverifiedCollections: false } } }), signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error' });
      if (!response.ok) throw new Error('DAS unavailable');
      const data = await readJson(response);
      if (data.error || !Array.isArray(data.result?.items) || data.result.items.length > 100) throw new Error('Invalid DAS response');
      for (const item of data.result.items) { const card = validatedDasCard(item, owner, collection, base); if (card && !cards.some(c => c.address === card.address)) cards.push(card); }
      if (data.result.items.length < 100) break;
      if (page === 5) partial = true;
    }
    if (recent.size >= 100) recent.delete(recent.keys().next().value!);
    recent.set(scope, { expires: Date.now() + 30_000, cards, partial });
    return { cards, partial };
      })();
      inflight.set(scope, pending);
      void pending.finally(() => { if (inflight.get(scope) === pending) inflight.delete(scope); }).catch(() => {});
    }
    return NextResponse.json(await pending, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof QuotaError ? 'Devnet ownership capacity reached. Core RPC fallback is available.' : 'Devnet indexer unavailable. Retry or use the Core RPC fallback.' },
      { status: error instanceof QuotaError ? 429 : 502, headers: error instanceof QuotaError ? { 'Retry-After': '60' } : undefined });
  }
}
