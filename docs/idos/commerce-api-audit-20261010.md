# iDos commerce API audit — 2026-10-10

This is a read-only capability audit. No wallet transaction, purchase, platform configuration change, or external message was performed during this audit.

## Verified scope

The installed packages are `@idosgames/core@0.21.3` and `@idosgames/wallet@0.6.3`. Public registry metadata was read at [registry/latest/index.json](https://cloud.idosgames.com/drive/registry/latest/index.json), commit `d43d588def0f56b2826b487f3f00b0c811871259`. The hosted `cloud-code` skill matches the bundled copy exactly.

Primary evidence:

- [Cloud Code skill](https://cloud.idosgames.com/drive/registry/latest/skills/cloud-code.json).
- [Match skill and its data-model reference](https://cloud.idosgames.com/drive/registry/latest/skills/match-system.json).
- [Blockchain skill and its data-model reference](https://cloud.idosgames.com/drive/registry/latest/skills/blockchain-system.json).
- [Currency skill and its data-model reference](https://cloud.idosgames.com/drive/registry/latest/skills/currency-system.json).
- Installed `node_modules/@idosgames/core/dist/RealtimeSession-C5VICo95.d.ts`, `node_modules/@idosgames/wallet/README.md`, wallet bridge declarations, and the connected MCP tool schemas.

## Wallet deposits and withdrawals are supported

Connecting/signing in with Phantom proves account ownership. It does **not** transfer tokens into the iDos game balance. A deposit is a separate mainnet transaction authorized by the player. Reading a Phantom balance must never create an equal game balance locally.

The core blockchain service is report-only. It verifies deposited transactions and issues withdrawal vouchers; the wallet package builds/submits on-chain transactions:

```ts
client.blockchain.getDefinitions({ forceRefresh: true });
client.blockchain.getUserState();
client.blockchain.depositToken(networkID, transactionHash);
client.blockchain.requestTokenWithdrawal(currencyID, networkID, walletAddress, amount, category?);
client.blockchain.retryWithdrawal(titleTransactionID);
client.blockchain.confirmWithdrawal(titleTransactionID, onChainTransactionHash);
```

`LazyWalletPanel` reads the title's networks and selects the Solana flow. The shipped `createPlatformPoolAdapter` calls `deposit_spl`/`withdraw_spl` against **the freshly read platform `RewardPoolAddress`**. Cluster selection is from the title's `ChainID`: 103 is devnet, otherwise mainnet. Do not replace the address with an application-owned wallet or rely on cached pool configuration when moving funds.

Inside the idosgames.com iframe, deposits/withdrawals go through the surrounding site's wallet card: `openPlatformWalletPanel()`. The top-up bridge requests `{ titleID, userID, currencyID, amount }`; the site refuses an account mismatch. Its success means the deposit was credited, rather than just sent. `onWalletBalanceChanged` should trigger an authoritative cache refresh, not a manual credit.

The wallet flow documents interruption stages. An on-chain deposit awaiting backend credit is retried by reporting the **same transaction hash**. A withdrawal already debited under `titleTransactionID` is resumed with that same ID; calling `withdrawToken` again would debit again. The cache consumes the server `StateDelta` only, avoiding duplicate local changes on replay.

## Native Match escrow exists, but cannot settle our TCG

The SDK exports these methods:

```ts
client.match.createMatch(entry, ruleID, characterID?, battleStrategy?, targetUserID?, selectedOptionID?);
client.match.cancelMatch(matchID);
client.match.instantBattle(matchID, ruleID, characterID?, battleStrategy?);
client.match.getMyMatches(page?, pageSize?, statuses?);
client.match.getAvailableMatches(page?, pageSize?, onlyPublic?);
```

The documented built-in Match module holds a creator's entry and supports cancellation and automatic offer-expiry refunds. On join, it resolves a character fight **instantly in the iDos combat engine**. Inputs are a character and repeating `AttackTarget`/`DefenseTarget` choices (`Head`, `Torso`, `Legs`). The result and dual-party resource update come from that engine in the same call. A join does not create an ongoing live turn-based match.

Crypto entries are supported when enabled in `MatchEntrySettings`, using whole token amounts. A decisive crypto result pays `2 × entry` minus the currency's `PlayerTradeFeePercent`, with no virtual-currency burn. Only the creator paid an entry before resolution; on a draw, its entry is refunded and the joiner was never charged. Separate creation costs have separate refund rules.

There is **no documented method here to reserve two TCG participants, then submit a winner established by our WebSocket authority**. Passing a manufactured instant-battle character/strategy to force a TCG winner would falsely present different combat as the source of the result and would not provide the required settlement contract. Do not enable it as TCG escrow.

## Cloud Code does not expose a verified financial adapter

The current official Cloud Code API lists `ReadUserData`, `GetTitleConfig`, protected user/title custom-data reads/writes, data-collection operations, integration settings, `HttpRequest`, and `AddQuestProgress`. It documents atomic multi-key custom-data writes, atomic title counters, and `SetTitleCustomData(bucket, key, value, expectedVersion?)` for compare-and-swap.

Those operations are useful for authoritative metadata and idempotency records. They are **not evidence of a transactional crypto balance debit, reservation, or two-player payout**. Writing custom data does not move `Main` tokens. CAS on a custom-data record alone does not atomically couple a hold, match start and payout across two player balances.

The connected MCP's `save_cloud_code` schema includes `ResourcePolicy.AllowedConsumeTypes` and `AllowedGrantTypes`, including `CryptoCurrency`, plus caps. However, neither that schema nor the published skill provides a callable financial method signature, result shape, idempotency semantics, or two-party transaction boundary. That capability remains **unverified**, rather than proven absent from the private backend. Do not guess a `server.ApplyResources`, `GrantCrypto`, or `ConsumeResources` API name.

`CurrencyService` only exports currency conversion: `convert` (virtual-to-virtual) and `cryptoConvert` (crypto source). These do have transaction IDs and seven-day replay handling. Conversion is not a cross-player escrow/settlement API. A virtual IOU is not withdrawable backing and must not be substituted for a real payout.

## Authentication and a feasible implementation boundary

The game's existing collection check sends a transient iDos `userId` + `sessionTicket` to the server, which validates by reading authoritative iDos data. Paid participation must validate **every participant**, even when its deck uses only free cards. A client-provided user ID, wallet address, balance, winner or receipt does not establish authority.

A complete financial adapter must provide:

1. Durable match/ledger records, exact integer base units, explicit currency/mint/network/decimals.
2. Idempotent reservation for both authenticated players, with no game start until both reservations are confirmed.
3. Server-only settlement against the authoritative final game state; exactly one winner payout or a deterministic refund outcome.
4. Durable recovery and reconciliation after a timeout, response loss or process restart. Unknown outcomes stay pending until queried, rather than charging again.
5. Cancellation/expiry/refund rules, account isolation, replay protection, and concurrency tests preventing overspend and duplicate payout.

The state machine, durable store interface, validation and UI can be implemented independently. Real `Main` debits and payouts must stay disabled until the adapter contract is verified. If iDos does not offer it, the alternatives are a reviewed on-chain escrow program or a separate authorized financial backend with persistent storage and explicit custodial/on-chain settlement; neither can be replaced by in-memory balances or an application client signature.

## Ready question for iDos support / mentor

> Our game is an external-authoritative, live, turn-based TCG on iDos Title `SI4IPS8B`. The WebSocket game server determines the final winner. We need both players to reserve equal amounts of the existing Solana `Main` token from their iDos game balances, then atomically pay the bank to the winner or refund the same reserved funds on cancellation/expiry/server failure. Does iDos expose a server API or Cloud Code API for this **without calling the native instant character battle engine**? Please provide the exact callable signatures and request/response schemas for reserve, query by idempotency key, settle, and refund; their atomicity and retry/expiry guarantees; exact decimal/base-unit rules; and the authentication model that lets only our server submit the winner. `CloudCode.ResourcePolicy` includes `CryptoCurrency`, but the public `server.*` skill does not document the resource-operation method. Is there a supported two-user atomic resource operation, and which publisher integration secret/permission is needed? Please also specify how a reservation is protected from simultaneous store purchases/withdrawals and how pending operations survive a restart.

This question has been prepared, not sent.
