# Spine: пилот для живой иллюстрации предводителя

## Решение этой итерации

В battle renderer уже один Babylon.js Engine, DynamicTexture для карты и отдельные VFX-атласы. Добавить pixi-spine в dependencies недостаточно: в проекте нет `.skel`/`.atlas`, а MP4 Omni содержит готовые пиксели, не кости/слоты/mesh. Не запускаем второй бесконечный ticker ради украшения всех карт.

Присланный `pixijs-userland/spine` поддерживает Pixi 7 и Spine 3.7–4.1. Для нового Pixi 8 / Spine 4.2 официальный путь — `@esotericsoftware/spine-pixi-v8`; текущая документация требует минимум Pixi 8.16. Версия major.minor редактора и runtime должна совпадать. [Исходный repo](https://github.com/pixijs-userland/spine), [официальная документация](https://esotericsoftware.com/spine-pixi).

Предлагаемый первый персонаж: **Genesis PFP / предводитель**, живая иллюстрация только в окне арта. Рамка, имя и числа рисуются текущим cardFace. Статическая карта работает до загрузки и при ошибке.

## Сравнение трёх путей

| Путь | Что получаем | Ограничения | Когда выбирать |
| --- | --- | --- | --- |
| Spine authoring → запечённые WebP-атласы | Те же анимации в существующих Babylon плоскостях; один renderer, известный pipeline | Нет runtime смешивания/IK/смены слоёв; atlas memory надо измерить | Первый проверяемый пилот и игровые VFX |
| Spine renderer-agnostic core → адаптер Babylon mesh/материала | Кости, смешивание idle/hit, skins внутри существующего engine | Свой адаптер для atlas UV, mesh, blend, clipping, batching; существенная разработка | Если пилот докажет пользу живых портретов и множество повторно используемых вариантов |
| Официальный Pixi 8 runtime в отдельном preview | Быстрый доступ к официальной реализации функций Spine | Второй renderer/context, нужно синхронизировать размер/сцену/паузы и выгружать; не бесплатная замена Babylon | Изолированная коллекция/лаборатория, до проверки мобильной памяти |

Это архитектурная оценка по коду проекта, не результаты выполненного Spine-бенчмарка. Первый выбор — запечённый пилот; позже сравнить его с runtime на одном и том же персонаже. Spine API не добавлен в боевой bundle.

## Пак исходников для автора

Omni-ролики 10–17 получены и подключены через атласы; их START/END/PROMPT сохранены для новых вариантов. Они остаются готовыми пикселями. Для Spine нужен другой материал:

1. PSD с раздельными слоями или набор прозрачных PNG одного размера и общей системы координат.
2. Персонаж без текста, чисел, рамки и UI. Не вырезать оружие/плащ из уже готового MP4.
3. Слои: `torso`, `head`, `hair`, `arm_front`, `arm_back`, `gladius`, `cape_front`, `cape_back`, `legs`. Скрытые части под суставами должны быть дорисованы, не оставлять дыр при повороте.
4. Экспорт `genesis-pfp.skel` (или JSON), `genesis-pfp.atlas`, страницы PNG, номер версии редактора. Это официальный контракт Spine-экспорта. [Формат](https://esotericsoftware.com/spine-pixi#Exporting-for-Spine-PixiJS-runtimes).
5. Сохранить проект авторинга и список анимаций/событий. Проверить применимые условия [Spine Runtimes License](https://esotericsoftware.com/spine-runtimes-license) перед подключением runtime.

### ART PROMPT — концепт для последующей ручной раскладки слоёв

Roman crypto-meme card-game commander, the Genesis founder of an imperial legion. Distinctive mature face, confident three-quarter stance, crimson cloak, readable bronze armor with one turquoise network gem, simple laurel crown, short Roman gladius. Stylized hand-painted collectible card illustration, large clean shapes, strong silhouette, warm directional light, restrained background detail. One single character from head to knees, centered with generous safe margins for a cloak and sword, no UI, no card frame, no letters, no numbers, no duplicated limbs. Keep torso, head, arms, sword and cloak visually separable for later layered 2D rigging. Transparent background. Do not animate or assemble a sprite sheet.

Один генеративный рендер не считается готовым ригом. Затем художник/редактор разделяет слои и дорисовывает перекрытия. Пока новый art не сгенерирован; все текущие изображения сохранены.

## Анимационный контракт пилота

| Имя | Длительность-цель | Движение | Примечание |
| --- | --- | --- | --- |
| `idle` | 2–3 s loop | Едва заметное дыхание и край плаща | В бою только выбранная/увеличенная карта; без скачка в loop seam |
| `summon` | 0.5 s | Выпрямление, короткий шаг/подъём плаща | Старт и конец совпадают с канонической позой |
| `attack` | 0.4 s | Подготовка, движение меча, короткий возврат | `contact` ориентировочно 0.18 s; источник времени — action timeline |
| `hit` | 0.25 s | Малый отскок корпуса | Не уводит лицо за окно арта |
| `buff` | 0.35 s | Подъём оружия/жест команды | Внешний эффект показывает только реальное изменение статов |
| `death` | 0.45 s | Потеря опоры и уход из окна | Не блокирует следующий контакт очереди |

Ни одна анимация не вызывает applyAction. Правило коммитится GameSession, presentation timeline определяет контакт, runtime/atlas только рисует фазу. Событие `contact` в asset служит для сверки, не становится вторым владельцем результата. При отмене/restart старые callbacks не выполняются. Reduce motion — каноническая поза и краткий знак результата.

## Приёмка перед выбором runtime

- Один персонаж в просмотре; затем 7+7 бойцов и 10 карт руки. Сравнить время первого открытия, объём скачивания, память текстур, draw calls, median/p95 frame time на одинаковом устройстве.
- Анимация не трогает рамку/цену/имя/цифры, не меняет hitbox и не перекрывает соседнюю карту.
- Никакой RAF/ticker при покое, скрытой вкладке, паузе или закрытом просмотре. Загрузка не блокирует правила. WebGL context loss/ошибка файла возвращает статический art.
- Явно unload atlas/textures/listeners при закрытии renderer; общие SkeletonData/атласы переиспользуются. Измерить повторные открытия, а не только первый удачный запуск.
- Проверить масштабы и clipping в portrait/landscape; прозрачные края без чёрного matte; slot/blend-order в свете арены.

До этих проверок нельзя утверждать, что Spine сделает игру быстрее, интереснее или дешевле по памяти.
