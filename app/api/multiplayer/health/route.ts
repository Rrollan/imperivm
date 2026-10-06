export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness only; it makes no claim about multi-instance persistence or connected players. */
export function GET() {
  return Response.json({status: 'ok', protocol: 'imperivm-pvp-v1', ruleset: 'classic-v1'}, {headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
}
