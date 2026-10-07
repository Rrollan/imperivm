"""Build the reviewable Flow Agent handoff. No external generation or game edits."""
from collections import Counter
from pathlib import Path
import csv
import hashlib
import json
import re
import zipfile

ROOT = Path(__file__).resolve().parents[2]
PACK = ROOT / "docs/art-direction/flow-characters-50-20261007"
DATA = json.loads((PACK / "catalogue.json").read_text())
CARDS = DATA["characters"]

STYLE = """IMPERIVM ART DIRECTION — SIMPLIFIED CLASSICAL CRYPTO FANTASY
Create original character illustrations for a tactical Greek/Roman crypto-fantasy card game. The world combines classical Mediterranean people, gods, crafts, bronze objects and architecture with crypto ideas expressed through physical visual jokes. Keep it warm, charming and premium, with the immediate readability of a good fantasy trading-card illustration.

LOOK: hand-painted stylized fantasy, broad deliberate brushwork, pleasantly exaggerated proportions, appealing expressive faces, tactile cloth/bronze/ceramic, large simple material planes. A restrained single magical accent is allowed. Avoid photographic portraits, dark muddy realism, generic over-armoured mobile-game heroes, plastic 3D, anime and flat vector clip art. The references set a shared finish; simplify minor costume detail further where it improves readability. Borrow their visual hierarchy, not their exact face, costume, pose or background for every character.

COMPOSITION: portrait 2:3 preferred, target 1024x1536 or higher native resolution if available. If Flow only offers another portrait ratio, use the nearest available option, preferably 3:4, and report the actual dimensions; do not pretend a size was supported. One dominant character per image, framed from waist or mid-thigh upward, complete head visible. The face must read at 96x144 thumbnail size. Put the face around the upper-middle, not against an edge; keep face, gripping hands and identifying object in the central 80% of width and between 12% and 78% of image height. Calm top-left background will sit behind the future cost badge. No floating bust with arbitrary white/black margins. Paint the background to all edges.

SIMPLICITY: one clear action, one identifying major object, one readable silhouette. Use two or three major colour masses. Secondary details must stay subordinate. Quiet atmospheric backdrop with at most one soft contextual architecture shape; no crowds or detailed panoramic cities. Each face, hairstyle, build, expression, stance and identifying object should distinguish this character from the others. Same universe and rendering quality, not fifty palette-swapped clones. Nonhuman characters still get a large readable face and clean anatomy.

PALETTES: shared ivory cloth and antique bronze unify the set. DeFi uses deep teal/emerald and amber light; NFT uses indigo/lavender with ivory ceramic and marble; DePIN uses jade/cyan and copper engineering; Meme uses burgundy/coral/rose with warm expressive faces. These are art palettes, not faction badges. Skin/fur/material colour stays believable. Preserve light/dark separation and saturated focal accents without washing everything beige or covering it in bloom.

COMMON AND RARE: compact readable identity, ordinary physical object, restrained light. EPIC AND LEGENDARY: equally simple anatomy; greater presence and one bold signature motif, not extra engraving or decoration. Every tier gets a polished illustration; metadata does not become a visible rarity jewel.

STRICT OUTPUT: illustration only. NO card frame, border, text box, titles, captions, readable text, letters, numbers, mana crystals used as UI, health/attack circles, rarity dots, logos, token tickers, watermark, infographic, grid, contact sheet or card mockup. Small in-world crystals described as physical props are allowed. No modern monitors, price charts, neon cyberpunk equipment or copied token branding. Avoid excessive laurels, gems, filigree, scattered coins, crowds, extra arms, extra fingers, weapon clutter and magical particle storms. A natural clearly gripping hand matters more than microscopic detail.

REFERENCES: reference-01-signal-oracle.png demonstrates a readable human, restrained engineering magic, warm/cool light and simple classical costume. reference-02-hopium-augur.png demonstrates an original crypto-meme animal with the same painterly finish and clear face/prop hierarchy. They are STYLE references for the whole set and subject references only for jobs 32 and 46 respectively. They are not extra deliverables, and not a mandate to make all characters look like those two.
"""

