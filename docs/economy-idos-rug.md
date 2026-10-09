# Бесплатные карты, паки Agora и пополнение IMP через iDos

Реализовано 8 октября 2026 в `rebirth`. Это инструкция для настройки Title Жориком. Она заменяет старые настройки `IMPERIVM_GENESIS / GENESIS_PACK / 500 live IMP` из первого брифа. Публикация Title, депозит, покупка за реальные средства и создание токена в этой итерации не выполнялись.

## Доступ к картам

| Набор | Получение | Использование |
| --- | --- | --- |
| База: 49 прежних карт | Бесплатно каждому, постоянно | Четыре полноценные стартовые колоды по 30 карт; AI и PvP без покупки |
| Agora After Hours: 50 новых персонажей | Только паки за виртуальный IMP | Каталог доступен для изучения; в колоду добавляются полученные карты |
| Genesis NFT: 40 неизменных ID | Отдельная devnet NFT-коллекция | Коллекционный предмет; не заменяет виртуальные паки и не выдаёт платные карты Agora |

Списки зафиксированы в `lib/collection/access.ts`, бесплатные стартовые колоды — в `lib/collection/starterDecks.ts`. Рецепты со связками в `lib/decks.ts` сохранены как ориентир для сборки после открытия карт. Переход в обычный бой не выдаёт эти карты автоматически; недоступная сохранённая колода заменяется бесплатной.

Коллекция iDos работает как альбом: одна открытая карта даёт до двух копий в колоде, легендарная — одну. Повторы превращаются в **CollectionCurrency**, не IMP; баланс и повторы показываются в паках. Настроить компенсацию по каждой редкости. Обмен этой валюты на выбранную недостающую карту пока **не реализован**. Штатный iDos сундук случайно выбирает из пула и может повторить карту; его нельзя рекламировать как гарантированную новую карту. До открытия платных продаж требуется выбрать и протестировать серверный рецепт обмена или честно принять этот ограниченный стартовый вариант.

Local demo имеет 500 тестовых IMP и свои покупки в браузере, без денежной стоимости. Эти карты работают в тренировке; WS-сервер никогда не доверяет localStorage для платных PvP-колод. Старая демо-коллекция без открытых паков мигрирует к бесплатной базе; существующие демо-покупки сохраняются.

## Путь покупки

1. Пользователь входит в iDos своим Solana-кошельком. Demo доступен без кошелька.
2. Пополняет платформенный кошелёк iDos **реальными SOL или native USDC в Solana mainnet**, через штатную панель платформы.
3. На `/packs` выбирает предложение: точное количество IMP, точная цена в SOL/USDC, текущий платформенный баланс.
4. Подтверждает отдельную покупку. `store.purchase` списывает CryptoCurrency и зачисляет VirtualCurrency IMP на backend iDos. Клиент не зачисляет деньги самостоятельно.
5. Отдельно открывает пак: **50 IMP → 5 карт Agora**, выдача и списание выполняются iDos.

IMP здесь — закрытая виртуальная игровая валюта, без вывода и обратного обмена на SOL/USDC. Выпуск SPL IMP не нужен и не выполнялся. Devnet login/proof-of-play/NFT остаются отдельными от mainnet платёжного контура. Нельзя в описании продукта обещать mainnet NFT или token listing.

В iframe доступна `openPlatformWalletPanel()` из официального SDK. В самостоятельном Next-приложении тратить уже пополненный iDos баланс можно, но для нового депозита используется ссылка на опубликованную страницу игры iDos. Произвольный получатель SOL, seed phrase и самодельная транзакция перевода не нужны.

## Настройки Title

