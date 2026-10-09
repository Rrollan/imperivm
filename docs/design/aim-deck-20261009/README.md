# Aim, contact effects and deck workshop — 9 October 2026

## Implementation

The shared AI/online Babylon renderer draws a raised quadratic Bezier ribbon with a bronze bevel and crimson enamel. The spearhead and open laurel crest were painted with built-in ImageGen, using the arena itself as a material reference. The shaft ends beneath the spearhead socket; short lanes shrink the head and overlapping faces hide the arrow. Card/ruler apertures keep the point outside the target face. Table coordinates are XY, with lift toward the camera along negative Z. All effect meshes are non-pickable.

Ready fighters have warm bronze laurel branches, a crimson/gold gladius badge and a short pulse when an attack becomes available. The old cyan compact-card border is removed. Eligible enemies receive a quieter laurel; the hovered legal target receives the full crest. Glow includes only registered accents and a disabled sentinel, rather than the entire board. Existing engine legal actions and server-provided presentation actions decide eligibility. Cancelling a pointer, opening the menu or losing selection clears aiming. Reduced motion retains the static arrow and marker.

The authored Flow clips are RGB premultiplied against black. A custom shader derives coverage and recovers colour before alpha compositing, avoiding double attenuation on light marble. Seven contact atlases (26–32) now use 384×216 frames instead of 256×144, with the existing timings. Each encoded file remains below 300 KB. They play behind the settled card in the same XY plane and follow formation reflow. Native warm dust, a cast shadow and a short bronze edge glint play at the same contact, including when an authored clip is available. The arrival handoff is shorter, with a restrained settling pulse. Original uploaded videos are retained.

To rebuild these seven atlases from the already-trimmed preview videos: `node scripts/vfx/rebuild-landings.mjs`. An optional list of IDs rebuilds only those effects. FFmpeg and the existing Sharp dependency under `scripts/tripo` are required. This command does not retrim the source range or alter the original MP4s. The older general import command remains available for other clips.

The diagnostic `/arena-lab/aim-preview` uses the exact runtime arrow/contact modules. It includes short/card/ruler/reduced-motion controls, landing selection, slow playback and a frozen contact frame. It does not issue game actions. A queued ResizeObserver callback after React cleanup is guarded against disposal.

Deck construction has a dedicated full-screen workspace. Catalogue and deck scroll independently; save remains visible. Tapping the face adds a legal copy, Details opens rules, and count controls remain separate. Search, collection/in-deck tabs, filters, starter recipes, undo and owned-only completion are retained. Adding to a full deck switches to replacement candidates and clears filters. Replacing one copy atomically keeps 30 cards and respects ownership/copy caps. No custom deck is overwritten automatically.

At 1280px the deck panel is on the right. At 844×390 the ruler selector is compact and deck/catalogue remain side by side. At 390×844 two large card columns and a persistent bottom bar provide deck/save controls. The drawer traps focus and closes with Escape. Landscape card details scroll within the viewport. CardView.tsx, card-frames.css, ManaCrystals.tsx, all 99 definitions, lib/net, lib/engine and server are unchanged.

## Verification

- Production build and strict TypeScript validation.
- Integration suite, including Bezier geometry fixtures (directions, short/overlapping lanes, finite coordinates, camera lift) and atomic deck replacement (30 cards, immutability, missing victim, copy/ownership limits).
- Presentation and combat checks compare rendered batches with authoritative engine outcomes; deployment geometry covers 20 layouts.
- Browser: full-deck replacement and Undo restored the original composition without saving over it. Catalogue layouts checked at 1280×720, 844×390 and 390×844. Portrait document width equals its 390px viewport; save remains visible and 44px high. Card details have internal landscape scrolling.
- Browser: selecting Gladiator GPS and clicking a legal enemy Hoplite destroyed the target, applied retaliation, consumed readiness and recorded the attack in history. A subsequent card play appeared on the field and consumed orders. Warm ready markers checked at 844×390. No observed console errors/warnings after these actions.
- Browser: exact-effect preview checked for long/short lanes, card/ruler targets, reduced motion and a frozen Firmware Phalanx landing frame.

Evidence: `qa/aim-native-v2.png`, `qa/aim-short-ruler-v2.png`, `qa/arena-native-v2.png`, `qa/arena-844-v2.png`, `qa/landing-firmware-v2.png`, `qa/deck-1280.png`, `qa/deck-844.png`, `qa/deck-390.png`. `qa/aim-1280.png` records the first visual iteration for comparison; it is not the final style. Asset prompts are in `asset-prompts.md`.

Phone sizes are browser emulation. Physical Safari/Telegram performance and hosted iDos iframe acceptance remain device/host checks. Coordinate dragging in an overridden browser viewport was unreliable; actual select-then-click and accessible actions were checked instead. This is not certification of physical touch input or sustained mobile FPS. No payments, minting or deployment.
