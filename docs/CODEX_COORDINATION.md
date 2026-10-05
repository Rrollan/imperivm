# Codex Coordination — ветка `rebirth`

Два Codex работают параллельно. Чтобы не ломать друг другу работу:

## Mac Codex (твой)
- `app/design-polish.css` — твоя территория
- `app/*.css` (кроме card-frames.css)
- `components/ArenaGates.tsx`, `components/ArenaGates.module.css`
- `components/HeroArt.tsx`, `components/HeroPortrait.tsx`
- `app/page.tsx`, `app/layout.tsx` (лендинг)
- `docs/design-audit.md`

## Server Codex (мой)
- `components/CardView.tsx`, `app/card-frames.css`
- `components/ManaCrystals.tsx`
- `lib/` — игровой движок
- `README.md`, `readme/`
- `app/game/` — логика игры

## Правила
1. Перед пушем: `git pull --rebase origin rebirth`
2. Если конфликт в чужом файле — не резолви сам, спроси
3. Пушь только свои файлы
4. После пуша — отпиши что изменил
