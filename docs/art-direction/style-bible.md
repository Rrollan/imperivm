# IMPERIVM — Art Direction (Style Bible)

> Living style guide for every illustrated asset in `public/cards/`, `public/heroes/` and (in 1B) battlefield skins under `public/boards/`. Treat this document as **binding** for all 40 cards, 4 heroes and 3 battlefield skins. If a generated output deviates, fix the source, not the style.
> Per-asset prompt, model and review records live in `/Artifacts/asset-manifest.json`.

## 1. Brand context

IMPERIVM is a Hearthstone-style card battler where **blockchain mechanics ARE the gameplay** (mempool, frontrunning, staking, halving, RUG PULL). The art direction treats the **Solana chain as a Roman empire** — not a literal toga parody, but a cinematic painterly reimagining where Rome's institutions, architecture, iconography and language have been absorbed into a crypto-native imperial court. A Solana native should feel at home; an art director should feel the Hearthstone/Diablo III premium-class fantasy.

Inspirations (do **not** copy): Diablo III card art, Hearthstone premium frames, Magic the Gathering "Theros Magic 'old-toga' decks". Reference their **readability and polish**, not specific IP.

## 2. Palette (binding hex set)

| Role | Hex | Usage |
|---|---|---|
| Imperial violet | `#3B1F6B` | Primary atmospheric tint, mid-tones, robe shadows |
| Obsidian | `#0B0A14` | Deep shadows, background voids, "block" base |
| Rich gold | `#D4A24C` | Laurel, denarii, armor trim, focal highlights |
| Antique gold | `#E8C77A` | Specular gold, hero coin rims, light bloom |
| Marble | `#EDE3D2` | Stone skin tones, statue highlights, parchment |
| Roman red | `#8A1C2B` | Capes, blood accents, rug-pull vignette |
| Turquoise accent | `#3FBFB5` | UI/transaction/mempool motifs, small highlights only |
| Cobalt smoke | `#1A2A4F` | Atmospheric haze, distant architecture |

Composition rules:
- **Violet → obsidian** dominates the mid- and shadow-side of every frame.
- **Gold** is the only allowed specular color for eyes, armor trim, laurels and transaction/symbol motifs.
- **Turquoise** is reserved for **mempool / transaction / chain glyphs** and must occupy < **5%** of the frame.
- **Red** is used sparingly for rugs, blood, and RUG PULL/spell visuals only.
- Avoid pure white, neon green, or modern UI blues. Everything must feel **painted in oil**, not rendered in CSS.

## 3. Motif vocabulary

Every illustration must include at least **two** of the following imperial motifs woven naturally into the scene:
- **Laurel wreaths/crowns** — gold leaves, often framing a portrait or used as a border accent
- **Marble** — columns, busts, plinths, cracked statues, polished floor tiles
- **Gold denarii** — coins stamped with a Solana-style sigil, often falling or stacked
- **Transaction/mempool glyphs** — small turquoise filigree: interlocking rings, chain links, a stylised sigil mark
- **Eagle / imperial standard** — for legendary cards, the Whale hero and high-faction pieces
- **Curved horn / scroll / wax seal** — spell cards may carry a rolled scroll or sealed tablet
- **Sandals-and-cloak warriors** — leather cuirasses, red cloaks, bronze greaves, never modern combat boots

Avoid: modern office tech, screens, glowing white panels, neon typography, anime chibi, blockchain isometric cubes, generic fantasy flames.

## 4. Composition rules

- **Portrait-centered** composition for character cards (subject occupies the central 60% of the frame, looking slightly off-axis).
- **Strong silhouettes** that read at thumbnail size — the card renders at ~180×250 px in-game. The outline of the subject must be recognizable in 64×90 px.
- **Cinematic light**: a single dominant key from the upper left, warm gold rim from the lower right, deep violet falloff into the background.
- **Detailed but uncluttered** — pick **one** focal subject and **two** supporting motifs. No busy collages.
- **Depth**: subject in foreground, atmospheric haze and architecture in mid-ground, dark obsidian/violet void in background.
- **No UI, no frame, no text, no watermark** — every asset is **croppable to the full image bounds**; the in-game frame, cost, stats and name are drawn by the engine on top.
- **Aspect ratio**:
  - Cards: **1024×1536** (portrait, 2:3)
  - Heroes (coin portraits): **1024×1024** (square)
  - Battlefields (1B): **1536×1024** (landscape)

