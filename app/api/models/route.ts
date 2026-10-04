import { access } from 'node:fs/promises';
import path from 'node:path';
import { MODEL_MANIFEST, type ModelKey } from '../../../components/3d/modelManifest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function exists(file: string) {
  try { await access(path.join(process.cwd(), 'public', file)); return true; } catch { return false; }
}

/** Fixed allowlist: never accept a filesystem path from the browser. */
export async function GET() {
  const entries = await Promise.all(Object.entries(MODEL_MANIFEST).map(async ([key, model]) => {
    const [available, webp, png] = await Promise.all([
      exists(model.path), exists(`/models/${key}.webp`), exists(`/models/${key}.png`),
    ]);
    return [key, { available, fallback: webp ? `/models/${key}.webp` : png ? `/models/${key}.png` : model.fallback }] as const;
  }));
  return Response.json(Object.fromEntries(entries) as Record<ModelKey, { available: boolean; fallback: string }>, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
