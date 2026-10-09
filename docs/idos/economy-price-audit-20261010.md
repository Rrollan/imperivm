# IMP economy and price audit — 10 October 2026

Read-only review. No platform configuration, wallet transaction, purchase, transfer or shared implementation was changed by this audit. Prices below are proposals until implemented and verified by the publisher.

## Finding

The displayed `490021.764541 IMP` is a token quantity, not a dollar balance. The old costs of 50 IMP per five-card pack and 200 IMP per ruler case were appropriate only as demo units; reusing those amounts against the real six-decimal Solana token makes purchases extremely cheap.

Phantom and the deposited iDos game balance are separate accounts. Connecting a wallet reads ownership and signs in; it does not authorize transferring all holdings. Deposits need a selected amount and an explicit wallet transaction. A pending deposit must be recovered by transaction hash, never sent a second time simply because game credit is delayed.

## Actual market observations

Canonical mainnet mint: `7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos`; decimals: 6.

At `2026-10-09T22:31:04Z`, [Jupiter Price V3](https://api.jup.ag/price/v3?ids=7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos) returned HTTP 200:

```json
{
  "usdPrice": 0.0000022410200653911057,
  "liquidity": 1.0651306640965243,
  "blockId": 454983027,
  "decimals": 6,
  "launchpad": "met-dbc"
}
```

[Jupiter Tokens V2](https://api.jup.ag/tokens/v2/search?query=7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos) matched mint, name IMPERIVM, symbol IMP, six decimals and one-billion supply. It reported two holders, organic score 0/low and the same price/liquidity. These are provider metrics, not an audited reserve statement or a promise that the whole supply can be sold at this mark.

Solana mainnet `getBlockTime(454983027)` returned `1791575874`, or `2026-10-09T19:57:54Z`. Thus the V3 mark's last-swap block was already over 2.5 hours old when read. It must not be labelled a newly executed trade.

Fresh read-only [Jupiter V1 quote](https://developers.jup.ag/docs/swap/v1/get-quote) requests returned routes; no swap transaction was built or executed:

| Pair | Input | Quoted output | Minimum output at 50 bps | Context slot |
| --- | ---: | ---: | ---: | ---: |
| IMP → USDC | 490,021.764541 IMP | 1.044910 USDC | 1.039686 USDC | 455025287 |
| USDC → IMP | 0.500000 USDC | 223,487.845918 IMP | 222,370.406689 IMP | 455025298 |
| IMP → SOL | 490,021.764541 IMP | 0.009575566 SOL | 0.009527689 SOL | 455025309 |
| IMP → USDC, later read | 223,487.845918 IMP | 0.476973 USDC | 0.474589 USDC | 455026270 |

Routes used Dynamic Bonding Curve pool `5hxNCB8gJLYyR9WJpFpqpcJ5cor5JRjtg3QZqR7GfGh5`; USDC routes also used a SOL/USDC market. The quoted wallet sale had `priceImpactPct` approximately `0.04878`, i.e. 4.878%, not 0.04878%. The illustrative buy/sell round trip is `0.5 → 0.476973 USDC`, a 4.6054% loss before any separate network/account costs and future state changes. This is a useful warning against claiming that nominal spot value is cash that can be withdrawn unchanged.

The read-only quote endpoint has a fresh overall context but the DBC leg's `updateContextSlot` remains the last changed pool state. An unchanged older pool state is not automatically proof that the new quote request failed; distinguish price last-swap time, pool last-update time and quote generation time.

Jupiter's live documentation now offers keyless access on `api.jup.ag` at 0.5 requests/second; production should use the publisher's server-side key and documented rate limits. The V1 quote API is marked superseded by V2, so a new production swap integration should evaluate V2 rather than depend on V1. This audit used V1 only for non-mutating route evidence. [Official Jupiter docs](https://developers.jup.ag/docs/price), [official quote reference](https://developers.jup.ag/docs/swap/v1/get-quote), [official rate limits](https://developers.jup.ag/docs/portal/rate-limits).

## Why the old prices are wrong

Using the observed V3 mark for illustration only:

| Quantity | Indicative USD mark |
| --- | ---: |
| 490,021.764541 IMP | $1.09814861 |
| Old pack: 50 IMP | $0.000112051 |
| Old ruler case: 200 IMP | $0.000448204 |

At old prices the wallet could buy about 9,800 packs or 2,450 cases. Changing the displayed number or the six-decimal token binding would corrupt accounting; change the product pricing instead.

## Recommended product prices

Set stable product targets of **$0.50 for a five-card Agora pack** and **$2.00 for one ruler case**. The 4× relationship is explicit, easy to explain, and preserves the existing relative cost. These are product decisions, not predictions of token appreciation.

At the observed mark, the corresponding illustrative quantities are approximately **223,112.683248 IMP** and **892,450.732989 IMP**, rounded upward to six decimals. Those numbers must not be hardcoded as a permanent exchange rate. At this mark the owner's holdings cover about two packs or half a case, which is consistent with a roughly $1 holding despite a large token count.

Preferred authoritative configuration uses a single crypto cost entry:

```ts
// Proposed five-card pack cost. Do not combine Amount and AmountUsd.
{ Type: 'CryptoCurrency', CurrencyID: 'Main', AmountUsd: 0.50 }
// Proposed ruler case cost.
{ Type: 'CryptoCurrency', CurrencyID: 'Main', AmountUsd: 2.00 }
```

Official `@idosgames/mcp@0.1.31`, `registry/skills/checkout-system.json`, explicitly documents USD prices converted into tokens by the server. Installed `@idosgames/core@0.21.3` exports `ResourceEntry.AmountUsd`, `CryptoCurrencyDefinition.ValueInUSD`, `ValueInUSDUpdatedAt` and `UsdPriceRefreshMinutes`. The bundled currency data-model reference is older and does not document `AmountUsd`; the checkout guide and installed types are the relevant evidence. The precise backend zero-price, freshness and rounding behavior remains unverified. Never turn on payments merely because a client type accepts a field.

The game's current validation explicitly insists on Amount=50/200 and must be replaced consistently with the publisher's authoritative cost. The collection definition itself, UI, affordability checks, receipt validation and errors all need the same change. A client-local multiplication cannot make the iDos server charge a different configured amount.

## Price and liquidity controls

Suggested launch policy, requiring server enforcement:

1. Validate exact mint, mainnet, six decimals, active/spendable Main; accept only finite positive USD values.
2. Refuse real purchases when the authoritative iDos price is missing/zero, timestamp is missing/future, or its update is older than the configured refresh interval plus a small bounded grace period (suggest 5 minutes absolute maximum for checkout).
3. Treat Jupiter's mark as indicative. For an executable USD-to-IMP preview, quote the actual size, require a fresh response/context, check expected input/output mints and amounts, and validate finite price impact with a strict bound.
4. Choose an explicit liquidity launch gate, for example at least $1,000 reported liquidity and at least 100× the largest offered purchase/stake. This is a publisher safety threshold, not an exchange rule. The observed $1.065 provider metric fails this policy now. Never silently substitute an arbitrary exchange rate if no trustworthy market is available.
5. Show `price unavailable` and keep free play open on outage, stale price, unsupported mint, bad route, excessive impact, illiquidity or market disagreement. Rate-limit/cache quotes on the server, bound timeouts and response sizes, and never expose a paid API key to the browser.
6. Freeze the IMP quantity for a short-lived server quote (suggest 60 seconds). Never allow client price fields to determine a debit. Requote and ask for renewed confirmation if terms change.
7. Verify that the backend enforces a maximum approved IMP debit/quote ID or an equivalent atomic price snapshot. Current observed SDK `collection.openPack` does not expose a maximum-spend argument. A browser-side preflight is insufficient against a price changing immediately before the server charge. If iDos cannot enforce the bound, leave commerce gated until a server-authoritative solution is available.

A new token can have a valid bonding-curve quote while having very low reported liquidity and little trading history. Do not describe it as a guaranteed dollar peg, do not inflate its value, and do not automatically buy liquidity with the owner's funds.

## Paid PvP proposal

Use IMP token escrow and a **0% game house fee** for the first version unless the publisher deliberately approves a fee. Entry suggestions are $0.25/$0.50/$1.00 targets converted to equal IMP stakes before matching. Indicative quantities at the observed mark are 111,556.341624 / 223,112.683248 / 446,225.366495 IMP. Both players must explicitly accept the same frozen token quantity; payouts occur in tokens, not a USD promise. Market changes during a battle do not alter its stake.

An alternative is clearly denominated fixed IMP stake tiers, e.g. 100,000 / 250,000 / 500,000 IMP. This avoids FX affecting match settlement, but USD labels must remain estimates and it is not a USD-priced product. Neither policy should be enabled against unverified holds/payouts.

Minimum settlement invariants:

- Reserve each player's confirmed deposited balance once; no spendable negative balances or credit based only on Phantom read results.
- Start only after both holds are confirmed. Never send a stake request on a passive page load.
- Winner receives exactly the pooled token stakes when the 0% rule applies; ties/cancelled matches return each player's original stake.
- Idempotent persisted settlement keyed by match ID. Restart/disconnect/timeout paths must not pay twice or lose held funds.
- Cancel unmatched offers and refund expired incomplete reservations. Retries inspect existing transaction/hold status before repeating.
- Server determines outcomes from game rules; browser-supplied victory flags cannot authorize a payout.
- Platform withdrawal or token trading fees are separate from the game house fee; do not promise fee-free withdrawal without checking active currency settings.

## Code paths that require coordinated changes

- `lib/collection/gateway.ts`: PACK_COST=50, RULER_CASE_COST=200, local-demo costs and errors.
- `lib/collection/idos.ts`: strict real pack/case definition validation, configured cost and purchase receipt handling.
- `components/home/RulerCase.tsx`: hardcoded 200 IMP button/conditions and disabled affordability behavior.
- `app/packs/page.tsx`: PACK_COST affordability gate and hardcoded 50 IMP status label.
- `lib/idos/commerce.ts`: older SOL/USDC-to-virtual-currency store path is distinct from the actual Main crypto token; do not mistake a virtual grant for a real token deposit.
- `components/RugShop.tsx`: real Main currently directs to the iDos wallet; add clear deposit action and pending state.
- `components/AccountPanel.tsx`: continue to distinguish Phantom from deposited game balance.
- `docs/idos/SI4IPS8B-integration.md`: record actual configured prices and tested receipt behavior; remove old 50/200 real-token claims when replaced.

This audit does not assert that deposits, USD-priced collection purchase, escrow or payout already work in production. Those need separate implementation and end-to-end validation before a paid release.
