# Verification record

Recorded **2026-10-04** against the final presentation working tree. Runtime: **Node v26.3.0**. Checks below establish local behavior and serialization; they do not establish live wallet or backend integration.

## Local command ledger

| Command | Observed result |
| --- | --- |
| `npm run build` | Exit 0: production build, strict type/lint checks and route generation succeeded. |
| `npx --no-install tsc --noEmit` | Exit 0; no diagnostics. |
| `npm run smoke` | Exit 0: 164 actions, 41 blocks, winner 0, Treasury 30 versus 0; 41 cards, 4 heroes, every preset 30 cards; 61 regression groups, including 48 seeded all-hero-pair matches. |
| `npx --no-install tsx scripts/tests/events.test.ts` | 28 passed, 0 failed. |
| `npx --no-install tsx scripts/tests/integrations.test.ts` | Exit 0: atomic packs, persistence/storage fallback, exact signatures, ownership/metadata filtering and custom-deck rules. |
| `npx --no-install tsx scripts/tests/metaplex.test.ts` | Exit 0: collection/badge/update, five configuration batches, machine and v0 mint packet size; mocked sign/send/recovery checks. |
| `npx --no-install tsx scripts/tests/ai.test.ts` | Exit 0: unstaking, Taunt/lethal choices and RUG PULL recovery. |
| `npx --no-install tsx scripts/tests/audio.test.ts` | Exit 0: gesture-only audio initialization, 18 cues, separate persisted settings, master mute and ambient restart. |

Metaplex tests use mocked RPC, simulation, wallet signing, sending and confirmation. **No live transaction was submitted by these checks.** Regression simulations are not a gameplay recording or a competitive balance assessment.

48 manifested artwork paths were inspected and decoded: 41 cards, four hero portraits and three battlefields. Original IDs remain intact. The optimized Whale GLB is 2,832,516 bytes; future model entries are unavailable.

## Real application review

Production server: `http://localhost:3910`. Chrome device emulation, actual DOM game and local WebGL; no fabricated gameplay scenes. See [capture ledger](media/README.md).

| Area | Observed evidence |
| --- | --- |
| Desktop 1440 × 900 | Whale versus Degen finished at block 35: Whale 4 HP, rival 0. Centered medallions, side End turn, hero power, slots and hand fit the viewport. The saved screenshot shows a later replay at block 7. |
| Mobile 390 × 844 | Whale versus Degen finished at block 37: Whale 17 HP, rival −1. Opening-hand choice, hero power, Staking Pool play, Flash Loan queue/next-block resolution and legal attack selection were exercised. Pool attacked a 1/1 GM: target died, Pool retained 3 HP. End turn and controls remained visible. |
| Card frames | Full rare spell inspection and mobile hand reviewed: distinct creature/spell silhouettes, readable cost/rules/stats. Desktop legendary cards use gilded ornamentation; not every full-size card was individually inspected. |
| Gameplay GIF | Actual exhibition combat progression and defeat recorded through the CanvasTTY browser; cropped enemy-rank view. Normal desktop/mobile full-board screenshots are separate. |
| Whale 3D | Supplied GLB visibly rotated on hero selection and victory. Only Whale is available. Captured chooser frame shows a side angle; it does not demonstrate all fallback paths. |
| RU / EN | Both languages observed across cards, settings, chooser and victory statistics; chosen language survived route navigation. Independent effects ON / music OFF observed. |
| Audio | UI toggles and procedural graph checks passed. Physical audibility was not accepted: browser/site mute can separately suppress sound. |
| Demo collection | Focused checks verify five-card purchase, −50 virtual RUG, persistence and valid 30-card decks. A final browser pack/reload/deck cycle has not yet been accepted. |
| Mobile/performance | Narrow emulation is accepted for layout. Physical-phone frame rate, forced WebGL context loss, touch drag and a comprehensive keyboard/screen-reader pass remain unverified. |

Use `/game?hero=whale&demo=1` for an automatically started exhibition. It bypasses wallet proof prompts, keeps engine opening-hand rules, and cannot earn qualifying leaderboard/badge wins. Normal interactive matches keep the opening-hand choice and optional proof flow.

## Package handoff

