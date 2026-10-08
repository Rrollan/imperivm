# IMPERIVM: iDos / Solana devnet — передача Жорику

Дата проверки: 8 октября 2026. Ветка `rebirth`, репозиторий https://github.com/Rrollan/imperivm.

## Что сделано в коде

Один `@idosgames/core` 0.21.0 клиент создаётся в браузере и используется всем приложением. Гостевой вход и вход Phantom — разные аккаунты; коллекция и баланс перечитываются при смене аккаунта. Покупки и смена аккаунта сериализованы. Повторный вход не переносит гостевые карты в кошелёк.

В самостоятельном приложении Phantom подписывает одноразовое сообщение iDos; SDK передаёт подпись в 0x-hex. Во встроенном окне используется официальный `loginWithWalletViaPlatform` из `@idosgames/wallet` 0.6.2, с проверкой origin внутри bridge. Сеть Title должна быть Solana devnet. `Mainnet` отклоняется. Демо остаётся доступно без кошелька, Title и токена.

Паки списывают **виртуальные** 50 RUG на сервере iDos и выдают пять карт. SPL-токен не создавался. Внешний баланс будущего devnet SPL читается только после настройки mint; это отдельный баланс, без автоматического обмена или депозита. Минимальный баланс токена сейчас не требуется.

Новая арена `/arena-lab` теперь предлагает подписать начало обычного матча с ИИ, записывает результат и статистику в зал побед. Диагностические/начатые с середины матчи не дают бейдж. Подпись участия проверяется Ed25519; победа с ИИ остаётся локальной и self-reported. Старые записи без полного проверяемого proof видны в истории, но не дают новое право на NFT.

Metaplex Core «Первая победа» использует существующую devnet транзакцию с симуляцией и отдельным подтверждением Phantom. Неподтверждённая отправка сохраняется, видна в Explorer, блокирует новый минт и проверяется после перезагрузки. Бейдж и его `wins` не являются доказательством честности PvP.

Общая таблица iDos — **тренировочная**, BestScore, без наград. Игрок вручную синхронизирует свои подписанные локальные победы. Это не доверенный соревновательный рейтинг. Сама iDos-интеграция не меняет WS и правила. Следующая явная просьба пользователя добавила 50 игровых персонажей, обновлённые колоды, половинный ответный урон и подкрепление из пустой колоды; сервер и оба клиента обновляются вместе. NFT Genesis manifest зафиксирован на исходных 40 ID: добавленные игровые карты раньше сдвигали индексы immutable Candy Machine и ломали её проверки. Все 49 исходных карт сохранены; теперь игровой каталог содержит 99 карт; расширение NFT Genesis требует отдельного выпуска коллекции.

## 1. Создать и настроить Title — без токена

1. Создать IMPERIVM в аккаунте пользователя; не запускать AI Coder и не создавать токен.
2. Получить канонический Title ID. В Blockchain включить WalletLogin; добавить сеть `SOLANA_DEVNET`, `Type=Solana`, `RpcUrl=https://api.devnet.solana.com`. Депозиты/выводы выключить.
3. `PlayAccess.Mode=Open`, `TokenGates=[]`: кошелёк и минимальный баланс не нужны для демо. В будущем gate настраивается на сервере Title после отдельного решения.
4. Создать VirtualCurrency `RUG`, стартовое количество 500. Это не SPL и не деньги.
5. Коллекция `IMPERIVM_GENESIS`; ID коллекционных карт совпадают с `lib/cards.ts` (99 игровых карт, включая 50 из `lib/characterCards.ts`), без служебных токенов. Виртуальная коллекция iDos не меняет отдельный immutable NFT-манифест Genesis из 40 ID.
6. PackType `GENESIS_PACK`: 5 collectibles, rarity weights 60/25/11/4. PriceOption `RUG`: единственная Standard entry `{Type: VirtualCurrency, CurrencyID: RUG, Amount: 50}`. Никаких CryptoCurrency, дополнительных расходов или премиальных скидок.
7. Необязательный leaderboard `IMPERIVM_PRACTICE_WINS`: enabled, `ScoreAggregation=BestScore`, без RankRewards, Milestones и reward presets. Назвать «Тренировочные победы».
8. Описание/скриншоты/category Gaming заполняются Жориком. Код не выполняет публикацию или final submit.

Для настройки Title MCP требует OAuth согласие владельца и выбранный Title. API key в клиент не нужен. Кодовый реестр читается отдельно: `npx -y @idosgames/mcp@0.1.28`, `get_skill({name:"idosgames-getting-started"})`. Getting-started, authentication, collection-system, currency-system, leaderboard-system и blockchain-system прочитаны. Scaffold нового проекта не использован по ТЗ.

## 2. Конфигурация фронтенда

Скопировать `.env.example` и заполнить публичные ID. На Vercel задать те же переменные, затем **пересобрать** фронт:

```dotenv
NEXT_PUBLIC_IDOS_TITLE_ID=<реальный Title ID>
NEXT_PUBLIC_IDOS_COLLECTION_ID=IMPERIVM_GENESIS
NEXT_PUBLIC_IDOS_PACK_TYPE_ID=GENESIS_PACK
NEXT_PUBLIC_IDOS_CURRENCY_ID=RUG
NEXT_PUBLIC_IDOS_PRICE_OPTION_ID=RUG
NEXT_PUBLIC_IDOS_SOLANA_NETWORK_ID=SOLANA_DEVNET
NEXT_PUBLIC_IDOS_LEADERBOARD_ID=IMPERIVM_PRACTICE_WINS
NEXT_PUBLIC_NFT_METADATA_BASE_URL=https://<реальный-домен-игры>
NEXT_PUBLIC_RUG_DEVNET_MINT=
NEXT_PUBLIC_WS_URL=wss://<существующий-WS-сервис>
```

