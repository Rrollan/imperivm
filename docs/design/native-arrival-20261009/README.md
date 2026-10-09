# Native aiming and card arrival — 9 October 2026

This iteration replaces the prominent laurel markers and the authored arrival overlays from `aim-deck-20261009`. The deck workshop changes from that iteration remain in place.

## Shared arena renderer

Readiness uses light along the existing frame and the existing crimson/gold weapon badge. Eligible enemies do not acquire decorations. A hovered legal target has measured bronze brackets: rectangular clamps for cards, circular arcs for rulers with the lower-right health area left open. Brackets are geometry, rather than an image stretched to different aspect ratios. Their pulse is less than one percent and disabled for reduced motion.

The aiming lance retains the board's bronze and crimson enamel. Short lanes launch from the upper attacker artwork. Target padding no longer reserves the head a second time. The head remains 36–44 board pixels before the lane safety clamp; the compact row regression fixtures require at least 32 pixels after that clamp. Shaft thickness no longer shrinks with lane length, keeping its bevel continuous on close targets. The shaft stops inside the spearhead socket and the point stays outside the enemy artwork. Targeting, legal actions and server-authoritative moves are unchanged.

## Native arrivals

`deploymentMotion.ts` provides the same flight/contact poses to the runtime and diagnostic. A card tilts as a rigid object, travels to its final formation slot, then accelerates downward and rocks briefly at contact. XY alignment completes before contact. Scaling is uniform and returns exactly to one; the card no longer squashes or dissolves between hand and battlefield faces. Expensive and legendary cards retain their public reveal and use greater lift, tilt and contact weight.

`ArenaDeploymentEffects` pools a moving cast shadow and 36 native particles: warm dust, lit bronze chips and short edge glints. Particles originate at the card perimeter and follow the actual new entity during row reflow. Card summons receive their own slot's contact; they do not replace an attacker's lunge with a drop. These objects are non-pickable and share the arena clock, pause, cancel and reduced-motion lifecycle.

Arrival/deploy/apparition clips 10–15, 21 and 23–35 are excluded from runtime warmup and playback. Uploaded files, rebuilt atlases and the art lab are preserved. Authored attack, spell and victory effects remain available. No changes to engine rules, balance, net protocol, server, card definitions, CardView, card frames or ManaCrystals.

## Checking the result

Open `/arena-lab/aim-preview`. Check short/long distances, card/ruler targets and reduced motion. Select a landing, use slow playback or freeze flight/contact, then press “Вернуться к наведению”. The diagnostic imports the exact native modules; it never issues game actions.

Verified:

- Production build and strict TypeScript.
- Integration suite, including finite/exact motion endpoints, downward contact, rigid settling, compact aiming geometry and preservation of attack/result clip categories.
- Combat presentation: 3,548 legal actions and 1,135 contacts, matching engine outcomes and single contact delivery. Presentation replay and 20 deployment layouts also pass.
- Browser at 1280 × 800: an attack destroyed the enemy Hoplite, applied retaliation, consumed readiness and returned control. Subsequent Node Guard and AMM Centurion plays appeared in their formation and consumed orders.
- Browser at 844 × 390: a dragged attack destroyed the Hoplite, applied retaliation and returned control. The document width equalled the viewport, without horizontal scrolling.
- Diagnostic: short card and ruler capture, open health crystal, long lance, frozen native flight/contact, ordinary/legendary arrivals, reset and reduced motion.

Screenshots are in `qa/`. Phone dimensions are browser viewport emulation, not physical Safari/Telegram testing or a mobile FPS certification. No payments, token mint or deployment were performed.
