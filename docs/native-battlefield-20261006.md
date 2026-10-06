# Native battlefield and board controls — 6 October 2026

Scope: `/arena-lab`, branch `rebirth`. All 43 existing cards and engine rules remain unchanged. README.md, CardView.tsx, card-frames.css and ManaCrystals.tsx are untouched.

## Presentation changes

- Four matching relief portraits use the board's own rim as their sole physical frame. Scene geometry follows separate measured native apertures for each side and aspect; the texture clips the inner coin relief and compensates the health badge to keep it round. Inspection retains the complete coin without cropping.
- A simpler generated 4:7 bronze/leather frame is shared by hand, battlefield, queue and inspection. The complete portrait, name and fixed combat values stay visible. One inset gem marks rarity; role labels and detailed rules remain in inspection. Battlefield readiness uses a corner gladius/hourglass/lock/spent engraving; Taunt has one shield between the stats.
- Targeting uses a 1600×1000 tapered bronze-edged ribbon. Source and target offsets follow their actual rectangular/elliptical edges. A short lane gets a smaller lance head. Selection highlights remain thin outlines.
- Edicts use original card faces, an owner-coloured ordinal and stable front-to-back ordering with the first-to-resolve card on top. Their counts sit inside the register; its wide placement clears the water clock. Hidden fourth-entry cancellation uses a bounded 100px cue at its own stack and clears a full opposing row.
- End-turn fills the measured interior of the existing octagonal socket. The regenerated plate is fitted in three slices: laurel ends retain their proportions, while the blank leather centre absorbs the generated alpha-aspect mismatch. Dynamic labels use the same centred composition for own/busy/enemy/finished states.
- Native order crystals fill the measured recesses; slots and numeric count use one state snapshot, including gold bonuses above capacity. At the seed-21 start, 6 available orders / 5 regular capacity means five cyan stones and one gold stone.
- Menu back/close controls share bronze bevels and vector engravings. The history/action footer is centred; cost chips share the action baseline. Focus, Escape, scroll and reduced-motion behavior remain supported.
- Row density changes reuse entities/textures and settle their compensated scale. Live ruler GLBs and their unused shadow pass were removed from this arena. Original generated PNGs and GLBs remain available.
- The empty-draw observability gap is fixed: a delayed draw edict records its own treasury delta; the normal turn draw has a separate remaining contact. Rules and turn order are unchanged. Source values and history are verified by legal-action regression fixtures.

The initial ornamented-card screenshots were rejected after full-desktop comparison. They are not visual acceptance evidence for this revision. See native-ui-fit-20261006.md for the later comparison and validation.

## Generated assets

Built-in imagegen mode, genuine alpha; original PNGs saved under `/Users/a11111/.codex/generated_images/01a10813-1873-74c2-a5e1-250044ecd604/`.

| Asset in public/ui/arena-lab/native | Original PNG | Use |
|---|---|---|
| degen-medallion-front.webp | exec-d66ff4d2-bbf7-45a1-92c4-dbdbfe2fcf82.png | Young clean-shaven Degen relief |
| validator-medallion-front.webp | exec-55fe1ea1-beb7-4243-94d9-b2baf05f19ae.png | Validator relief with justice scales |
| whale-medallion-front.webp | exec-3b9bb7b1-05f5-4317-8f41-23f870bfc2e5.png | Whale relief |
| edict-register-native.webp | exec-a859e813-8833-4181-bae2-be8909bcd6aa.png | Edict queue register |
| turn-inlay-native.webp | exec-daa50e62-27a7-4972-884c-d81a69228056.png | Original reference for the revised inlay |
| turn-inlay-fit.webp | exec-f71384e3-c5b2-4551-8041-bdb0f9b750d3.png | Revised socket inlay with fitted end caps |
| card-frame-simple.webp | exec-558c2868-7c18-4f70-8dd7-5a99bd0c4260.png | Simplified shared card frame |

Builder uses the previously generated front coin; its original prompt/source is recorded in native-inspection-20261006.md.

## Exact generation prompts

### degen

Use case: precise-object-edit. Image 1 is the EDIT TARGET Degen portrait coin; image 2 is ONLY the craftsmanship/style reference Builder coin. Reconstruct Degen as one perfectly circular gold relief coin seen exactly straight-on, camera normal to coin plane, zero tilt or perspective. Preserve Degen's young clean-shaven Roman male profile facing RIGHT, unruly curly hair and laurel wreath; no beard, no hammer. Match the warm antique gold/bronze relief, clean beaded rim, restrained bottom laurel sprigs, broad highlights from upper left and readable hand-painted fantasy game style of image 2. COMPLETE circular rim visible, centered exactly in a square canvas with equal transparent margins of 5% on every side. Remove all purple background, scene, tiny inscriptions and outside shadows. Actual transparent alpha outside the coin. No words, letters, numbers, glow, sparkles, extra plaque or objects. This is a production coin sprite for a Roman card-game ruler socket, not a photographed coin. Equal horizontal and vertical diameter.

