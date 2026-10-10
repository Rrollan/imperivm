import type {MouseEvent} from 'react';

/** Expand the platform iframe from the player's click, keeping its wallet bridge. */
export function expandBattle(event: MouseEvent<HTMLAnchorElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (window.self === window.top || document.fullscreenElement || !document.fullscreenEnabled) return;
  // Navigation stays available when the browser does not support iframe fullscreen.
  void document.documentElement.requestFullscreen().catch(() => undefined);
}
