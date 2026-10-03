# Rules added to IMPERIVM

The engine remains pure TypeScript. Existing action variants and required public
fields are preserved; new keyword and bookkeeping fields are optional.

| Rule | Behavior |
| --- | --- |
| Taunt | Attacks must hit an enemy Taunt minion first. Staked Taunt still protects. Spells ignore Taunt. |
| Rush | Attack enemy minions on the summon turn; attack Treasuries from the next own turn. Staking still prevents attacks. |
| Lifesteal | Combat damage heals the dealer's Treasury by actual health removed, capped at 30. Retaliation and fatal attackers count. |
| Pavilion | The second card of a faction played in your turn refunds 1 gas, once per faction. Resolving spells does not count. |
| Comeback | Hero power costs 1 when your Treasury is at most 12 and the opponent has at least 12 more HP. Once per turn still applies. |
| Mulligan | Optional opening-hand replacement. Keep or select cards once; replacements are drawn before rejected cards return to the deck. |
| Audit | New DeFi rare spell, 3 gas. Immediately counters the highest-cost enemy queued spell; next own turn gives your minions +1/+1. |

Taunt: Profile-Pic Phalanx, Hotspot Hoplite, Impermanent Guard.
Rush: Blue-Chip Basilisk. Lifesteal: Liquidation Officer.
All original 40 card IDs remain; Audit is card 41. Each starter deck remains 30
cards, with at most two copies and one copy of each legendary.

## Mulligan API

```ts
createGame(heroA, deckA, heroB, deckB, { enableMulligan: true }, seed);
applyAction(state, { type: 'mulligan', uids: [] }); // keep
```

The original fifth numeric seed argument still works with mulligan disabled.
While a selection is pending, `legalActions` lists every legal subset (including
keep) and blocks other actions. P0 chooses from three opening cards. P1 chooses
from four at block 2; completing that choice performs the normal first-turn draw
and gas refill once, in the same block. Invalid, repeated or duplicate picks
throw. Optional `mulliganCount` limits replacement count to an integer from 0–4.

## Preserved core rules

Treasuries start at 30. Board cap 7; hand cap 10 with overflow burn. Gas capacity
grows to 10; staked minions add gas on turn start. Unstaking prevents attacking
that turn. Own queued spells resolve in cast order at the start of the next own
turn, before halving, refill and draw. Priority counters highest cost, breaking
ties by earliest cast. Frontrun Bot retains both its battlecry and priority
counter. RUG PULL destroys both boards. Empty draws cause increasing fatigue.

## Verify

- `npm run build`: strict production build.
- `npm run smoke`: baseline AI match plus 61 deterministic regression groups,
  including 48 bounded matches covering all hero pairings and three seeds.
- `npx tsx scripts/validate-content.ts`: card, hero and deck invariants.

AI is a greedy heuristic. Balance has deterministic rule coverage but still
needs human playtesting. No quests, arena draft, network PvP or payouts are
implemented by this package.
