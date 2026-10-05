# Генерация арта IMPERIVM

## Кристалл газа в гнезде

Файл: `public/ui/arena-lab/gas-socket.webp`, 384×384, alpha сохранена. Исходник: `exec-a558711d-6113-479c-8865-4492c9e0a94f.png`, встроенный `image_gen.imagegen`.

Use case: stylized-concept. Asset type: production game HUD sprite, single resource gemstone for a Roman fantasy card battler IMPERIVM. A single polished turquoise emerald-blue crystal, wide six-sided faceted diamond viewed almost directly from above, seated flat inside a shallow round aged-bronze bezel with a restrained carved laurel edge. One compact circular object on transparent background, centered, occupies 82 percent of square canvas. Rich hand-painted fantasy game illustration, broad readable facets, tactile bevels, warm key light from upper left, dark teal underside, pale cyan glint along upper left facet, no excessive bloom, no surrounding scenery or text. Should read clearly at 36 pixels. Not a cluster, not a vertical tower, not jewellery, not glossy plastic, no numbers, no letters, no symbols, no UI panels. Balanced round silhouette for an inset resource socket on a walnut and bronze Roman game board. Output actual alpha transparency.

Эффекты для Flow и точные prompts: `docs/flow-vfx/frames.json` и `docs/flow-vfx/BRIEF.md`.

Инструмент: встроенный `image_gen.imagegen`. PNG-оригиналы сохранены в Codex; в проекте — WebP без изменения композиции. Текст интерфейса не запечён в изображения.

## Общая арена

Файл: `public/ui/arena-lab/roman-board.webp`.

Use case: stylized-concept. Asset type: production background plate for a premium browser collectible-card-game arena named IMPERIVM. Make an original, art-directed, hand-painted 2.5D Roman imperial game board with the tactile material quality, intuitive physical sockets and beautiful composition of a premium Hearthstone-like card battle, but Roman setting, no Warcraft designs. Landscape 16:10, 1600x1000 composition. A cohesive rectangular tabletop viewed almost overhead with a slight perspective, rich dark carved walnut and aged bronze frame, softly sunlit ivory sand playing court in the center. The quiet playing court occupies x=210..1360 y=200..760, generous smooth empty space for two rows of live game pieces, subtle warm gradients, NO tile grid and NO noisy coarse cracks. Outer scenery is rich but contained entirely along the edges: upper left small Roman marble portico and dark cypress with muted sage foliage, upper right carved marble steps and laurel engravings; lower left folded deep burgundy cloth and a few denarii, lower right a recessed teal-enamel resource trough with five empty circular cups. Paint no separate heroes, units, cards or props such as hourglass, chest, brazier: real 3D models will occupy these spaces. Important blank physical sockets built into the table: a round bronze hero socket centered at (800,155), diameter 145; matching round socket centered at (800,715), diameter 145, with burgundy velvet inside. A smaller power socket centered at (1000,715), diameter 95. A command dock on the right edge around x=1450,y=485, 170x80, a blank dark walnut plaque with a thick bevelled aged bronze rim, no words. A small pedestal above it at (1450,350), for a future hourglass model. A clock socket at (145,190). Deck niche at (1440,195). Empty hand shelf across the lower middle x=350..1230,y=875, dark curved walnut, no cards. The tabletop fills nearly the image; a dark, subtly painted surrounding Roman room is visible around its rounded silhouette. Warm directional light from upper left, soft contact shadows, sculpted rounded edges, saturated yet restrained burgundy/sage/ivory/bronze palette. Painterly premium game art, coherent scale, absolutely not photoreal and not crude flat geometric boxes. Clear silhouettes, calm center, detailed corners, no repeating texture. Every interface socket feels carved into a single physical object. No text, no numbers, no lettering, no logos, no card illustrations, no UI overlay, no floating rectangles, no modern software panels.

## Материал бумажных меню

Файл: `public/ui/arena-lab/playing-surface.webp`.

Use case: stylized-concept. Asset type: a single albedo texture for the recessed playing surface of an original Roman collectible-card-game arena, to be applied to real 3D geometry. Primary request: premium hand-painted fine warm sand over polished pale sandstone, with softly brushed tonal variation like a beautiful illustrated game board. Composition: orthographic straight overhead, wide landscape 2:1, the entire image is ONLY the surface, full bleed. Warm ivory and muted honey in the quiet center, subtly darker warm ochre edges, a very faint worn embossed circular Roman laurel mark in the middle. The mark is delicate, almost invisible, low contrast. Lighting is diffuse and even, no baked directional cast shadows. Texture scale is fine, calm, smooth enough for readable cards; no coarse noisy grit. Painterly stylized craftsmanship, warm welcoming tactile material. Constraints: no objects, no frame, no table, no perspective, no characters, no cards, no typography, no numbers, no cracks, no tile grid, no marble veins, no buttons, no interface. It is a material texture, not a screenshot.

## Медальоны сил героев (fallback)

Файл: `public/ui/arena-lab/power-medallions.webp`.

Create an original premium hand-painted game UI asset atlas for IMPERIVM, an ancient Roman strategy card game. Transparent background. Exactly four separate ROUND bronze hero-power medallions arranged in a perfectly regular 2 by 2 square grid, each disk fully contained in its tile, large transparent padding, all identical diameter and front-facing camera angle, no perspective. Top left: a Roman builder's iron hammer over a small carved arch. Top right: a stack of Roman denarius coins with a restrained laurel. Bottom left: a worn ivory Roman gambling die, dramatic crimson enamel behind it. Bottom right: a Roman judicial seal with balanced scales and teal enamel. Thick sculpted aged bronze rims, small engraved Roman meander details, strong painted bevels, warm upper-left lighting, rich walnut shadows, readable silhouettes at small game UI size, subdued jewel color, tactile artisan finish matching a bronze and travertine Roman tabletop. Each disk includes its own internal dark background; the areas outside all four disks are fully transparent. No letters, no numbers, no text, no captions, no watermark, no outer board. Do not imitate Warcraft icon art or logos.

## Командная табличка

Файл: `public/ui/arena-lab/turn-command.webp`. Используется для кнопок меню и fallback.

Сохранённый brief ранней генерации: blank front-facing Roman bronze and dark walnut command plaque, heavy rounded bevel, restrained meander/laurel, upper-left warm light, calm center for live text, transparent background, no lettering or logos. Точный исходный prompt этой ранней генерации не сохранён.

## Вертикальная арена

Файл: `public/ui/arena-lab/roman-board-portrait.webp`, 1000×1400. Встроенный image_gen; горизонтальная арена использована как референс материалов. Новый рисунок пересобирает физические гнёзда под 5:7, без растягивания старого стола. Точный prompt и исходник: `portrait-board.json`.
