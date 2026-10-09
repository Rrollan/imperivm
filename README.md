<div align="center">

# 🏛️ IMPERIVM

**Veni. Vidi. Rugi.**

A Hearthstone-style card battler set in imperial Rome — on Solana. Read the mempool. Build your legion. Empty the rival's Treasury.

[![Live Demo](https://img.shields.io/badge/🎮_Live_Demo-Play_Now-D4A24C?style=for-the-badge)](https://imperivm-git-rebirth-adamrogozhin-7410s-projects.vercel.app/)
![Next.js](https://img.shields.io/badge/Next.js-14-0B0A14?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-3B1F6B?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3B1F6B?logo=typescript&logoColor=white)
![Solana](https://img.shields.io/badge/Solana-devnet-14F195?logo=solana&logoColor=0B0A14)
![License](https://img.shields.io/badge/License-MIT-2C784C)
![i18n](https://img.shields.io/badge/UI-RU_/_EN-D4A24C)

**99 cards · 9 rulers (5 free / 4 from cases) · No wallet required for training**

</div>

---

## 🎮 Gameplay

![IMPERIVM gameplay](readme/gameplay.gif)

*Real autoplay match — minions clash on the marble battlefield*

---

## ⚔️ The chain is the board

Every turn creates a block. Tactical **instant spells** act immediately; **edicts** wait in a public mempool until your next turn, giving the opponent a response window.

| Mechanic | What it does |
| --- | --- |
| **Mempool** | Cast spells resolve at the start of your next turn, in cast order. Both players see the queue. |
| **Orders / Приказы** | Mana crystals, 1→10. Grows each turn. Staked creatures add gas. |
| **Priority** | Instantly counters the most expensive enemy queued spell. Frontrunning as gameplay. |
| **Staking** | A creature earns +1 gas each turn but cannot attack. Still attackable. |
| **Halving** | Creatures gain +1/+1 at block intervals. Both boards tick. |
| **RUG PULL** | The trap card. Clears both boards on resolution. Hold it long enough — or watch **Audit** cancel it. |
| **Taunt / Rush / Lifesteal** | Protect the Treasury. Strike on summon turn. Heal from combat damage. |

Deck **30** · hand **10** · board **5**, expandable to **7** with Agora Expansion. Treasuries start at **30 HP**. Reduce the rival's to zero.

---

## 🃏 Cards & Heroes

Olympus adds six cards with public preparation and conditional arrival effects. All previous cards remain available. See [design, research and validation](docs/research/olympus-design-20261007.md) and [Omni Flash pack 18–25](docs/olympus-vfx/00-START-HERE.md).

All eight Olympus effects are installed; see the [import and validation report](docs/olympus-vfx/IMPORT-20261008.md). The [Agora After Hours expansion](docs/character-expansion-20261008.md) adds 50 pack-exclusive characters with immediate arrival abilities and conditional synergies. Everyone receives 49 free base cards and legal 30-card starters for all nine rulers; expansion deck recipes unlock as cards are collected. Inspect their cards and build decks at `/collection` → **New characters**. Original 49 cards and the separate Genesis NFT manifest are preserved.

Deployment contacts now match the card plane and battlefield spacing. All twelve videos from [VFX pack 26–37](docs/arrival-vfx-26-37/00-START-HERE.md) have been imported: seven landings and two ranged impacts are used in battle; three character appearances are reserved for future cards. See the [import report](docs/arrival-vfx-26-37/IMPORT-20261008.md). Preview/download at `/ui/arena-lab/imperivm-arrival-vfx-26-37/index.html`.


Hearthstone-grade card anatomy: blue mana crystal, oval art portrait, gold name ribbon, parchment rules text, gold attack orb, red health drop. Rarity frames from silver to dragon-claw legendary.

![Battlefield](readme/game.png)

*Unified marble battlefield — no blocks, no panels. Just the game.*

### Heroes — the Wallets

| Ruler | Access | Orders | Power |
| --- | --- | --- | --- |
| **Whale** | Free | 3 | 2 damage to a random enemy fighter, or the rival Treasury if its board is empty. |
| **Builder** | Free | 2 | Heal Treasury 2 and the most wounded friendly fighter 1. Requires useful healing. |
| **Degen** | Free | 2 | Draw 1, take 2 damage. |
| **Validator** | Free | 1 | Reserve 2 orders for the start of the next own turn, above capacity. |
| **Strategist** | Free | 2 | Summon a fresh Pixel Squire 1/1 in an empty slot; no arrival effect. |
| **Athena** | Case | 3 | Lowest-health ally gets +1/+1 and Taunt; +1/+2 with another established NFT ally. |
| **Hermes** | Case | 2 | Draw 1, take 3 damage; no damage after playing a DePIN card this turn. |
| **Hephaestus** | Case | 3 | Summon a Legionnaire 2/2, or 3/3 with an established staked ally. |
| **Poseidon** | Case | 4 | Damage all enemy fighters 1, or 2 after two DeFi plays this turn. |

All powers are once per turn. All rulers start at 30 HP with the same formation limit. Tied targets use formation order. The second player receives one temporary extra order in their first turn; it does not increase capacity. Existing saved decks and all 99 card definitions are preserved.

Phone battles use **landscape**: full-width scenery, portrait court tiles with attack/health and readiness, and larger hand cards. Tap to inspect full rules, tap a ready fighter then a target, or drag. In portrait the rotation prompt covers the battlefield. `/arena-lab/embed-preview` provides a real 1280px iframe harness; `?screen=phone` uses 844×390.

See [implementation, measurements and remaining limits](docs/design/arena-refresh-20261009/README.md). The [Flow loading-background kit](public/ui/loading/imperivm-arena-loading-flow.zip) contains START/END/PROMPT. Preview at `/arena-lab/loading-preview`.

![Choose your hero](readme/landing.png)

### Arena

![Arena gates](readme/arena.png)

*Training and free online 1v1 share the imperial arena. Private rooms and matchmaking use the authoritative WS service; see [server/README.md](server/README.md).*

---

## 🚀 Quick start

**Node.js 20+**

```sh
npm ci
npm run dev
```

Open **http://localhost:3000** — no wallet, no env file, no setup. Pick a hero and play.

```sh
npm run build    # production build
npm start        # serve production
npm run smoke    # full AI match, 256 regression groups and presentation checks
```

---

## 🏗️ Project structure

```text
app/                Routes — landing, arena, game, collection, packs
components/         Cards, board, effects, dialogs, wallet UI
components/3d/      Lazy GLB accents (coins, trophy, column) with 2D fallbacks
lib/engine/         Pure TypeScript game rules — deterministic, tested
lib/solana/         Devnet guards, proof verification, NFT flows
lib/collection/     iDos gateway + local browser fallback
public/             Card art, hero coins, marble battlefields
scripts/            Smoke tests, content validation, regressions
readme/             Screenshots & GIFs for this README
```

---

## 🌐 Demo & chain status

**🎮 [Play the live demo](https://imperivm-git-rebirth-adamrogozhin-7410s-projects.vercel.app/)** — Vercel preview, no login needed.

| Layer | Status |
| --- | --- |
| **Local game** | ✅ Full AI matches, 9 rulers, 99 cards, demo packs, owned deck builder |
| **Solana** | 🧪 Devnet only. Phantom connect, proof-of-play signatures |
| **NFTs** | 🧪 Metaplex Core collection + Candy Machine coded, not yet live-minted |
| **iDos** | 🧪 Typed adapter ready, no Title created yet |
| **PvP** | ✅ Authoritative free online 1v1; paid entitlements require configured iDos |
| **Mainnet checkout** | 🧪 Prepared, disabled until configured and verified |

> Local demo IMP has no cash value. Live IMP is a closed-loop iDos virtual currency, not an SPL token. SOL/USDC top-up code is prepared, disabled until the Title and live checkout are verified. See the [economy setup](docs/economy-idos-rug.md).

---

## 📜 License

[MIT](LICENSE) — built for the Crypto World's Fair Hackathon.

<div align="center">

**Veni. Vidi. Rugi.** 🏛️

*The forum will remember.*

</div>
