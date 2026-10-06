# Native UI fit — 6 October 2026

Scope: `/arena-lab`, `rebirth`. User's twelve desktop screenshots prompted this iteration. All existing cards, costs, abilities and engine rules are preserved. The four protected files remain unchanged.

## Reference and decisions

The supplied Hearthstone board-control video was inspected in the browser around 3:55. Its stable resource/hero placement, clearly separated values and hover inspection support using consistent positions and moving detailed rules out of the small battlefield faces. This is an interpretation of observed UI behavior, not a claim about its implementation. Reference: [Trump's board-control lesson](https://www.youtube.com/watch?v=DVNvpeQGir4&t=235s). Blizzard also explains why row placement can carry gameplay meaning: [Board Positioning](https://news.blizzard.com/en-us/article/21295165/what-sets-the-pros-apart-board-positioning). Our engine's row order is preserved.

| Reported defect | Current treatment |
|---|---|
| Rarity dots and competing role marks | One inset rarity stone; role/rank text in inspection |
| Crooked numeric badges | Shared round badge painter with optical text-centering from font bounds |
| Mismatched back/close controls | Same bronze control family, vector back/close engravings |
| End-turn strip inside a tall well | Full native aperture, regenerated leather inlay, unstretched laurel caps |
| Register covering the water clock | Separate measured register position; counts inside its face |
| Two ruler rims / oversized coins | One board rim; clipped inner relief fitted to each board aperture |
| Low-resolution aiming arrow crossing values | Doubled texture resolution, tapered curved ribbon, actual piece-edge offsets |
| Small crystals inside recesses | Board-measured centres and 22px portrait / 14.5px wide stone radii |
| Left-aligned history footer / hanging cost | Centred footer and inline-flex cost/action baseline |
| Battlefield labels and statuses competing | Full artwork/name card, fixed attack/health corners, one corner readiness mark |
| Wrong edict at front of stack | First-to-resolve card draws last within the transparent stack |
| Fourth-edict cancel clip over a fighter | 100px cancellation clip, stack-centred overflow anchor |
| Empty-deck damage merged with turn aftermath | Public per-edict fatigue ledger; separate remaining turn-draw contact |

`boardSockets.ts`, `battleLayout.ts`, `ordersView.ts`, `queueLayout.ts` and `targetingGeometry.ts` provide the geometry contracts. Renderer, flight/cue anchors and regression fixtures use those contracts.

## Generated sprite prompts

Original PNGs are preserved under `/Users/a11111/.codex/generated_images/01a10813-1873-74c2-a5e1-250044ecd604/`. WebP encoding is the only offline processing. Dynamic names, glyphs, values and fitting are code-rendered.

### Simple frame

Original: `exec-558c2868-7c18-4f70-8dd7-5a99bd0c4260.png`; runtime: `public/ui/arena-lab/native/card-frame-simple.webp` (576×1008).

Use case: precise-object-edit. Simplify the attached IMPERIVM card-frame sprite for a premium readable Roman crypto card game. Keep the same portrait 4:7 overall ratio and actual transparent outside AND transparent central artwork aperture. Replace the complicated pointed crown, shoulder laurels, tiny blade and many overlapping bevels with ONE clean aged-bronze rounded-rectangle frame, narrow warm gilded edge, dark oxblood leather sidewalls. Large EMPTY TRANSPARENT artwork aperture at x=8%..92%, y=5%..77%. At y=78%..87% one simple straight dark walnut blank name ribbon, broad smooth surface for two lines of text. At y=88%..98% one clean warm parchment strip, blank and uncluttered for dynamically placed stats. Outer corners softly cut; no projecting points, scallops, gemstones, emblems, text, digits, laurels, ornament or cards inside. Very restrained craftsmanship matching the existing warm painted Roman board, broad upper-left highlight, matte readable materials. Entire one frame centered and fully visible with equal narrow margins. Actual transparency required, no black/color filling in aperture. The UI will draw names, rarity seal and stats itself.

### Fitted turn inlay

Original: `exec-f71384e3-c5b2-4551-8041-bdb0f9b750d3.png`; runtime: `public/ui/arena-lab/native/turn-inlay-fit.webp` (768×307). Opaque bounds were measured at 72,88…1913,670 in the 1984×793 source. The generation did not deliver the requested visible aspect exactly; the renderer preserves end-cap proportions and adapts only its empty centre.

Use case: precise-object-edit. Reshape the attached Roman game button inlay for a board recess whose visible interior has width 171 and height 68, an exact 2.51:1 wide octagonal silhouette. Keep the dark wine-red leather, narrow aged bronze edging, matte painterly craft and restrained gold laurel leaves at both short ends. Make the actual visible object 2.51:1, much taller relative to width than the reference, with eight neat chamfered corners, no outer board frame, no massive border or decorative projections. Center the inlay with narrow equal transparent margins; transparent background. Blank center for two lines of dynamic UI text occupying the middle 58% of its width; no letters, numbers, shadows outside, glowing or logos. Upper-left warm sunlight. Clean stable silhouette at small size.

## Review media and animation pack

The existing production effect pack stays at `/arena-lab/animation-kit`: eight START/END/PROMPT folders for six roles, weaken and heal; effects 01–09 are already integrated. Those isolated black-background accents remain usable with the simpler cards. Travel, landing, targeting, contact numbers and HUD feedback remain native runtime animation; generating a new clip must not replace engine validation or redraw UI text.

The user selected Omni Flash. The page now defaults to Omni-specific prompts and a new `imperivm-omni-flash-vfx.zip`; the original Flow version remains selectable. The eight PNG pairs are preserved byte-for-byte. `scripts/vfx/pack-omni.py` validates 1280×720 dimensions, visible starts, pure-black ends and archive integrity. The new prompts explicitly bind Image1/2 to first/last roles, require one continuous silent shot and retain the short active effect even if the interface generates a longer clip. Reference: [official Omni guidance](https://ai.google.dev/gemini-api/docs/omni.md). Clips 10–17 are still awaiting the user's generated MP4s; the game's built-in role animations operate meanwhile.

Later screenshots are in `docs/media/native-fit-*` and `native-simple-*`. Narrow and wide capture checks are separate; a small downscaled window alone is insufficient to approve the wide native apertures.

## Validation limits

Cold loading still has frame stalls; a warm median near one refresh interval is not a universal FPS guarantee. `/game` is unchanged. The engine change adds only public attribution of the observed treasury loss from an empty draw; it changes no card, cost, random choice, damage rule or turn order. The previous per-source fatigue limitation is addressed by this revision.

## Browser verification

- Wide viewport 1280×720 and narrow viewport 475×664; a full native Helium window was also inspected. Native ruler apertures, resource recesses and end-turn well were checked in the wide view, rather than approving only a downscaled narrow screenshot.
- Seed 21, Builder: original 6/5 resource state, queue → first edict → Back, inspection Play, direct card drag, direct attack drag, ruler-target aim, short fighter-target aim, garrison → return → garrison, delayed weakening and the following AI turn. The history records actual resource changes, attack targets, Solar's two lethal targets and the later weakening 3 → 2. No error/warning was captured in that tested path.
- Builder heal: treasury 25 → 28, orders 6 → 4, repeat power unavailable in inspection, same values in history.
- Seed 1: legal Phalanx play gives four → five fighters and buffs the old row. Seed 113: legal Guard play gives six → seven in both wide and narrow views. The final rows retain visible portrait/name/value areas and positive gaps; narrow density change settles without replacing existing entities.
- All four rulers were visually checked: Builder, Degen, Validator and Whale. Ruler inspection retains the complete coin, while the board uses its own rim.
- Real opening-hand replacement: one selected starting card, confirmed replacement, unchanged two retained cards, one recorded mulligan action and normal first-turn resource count.
- Escape closes inspection; Back restores the queue. Menu, inspection and history actions stay centred in the tested formats.

Review captures: `docs/media/native-fit-wide-20261006.png`, `native-fit-arrow-20261006.png`, `native-fit-short-arrow-20261006.png`, `native-simple-edict-20261006.png`, `native-simple-queue-20261006.png`, `native-simple-card-action-20261006.png`, `native-simple-ruler-20261006.png`, `native-simple-history-heal-20261006.png`, both six/seven-row pairs, and the four/five-row pair. Degen/Whale and Validator wide views are separate captures.

## Deterministic verification

`fatigue-presentation-check.ts` uses legal GameSession actions to test two queued draw edicts (−3, −7) plus the turn draw (−5), partly full deck, ordinary draws, lethal queue stop, both heal/fatigue orderings, per-source history and health updates at each scheduled contact. The two draw edicts preserve their source UIDs; the remaining turn draw is emitted once. Existing geometry regressions check socket clearances, seven-card rows, short/diagonal targeting, third-card register gaps and hidden fourth-entry cancellation bounds.

Final `npm run build` and `npm run smoke` passed. Smoke covers 61 regression groups, 43 cards / 86 legal card transitions / 103 ability and video cues, four complete engine-equivalent matches, 24 mixed queue outcomes and 70 reduced-motion outcomes, plus the new fatigue cases. Build log: `/tmp/imperivm-native-omni-build.log`; smoke log: `/tmp/imperivm-native-omni-smoke.log`.

The Omni page was also tested in the production browser: mode changes switch the archive and prompt paths; Copy writes the exact Omni prompt (verified after the asynchronous completion); ZIP downloads successfully and its SHA-256 matches the source archive. No error/warning was captured on the page. Eight START/END pairs and prompts were verified by the pack script.

Browser sampling does not claim exhaustive rendering of every possible card combination or a universal frame-rate guarantee. README.md, CardView.tsx, card-frames.css and ManaCrystals.tsx remain unchanged; all 43 existing card definitions remain unchanged.
