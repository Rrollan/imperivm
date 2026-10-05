/** One clock for movement, impact, death and audio. No delayed React callbacks. */
export class PresentationScheduler {
  private current: {
    elapsed: number;
    duration: number;
    impactAt: number;
    impacted: boolean;
    update: (progress: number) => void;
    impact: () => void;
    finish: () => void;
    resolve: () => void;
  } | null = null;

  get active() { return this.current !== null; }

  play(duration: number, impactAt: number, update: (progress: number) => void, impact: () => void, finish: () => void) {
    this.cancel();
    return new Promise<void>(resolve => {
      this.current = { elapsed: 0, duration: Math.max(1, duration), impactAt, impacted: false, update, impact, finish, resolve };
      update(0);
    });
  }

  tick(deltaMs: number) {
    const item = this.current;
    if (!item) return;
    item.elapsed += Math.max(0, deltaMs);
    const progress = Math.min(1, item.elapsed / item.duration);
    item.update(progress);
    if (this.current !== item) return;
    if (!item.impacted && progress >= item.impactAt) { item.impacted = true; item.impact(); }
    // Impact handlers may synchronously cancel/restart the presentation.
    if (this.current !== item) return;
    if (progress >= 1) {
      this.current = null;
      item.finish();
      item.resolve();
    }
  }

  cancel() {
    const item = this.current;
    this.current = null;
    item?.resolve();
  }
}
