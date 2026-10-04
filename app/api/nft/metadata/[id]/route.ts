import { NextResponse } from 'next/server';
import { metadataBase, nftMetadata } from '../../../../../lib/solana/metadata';
export function GET(_request: Request, { params }: { params: { id: string } }) {
  const base = metadataBase();
  if (!base) return NextResponse.json({ error: 'Public NFT metadata origin is not configured.' }, { status: 503 });
  try { return NextResponse.json(nftMetadata(params.id, base), { headers: { 'Cache-Control': 'public, max-age=3600' } }); }
  catch { return NextResponse.json({ error: 'Unknown Genesis card.' }, { status: 404 }); }
}
