# Wallet session and iframe actions — 11 October 2026

## Observed problems

The owner confirmed a paid pack opened, but the account logged out on repeat visits. Creating a market listing appeared to do nothing after the card and price were selected.

The runtime explicitly disabled remembered sessions and always started a DeviceID guest login. A null initial Phantom state could also disconnect a recovered wallet. The catalog's live iframe sandbox omits `allow-forms`, preventing the native form submission event used by the listing UI.

## Changes

- Official SDK remembered refresh tokens and `autoLogin` restore the server account before game data is loaded. No previous wallet signature is replayed.
- The local wallet hint contains only version, public address, UserID and network. Restored server UserID and optional server wallet metadata are checked. A known changed wallet resets to a guest; temporary network failure keeps persistence for retry.
- Phantom reconnect uses Wallet Standard's silent mode. Profiles and header names use the authenticated session even while the extension is locked.
- `ActionForm` runs click/Enter callbacks before native submission. It is used for market listings, nickname edits, transfer preparation and multiplayer registration. Existing quantity/price validation, review, account locks and native settlement contracts are retained.

## Checks

- TypeScript, full smoke checks, twenty integration groups and Next production build passed.
- Session regressions cover cold refresh, a single rotation for concurrent startup, React remount, explicit logout, wallet switch, mismatched server UserID, mismatched server wallet cache and temporary-error retry.
- Browser reproduction used an iframe with `sandbox="allow-scripts allow-same-origin"`. The original submit button ran zero callbacks. The real `ActionForm` ran exactly one callback per click/Enter. An invalid amount showed a visible error without incrementing the count; disabled Enter did not run an action.
- These checks performed no wallet signatures or financial transactions. Live two-wallet market settlement and withdrawal remain unverified.

## Published release

v28 `bld5df96d766ba141579c2ab2dd6091fb2c` is **Live**, `Published=true`, `Errors=[]`. The catalog iframe loads `assets/index-C8hobPzA.js` from this build. Browser checks covered guest startup, account, market access controls and mode selection without JavaScript errors. Wallet restoration and actual listing creation still require owner verification after a fresh login.

ZIP: `dist/imperivm-idos-session-forms-v28.zip`, 1,018,335 bytes; 65 files, 3,862,208 bytes unpacked; SHA-256 `a8983163a64de6a91b3b292268e6427874408a976407fbd964c88481f94b47da`. No source maps, TS/TSX source or credentials are included. All 358 artwork files match retained v4/v23 manifests; one unchanged CSS file comes from v24.

The first upload, v27 `bld4e0a4b13514e4ea48f343731b2b7ca30`, failed with `Storage quota exceeded` and was not deployed. After the owner's specific confirmation, three older arena scripts were removed: v24 `createArena-DaZS_hT-.js`, v23 `createArena-BGzj6iYi.js`, v22 `createArena-BZVYGAB3.js`. Total 4,282,449 bytes; the UI confirmed three files and 4.1 MB freed. Exact backups from their original upload ZIPs and a SHA-256 manifest are private in `dist/storage-backups/20261010-session-forms/`. The new build does not reference these scripts. Shared artwork/CSS and v26 are retained for compatibility and rollback.

Private browser proof: `dist/qa/session-forms/iframe-regression.png`, `storage-selection.png`, `storage-deleted.png` and `public-v28.png`.

After release, the owner needs one fresh wallet login because v26 did not save a refresh token. Subsequent revisits in the same browser/origin should restore automatically while that server session remains valid. Expired/revoked sessions, explicit sign-out, cleared storage and a different browser/origin can still require sign-in.
