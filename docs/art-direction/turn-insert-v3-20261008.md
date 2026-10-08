# Вставка кнопки хода — 8 октября 2026

Финальный ресурс: `public/ui/arena-lab/native/turn-insert-v3.webp`.

Создан встроенным image generation по референсу существующего стола. Исходник: `01a10813-1873-74c2-a5e1-250044ecd604/exec-e5646314-e5c6-44b9-b87b-cdde27a8598f.png` в Codex generated_images. WEBP — перекодировка исходных 1962 × 802 пикселей, без обрезки или изменения рисунка.

В рисунке нет текста и второй внешней рамы. Canvas накладывает локализованную надпись; материал обрезается по восьми измеренным вершинам внутреннего паза. Ландшафтный исходник стола имеет 1586 × 992 пикселя и проецируется на 1600 × 1000. Его внутренний паз: центр (1425.5, 456.5), размер 189 × 75 пикселей. Портретный паз измерен отдельно. Опорные точки находятся в `components/presentation/boardSockets.ts`; отрисовка — `ArenaTextures.ts`. Это совпадение с пиксельным контуром изображения, не заявление о физических миллиметрах на разных экранах.

## Prompt

Use case: stylized-concept. Asset type: IMPERIVM game end-turn button INSERT texture, not a mockup. Generate a clean full-bleed horizontal rectangular dark oxblood/burgundy leather insert, approximately 2.45:1, with a shallow embossed surface lit warmly from upper left. Match the restrained painterly Roman bronze-and-dark-wood game board in the reference. It sits INSIDE an existing large bronze octagonal recess: do NOT generate an outer border, frame, bevel, button body, scene, shadow outside the texture, or transparent padding. Fill every pixel corner to corner with the leather material; its exact chamfered outline will be clipped in the game renderer. Keep the central 75 percent calm, dark and completely empty for live readable gold text. Only two small, subdued antique gold laurel sprigs embossed into leather near the far left and far right edges, with generous space around the centre. Tasteful, tactile, slightly worn, simple and readable at a small size. NO text, NO numbers, NO letters, NO UI labels, no logos, no extra objects, no gradients outside the panel. The reference is style/lighting only; output ONLY the flat full-bleed insert texture.