## 5. Card-specific rules

- Subject must be a **legible character or sigil** that visually communicates the card's effect and flavor, not just its name.
  - *Imperator Liquidus* — a regal emperor in violet-and-gold armor, denarii swirling around him like a hurricane, mempool glyphs orbiting his laurel crown.
  - *Genesis PFP* — the **first** minted imperial portrait bust, a marble-and-gold profile statue of an emperor with a turquoise sigil glowing on the cheek.
  - *The Grand Cartographer* — a robed scholar-archivist unrolling a living map that becomes a Solana-style ledger, the map extending past the frame.
  - *FUD Hydra* — a multi-headed hydra with **three** heads (cut one, two more), each head whispering a different fear in stylized morse-code filigree.
- The focal subject must **fill the frame**: from the bottom edge to ~80% of the height, with breathing room above the head.
- Spell cards may use a **floating artifact** (a glowing scroll, a wax-sealed tablet, a falling denarius) as the focal element, with a hint of the casting faction in the background.
- Legendary cards (`imperator-liquidus`, `genesis-pfp`, `the-grand-cartographer`, `rug-pull`) get a subtle **gold vignette** so they read as "boss" pieces; epics get a thinner gold rim, rares and commons no vignette.

## 6. Hero (coin portrait) rules

- Subject is an **imperial-profile bust**: a figure in left-facing or right-facing profile, similar to a Roman aureus coin.
- **Strong laurel crown**, **rich gold armor or robe trim**, **dark violet/obsidian background**.
- The bust occupies the central 70% of the frame, head and shoulders, with breathing room above the laurel.
- **Whale** (this pilot): a regal emperor figure in profile, draped in violet robes, a faint whale-silhouette carved into the laurel — the **market mover**. Cool teal accent on a single denarius.
- **Faction impression**: each hero must hint at a primary faction through costuming — Whale leans **DeFi** (heavy gold, denarii), Builder **DePIN** (tools, blueprints, marble draftsman's desk), Degen **Meme** (chaotic, playful, slightly comical — a jester-emperor), Validator **NFT** (the most classical profile, minting-press motif).

## 7. Battlefield skin rules (defined here for 1B; not used in 1A)

- **Marble**: cool marble colonnade, gold inlays, neutral palette.
- **Lava**: cracked basalt, glowing orange-red fissures, ember motes.
- **Neon**: stylized Solana-cyberpunk palace — turquoise and gold underlighting, violet shadows, modern but still imperial.
- All three must be painted in the same painterly style as cards; **no CSS gradients, no procedural noise placeholders**.

## 8. Quality bar (rejection criteria)

Reject a generation if it has:
- Baked-in text, numbers, letters, watermarks, or a card frame
- A real-world photograph feel or 3D-render CGI look
- More than two focal elements fighting for attention
- Wrong aspect ratio, missing the subject, or a cropped head/limb
- A palette outside the binding hex set (e.g. neon green, pure white)
- Any legible modern brand, logo, real currency, or Hearthstone IP
- Visible compression artifacts or obvious AI glitches (six fingers, melted faces)

## 9. Provenance and reproducibility

Every accepted final asset is logged in `/Artifacts/asset-manifest.json` with:
- `id` (matches file slug)
- `model` (the `gpt-image-2.5-*` family used; both `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare` are **valid finals** under the same GPT Image 2.5 release — flare is the lighter sibling, sunburst is the quality sibling; per-asset final reflects whichever actually produced the accepted frame, never an assumed preference)
- `prompt` (the exact prompt the spec sent)
- `size`, `quality`, `output_format`
- `asset_path` (the repo-relative path under `public/`)
- `raw_path` (the temp source path under `.orchestration/imagegen/raw/`)
- `generated_at` (ISO timestamp)
- `review_notes` (accept / regenerate / reason)

Raw intermediate PNGs and credentials stay under `.orchestration/imagegen/raw/` which is gitignored; **only WebP finals and the manifest** are committed.