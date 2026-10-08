# Wallet, collection and achievements

Updated 8 October 2026. See [iDos / Colosseum handoff](idos-colosseum-handoff.md) for exact Title settings, deployment limitations and live acceptance steps.

## Verified status

- Wallet-free AI gameplay, engine smoke and strict production build pass.
- `@idosgames/core` **0.21.0** is installed and used by the typed collection adapter. Its backend is **not configured or live-tested**: no iDos title was created or paid for.
- Local collection and virtual `$RUG` persistence, atomic purchases, storage failure fallback, proof signature validation and deck validation have deterministic checks.
- Phantom uses Wallet Standard discovery. Address and balance come from Solana devnet; a match can request a free, verified Ed25519 message signature. This is **off-chain proof of wallet participation**, not an on-chain match or competitive verification.
- Metaplex Core achievement creation and win-attribute updates have a wallet-backed transaction flow. **No live badge mint has been verified yet.** A funded devnet wallet and public metadata origin are required.
- Standings are local to this browser. A configured iDos practice leaderboard can read and publish self-reported AI wins with BestScore and no rewards; it is not live PvP ranking.

## Configuration

Copy `.env.example` to `.env.local`, then restart/rebuild. Do not commit `.env.local`.

An empty or placeholder `NEXT_PUBLIC_IDOS_TITLE_ID` selects the local gateway. A real Title ID selects the actual SDK adapter, with one app-owned client, guest or signed Solana-wallet login, collection definitions, user-state reads and atomic `collection.openPack(...)`. The UI remains the same.

Configure these entities in the **future** iDos title:

| Entity | Default ID | Required configuration |
|---|---|---|
| Virtual currency | `RUG` | 500 initial units; no cash value; not an SPL token |
| Collection | `IMPERIVM_GENESIS` | Collectible IDs equal the IDs in `lib/cards.ts` |
| Pack type | `GENESIS_PACK` | Five collectibles, rarity weights 60/25/11/4 |
| Price option | `RUG` | Exactly 50 **VirtualCurrency** units of `RUG` |
| Leaderboard | unset | Optional future configuration; score adapter included |

The adapter refuses crypto payments, other pack sizes/costs, missing entities and invalid state. A configured backend error stays visible with Retry and **Use local demo** actions. It does not fabricate backend purchases or silently credit a local account.

Local mode starts with 500 `$RUG` and two copies of each common card. A pack costs 50 and adds five cards. Purchases serialize within a tab and across tabs when Web Locks are available. Storage failures use memory for the session. All preset demo decks remain available regardless of collection ownership.

## Proof of play

1. Connect Phantom from the header; inspect its full address and **devnet** balance.
2. Start an ordinary training match from the beginning on `/arena-lab` (or the legacy `/game`). Choose **Sign & play** or **Continue in demo**.
3. Inspect the message in Phantom: domain, devnet, match ID, hero, nonce and timestamp.
4. Approval is checked against the exact message and connected public key. Cancellation or disconnection never prevents demo play.
5. The receipt is kept in session storage; match history retains its public signature. No secret key is read or stored.

Autoplay, debug encounters and mid-match lab starts are exhibitions. It cannot qualify for a victory badge or add leaderboard wins.

## First Victory badge

Set `NEXT_PUBLIC_NFT_METADATA_BASE_URL` to the actual **public HTTPS origin** serving this app. `/api/nft/metadata/victory` must return valid public metadata and its image must load. Localhost and placeholder origins are rejected.

Win a signed match, then open **Hall of victories → Mint / sync badge**. The app finds an existing owned Core badge or prepares a new asset with `achievement`, `wins`, `last_match_id` and `verification` attributes. It simulates the v0 transaction and displays account, fee payer, rent and network fee. Only **Approve in Phantom** requests a signature. Preflight and confirmed transaction checks precede the Explorer receipt.

Only devnet is coded into the RPC and signing chain. Obtain free **test SOL** from [Solana Faucet](https://faucet.solana.com/). The wallet owns the badge and its update authority; the win count is explicitly **self-reported from local AI matches**. A production competitive system would need an authoritative match service.

If confirmation is unresolved, the pending receipt survives reload and blocks another mint; use Check confirmation or inspect the submitted signature on devnet Explorer before retrying. The UI does not show an NFT as confirmed on a timeout.

## Checks

```sh
npm run build
npm run smoke
npx tsx scripts/tests/events.test.ts
npm run test:integrations
```

The deterministic integration checks do not send transactions and are not evidence of a live devnet mint. Actual wallet approval, metadata availability and confirmed receipts remain separate acceptance steps.

## Sources

- [iDos SDK and MCP](https://idosgames.com/mcp/)
- [Wallet Standard](https://github.com/wallet-standard/wallet-standard)
- [Solana developer skill](https://github.com/solana-foundation/solana-dev-skill)
- [Metaplex Core asset creation](https://www.metaplex.com/docs/smart-contracts/core/create-asset)
- [Metaplex Attributes plugin](https://www.metaplex.com/docs/smart-contracts/core/plugins/attribute)