FACTION_NOTES = {
    "DeFi": "Financial guardians, liquidity, collateral, lending and market control, translated into bronze tools, containers and sea motifs; humour is dry and intelligent.",
    "NFT": "Makers, preservation, provenance, revelation and second chances, translated into clay, mosaic, marble and theatrical reveals; no digital gallery interface.",
    "DePIN": "Public works, physical networks, relay chains and infrastructure, translated into aqueducts, copper tools, beacons and simple clockwork; not futuristic robot soldiers.",
    "Meme": "Hype, FOMO, copium, bagholding, diamond hands and rug humour, translated into expressive original people, animals and Greek figures; funny with premium craft, not low-effort joke clip art.",
}


def job(card, index):
    filename = f"{index:02d}-{card['id']}.png"
    return f"""JOB {index:02d}/50 — {card['nameEn']} / {card['nameRu']}
Stable character ID: {card['id']}
Faction: {card['faction']}. {FACTION_NOTES[card['faction']]}
Planned rarity: {card['rarityPlan']} — metadata only; never render it.
Required character and scene: {card['visual']}
Output asset name: {filename}
Generate one separate portrait illustration for this job using the shared art direction. The name is an asset label, never image text. No frame or game UI.
"""


MISSION = """You are the Google Flow Agent, working as an art-production assistant for IMPERIVM.
EXECUTE the image generation task below, not merely an outline or a rewrite of the prompts.

TASK: create exactly 50 DISTINCT CHARACTER ILLUSTRATIONS, one separately generated image per numbered job. Use Nano Banana 2.1 if available in this project's image settings. If it is unavailable or the Agent cannot enforce the selected model, report the actual model before using an alternative; do not silently claim Nano Banana 2.1 was used. Respect the account's generation confirmations and limits.

These are 50 new character concepts for a later card expansion. Do not draw complete UI cards, decide gameplay numbers, rewrite abilities or replace existing game cards. Both uploaded references are references only and do not count toward the fifty. Their subjects are regenerated as jobs 32 and 46 so the output roster still contains 50 distinct jobs.

WORKFLOW:
1. Keep the common art direction below active for every generation. Use both reference files as shared STYLE references. For job 32 use reference 01 additionally as the subject concept; for job 46 use reference 02 additionally as the subject concept. Do not propagate those identities into other jobs.
2. Work in five batches: jobs 01-10, 11-20, 21-30, 31-40, 41-50. These are ten different jobs, not ten random variations of a single image. If a batch exceeds a supported request size, split it into smaller consecutive groups without skipping or merging jobs. Do not turn the batch into one collage.
3. Produce one first-pass image per job; do not create multiple optional variants or videos. If a generation technically fails, record it as failed, not completed. Keep completed work and continue the remaining jobs when the platform permits. If generation cannot continue because of a quota/credit/confirmation limit, report the exact completed IDs and the next unfinished ID. Never invent finished images or download links.
4. Review each output: large readable face, distinguishing object, anatomy, faction palette, subdued backdrop, portrait crop, no baked UI or text. Flag failures for a focused repair rather than silently accepting them or regenerating the entire batch. Further repair generations use the separate repair instruction; do not automatically spend credits on indefinite retries.
5. Name each generated asset with its exact requested two-digit prefix and ID. Create the Collection 'IMPERIVM — Agora After Hours — 50' if Collections are available, grouping only this task's assets. Do not delete or overwrite unrelated assets or references. If renaming/Collections are unavailable, supply a numbered mapping from requested filename to actual asset.
6. Preserve the highest available native-quality individual image. Prefer PNG; if the platform exports JPEG/WebP, preserve that format and the same base filename. Do not mislabel extensions, fake resolution, upscale a tiny preview and call it a native master, or export screenshots of the editor.
7. At completion give a compact 50-row checklist with ID, filename, actual model, dimensions, status and any quality issue. If ZIP export is actually available, include the fifty individual masters plus this mapping in one archive. Otherwise leave individually named project assets ready for normal user export and report that fact. A contact sheet may be an additional review aid only; it never substitutes for any individual image.

Do not count written prompts, existing references, proposed concepts or duplicate variants as completed jobs. Generate all fifty within supported batch limits. Avoid creative clarification: the brief is complete. Keep platform-required account confirmations intact.

"""

