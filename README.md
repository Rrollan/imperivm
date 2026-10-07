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

**49 cards · 4 heroes · No wallet required**

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


Hearthstone-grade card anatomy: blue mana crystal, oval art portrait, gold name ribbon, parchment rules text, gold attack orb, red health drop. Rarity frames from silver to dragon-claw legendary.

![Battlefield](readme/game.png)

*Unified marble battlefield — no blocks, no panels. Just the game.*

### Heroes — the Wallets

| Hero | Title | Power (2 gas) |
| --- | --- | --- |
| 🐋 **Whale** | The Market Mover | *Market Dump* — 2 damage to a random enemy |
| 🔨 **Builder** | The Shipwright | *Deploy Patch* — restore 3 Treasury HP |
| 🚀 **Degen** | The Aped | *Aped In* — draw a card, take 2 damage |
| ⛓️ **Validator** | The Block Keeper | *Validate* — gain 2 gas this turn |

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
npm run smoke    # full AI match + 61 regression groups
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
| **Local game** | ✅ Full AI matches, 4 heroes, 41 cards, demo packs, deck builder |
| **Solana** | 🧪 Devnet only. Phantom connect, proof-of-play signatures |
| **NFTs** | 🧪 Metaplex Core collection + Candy Machine coded, not yet live-minted |
| **iDos** | 🧪 Typed adapter ready, no Title created yet |
| **PvP / Mainnet** | 🔜 Future work |

> `$RUG` is a demo currency with no cash value. Not an SPL token.

---

## 📜 License

[MIT](LICENSE) — built for the Crypto World's Fair Hackathon.

<div align="center">

**Veni. Vidi. Rugi.** 🏛️

*The forum will remember.*

</div>
