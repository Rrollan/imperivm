# Architecture

The Next.js application and iDos static entry share React components, adapters and the TypeScript engine. Vite compiles the actual game for iDos; there is no external-site iframe wrapper. Immutable artwork is reused only when a retained manifest matches its content hash.

## Boundaries

| Component | Responsibility |
| --- | --- |
| `lib/engine` | Deterministic game transitions and legal moves |
| `components` | Input, readable state, animation and explicit action reviews |
| `server/src/rooms.ts` | Authoritative free duels, hidden-hand filtering, matchmaking and reconnects |
| `lib/collection/authority.ts` | Server verification of pack-card entitlement |
| `lib/idos/client.ts` | Serial SDK operations, server authentication and account-scoped access |
| `lib/idos/session.ts` | Non-secret wallet/account identity hint; never an authentication credential |
| `lib/idos/cardMarket.ts` | Native iDos listings, purchases, cancellation and uncertain-operation recovery |
| `server/src/cardMarketPrices.ts` | Server-verifiable completed-sale history and bounded price statistics |
| `supabase/migrations` | Persistent sale-history schema |

## Identity

The official iDos SDK persists and rotates its refresh token. Startup uses `autoLogin` without first logging out. The recovered backend UserID must match remembered identity; server-provided wallet metadata is checked when present. The optional local wallet address is only a display/association hint after authenticated restoration. Current Phantom/parent-platform identity is read without requesting a signature. A changed connected wallet invalidates the previous session. Explicit sign-out clears persistence; temporary network errors do not erase a valid remembered login.

Operations are serialized. Refresh rotation uses a browser cross-tab lock when available. Profile results are scoped to owner, UserID and session revision, preventing late responses from replacing another user's profile.

## Money and market

Solana wallet holdings, deposited iDos IMP and local demo credits are distinct. iDos is the balance and marketplace authority; the Node service and Supabase do not mint game balances. Currency configuration is validated for IMP mint, six decimals and expected costs. Signed transactions are checked before submission. Durable journals prevent a network failure from becoming a duplicate debit.

Supabase receives verified completed-sale rows through server-only credentials. Browsers cannot write arbitrary reference prices. Full schema and deployment details are in [the integration document](idos/SI4IPS8B-integration.md).

## Embedded UI

The iDos catalog iframe allows scripts but does not allow HTML form submission. `components/ActionForm.tsx` handles clicks and Enter directly while suppressing native submission. Existing domain validation, disabled controls and amount review remain in place. This applies to listings, profile names, transfer preparation and multiplayer registration.

## Deployment limits

Render hosts the authoritative Node service; live rooms are in process memory. Restarting that service loses active rooms. Supabase preserves completed-sale history across restarts. iDos hosts the static game and its retained resources. [Server operations](../server/README.md) · [API](api.md).