QA = """
FINAL ACCEPTANCE CHECK
- 50 numbered jobs accounted for; output count is 50 distinct character masters, or unfinished jobs are explicitly named.
- 13 DeFi, 13 NFT, 12 DePIN, 12 Meme; no missing or duplicate IDs.
- Names, costs, attack, health, rarity and ability text are NOT drawn into images.
- No collage, card border, awkward blank bands or text-overlap risks baked into the art.
- Human and animal faces are legible in a small portrait; neither atmosphere nor magic obscures the face.
- Different silhouettes and expressions; palette alone is not enough to distinguish characters.
- No invented certainty about gameplay, model selection, quality control or export functionality.
"""


def write(name, text):
    (PACK / name).write_text(text, encoding="utf-8")


def main():
    assert len(CARDS) == 50
    ids = [card["id"] for card in CARDS]
    assert len(set(ids)) == 50
    assert all(re.fullmatch(r"[a-z][a-z0-9-]+", value) for value in ids)
    assert Counter(card["faction"] for card in CARDS) == {"DeFi": 13, "NFT": 13, "DePIN": 12, "Meme": 12}
    assert Counter(card["rarityPlan"] for card in CARDS) == {"common": 22, "rare": 16, "epic": 8, "legendary": 4}
    existing = set(re.findall(r"^\s*'([a-z0-9-]+)':\s*\{", (ROOT / "lib/cards.ts").read_text(), re.M))
    assert existing.isdisjoint(ids), f"Existing game IDs reused: {existing.intersection(ids)}"
    (PACK / "prompts").mkdir(exist_ok=True)
    (PACK / "batches").mkdir(exist_ok=True)
    write("01-FLOW-AGENT-MASTER.txt", MISSION + STYLE + "\nTHE FIFTY JOBS\n\n" + "\n".join(job(c, i) for i, c in enumerate(CARDS, 1)) + QA)
    write("02-AGENT-INSTRUCTIONS.txt", STYLE + "\nKeep these instructions active across all sessions for this set. Generate only the requested numbered IDs, one image each. Asset names and card metadata must never appear inside the art.\n")
    write("03-CONTINUE.txt", """Continue the existing IMPERIVM — Agora After Hours — 50 task using the same two reference images and established art direction. Inspect the completed job checklist and existing named project assets first. Generate only unfinished numbered jobs, with their original filenames and descriptions. Do not regenerate completed IDs, create duplicates, change the art style, replace the character list or make a collage. Work in consecutive groups of at most ten distinct jobs, smaller if platform limits require it. Respect account confirmations and limits. If the previous session is unavailable, ask me for the unfinished ID range instead of inventing one. Update the checklist with actual model, dimensions, status and asset mapping.\n""")
    write("04-REPAIR.txt", """Repair ONLY the selected failed IMPERIVM character asset. Keep its original ID, intended character identity, faction palette, painterly finish and filename. Compare against the two style references and that ID's original description. Correct only the reported defects: illegible face, busy background, subject too small, poor crop, incorrect gripping hand, duplicate identity, unwanted text or card UI. Keep the dominant face and identifying object clear. Generate one targeted corrected image, preserve the previous version in its stack, and do not regenerate other completed jobs. Report the actual corrected asset mapping and any remaining defect.\n""")
    for index, card in enumerate(CARDS, 1):
        write(f"prompts/{index:02d}-{card['id']}.txt", "Generate ONE character illustration for this job. Use the two supplied references for the shared style.\n\n" + STYLE + "\n" + job(card, index))
    for batch in range(5):
        lo, hi = batch * 10 + 1, batch * 10 + 10
        scoped = f"\nSCOPE OVERRIDE FOR THIS MESSAGE: generate ONLY jobs {lo:02d}-{hi:02d}, ten distinct images. Do not run the other forty jobs from the full production plan. Preserve prior completed assets.\n"
        write(f"batches/BATCH-{batch + 1:02d}-{lo:02d}-{hi:02d}.txt", MISSION + scoped + STYLE + "\n" + "\n".join(job(CARDS[i - 1], i) for i in range(lo, hi + 1)) + "\nReport this batch's ten actual assets and any unfinished IDs.\n")

    manifest = {
        "set": DATA["set"], "version": 1, "status": DATA["status"],
        "totalCharacters": 50, "factions": dict(Counter(c["faction"] for c in CARDS)),
        "plannedRarities": dict(Counter(c["rarityPlan"] for c in CARDS)),
        "preferredRatio": "2:3", "preferredNativeSize": [1024, 1536],
        "fallback": "Nearest available portrait aspect ratio, preferably 3:4; report actual dimensions.",
        "containsProductionImages": False, "containsGeneratedStyleReferences": True,
        "referenceCountExcludedFrom50": 2, "gameImplementationChanges": False,
        "characters": [dict(c, index=i, requestedFilename=f"{i:02d}-{c['id']}.png", promptFile=f"prompts/{i:02d}-{c['id']}.txt", batch=(i - 1) // 10 + 1) for i, c in enumerate(CARDS, 1)],
        "sources": ["https://support.google.com/flow/answer/17093911?hl=en", "https://support.google.com/flow/answer/16729550?hl=en", "https://support.google.com/flow/answer/16352836?hl=en"],
    }
    write("MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    with (PACK / "ROSTER.csv").open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.writer(stream, lineterminator="\n")
        writer.writerow(["index", "id", "name_ru", "name_en", "faction", "planned_rarity", "future_role", "future_hook_not_implemented", "synergy", "requested_filename"])
        for i, c in enumerate(CARDS, 1):
            writer.writerow([i, c["id"], c["nameRu"], c["nameEn"], c["faction"], c["rarityPlan"], c["roleRu"], c["hookRu"], c["synergy"], f"{i:02d}-{c['id']}.png"])
    roster = "# 50 персонажей: Agora After Hours\n\nЭто концепты будущих карт. Стоимости, характеристики, правила, редкости и состав колод ещё не утверждены. Редкость ниже — ориентир для разнообразия артов.\n\n| № | ID / персонаж | Фракция | План редкости | Роль и будущая связка |\n|---|---|---|---|---|\n"
    for i, c in enumerate(CARDS, 1):
        roster += f"| {i:02d} | `{c['id']}` — **{c['nameRu']}** | {c['faction']} | {c['rarityPlan']} | {c['roleRu']}. {c['hookRu']} |\n"
    write("05-ROSTER.ru.md", roster)

    write("00-START-HERE.ru.md", """# IMPERIVM: 50 персонажей для Flow Agent

Готовый художественный пакет: 50 отдельных заданий, 2 новых визуальных референса, общий стиль, 5 партий по 10, отдельные промпты и каталог. В паке пока нет пятидесяти готовых артов или реализованных игровых карт.

## Как запустить

1. Создай отдельный проект Flow для этого набора и включи Agent. В настройках изображения выбери **Nano Banana 2.1**, если модель доступна. Официальная справка Google подтверждает модель; Agent может сам выбирать модель, поэтому в задании есть требование сообщать фактически использованную.
2. Загрузи `references/reference-01-signal-oracle.png` и `references/reference-02-hopium-augur.png` и прикрепи оба к промпту как референсы стиля. Нельзя полагаться на локальные пути внутри текста: Flow должен получить сами изображения.
3. При желании сохрани текст `02-AGENT-INSTRUCTIONS.txt` в Agent Instructions вместе с референсами. Это помогает удержать стиль между партиями.
4. Скопируй **весь текст** `01-FLOW-AGENT-MASTER.txt` в Agent. В нём уже есть общий стиль и все 50 персонажей. Модель должна делать отдельные изображения, не коллаж.
5. Если полный текст не помещается или удобнее контролировать результат, вместо MASTER отправляй файлы из `batches/` по очереди. Каждый содержит собственный полный стиль и ровно 10 заданий. Не запускай MASTER и партии одновременно: это создаст дубли.
6. При остановке используй `03-CONTINUE.txt`. Для дефектного арта выбери только его и отправь `04-REPAIR.txt` с коротким описанием дефекта.
7. Сохрани индивидуальные изображения в исходном качестве. Предпочтительно PNG; JPEG/WebP тоже подходят. Сохрани префикс и ID, например `01-collateral-squire.png`. Присылай ZIP с отдельными файлами и перечнем соответствий, если Flow изменит названия. Снимки интерфейса или единственный коллаж не заменяют исходники.

## Что внутри

- **13 DeFi:** экономические двигатели, защита стейкинга, контроль рынка.
- **13 NFT:** сохранение союзников, мастерская минта, восстановление.
- **12 DePIN:** физические сети, последовательности розыгрышей, инфраструктура.
- **12 Meme:** дешёвое давление, hype-цепочки, риск и компенсация потерь.
- По художественной роли: **22 common / 16 rare / 8 epic / 4 legendary**. Это предварительный план, не утверждённые игровые редкости.
- `05-ROSTER.ru.md`, `ROSTER.csv`, `MANIFEST.json` связывают изображение с персонажем, фракцией и будущей ролью.

## Главные требования

Крупный персонаж, хорошо видимое лицо, один узнаваемый предмет, простой фон и ограниченная палитра. Греция/Рим + физические метафоры крипты. Никаких рамок, имени, стоимости, атаки, здоровья, эффектов, иконок и текста внутри изображения: игра рисует всё это отдельно. Портрет 2:3, желательно 1024×1536 или выше в нативном разрешении; при ограничениях Flow — ближайший портретный формат с указанием реальных размеров.

Два референса сгенерированы встроенным imagegen в Codex; это примеры направления, а не результаты Nano Banana. Они не входят в счёт пятидесяти финальных артов. Оракул сигнала и Авгур хопиума занимают задания 32 и 46 и будут сгенерированы в Flow заново в составе полного набора.

## После получения изображений

Сначала проверить читаемость в реальном размере карты и кадрирование в нашей рамке. Затем принять карточные правила и баланс по группам, добавить необходимые эффекты в общий движок, проверить синергии и контрмеры, собрать колоды и прогнать PvP. Одновременно вводить 50 непроверенных правил в мету нельзя считать завершённой балансировкой. Концепты новых механик в каталоге явно помечены как будущие.

Пак подготовлен 7 октября 2026. Он не меняет существующие 49 карт, правила, сетевой протокол или UI.

Официальные источники:
- [Google Flow Agent: генерация, пакетные задания, имена, Collections и инструкции](https://support.google.com/flow/answer/17093911?hl=en)
- [Создание изображений и прикрепление референсов](https://support.google.com/flow/answer/16729550?hl=en)
- [Модели Flow, включая Nano Banana 2.1](https://support.google.com/flow/answer/16352836?hl=en)
""")
    write("06-FUTURE-MECHANICS.ru.md", """# Будущие связки: ориентиры для реализации после арт-приёмки

Все следующие пункты — задания на проектирование, а не уже реализованные эффекты. Никаких цен, статов и обещаний винрейта этот набор не фиксирует.

## Два направления на фракцию

| Фракция | Направление 1 | Направление 2 | Что должен уметь соперник |
|---|---|---|---|
| DeFi | Сохранить экономических бойцов, получить ограниченную награду от стейкинга | Размены и узкое вмешательство в публичные указы | Убрать двигатель, атаковать во время ресурсного хода, защитить подготовленную угрозу |
| NFT | Сохранение и ремонт бойцов под Афину | Подготовка минта и раскрытия | Разорвать подготовку удалением, вынудить тратить поддержку до награды |
| DePIN | Последовательность недорогих розыгрышей под Гермеса | Поддержка расширенного поля и один ограниченный помощник | Убрать поддержку, не дать бесплатно превратить лишнее место в бесконечный ресурс |
| Meme | Дешёвые бойцы и награда за последовательность под Аида | Осознанный риск и ограниченная компенсация утрат | Остановить давление, вынудить использовать части связки раньше, убрать растущий двигатель |

## Различать текущие правила и новые концепты

Текущий движок уже поддерживает выход, Провокацию, Рывок, Вампиризм, мгновенные тактические заклинания, стейкинг, открытые указы, расширение пяти мест до семи и условные Olympus-выходы. Арты могут опираться на эти возможности.

Пункты вроде интерфейса выбора двух эффектов, адресного возвращения союзника в руку, связи двух бойцов, переноса баффов, истории павших, предсмертных эффектов и условного восстановления **ещё не получают реализацию от этого пакета**. Их необходимо отдельно спроектировать, типизировать, проверить в авторитетном общем движке, обеспечить сетевую приватность и добавить понятный UI. Разработка не должна случайно обещать механику одним текстом карты.

## Ограничения будущего баланса

- Не превращать все 50 персонажей в легендарные дорогостоящие карты: сохранить дешёвые части связок и ответы.
- У поддержки должна быть понятная польза без полной связки. Усиленная награда требует цены и подготовки.
- Проверять доступность цепочек по фактической кривой ресурсов и руки, особенно для Аида и дорогих наград.
- Слот пять — цена; дополнительное место полезно только при возможности разыграть и сохранить бойцов. Не обходить максимум семь призывом или возвращением.
- Награды двигателей ограничивать, не допускать бесконечных циклов ресурсов, добора, возвращения и восстановления.
- Крупный эффект и красивый арт не заменяют контрмеры и баланс. Проверить первый/второй ход, пустые ходы, частоту подготовки/срыва связки, удержание поля, длительность матча и каждую пару колод.
- Существующая слабость Строителя в greedy-AI тесте остаётся открытой: сами арты её не исправляют.

После арт-приёмки сначала реализовать компактный набор взаимодействующих карт для всех четырёх фракций, проверить его, затем подключать следующие группы. Все 50 исходных изображений и ID сохраняются независимо от порядка релиза.
""")

    provenance = PACK / "references/provenance.json"
    refs = [PACK / "references/reference-01-signal-oracle.png", PACK / "references/reference-02-hopium-augur.png"]
    assert all(p.exists() for p in refs), "Copy both built-in generated reference images before packing."
    assert provenance.exists(), "Reference provenance must be preserved."
    checksums = []
    for p in sorted(PACK.rglob("*")):
        if p.is_file() and p.name != "SHA256SUMS.txt":
            checksums.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(PACK)}")
    write("SHA256SUMS.txt", "\n".join(checksums) + "\n")
    dest = ROOT / "public/ui/arena-lab/imperivm-flow-characters-50.zip"
    with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for p in sorted(PACK.rglob("*")):
            if p.is_file():
                archive.write(p, Path("imperivm-flow-characters-50") / p.relative_to(PACK))
    with zipfile.ZipFile(dest) as archive:
        assert archive.testzip() is None
    print(json.dumps({"characters": len(CARDS), "factions": manifest["factions"], "planned_rarities": manifest["plannedRarities"], "existing_card_id_collisions": len(existing.intersection(ids)), "individual_prompts": len(list((PACK / "prompts").glob("*.txt"))), "batches": len(list((PACK / "batches").glob("*.txt"))), "zip": str(dest), "bytes": dest.stat().st_size}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
