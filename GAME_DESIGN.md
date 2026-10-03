# IMPERIVM — Game Design Document

> Living design doc for contributors and AI agents. Facts first, proposals second.
> Engine contract: `lib/engine/types.ts` · implementation: `lib/engine/engine.ts`.

## 1. Vision

IMPERIVM is a card battler where **you don't play *with* crypto theme — you play *with* blockchain mechanics**. Every crypto-native concept (mempool, frontrunning, staking, halving, rug pulls) is a first-class game rule, not flavor text. A Solana native should feel at home; a Hearthstone player should learn the rules in 60 seconds.

**Design pillars:**
1. **Chain is the board.** Turns are blocks, spells are transactions, the mempool is public.
2. **Information is a weapon.** You see enemy spells before they resolve — counterplay is the core skill.
3. **Greed has a price.** Staking, frontrunning and RUG PULL are all tempo-vs-value gambles.
4. **Emperor fantasy.** You are not a planeswalker — you are the chain's emperor. Treasuries, legions, triumphs.

## 2. Core loop

`Draw → gain gas → play minions/spells → attack → stake/unstake → END TURN (mint block) → mempool resolves → repeat` — until a Treasury hits 0.

## 3. Current mechanics (implemented, tested)

### 3.1 Gas (mana)
- Starts at 1, grows +1 per turn, cap 10. Refills fully each turn.
- Each **staked** minion adds +1 gas per turn.
- Card costs are paid in gas; unspent gas is lost (no banking — keeps turns snappy).

### 3.2 Mempool & priority (the signature mechanic)
- Spells cast from hand go to the **mempool** and resolve at the start of the caster's **next** turn.
- Both players see the mempool. This creates a full turn of counterplay.
- **Priority** cards (e.g. *Frontrun Bot*): Battlecry removes the highest-cost enemy spell from the mempool. Frontrunning as removal.
- Design note: the mempool turns every spell into a *telegraphed threat* — the skill is reading it.

### 3.3 Block clock & halving
- Turn number = block height, shown as `BLOCK #n`.
- **Halving** cards gain +1/+1 every N blocks (e.g. every 4). They reward long games and demand answers.

### 3.4 Staking
- Action: stake a friendly minion → it can't attack or be attacked(?), yields +1 gas/turn.
- Unstake is free; the minion can attack next turn.
- Tension: board presence *vs* economy. Staking a big minion to ramp is the "greed" play.

### 3.5 RUG PULL
- Legendary spell, 8 gas: **destroy ALL minions** (both sides).
- The ultimate reset button. Holding it is strong; playing it badly loses tempo.

### 3.6 Combat & zones
- Deck 30 · hand ≤ 10 (overflow burns) · board ≤ 7 · Treasury 30 HP.
- Minions have summoning sickness (can't attack the turn played).
- Fatigue: drawing from empty deck deals 1, 2, 3… to own Treasury.
- Attacks: minion → minion (both deal damage) or minion → enemy hero/Treasury.

### 3.7 Heroes (wallets as characters)
| Hero | HP | Hero power (2 gas, 1×/turn) | Fantasy |
|---|---|---|---|
| Whale | 40 | *Market Dump* — deal 3 to a minion | The Market Mover |
| Builder | 35 | *Deploy Patch* — give a minion +2 HP | The Protocol Dev |
| Degen | 30 | *Ape In* — draw a card, take 2 | The Aped |
| Validator | 45 | *Attest* — restore 4 Treasury HP | The Chain Guardian |

### 3.8 Factions (fair pavilions)
- **DeFi** — value engines, staking synergy, big late-game.
- **NFT** — unique effects, halving growers, collectible feel.
- **DePIN** — board-wide infrastructure, swarm/utility minions.
- **Meme** — chaos, randomness, burst (FUD Hydra, GM Greeter…).

### 3.9 AI
Greedy heuristic: plays on-curve, takes favorable trades, uses hero power, counters mempool with priority when valuable, stakes surplus minions. Never gets stuck in pass loops.

## 4. UX principles (binding)

- **Mobile-first.** 390px wide must be fully playable: readable cards, no overlaps, big tap targets.
- **Drag & drop** (@dnd-kit) is primary input; tap/click is fallback.
- **Teach in 3 steps.** First-game overlay: play a card → attack → empty the Treasury.
- **Every mechanic must be discoverable** via tooltip or hint — no hidden rules.
- **Juice everything:** deal animation, attack lunge, damage numbers, death fade, mempool resolve flash, VICTORIA/RUGGED screens.
- **Sound:** all SFX via Web Audio API (procedural, no assets) + mute toggle. *Not yet implemented — open task.*
- **Reduced motion** respected (`prefers-reduced-motion`).

## 5. Proposed improvements (for contributors — pick up, refine, don't treat as gospel)

### Mechanics depth
1. **New keywords:** *Taunt* (must be attacked first), *Rush* (can attack immediately), *Lifesteal* (damage heals your Treasury). Start with Taunt — it fixes "face race" degeneracy.
2. **Pavilion synergy:** playing 2+ cards of the same faction in one turn grants a small bonus (e.g. +1 gas next turn). Rewards deck identity.
3. **Comeback valve:** if your board is empty while the enemy has 3+ minions, your hero power costs 1 less. Prevents snowball losses feeling hopeless.
4. **Mulligan:** redraw opening hand once before turn 1. Standard, expected.
5. **Audit (counter-RUG):** a 3-gas spell that protects your board from the next board-clear. Creates RUG PULL mind games.
6. **Quests:** each hero gets a secret quest (e.g. Whale: "stake 5 minions") rewarding a powerful card. Gives long-term direction per match.
7. **Draft/Arena mode:** pick 1 of 3 cards × 15 rounds, then play. Uses the pack-opening UI. Huge replayability for little code.

### Presentation
8. **Regenerate card art** in one premium style (the current 40 are placeholders of varying quality). Keep `public/cards/<id>.webp` naming.
9. **Sound design:** card play *thwip*, attack *clang*, mempool *bubble*, victory *triumph horns* — all procedural Web Audio, ~15 SFX + mute.
10. **Board personalization:** pick battlefield skin (Marble / Lava / Neon). Cheap, high delight.
11. **Emote system:** 4 emperor emotes per hero ("Veni. Vidi. Rugi."). For future PvP.

### Tech
12. Keep `npm run build` green and `npm run smoke` passing after every change.
13. No on-chain game logic in this repo yet — wallet stays optional (demo mode). Any token/NFT work goes through the iDos flow (see hackathon docs), not into the engine.

## 6. Balance notes
- Aggro (Degen/Meme) vs control (Validator/DeFi): watch turn-5 kill potential; RUG PULL at 8 gas is the control valve.
- Staking economy: +1 gas/minion/turn is strong — if ramp dominates, cap staked minions at 3.
- Priority cards must stay slightly understatted — their value is the counterplay.

## 7. Hackathon compliance (do NOT break)
- **Claim only what's real:** devnet demo, AI opponent, mock packs. No "mainnet", no "live PvP", no "NFT minting" as shipped features — those are roadmap.
- Submission needs: public GitHub repo (this), demo video ≤ 3 min, pitch video ≤ 2 min, Solana as chain.
- Keep the build one-command: `npm install && npm run dev`.
