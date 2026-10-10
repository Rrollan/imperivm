# IMPERIVM

[![CI](https://github.com/Rrollan/imperivm/actions/workflows/ci.yml/badge.svg?branch=rebirth)](https://github.com/Rrollan/imperivm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-mainnet_IMP-14F195)](https://explorer.solana.com/address/7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos)

An imperial browser card battler where crypto culture becomes tactics. Read a public spell queue, build faction combinations and defeat the rival Treasury. Training is free and works without a wallet.

**[Play](https://idosgames.com/app/SI4IPS8B/) · [Demo video](https://youtu.be/qCE7RaiwSAQ) · [Founder pitch](https://youtu.be/EQX3xrAf2e4) · [Documentation](docs/product.md) · [Colosseum submission](https://colosseum.com/arena/projects/pichat)**

![IMPERIVM training match](readme/current/battle.jpg)

## Hackathon submission

Built for the 2026 Crypto World's Fair Hackathon and the Superteam Kazakhstan × iDos Games side track. Colosseum submission is **Submitted**; the Superteam application is submitted and its Colosseum answer has been updated to Yes. iDos displays the entry as accepted in its leaderboard. These are submission states, not judging results.

**Current source: [`rebirth`](https://github.com/Rrollan/imperivm/tree/rebirth).** This repository follows the documentation structure of the [Colosseum example](https://github.com/Marakaya/colosseum_example), retaining its working Next.js application and separate Node service.

| Name | Role | Contact |
| --- | --- | --- |
| Rollan Rogozhin | Founder & Developer | [GitHub](https://github.com/Rrollan) |

[Application packet and verified status](docs/hackathon-20261009/APPLICATION.md)

## Problem and solution

- Wallet setup can interrupt a player's first experience. IMPERIVM offers a complete free training match before sign-in.
- Collectible games need useful gameplay beyond collection. Public delayed edicts, immediate spells and faction combinations give players tactical decisions.
- Wallet holdings and in-game balances are easy to confuse. The interface labels Phantom IMP and deposited iDos IMP separately; buying tokens and depositing are explicit actions.
- A shared card market needs reliable pricing evidence. Completed iDos sales provide weighted reference prices, with verified history stored in Supabase.

## Why Solana

IMPERIVM uses Solana for wallet identity and its mainnet SPL token, **IMP**, with six decimals. The iDos SDK handles native deposits, withdrawals, paid packs and marketplace settlement. Players can buy IMP with SOL through Jupiter; the purchased tokens first arrive in Phantom.

Mint: [`7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos`](https://explorer.solana.com/address/7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos).

Game turns and the spell queue are game mechanics: they do not send chain transactions. Free matches have no wager. Experimental Metaplex Core devnet badges are disabled by default and have no verified live mint.

## Features

- **99 cards:** 49 free base cards and 50 pack-exclusive characters; DeFi, NFT, DePIN and meme factions.
- **Nine rulers:** five free, four from cases; tested powers and legal starter decks.
- **30-card deck workshop:** ownership filters, search, copy limits, cost curve and saved decks.
- **Imperial Babylon.js arena:** landscape phone support, targeting, fighter readiness and compact card previews.
- **Free multiplayer:** private duels and random matchmaking, with authoritative server rules and reconnect support.
- **Wallet account:** nickname and avatar, server-authenticated session restoration without replaying a signature on every visit.
- **IMP economy:** five-card packs cost **100,000 IMP**, ruler cases **900,000 IMP**. The paid legendary chance is **0.0001% per whole pack** (one in a million); demo probabilities and currency are separate.
- **Card marketplace:** native iDos listings, buying, cancellation, ownership reservation and completed-sale price history.
- **Russian / English interface.**

![Deck workshop](readme/current/deck-builder.jpg)

## Verification and limits

The owner confirmed wallet sign-in, SOL → IMP purchase, a real deposit that persists after reload, and opening a paid pack. Free PvP was checked with two independent clients. Automated integration tests cover account isolation, exact token amounts, uncertain-payment recovery and native marketplace contracts.

Two-wallet marketplace settlement and withdrawals have **not** been confirmed in a live owner test. The iframe listing-button fix has been verified in a sandbox without `allow-forms`; session restoration has regression tests. Actual wallet signing and financial confirmations remain player actions. [Release evidence](docs/idos/public-release-20261010.md).

Local demo IMP is browser test currency with no cash value. Mainnet IMP in Phantom and the deposited iDos game balance are separate. Check the current iDos withdrawal waiting period and fees before depositing.

## Tech stack

| Layer | Technology |
| --- | --- |
| Web UI | Next.js 14, React 18, TypeScript, CSS modules / Tailwind |
| Arena | Babylon.js; painted WebP card previews and detailed artwork |
| Rules | Deterministic TypeScript engine shared by client and server |
| Multiplayer | Node.js 22, WebSocket authority on Render |
| Wallet / economy | Wallet Standard, Phantom, Solana web3.js, iDos SDK, Jupiter |
| Persistent sale history | Supabase; server-side verification of completed iDos deals |
| Delivery | Next.js production build and Vite static game hosted on iDos |

## Architecture

```text
Browser game ── game actions ──> Node WebSocket authority
     │                                 │
     │ official SDK                    │ verified sale history
     ▼                                 ▼
 iDos identity, Items, market       Supabase
     │
     └── confirmed transfers ──> Solana mainnet IMP

Phantom ── player-approved Jupiter swap ──> IMP in Phantom
```

The server validates gameplay and pack-card ownership. iDos owns the money ledger and native market contracts. Supabase stores sale statistics, not a replacement balance ledger. [Architecture](docs/architecture.md) · [API](docs/api.md).

## Quick start

Requires **Node.js 22+** and npm. From the repository root:

```sh
npm ci
NEXT_PUBLIC_IDOS_TITLE_ID=YOUR_TITLE_ID npm run dev
```

Open **http://localhost:3000**. The placeholder Title ID explicitly selects local demo mode; no wallet or backend credentials are needed. Local demo packs cost 50 demo IMP and cases cost 200.

For a configured integration, copy [.env.example](.env.example) to `.env.local`, edit public configuration IDs and restart. Server secrets belong only on the server. See [iDos setup](docs/idos/SI4IPS8B-integration.md).

For local multiplayer, use two terminals:

```sh
npm ci --prefix server
npm run dev --prefix server
```

```sh
NEXT_PUBLIC_IDOS_TITLE_ID=YOUR_TITLE_ID NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3102 npm run dev -- -p 3101
```

Open **http://127.0.0.1:3101/play?mode=friend** in two independent tabs. [Server setup and protocol](server/README.md).

### Build and checks

```sh
npx tsc --noEmit
npm run smoke
npm run test:integrations
npm run build
npm start
```

`npm run build:idos` creates the static game in `dist/idos`; it does not publish automatically. Production upload uses official iDos build tooling and retained asset manifests. [Deployment notes](docs/idos/public-release-20261010.md).

```sh
npm run test --prefix server
npm run build --prefix server
```

## Repository structure

```text
app/                 Next.js pages and API routes
components/          Arena, cards, market, profiles and wallet UI
lib/engine/          Shared deterministic rules
lib/idos/            Auth, Items, transfers, marketplace and receipt recovery
lib/solana/          Token reading, signatures and disabled devnet experiments
server/              Authoritative rooms, RPC relay and verified market history
supabase/migrations/ Sale-history schema
platform/idos/       Static entry point and retained asset manifests
public/              Artwork, audio and native UI assets
scripts/             Builds and regression checks
readme/              Current screenshots and historical captures
docs/                Product, architecture, API, roadmap and submission evidence
```

## Roadmap

- [x] Free AI training, nine rulers and 99 cards.
- [x] Deck workshop, free private duels and random matchmaking.
- [x] Mainnet IMP balance, swap, deposit and paid pack verified by owner.
- [x] Native card-market integration and persistent completed-sale statistics.
- [ ] Verify listing, purchase and settlement with two independent wallets.
- [ ] Verify withdrawal and recovery with an eligible iDos account.
- [ ] Continue performance and accessibility checks on lower-powered phones.

[Detailed roadmap](docs/roadmap.md) · [Contributing](CONTRIBUTING.md)

## Resources

- [Public game](https://idosgames.com/app/SI4IPS8B/)
- [Demo walkthrough](https://youtu.be/qCE7RaiwSAQ) and [founder pitch](https://youtu.be/EQX3xrAf2e4)
- [Colosseum project](https://colosseum.com/arena/projects/pichat)
- [Superteam side track](https://superteam.fun/earn/listing/superteam-kazakhstan-x-idos-games-side-track)
- [iDos contest leaderboard](https://idosgames.com/contest/solana-superteam-kz/?tab=leaderboard#row-SI4IPS8B)
- [Artwork loading verification](docs/design/card-loading-20261010/README.md)
- [Rules](docs/mechanics.md) and [ruler / expansion design](docs/character-expansion-20261008.md)

## License

[MIT](LICENSE). AI-assisted code and artwork are documented in the project media and design notes.