- VirtualCurrency `IMP`: **InitialDeposit=0** для платного live Title; никакой автоматической выдачи 500 реальных IMP. Не настраивать вывод/конвертацию IMP в crypto.
- Активная virtual collection **`IMPERIVM_AGORA`**: ровно 50 ID, только новые персонажи, обычные версии. Готовые определения: `docs/idos/agora-collection.json`. Это конфигурация виртуальной коллекции, а не NFT-манифест.
- PackType **`AGORA_PACK`**: 5 карт, GuaranteedMinRarity=1, GuaranteeMaxRarity=false, без bonus/pity/presets/special versions. Numeric rarity: 1=common, 2=rare, 3=epic, 4=legendary. Weights **60/25/11/4**, редкость 5 не используется. Вероятность указана для каждого слота, не гарантия легендарной в паке.
- Единственный используемый PriceOption `IMP`: `{Type:"VirtualCurrency",CurrencyID:"IMP",Amount:50}`. Клиент проверяет цену, состав пула и вероятности до открытия.
- DuplicateConversions: предложено 1/3/8/20 CollectionCurrency для rarity 1/2/3/4. Это компенсация, не обещание готового крафта; согласовать рецепт обмена до включения реальных продаж.
- Blockchain network **`SOLANA_MAINNET`**: Type=`Solana`, RpcUrl=`https://api.mainnet-beta.solana.com`. CryptoCurrency `SOL`: единственная binding этой сети, пустой ContractAddress, Decimals=9. `USDC`: единственная binding этой сети, mint **`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`**, Decimals=6. У обеих активный статус и SpendableInGame=true. См. [Circle native USDC](https://help.circle.com/support/en/usdc-supported-blockchains-minting-redemption-faqs?id=kb_article_view&sysparm_article=KB0010590).
- Отдельная сеть логина `SOLANA_DEVNET` с devnet RPC остаётся для текущего подписанного участия и NFT. Кошелёк привязывается тем же публичным ключом; проверить обе сети в опубликованной панели iDos.
- Store **`IMPERIVM_IMP`**, fixed slots, sole reward VirtualCurrency IMP; price options — только один SOL или USDC расход. Не использовать ad, IAP receipt, премиальные расходы, бонусные ресурсы или динамические pool slots в этой версии.

Предложение начальной экономики для обсуждения: 250 / 1000 / 2500 IMP (5 / 20 / 50 паков). Ориентир для USDC: 1 / 4 / 10, без скидки за объём. **Это предложение, не активные цены.** SOL цены назначаются в Title после согласования курса; сайт всегда читает настроенную цену из storefront. В `docs/idos/rug-store-template.json` Amount оставлен null: заполнить утверждённые цены, не публиковать шаблон без правки.

SDK не даёт параметра expected-price для `store.purchase`. Клиент освежает предложение перед списанием и отклоняет изменившуюся цену/награду, но это не атомарная фиксация quote. **Не менять стоимость существующего OptionID** во время продаж: для нового курса создать новый OfferID/OptionID, убрать старое предложение из storefront, проверить отказ старой quote. Не обещать блокировку рыночного курса между загрузкой и покупкой.

## Переменные и порядок включения

Фронт: `.env.example`, реальные ID задаются до build:

```dotenv
NEXT_PUBLIC_IDOS_TITLE_ID=<live-title-id>
NEXT_PUBLIC_IDOS_COLLECTION_ID=IMPERIVM_AGORA
NEXT_PUBLIC_IDOS_PACK_TYPE_ID=AGORA_PACK
NEXT_PUBLIC_IDOS_CURRENCY_ID=IMP
NEXT_PUBLIC_IDOS_PRICE_OPTION_ID=IMP
NEXT_PUBLIC_IDOS_SOLANA_NETWORK_ID=SOLANA_DEVNET
NEXT_PUBLIC_IDOS_COMMERCE_ENABLED=false
NEXT_PUBLIC_IDOS_IMP_STORE_ID=IMPERIVM_IMP
NEXT_PUBLIC_IDOS_COMMERCE_NETWORK_ID=SOLANA_MAINNET
NEXT_PUBLIC_IDOS_SOL_CURRENCY_ID=SOL
NEXT_PUBLIC_IDOS_USDC_CURRENCY_ID=USDC
NEXT_PUBLIC_IDOS_APP_URL=https://idosgames.com/app/<published-app-id>
```

WS-сервер отдельно:

```dotenv
IDOS_TITLE_ID=<the-same-live-title-id>
IDOS_COLLECTION_ID=IMPERIVM_AGORA
# IDOS_BUILD_KEY=<only if required by this Title; server only>
```

Фронт и WS deploy **вместе**. Server-only Title выбирает фиксированный API endpoint iDos; клиент передаёт только transient userID/sessionTicket при первоначальном создании/входе с платной колодой. Сервер проверяет backend OwnedCollectibles и правила числа копий. Credential не попадает в opponent snapshot, лог, ссылку приглашения или browser sessionStorage. Бесплатная колода не зависит от доступности iDos. Возврат по секрету места продолжает уже проверенную, неизменную колоду без повторного логина. Случайный режим текущего HTTP-прототипа использует бесплатные стартовые карты. Правитель из кейса требует той же серверной проверки коллекции, даже с бесплатной колодой.

До изменения flag на `true`: настроить Title, решить обмен повторов, проверить актуальные production зависимости (существующий Next 14.2.35 имеет advisory; см. `docs/idos-colosseum-handoff.md`), затем владелец выполняет один согласованный платный тест в iDos. В этой работе Title не настроен и такой платный тест не выполнен.

## Сбой покупки и восстановление

Перед списанием клиент сохраняет pending marker, без wallet/private/session credentials. Один процесс и Web Locks сериализуют нажатия и вкладки. SDK может повторять **тот же** запрос со своим RelatedEntityID; приложение не создаёт повторную покупку автоматически.

Если ответ потерян, не распарсился, вернулся generic server error или receipt не соответствует выбранной награде/расходу, новые покупки блокируются. Перезагрузка сохраняет блокировку. Refresh читает свежие серверные counters и баланс, без списания; marker снимается при росте PurchasedTotal соответствующего предложения. Явная локальная ошибка, throttle или отказ авторизации до исполнения снимают marker.

Если запрос не дошёл до backend и счётчик не вырос, клиент не способен отличить это от ещё не подтверждённого списания. Нужно проверить ledger iDos и завершить восстановление с поддержкой/оператором. Не удалять marker и не нажимать повторно наугад. Аналогично требуется ручная проверка, если предложение исчезло из storefront. Это ограничение SDK, а не подтверждение успешного платежа.

## Приёмка

Локальные проверки без средств: `npm run test:integrations`, `npm test --prefix server`, `npm run build --prefix server`, `npm run smoke`, `npm run build`. Есть проверки 49/50, девяти колод и правителей, migration, session isolation, server entitlements, строгих assets mainnet, decimal balances, изменения price, receipt mismatch и pending recovery. Сетевая проверка включает полный матч и настоящий десятисекундный обрыв.

Ручной тест настроенного Title: чистый аккаунт получает 49 free и 0 live IMP; нужная криптовалюта читается; нет funds — нет списания; один подтверждённый SOL/USDC offer даёт ровно заявленные IMP; отмена не списывает; пак списывает 50 и показывает ровно 5 pulls, дубликаты не удваиваются; коллекция доступна на другом устройстве; forged/unowned deck отклонён WS; reconnect работает без утечки ticket.

API сверены с [iDos MCP](https://idosgames.com/mcp/), официальным registry `@idosgames/mcp@0.1.28` (collection/store/currency/blockchain skills) и установленными TypeScript definitions `@idosgames/core@0.21.0`, `@idosgames/wallet@0.6.2`.


## Переименование в $IMP

С 8 октября интерфейс и новые определения iDos используют IMP: VirtualCurrencyID/PriceOptionID `IMP`, StoreID `IMPERIVM_IMP`. Токен на блокчейне этим изменением не создаётся и не переименовывается. `CollectionSnapshot.rug`, ключи локальной коллекции и защиты от повторного платежа оставлены совместимыми: существующие карты, тестовый баланс и незавершённые чеки сохраняются. Для уже настроенного Title старые ID можно явно оставить через env; новый `NEXT_PUBLIC_IDOS_IMP_STORE_ID` поддерживает старый `NEXT_PUBLIC_IDOS_RUG_STORE_ID` как резервный. Прежде чем менять существующий платёжный каталог, оператор должен завершить ожидающие покупки и подтвердить перенос валюты на стороне iDos. Реальные покупки в этой итерации не выполнялись.


## Кейсы предводителей

Пять правителей доступны бесплатно; четыре отдельными коллекционными предметами. Локальный кейс стоит 200 demo IMP, повтор даёт 100 валюты коллекции. Реальный кейс по умолчанию отключён. См. [конфигурацию и условия активации](design/arena-refresh-20261009/IDOS-RULER-CASES.md): оператор должен подтвердить поддержку rarity 5 и равные шансы четырёх предметов до включения. Эта работа не создаёт Title и не проводит платежи.
