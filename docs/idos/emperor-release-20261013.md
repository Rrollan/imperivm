# Emperor release — 13 October 2026

Live game: https://idosgames.com/app/SI4IPS8B/

Direct version: https://si4ips8b.idos.games/v/blda0de778fed124bd59f6dd89babbc8799/index.html

## Published build

- Title: `SI4IPS8B`, version **32**, build `blda0de778fed124bd59f6dd89babbc8799`.
- iDos confirmed `Status: Live`, `Published: true`, `Errors: []`.
- Code source: `ebdd333249a4669567fa549bdc03e28e43bfa90f` on `rebirth`.
- ZIP: 1,000,822 bytes; 63 files; 3,717,892 unpacked bytes.
- ZIP SHA-256: `bd09b7c4fef51d68259ba2c26a8fc81a029761fc72e45c4c2b8a427c2e650914`.
- Build and browser screenshot tests ran on the separately authorized render server. No video rendering ran on the Mac.

## Player-visible change

Forty distinct illustrated decrees run in normal practice, legacy training and online battles with two compatible clients. Decrees arrive at full rounds 1, 4 and 7; the engine preserves a maximum of three declarations and does not repeat a rule within a match. Twenty-four sustained laws and sixteen one-time events have public, symmetric effects. A new declaration replaces the prior law.

Each rule has its own transparent 768×512 WebP artifact and readable large announcement. Five thematic animation families, a native arena badge and battle history support opening and re-reading. The latest adjustment removes the pause button and the rectangular hover background. A noninteractive ten-second countdown runs during reading, including hover and keyboard navigation; hidden tabs do not consume reading time. Reopening a decree starts a fresh countdown. The online turn clock is independent and keeps running.

Mercy grants new fighters Lifesteal. Fighter damage still hits the selected target and heals the fighter owner's ruler by actual health removed, capped at 30. It does not redirect damage to the enemy ruler. The description now says this explicitly.

## Retained shared dependencies

Do not delete the assets referenced through the manifests:

| Version | Build | Purpose |
| --- | --- | --- |
| v4 | `bld52ef6b0ad13a431dbfd6d0e32421f756` | Existing shared public artwork |
| v23 | `bldda32001e101e43c282436b8d451bc2b8` | Existing compact public previews |
| v31 | `bld30f55f5764d74ef484c3ca675bd6c188` | All 40 Emperor artifacts and unchanged exact-hash code dependencies |

V31 is staged, not the live frontend. Its full package contains 106 files, 10,203,547 unpacked bytes and all forty artifacts. V32 deliberately packages zero new Emperor images: the complete group is reused from v31, using `shared-assets.v31.json`; `shared-code.v31.json` permits reuse only after an exact SHA-256 match. All 40 hosted WebPs were fetched from the actual Title `/v/` paths and matched source SHA-256.

## Validation

- TypeScript and compact static build passed on the render server.
- All 40 decree effects, both seats, real granted-Lifesteal attacks, healing cap and overkill, scheduling, JSON replay, immutable transitions and 27 deterministic nine-ruler AI games passed.
- Earlier full CI passed for feature/compatibility commits `91a9983` and `6ecd0a6`, including smoke, integration, Next production and 41 server tests.
- Final full CI for `ebdd333` passed on rerun (`38444368337`): TypeScript, smoke, integration, Next production, server tests and server build. Its first attempt failed while Next's Google-font loader parsed an external font response; no game/test step failed, and the unchanged-code rerun completed successfully.
- Browser checks covered the real arena at 1280×720, 844×390 and 390×844. Portrait decrees are readable; normal portrait arena interaction uses the existing rotate-device hint.
- The final UI check confirmed no pause control, closing while hovered, closing after keyboard exploration, a transparent native badge hover and no page errors.
- The uploaded v32 launched in the public iDos iframe. A guest entered training, completed the opening-hand selection and reopened `three-seats`; the artifact loaded and the running countdown appeared.
- The live Render backend reported healthy, with no active rooms or queued users during verification. Two compatible clients receive Emperor rules; a mixed pair retains classic rules. No wallet signing or payment was performed.

Private verification files are under `verification/emperor-20261013/full-app/`: release metadata, hosted-art hashes, browser reports, final native hover screenshots and `idos-v32-live-iframe.jpg`. Original asset prompts and the complete 40-image contact sheet remain available separately.

## Storage cleanup

The publisher explicitly authorized each deletion group immediately before its irreversible iDos action. Nine old JS files were removed, freeing **12,168,579 bytes**; public artwork and the previously live v28 were retained. Each removed file has a private backup with SHA-256 under `verification/emperor-20261013/storage-backup/`.

| Old version | Removed JS |
| --- | --- |
| v24 | `index-DZ4iDyPB.js` |
| v23 | `index-cBcYrV1N.js` |
| v22 | `index-CNLePwDm.js` |
| v18 | `index-CUFVR12E.js` |
| v17 | `index-6ve4QHGW.js` |
| v4 | `createArena-B7mjSuHB.js` |
| v8 | `createArena-Bk8WrsYI.js` |
| v5 | `index-jp9U7ZWW.js` |
| v15 | `index-9KysKc4Y.js` |

The old versions above lose their removed entry point or arena. Current v32 and its retained artwork dependencies do not reference those scripts. V28 remains a retained previous release for rollback; downgrading to it removes the new Emperor frontend and the backend's compatibility negotiation then keeps mixed/old matches classic.
