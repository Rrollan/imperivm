# Arena and nine rulers — 9 October 2026

## Delivered

The shared Babylon renderer serves AI and authoritative WS games. Short landscape hosts use the full width instead of letterboxing the 1600×1000 painting. Only the scenery is vertically compressed; cards, court tiles, coins and hit regions preserve their proportions. Court pieces show portrait, faction, attack/health and readiness. Tap opens the full card and readable rules; tap a ready fighter then its target or drag. Control hit regions are at least 44 CSS px. Rotation during a presentation settles the already-computed result before drawing in the new coordinates. This does not calculate another move.

Desktop uses the existing imperial board. The end-turn insert is clipped to the measured painted recess, leaving its bronze rim to the background. Target corners/laurel replace the red rectangular marker. The attack lance uses a 2400×1500 texture and teal/ivory/gold accents. The new readiness corner/badge is driven by legal attacks, including Rush, fresh, spent and staking states.

The card footer now contains faction and a short trait between attack/health. Full rules remain in the inspector. The protected CardView.tsx, card-frames.css and ManaCrystals.tsx are unchanged. All 99 card definitions, uploaded VFX and saved user decks remain intact.

Deck construction: tapping an owned card image adds a legal copy directly; the name/details button opens its abilities. Existing minus, swap, undo, save and owned-only autofill remain. Nine rulers are visible; unavailable case rulers are locked and link to their acquisition path. The Arena CTA uses the painted navigation icon.

Five free rulers: Whale, Builder, Degen, Validator and Strategist. Four case rulers: Athena, Hermes, Hephaestus and Poseidon. See the exact costs and conditions in the root README and lib/heroes.ts. Case powers have setup-dependent peaks; no extra Treasury, board cap or passive paid bonus. Builder's full-health empty heal is illegal. Validator income pays once at the next own turn, not on activation. The second seat receives one temporary opening order, without increasing capacity.

## Balance measurements, not a human PvP claim

The first probe exposed Whale at 83.8% in one policy. The free recipes were revised to a shared cost curve with cost-matched faction substitutions; saved decks are not rewritten. Current reports cover all 81 ordered pairs, including mirrors, mulligan and both seats. The source digest identifies the engine/cards/decks being tested; engineCommit records the parent commit at run time.

- [Free starters](../../balance/nine-rulers-final-free-20261009.json): 11,664 complete games, 48 seeds per ordered pair and three policies. Greedy ruler aggregates span 43.9–57.6%; first-seat win rate 46.5%, median 25 plies. Pressure spans 35.4–63.2%; first seat 57.4%, median 15 plies. Shared-deck greedy spans 44.0–57.6%; first seat 42.9%, median 24 plies.
- [Owned expansion recipes](../../balance/nine-rulers-owned-20261009.json): 5,832 complete games, 24 seeds per pair and three policies. Greedy spans 37.3–58.3%; pressure 32.4–63.2%; shared deck 42.4–59.7%.

These automated policies do not plan every conditional power setup and cannot establish a 7–10 minute human match duration. Pressure underperforms with Hephaestus/free (35.4%), favours Validator/free (63.2%), and favours Athena/owned (63.2%). The expansion decks also change the strength of Whale and Degen. These remain explicit tuning targets: collect human matchup/turn/choice telemetry before claiming ranked balance. Do not use aggregate simulations as proof that purchasing a ruler improves human win rate. Report intervals are descriptive; same-match seats are correlated. Initial and intermediate reports are retained for comparison.

## Loading art and generation

Painted arena gates replace the blank IV loader, with restrained braziers/motes, a real wordmark and rotating readable tips. Reduced-motion settings stop decorative motion. Current background movement is native CSS; no generated video is claimed installed.

[Download the Flow kit](../../../public/ui/loading/imperivm-arena-loading-flow.zip): START.png, END.png and PROMPT.txt. Use Omni Flash, 16:9, one variant, six seconds; attach both endpoints. Locked camera, animate only existing flames and dust, no text/audio. Return the clip for integration. `/arena-lab/loading-preview` shows the live composition.

The five additional coin portraits and loading backdrop were generated with the built-in image generator. Portraits are transparent gold profile reliefs with a beaded rim: Strategist, Athena, Hermes, Hephaestus, Poseidon. Existing four portraits remain their original files. Runtime WebP coins are 210–243 KB each instead of approximately 3 MB PNG originals; the loading backdrop is 170 KB. Original PNGs and Flow endpoints are preserved. Reproduction recipes: [ART-PROMPTS.md](ART-PROMPTS.md).

## Verification

Automated acceptance: `npm run build`, server TypeScript build, `npm run test:integrations`, `npm run smoke` and the server network suite. The smoke suite covers all 99 legal card definitions, 256 regression groups, real action effects/contact targets, queue ordering, fatigue, mulligan and immutable session/presentation behaviour. Nine-ruler fixtures cover both seats, exact targets and prices, conditional values, capped boards, delayed payout, ownership and rejection of forged case entitlements. The network suite includes a full match, illegal actions and a real ten-second disconnect/reconnect.

Browser evidence is stored under `qa/`. The real local iframe harness tests 844×390 and 1280px child viewports, not a screenshot scaled to a phone. A device-level Safari/Telegram test and live hosted iDos validation remain required: the local harness proves layout, not host wallet/storage permissions, notch behaviour or sustained device FPS. Physical phone touch performance and external checkout have not been certified.

## iDos handoff

[Case configuration and activation](IDOS-RULER-CASES.md). Local cases cost 200 demo IMP, grant one of four rulers uniformly, and turn duplicates into 100 collection currency. This is not spendable IMP. Live cases are disabled by default. The server validates case-ruler ownership independently of whether the deck contains any paid cards. A local demo unlock never grants case-ruler permission in online PvP.

## References and adaptations

- [Hearthstone Core Set](https://hearthstone.blizzard.com/en-gb/news/23620129/introducing-the-core-set-and-classic-format): a useful free foundation; IMPERIVM uses five free rulers and legal free starters.
- [Hearthstone balance patch](https://news.blizzard.com/en-us/article/24244400/34-4-2-patch-notes): specific cost/stat tuning by archetype rather than a universal power increase. Our tests separate deck pools, policies and seats.
- [Clash Royale cards and decks](https://support.supercell.com/clash-royale/en/articles/cards-and-decks-6.html): direct card selection and a bounded visible deck; adapted to IMPERIVM's 30-card copy limits and owned cards.
- [iDos MCP](https://idosgames.com/mcp/): official integration entry point. Runtime types are from installed @idosgames/core 0.21.0. Rarity-5 pool behaviour requires a configured Title verification before activation.

These are design adaptations; no claim is made that every Hearthstone card was reproduced or that human ranked balance is solved.
