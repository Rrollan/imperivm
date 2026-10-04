# Application media ledger

Captured **2026-10-04** from the running production app at `http://localhost:3910`. Screenshots show the real application; no generated or simulated gameplay scenes were substituted.

| File | Source / metadata | Review |
| --- | --- | --- |
| `banner.svg` | Designed 1440 × 480 branding banner using existing project artwork; **not a gameplay screenshot** | Reviewed as a README design asset. |
| `desktop.png` | Chrome `/game?hero=whale`, RU, Marble, replay block 7. CSS viewport 1440 × 900; native export 2880 × 1800, Lanczos reduced to 1440 × 900. | Board, creatures, hero power, gas and hand visible; accepted. |
| `mobile.png` | Chrome narrow **emulation**, `/game?hero=whale`, RU, Marble, block 9 attack selection. CSS 390 × 844; native export 780 × 1688, reduced to 390 × 844. | Legal-target arrow, damage/retaliation preview, board and controls visible; accepted. |
| `hero-3d.png` | Chrome `/#heroes`, RU, actual supplied optimized Whale GLB. CSS 1440 × 900; DPR-2 export reduced to 1440 × 900. | Real WebGL rendering; coin captured at a side angle. Rotation separately observed in chooser and victory. |

Source PNG exports remain in the local Downloads folder. Browser emulation establishes layout, **not physical-phone performance**. The two finished QA matches and remaining functional limits are recorded in [verification](../verification.md).

## Gameplay recording

`gameplay.gif` contains 15 consecutive real CanvasTTY browser captures from `/game?hero=whale&demo=1`, Marble/RU, sampled during exhibition combat at blocks 10–16 and the resulting defeat. Output 720 × 376; playback is accelerated about 3×, with a final one-second hold. The source browser widget changed scale during capture (screenshots 768–1202 pixels wide, same aspect ratio); frames were resized consistently. This is a cropped browser view of the enemy rank/mempool, not a full-board recording. Raw 48-frame capture and timestamps remain in local ignored `.orchestration/gif-frames`. Frames were inspected; no generated match states or overlays were inserted.

## Arena gates / native scene (4 October 2026)

`arena-gates-{desktop,mobile}.png` and `arena-board-{desktop,mobile}.png` are
production Chromium captures at exact CSS viewports 1440×900 and 390×844, DPR 1,
RU/Marble. Gates show the complete mode menu; board captures show a real local AI
exhibition match paused after autoplay, with existing models/fallback artwork.
No game state was fabricated for the captures.

`arena-confirm-*`, `arena-search-*` and `arena-room-*` capture the complete page
height at the same viewport widths, including the warning and network-preview
boundaries. The room code is a local preview code, not a registered server room.
The final captures use the eight contract-named PNGs supplied by the owner during this work. Missing-file fallback was verified separately; the supplied asset files were not edited by the UI task.
See the [Russian delivery report](../arena-gates.md) for implementation and checks.
