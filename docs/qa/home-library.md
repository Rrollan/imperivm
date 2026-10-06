# Home and library acceptance

Updated 2026-10-06. The homepage is the entry to battle, reference material, and the existing collection flow. No online population or fabricated match state appears here.

## Routes and data

- `/`: real 43-card count and 4 rulers; selected ruler is carried into `/arena?hero=…`. The default is Builder, and a validated selection is saved in this browser.
- `/library`: every card from `CARDS`, sorted by orders, with name/ability search, faction, type, and rarity filters. Instant vs. queued edict is derived from `isInstantSpell`, never inferred from card text.
- `/library#rulers`: all 4 real ruler powers from `powerRules`, their costs, once-per-turn rule, and 30-card preset decks. Each ruler has a functioning battle link.
- `/library#rules`: core game decisions, controls, and the real mechanic glossary. Instant spells and delayed edicts are explained separately.
- `/packs` and `/collection` remain the existing real collection flows. Free preset combat is explicitly independent of packs, wallets, and optional devnet NFT features.

## Interaction acceptance (browser verification owned by root)

- Choose each ruler on home; ability and Play/Continue href follow the selection.
- RU/EN switch changes every label, card face, rule, and dialog; headings use the existing Cyrillic Roman font.
- Inspect any home/library card; a native modal opens at its original 384×672 aspect ratio. No horizontal artwork container adds black fields.
- Modal close icon, Escape, and backdrop close the modal. Native focus containment works; close restores the opener. Body scroll state is restored.
- Library type filter shows 5 instant cards, 4 delayed edicts, and 34 fighters; combining filters never alters the catalogue. Search includes localized and English card names, game abilities, roles, and factions.
- A no-result search offers a working reset. Active filters survive switching reference sections.
- Sections work via hash deep links and browser hash changes. Library and home links remain keyboard accessible; controls have at least 44 px touch height.
- Widths 320, 390, 768, and 1280: no horizontal scroll, no clipped button text, readable card previews, scrollable modal contents. Reduced motion follows both OS and game setting.

## Implementation limits

This change introduces no ownership gate, rarity advantage, fake matchmaking, sale, or new combat rule. Existing CardView, global card frames, resource crystals, native assets, and README are untouched. Match mode availability and network behavior belong to the arena entry flow.
