# IMPERIVM — *Veni. Vidi. Rugi.*

> A Hearthstone-style card battler on **Solana** where blockchain mechanics **ARE** the gameplay.

You are the emperor of your own chain. Spells sit in a **mempool** and resolve next block — frontrun them with priority fees. Every turn mints a block; **halving** cards grow stronger. **Stake** creatures for gas, dodge **RUG PULL** traps. Empty the enemy Treasury to win.

Built for the **Crypto World's Fair Hackathon** (Colosseum) — tracks: *iDos Games*, *Superteam Kazakhstan*, *Solana*.

---

## ✨ What makes it different

| Blockchain concept | Game rule |
|---|---|
| **Mempool** | Spells don't resolve instantly — they enter the mempool and resolve at the start of your next turn. Your opponent sees them coming. |
| **Frontrunning** | *Priority* cards counter the most expensive enemy spell sitting in the mempool. |
| **Block height** | Every turn = a new block (`BLOCK #n`). *Halving* cards gain +1/+1 every N blocks. |
| **Staking** | Lock a minion: it can't attack, but yields +1 gas per turn. Unstake anytime. |
| **RUG PULL** | A legendary spell that destroys **all** minions on the board. |

## 🃏 Content

- **40 cards** across 4 fair pavilions (factions): **DeFi**, **NFT**, **DePIN**, **Meme** — each with unique art
- **4 wallet-heroes** with hero powers (2 gas, once per turn):
  - 🐋 **Whale** — *The Market Mover* (40 HP)
  - 🛠️ **Builder** — *The Protocol Dev* (35 HP)
  - 🤪 **Degen** — *The Aped* (30 HP)
  - 🛡️ **Validator** — *The Chain Guardian* (45 HP)
- **4 pre-built 30-card decks**, one per hero
- **Pack opening** screen (mock — 5 cards with reveal animation)
- **AI opponent** with greedy heuristics: mana curve, favorable trades, mempool counterplay, staking

## 🎮 Rules (60 seconds)

- **Treasury: 30 HP.** Reduce the enemy Treasury to 0 to win.
- **Gas: 1 → 10**, refills each turn (+1 per staked minion).
- Deck 30 cards · hand max 10 (overflow burns) · board max 7 minions.
- Minions can't attack the turn they're played. Staked minions can't attack.
- Spells go to the **mempool** first — they resolve next turn.
- Empty deck → fatigue: your Treasury takes 1, 2, 3… damage.

**Controls:** drag a card onto the board (or tap → Play) · drag your minion onto an enemy to attack · mobile: tap a card to zoom.

## 🚀 Run it

```bash
npm install
npm run dev      # → http://localhost:3000
```

```bash
npm run build    # production build (must pass clean)
npm run smoke    # headless AI-vs-AI match to victory
```

**No wallet needed** — the game is fully playable in demo mode. The Phantom button (devnet) is optional.

## 🧱 Tech

- **Next.js 14** App Router · **TypeScript** strict · **Tailwind CSS**
- **@dnd-kit** — touch-friendly drag & drop
- **Framer Motion**-style CSS keyframe animations (deal, attack lunges, damage numbers, VICTORIA / RUGGED screens)
- **@solana/web3.js** + wallet-adapter (Phantom, devnet) — connection only, no on-chain game logic in this build
- Game engine: `lib/engine/` — pure TypeScript, ~50 simulation asserts

## 📁 Structure

```
app/                    landing (/), game board (/game), packs (/packs)
components/             CardView (3D tilt cards), dnd.tsx, battleFx.ts, …
lib/engine/types.ts     engine contract — do not break
lib/engine/engine.ts    turns, mempool, staking, halving, RUG PULL
lib/ai.ts               AI opponent
lib/cards.ts            40 cards · lib/heroes.ts · lib/decks.ts
public/cards/           40 unique card arts + card back
public/heroes/          4 hero coin portraits
scripts/smoke.ts        AI-vs-AI headless match · validate-content.ts
```

📖 Full game design: [`GAME_DESIGN.md`](./GAME_DESIGN.md)

## 🗺️ Roadmap

- [ ] PvP matchmaking (live multiplayer)
- [ ] NFT minting of cards; packs purchasable with `$RUG` via iDos bonding curve
- [ ] Sound design (procedural Web Audio SFX)
- [ ] Draft / Arena mode
- [ ] Mainnet deployment (currently demo/devnet only)

## 📜 License

MIT — see [LICENSE](./LICENSE).