| Package | Main delivered files / verification | Limits |
| --- | --- | --- |
| 1 · Artwork | `public/cards`, `public/heroes`, `public/boards`, `Artifacts/asset-manifest.json`; inspect cards/chooser/arena skins | Original card back retained; generation provenance in manifest/style bible. |
| 2–3 · Motion/audio | `components/MotionFx.tsx`, `AbilityFx.tsx`, `AttackFlight.tsx`, `lib/audio`; events/audio checks plus real combat | Procedural sound; physical audibility and every effect on a physical phone still need review. |
| 4 · Mechanics | Additive engine rules, `lib/ai.ts`, `docs/mechanics.md`; smoke/regressions | Draft/Arena and hero quests remain future work; human balancing required. |
| 5/9 · UX/3D/RU/cards | `app/arena.css`, `app/card-frames.css`, `CardOrnament.tsx`, `BoardRank.tsx`, `AttackAim.tsx`, locale and `components/3d`; build and desktop/mobile matches | Only supplied Whale model; accessibility and physical-device performance limits above. |
| 6 · Showcase | Root README and `docs/media`; actual captures and command ledger | No claims of unverified live integrations. |
| 7 · Solana/iDos | Wallet/collection gateway, `lib/solana/metaplex.ts`; integration checks; `/leaderboard` | Local fallback works; no configured Title or live badge/wallet acceptance. |
| 8 · Genesis NFTs | `/devnet`, `/packs`, ownership API/context, `lib/solana/{genesis,deployment,ownership,ownedCore}`; Metaplex checks and deployment guide | Core NFTs with free Core Candy Machine, not compressed NFTs. Live deployment/mint/ownership demo remains outstanding. |

## Live integration acceptance

These are outstanding checks for optional integration deployment. They do not block wallet-free AI play.

### Phantom and message proof

Connect a real Phantom account that supports Solana devnet. Verify the displayed address/balance against devnet, inspect the free match-signature message, approve it and confirm exact-message/public-key verification. Repeat with cancellation/disconnection and confirm demo play remains available. Record public proof fields and the observed outcome; an off-chain signature does not certify competitive gameplay.

**Status:** live wallet interaction not established by this documentation record.

### Genesis collection and NFT pack

1. Publish the app at a real HTTPS origin; verify public metadata JSON and artwork responses. Set `NEXT_PUBLIC_NFT_METADATA_BASE_URL` to that origin.
2. Use a funded devnet authority wallet at `/devnet`. Inspect each simulation, account, rent and fee preview; approve collection creation and Candy Machine setup separately in Phantom.
3. Load all 40 original Genesis entries in batches. Read progress from chain. Record confirmed collection/machine addresses and transaction signatures before configuring public environment IDs.
4. At `/packs`, inspect and approve one NFT-pack transaction. Record its confirmed devnet Explorer receipt, minted account, wallet owner, Genesis collection and matching card metadata.
5. Refresh `/collection`; confirm ownership filtering unlocks only verified cards. Check cancellation, mismatched ownership, expired preview and unresolved confirmation/retry behavior without duplicating a mint.

**Status:** no live collection deployment, Candy Machine setup or NFT mint has been verified. Audit is not part of the original 40-card mint edition. Test SOL rent and fees apply; no mainnet action is implemented.

### First Victory badge

Win a non-exhibition match with a verified wallet message proof. Prepare the badge at `/leaderboard`; inspect the simulation/fee summary, approve in Phantom and record the confirmed asset receipt. After a later qualifying win, verify an update to the same owned badge's `wins` attribute. Confirm exhibitions cannot qualify. The achievement remains self-reported from local AI play.

**Status:** no live badge create/update receipt has been verified.

### iDos backend

A real Title must be configured with matching collection/card IDs, a five-card pack and exactly 50 units of virtual `RUG` as its price. Confirm SDK device login, definitions/state reads, one atomic purchase and persisted inventory/currency on reload. Reject invalid definitions and observe visible recovery actions for backend errors. A leaderboard ID is an optional future module.

**Status:** no Title was created or paid for; the configured live SDK path has not been exercised. Demo `$RUG` is not a token, payout or paid crypto transaction.

## Known evidence limits

There is no authoritative multiplayer service, live marketplace listing/trading flow, mainnet deployment, verified demand, competition eligibility assessment or final cross-device performance verdict in this record. The older design document contains proposed features and stale values; current engine/source and `docs/mechanics.md` define implemented behavior.