`NEXT_PUBLIC_RUG_DEVNET_MINT` оставлять пустым до явного разрешения пользователя и создания **devnet** mint. Ни private key, ни seed phrase, ни серверные credentials не нужны в этих переменных. Title ID нельзя подменять параметром URL или чужим приглашением.

Локально: `npm ci`, `npm run build`, `npm start -- -p 3101`. Для проверки кода: `npm run test:integrations`, `npm run smoke`.

## 3. Ограничение публикации на iDos

Официальный getting-started описывает `begin_build_upload` → **статические файлы с index.html** → `finish_build_upload`. Wrapper, который frames внешний Vercel-сайт, на странице iDos не допускается. Разрешения fetch/WS ограничены платформенными хостами и настроенным allowlist Title.

Текущий IMPERIVM — Next.js с `/api/models`, метаданными NFT, NFT indexer и серверными страницами; `.next` нельзя выдать за статический ZIP. Подключение GitHub само по себе это не решает. Нужно проверить, предлагает ли дашборд отдельный поддерживаемый Node/Next deployment. Если нет — требуется отдельная упаковка клиентских экранов и вынос этих API на HTTPS backend, плюс allowlist RPC/WS/API. **Этот шаг не выполнен и не заменён iframe-заглушкой**, чтобы не пересобирать игру вопреки ТЗ. Vercel-приложение с SDK может работать самостоятельно после настройки Title.

Во встроенном окне iDos вход кошельком поддержан официальным bridge. Произвольная proof-of-play подпись и Metaplex транзакция используют прямой Phantom в самостоятельном HTTPS приложении. Не утверждать, что NFT-минт работает внутри iframe: платформенный bridge документирует вход/линковку, а не произвольные транзакции нашей игры.

## 4. Живая проверка перед демонстрацией

- Открыть `/` без расширения: демо, библиотека, пак и тренировочный бой доступны.
- «Аккаунт» → Phantom / «Войти в iDos кошельком»: проверить адрес, SOL devnet, backend RUG, отдельное обозначение будущего SPL.
- Купить пак: ровно 50 backend RUG, 5 карт; обновление страницы сохраняет iDos коллекцию. Отказ backend не превращается в локальную покупку.
- Переключить Phantom A → B: старый баланс не остаётся в B. При отказе подписи не появляется успешный wallet login.
- Тренировка с самого начала → «Подписать и играть»: проверить точное сообщение, отказаться и убедиться, что демо работает. Повторить с подписью; победить; результат должен быть в `/leaderboard`.
- На публичном HTTPS проверить `/api/nft/metadata/victory` и image из JSON. С бесплатными devnet SOL подготовить бейдж, посмотреть симуляцию, подтвердить в Phantom, сохранить подтверждённый Explorer receipt. Второй клик не создаёт второй бейдж для того же счёта.
- Синхронизировать тренировочные победы, повторить: BestScore не увеличивает число повторно. Проверить таблицу со второго аккаунта.
- В iDos frame проверить platform wallet login отдельно от прямого Phantom; не смешивать эти результаты.
- Полный WS PvP проверить по `server/README.md`: сеть и правила этой интеграцией не изменялись.

На 8 октября живой Title и публичный metadata origin в этом checkout не настроены. Реальная iDos покупка, platform iframe login и подтверждённый NFT-минт **не проверены**. Автотесты не заменяют их и не тратят SOL.

## 5. Colosseum

[Официальные правила](https://colosseum.com/legal/Crypto%20World%27s%20Fair%20Hackathon%20Rules.pdf), §§5–6: deadline **12 октября 2026, 23:59 PT**, что соответствует **13 октября, 11:59 Asia/Almaty**. Рабочая цель — отправить 12 октября заранее.

- Project Details: Solana **devnet**, Phantom wallet login, server-side iDos virtual RUG/collection, signed off-chain participation, Metaplex devnet badge. SPL mint пока не создан; PvP результаты не превращаются в доверенный on-chain рейтинг.
- Media and Code: https://github.com/Rrollan/imperivm, рабочий HTTPS demo URL.
- По ТЗ: demo ≤3 минут работающего продукта; pitch ≤2 минут; профили участников; final submit делает пользователь/Жорик.
- KZ-трек: «Did you submit this project to Colosseum?» → Yes **после** принятого final submit.
- Не заявлять mainnet-листинг, опубликованный Title или минт, пока их нет.

## 6. Что нужно до публичного production

`npm audit` от 8 октября показывает critical advisory в существующем Next.js 14.2.35 и другие high/moderate зависимости. Добавленная wallet-библиотека не устраняет эти старые риски; массовый `audit fix --force` не выполнялся. Обновление Next/Tailwind с отдельной проверкой маршрутов и CSS — отдельный обязательный этап перед production. Текущий статус — devnet интеграция для хакатона, не security-approved production.

Источники API: [iDos MCP](https://idosgames.com/mcp/), официальные npm пакеты `@idosgames/mcp` 0.1.28, `@idosgames/core` 0.21.0, `@idosgames/wallet` 0.6.2 и [SDK repository](https://github.com/iDos-Games/iDosGamesSDK_TS). Contest listing iDos не удалось прочитать; условия $5k/20 мест взяты из пользовательского ТЗ, не проверены этим изменением.
