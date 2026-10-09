# Painted aiming assets

Generated with the built-in ImageGen tool, transparent background enabled. Style reference: `public/ui/arena-lab/native/roman-board-ten-orders.webp`. Originals and optimised runtime files are in `public/ui/arena-lab/native/aim-v2/`.

## Spearhead

Use case: stylized-concept. Asset type: production transparent aiming arrow spearhead sprite for IMPERIVM Roman card game. Reference image is STYLE AND MATERIALS ONLY, do not reproduce the board. Draw one single upright spear-shaped arrowhead, pointing vertically UP, centered on a genuinely transparent canvas. Strong readable silhouette, broad triangular pointed tip, carved aged bronze/gold bevel with convincing warm upper-left light and dark brown undercuts, deep wine-red enamel inset, tiny sculpted laurel leaves only at the short base/socket, restrained detail. Front facing orthographic, no oblique perspective, no long handle, no cast shadow onto background. It must look like a physical object made by the same craftsman as the reference bronze frame, rich painterly hand-rendered videogame object, NOT flat SVG, not icon line art, not neon laser, not generic polygon. The point must be crisply formed. Occupy central 70% of canvas height, with narrow transparent margin. No text, no letters, no UI, no circles, no unrelated props. Only one arrowhead, no sheet, no alternatives.

## Open laurel

Use case: stylized-concept. Asset type: transparent game overlay for a READY TO ATTACK card in IMPERIVM. Reference is style/material only. Draw a single symmetrical U-shaped open laurel crest: two slender sculpted ancient bronze-gold laurel branches along left and right edges, joined at bottom by one very small crossed Roman gladius emblem. The leaves curve gently upwards from the bottom, leave all of the CENTRAL 78% AREA genuinely transparent so a rectangular playing card can sit inside it. Both branches stop at around half height; no top border, no rectangular lines, no corners, no ring. Crisp full-color painterly bas-relief bronze bevel and polished gold raised edges, deep brown crevices, convincing directional upper-left warm light. Restrained detail so readable in a mobile game. Vertical 3:4 composition, on truly transparent background with clean alpha; no background, no shadow cast on a background, no white fill, no text, no neon glow, no cyan, no screen HUD. Occupy 88% width of canvas, small transparent margins. Same warm crafted metal as Roman arena frame. One crest only.

## Runtime export

Sharp: spearhead `.trim().resize({height:768}).webp({quality:92})`; laurel `.resize({height:768}).webp({quality:92})`, keeping its transparent interior and upper margin. Original PNGs are preserved. Runtime files together are about 159 KB. Materials use alpha coverage; the crest is behind the card face so its centre does not cover the art.
