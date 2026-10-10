/** Artwork is shared by the table and card inspection. Four downloads at once
 * leave bandwidth for the board/UI; one retry recovers transient failures. */
export type ArenaImage = {image: HTMLImageElement; loaded: Promise<HTMLImageElement>};
export type ArenaImageOptions = {priority?: 'high' | 'normal'};
type QueuedRequest = {src: string; priority: 'high' | 'normal'; start: () => void};
const images = new Map<string, ArenaImage>();
const decodedImages = new WeakSet<HTMLImageElement>();
const highQueue: QueuedRequest[] = [];
const normalQueue: QueuedRequest[] = [];
const queuedRequests = new Map<string, QueuedRequest>();
let active = 0;
function pump() {
  while (active < 4 && (highQueue.length || normalQueue.length)) {
    const request = (highQueue.shift() ?? normalQueue.shift())!;
    queuedRequests.delete(request.src);active++;request.start();
  }
}

export function requestArenaImage(src: string, options: ArenaImageOptions = {}): ArenaImage {
  const known = images.get(src);
  if (known) {
    images.delete(src);images.set(src,known);
    const queued = queuedRequests.get(src);
    // A visible consumer can promote a shared prefetch without another download.
    // Later normal consumers never demote an already visible request.
    if (options.priority === 'high' && queued?.priority === 'normal') {
      normalQueue.splice(normalQueue.indexOf(queued),1);
      queued.priority = 'high';highQueue.push(queued);
    }
    return known;
  }
  const image = new Image();image.crossOrigin = 'anonymous';image.decoding = 'async';
  const loaded = new Promise<HTMLImageElement>((resolve,reject) => {
    const priority = options.priority === 'high' ? 'high' : 'normal';
    const request: QueuedRequest = {src,priority,start: () => {
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
    }};
    queuedRequests.set(src,request);
    (priority === 'high' ? highQueue : normalQueue).push(request);
  });
  const entry = {image,loaded};images.set(src,entry);pump();return entry;
}