### queue

Use case: stylized-concept. Production game UI sprite for IMPERIVM, a Roman crypto fantasy card battler. Make ONE compact clickable imperial edict-register plaque, exactly frontal orthographic view, horizontal 2:1 aspect ratio, symmetric and perfectly straight. It will sit on the wooden left rail of a warm marble/bronze painted Roman game board. The central dark oxblood leather/walnut panel is completely BLANK with generous space for dynamic Russian text. Frame is chunky aged bronze with a clean bevel, ONLY one small rolled parchment relief at its TOP center and two restrained laurel accents near sides. Visual tone: hand-painted premium collectible-card game, readable at 80px wide, broad highlights from upper-left, rich warm midtones, simple large forms. Outside is genuine transparent alpha, equal narrow margins; frame nearly fills canvas. No text, letters, numerals, loose paper behind it, cards, extra seals hanging below, background, floor, sparkles or glow. This is a cohesive native wooden/bronze button asset, not a UI mockup or generic rounded HTML rectangle.

### validator

Use case: precise-object-edit. Image 1 is EDIT TARGET Validator's portrait; image 2 is ONLY a style reference Builder coin. Reconstruct the same stern mature Roman male with SHORT beard, short hair and laurel wreath, profile facing RIGHT, as one perfectly round antique GOLD relief coin seen exactly straight-on, zero perspective or tilt. Keep the Validator identity distinct from Builder: NO hammer, NO long flowing beard. Add a small restrained balance-scales relief at the bottom behind the shoulder, matching the original justice motif. Match image 2's warm bronze/gold hand-painted fantasy game craftsmanship, clean beaded rim, simple bottom laurel sprigs, broad light from upper left and readable midtones. Complete equal circular diameter, coin centered exactly on square canvas, equal 5% transparent margins. Remove purple background and scene. Actual transparent alpha outside the coin. No words, letters, numbers, extra frames, floor, glow, sparkles or cast shadows outside coin.

### whale

Use case: precise-object-edit. Image 1 is EDIT TARGET Whale's existing circular coin sprite; image 2 is ONLY the style reference Builder coin. Preserve the Whale identity: an expressive right-facing whale head with laurel crown, Roman crypto market whale, wave relief below and a restrained chart-line relief in the background inside the coin. Reconstruct as one perfectly round antique gold coin EXACTLY straight-on, orthographic camera perpendicular to coin plane, zero tilt or perspective. Match image 2's warm gold/bronze hand-painted card-game relief, clean beaded rim, broad upper-left highlights and readable deep midtones. Complete rim visible, equal horizontal/vertical diameter, exactly centered on square canvas with equal 5% transparent margins. Genuine transparent alpha outside coin, no exterior shadow. No text, letters, numbers, extra frames, background, floor, glow, particles or sparkle.

### turn

Use case: stylized-concept. Production UI asset: ONE blank END-TURN INLAY for a premium hand-painted Roman fantasy card-game board. Horizontal 5:2 aspect ratio, perfectly frontal and horizontally symmetric, zero perspective, perfectly straight. It is an INSERT to fit INSIDE an existing thick bronze octagonal board socket, so NO large second outer frame. Make a dark oxblood leather/walnut recessed plate with softly clipped corners, one thin warm gilded bevel and restrained embossed gold laurel ornaments confined to the leftmost and rightmost 18%. Large central 60% stays smooth and EMPTY for two lines of dynamic Cyrillic text. Match warm bronze/marble Roman board lighting: highlights upper-left, broad readable forms, restrained detail. The center must be dark enough for ivory lettering. Genuine transparent alpha outside the single insert, equal narrow margins. No words, letters, numbers, buttons beyond this one plate, symbols in center, extra frames, floating objects, UI mockup, scene, glow or sparkles.

## Validation boundaries

These changes target the reported board alignment and inconsistent piece silhouettes. The per-source fatigue ledger limitation documented in native-inspection-20261006.md is addressed in this revision. Warm frame timings apply only to the measured scene on this Apple M1; cold loading still has stalls. The older /game renderer is unchanged.
