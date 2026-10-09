import assert from 'node:assert/strict';
import {requestArenaImage} from '../../components/presentation/arenaImage';
import {cardArtworkPaths} from '../../components/presentation/cardFace';
import {playProofEnabled} from '../../lib/solana/features';

const started: FakeImage[] = [];
class FakeImage {
  crossOrigin = ''; decoding = ''; complete = false; naturalWidth = 0;
  onload: (() => void) | null = null; onerror: (() => void) | null = null;
  private url = ''; private decodeDone: (() => void) | null = null;
  set src(value: string) {
    assert.equal(this.crossOrigin,'anonymous','CORS mode must precede the request');
    this.url = value;this.complete = false;started.push(this);
  }
  get src() {return this.url;}
  decode() {return new Promise<void>(resolve => {this.decodeDone = resolve;});}
  downloaded() {this.complete = true;this.naturalWidth = 512;this.onload?.();}
  decoded() {assert(this.decodeDone);this.decodeDone();}
  failed() {this.complete = true;this.naturalWidth = 0;this.onerror?.();}
}
Object.assign(globalThis,{Image:FakeImage});
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
async function run() {
  assert.deepEqual(cardArtworkPaths(['', '', 'dogen', 'dogen']), ['/cards/renewed/dogen.webp', '/ui/cards/rarity-v1/common.png'], 'Preloading must ignore private online card placeholders and deduplicate public artwork');
  assert.deepEqual(cardArtworkPaths(['','']),[], 'A private deck never invents portraits');
  const cards = Array.from({length:6},(_,i)=>requestArenaImage(`/test/card-${i}.webp`));
  assert.equal(started.length,4,'At most four active image downloads/decodes');
  assert.equal(requestArenaImage('/test/card-0.webp'),cards[0],'Inspection shares the table request');
  let resolved = false;void cards[0].loaded.then(()=>{resolved=true;});
  const first = cards[0].image as unknown as FakeImage;
  first.downloaded();await tick();
  assert(!resolved,'A downloaded but undecoded portrait must not report ready');
  assert.equal(started.length,4);
  first.decoded();await tick();assert(resolved);assert.equal(started.length,5);
  for (let i=1;i<6;i++) {const image=cards[i].image as unknown as FakeImage;image.downloaded();image.decoded();await tick();}
  await Promise.all(cards.map(card=>card.loaded));

  const retry = requestArenaImage('/test/retry.webp');const image = retry.image as unknown as FakeImage;
  const before = started.length;image.failed();assert.equal(started.length,before+1);
  assert.equal(image.src,'/test/retry.webp?arena_retry=1');
  image.downloaded();image.decoded();await retry.loaded;
  const bad = requestArenaImage('/test/missing.webp');const failed=bad.image as unknown as FakeImage;
  const outcome = assert.rejects(bad.loaded,/artwork unavailable/i);
  failed.failed();failed.failed();await outcome;
  assert.notEqual(requestArenaImage('/test/missing.webp'),bad,'A failed portrait cannot poison later loading');
  const recovered=requestArenaImage('/test/missing.webp').image as unknown as FakeImage;
  recovered.downloaded();recovered.decoded();await tick();

  // Long browsing sessions release old decoded artwork, retaining recent entries.
  for (let i=0;i<55;i++) {const card=requestArenaImage(`/test/lru-${i}.webp`);const img=card.image as unknown as FakeImage;img.downloaded();img.decoded();await card.loaded;}
  assert.equal(started.at(-1),requestArenaImage('/test/lru-54.webp').image);
  const stale=requestArenaImage('/test/card-0.webp');assert.notEqual(stale,cards[0]);
  const staleImage=stale.image as unknown as FakeImage;staleImage.downloaded();staleImage.decoded();await stale.loaded;
  const previous=process.env.NEXT_PUBLIC_PLAY_PROOF_ENABLED;
  delete process.env.NEXT_PUBLIC_PLAY_PROOF_ENABLED;assert.equal(playProofEnabled(),false,'Unshipped achievements never ask for a match signature');
  process.env.NEXT_PUBLIC_PLAY_PROOF_ENABLED='true';assert.equal(playProofEnabled(),true);
  if(previous===undefined)delete process.env.NEXT_PUBLIC_PLAY_PROOF_ENABLED;else process.env.NEXT_PUBLIC_PLAY_PROOF_ENABLED=previous;
  console.log('ARENA LOADING OK: shared requests, four-download limit, decode readiness, bounded retry, failure recovery, decoded cache eviction and opt-in match signatures.');
}
void run().catch(error=>{console.error(error);process.exitCode=1;});
