# Arena polish · 4 October 2026

Branch: `codex/ui-rebuild-hs`.

The gates now use a feathered stone texture and fading gold arch rims on a softly blended card surface. Hard rectangular arch backgrounds, doubled outlines and paired edge strips are removed. Each desktop gap has one centered divider with faded ends; the Roman numeral seals sit over the arch crowns. The imperial stone frieze stays intact.

Gate I uses `brazier`, gate II uses `coin-rug` at 0.12 radians/second, and gate III uses `laurel-wreath`, through the existing lazy `CoinPreview` / `Coin3D` entry point. Preview containers are capped at 148px on desktop and 76px on mobile. Brazier and wreath use demand rendering; the coin rotates only while visible with motion enabled. Existing DPR ≤ 1.5, viewport loading, reduced-motion handling and 2D poster fallbacks are preserved. All new accessible labels have RU/EN translations. The compact mobile grid retains its dimensions.

`lib/engine`, `lib/ai`, model assets and `public/ui/buttons` are untouched. The separate button asset delivery remains untracked.

Validation:

- `npm run build`: passed, including TypeScript checks.
- `npm run smoke`: passed, `SMOKE OK`, all 61 regression groups and content checks. The npm entry and child commands now use `node --import tsx` so verification needs no CLI IPC socket.
- Arena lobby checks: passed with `node --import tsx scripts/tests/arenaLobby.test.ts`.
- `git diff --check`: passed.

Browser validation and the requested fresh `docs/media/arena-polish-desktop.png` (1440×900) and `docs/media/arena-polish-mobile.png` (390×844) are pending. This session denies local server sockets (`listen EPERM`) and Chromium startup sockets (`setsockopt: Operation not permitted`). No old captures were relabeled as new evidence. Visual seam removal, live WebGL rendering and mobile fit therefore remain unverified in a browser.

The local commit is also pending: the explicit `git add` / `git commit` attempt failed because `.git/index.lock` cannot be created on the read-only filesystem. Changes remain in the working tree; nothing was pushed.
