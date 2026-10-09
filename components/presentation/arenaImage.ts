/** Artwork is shared by the table and card inspection. Four downloads at once
 * leave bandwidth for the board/UI; one retry recovers transient failures. */
export type ArenaImage = {image: HTMLImageElement; loaded: Promise<HTMLImageElement>};
const images = new Map<string, ArenaImage>();
const decodedImages = new WeakSet<HTMLImageElement>();
const queue: (() => void)[] = [];
let active = 0;
function pump() {while (active < 4 && queue.length) {active++;queue.shift()!();}}

export function requestArenaImage(src: string): ArenaImage {
  const known = images.get(src);
  if (known) {images.delete(src);images.set(src,known);return known;}
  const image = new Image();image.crossOrigin = 'anonymous';image.decoding = 'async';
  const loaded = new Promise<HTMLImageElement>((resolve,reject) => {
    queue.push(() => {
      let attempt = 0, settled = false, timer: ReturnType<typeof setTimeout>;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;clearTimeout(timer);image.onload = null;image.onerror = null;active--;
        if (ok) {
          decodedImages.add(image);resolve(image);
          // Evict only settled artwork. Consumers retain their own references.
          for (const [key,entry] of Array.from(images)) {
            if (images.size <= 48) break;
            if (key !== src && decodedImages.has(entry.image)) images.delete(key);
          }
        } else {images.delete(src);reject(new Error(`Arena artwork unavailable: ${src}`));}
        pump();
      };
      const begin = () => {
        const generation = ++attempt;
        const retry = () => {if (settled || attempt !== generation) return;clearTimeout(timer);if (attempt < 2) begin();else finish(false);};
        image.onerror = retry;
        image.onload = () => {
          if (settled || attempt !== generation) return;
          if (!image.naturalWidth) {retry();return;}
          // Resolve after decoding, so a first draw never starts a large decode.
          const decoded = typeof image.decode === 'function' ? image.decode() : Promise.resolve();
          void decoded.then(() => {if (attempt === generation) finish(true);},retry);
        };
        timer = setTimeout(retry,20000);
        image.src = generation === 1 ? src : `${src}${src.includes('?')?'&':'?'}arena_retry=1`;
      };
      begin();
    });
  });
  const entry = {image,loaded};images.set(src,entry);pump();return entry;
}
