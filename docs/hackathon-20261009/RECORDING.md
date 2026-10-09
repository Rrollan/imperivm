# Демо и питч — план записи

Использовать только новый интерфейс из `main`. Записывать обычные страницы продукта, не `arena-lab` с искусственно заполненным полем. Игровые кадры — landscape, 1280×720 или 1920×1080, видимые клики, тихая музыка. Не показывать seed phrase, секреты, личные чаты, уведомления, платёжные данные или чужие аккаунты.

В проверенной личной форме Colosseum: product demo **≤3 минут**, pitch video **≤2 минут**. Публичный FAQ указывает 2–3 минуты, но для загрузки соблюдаем более строгий лимит актуальной формы. Цель записи питча — 1:40–1:55. Источники: [форма Media](https://colosseum.com/arena/hackathon/project/editor?section=media), [FAQ Colosseum](https://colosseum.com/hackathon), просмотрены 9 октября 2026. Для side track показывать работающий продукт, а не слайды или просмотр кода.

## Демо — целевая длительность 2:45

| Время | Реальное действие | Что объяснить |
| --- | --- | --- |
| 00:00–00:12 | Главное меню → библиотека | «IMPERIVM — карточные дуэли в имперском Риме. 99 карт, 9 правителей». |
| 00:12–00:38 | Выбрать бесплатного правителя, открыть стартовую колоду, заменить 1 карту, сохранить 30/30 | Фильтры, стоимость, лимит копий, зачем эта замена. |
| 00:38–00:55 | Начать обычную тренировку, заменить одну стартовую карту | Без кошелька уже можно играть. |
| 00:55–01:33 | Поставить бойца, показать доступную атаку, атаковать; сыграть указ в публичную очередь | Разница мгновенного эффекта и отложенного указа. Ответный удар — половина атаки защитника. |
| 01:33–01:53 | Использовать полезную способность правителя или реальную условную связку | Объяснить условие и видимый результат. Не ждать редкий эффект всю запись. |
| 01:53–02:15 | Открыть **демо** пак; раскрыть карты по одной | Пять карт, различия редкостей, новые персонажи. Демо-баланс не имеет денежной стоимости. |
| 02:15–02:38 | После live-проверки: показать кошелёк, запрос подписи участия и результат; devnet бейдж/Explorer если реально minted | Отдельно назвать off-chain подпись и сеть NFT. Если не проверено — показать имеющийся UI и честно сказать «путь ещё проверяется», не симулировать success. |
| 02:38–02:45 | Вернуться к игре; ссылка на актуальную страницу | После iDos-публикации писать именно страницу каталога. |

Можно заранее записать несколько обычных матчей и выбрать реальные действия. Не выдавать диагностику, постановочный баланс, спliced wallet success или неподтверждённую транзакцию за live-прохождение. Онлайн PvP добавлять только после реального матча на двух устройствах/аккаунтах. Демо не обязано заканчиваться победой; лучше показать понятную механику.

## Питч — EN, черновик для записи не более 2 минут

Hi, I'm Rollan Rogozhin, the founder and developer of IMPERIVM.

IMPERIVM is a browser card battler set in imperial Rome, with characters and abilities drawn from crypto culture. My goal is to make a game that is fun to play before asking players to connect a wallet.

You choose a ruler, build a thirty-card deck and try to empty your opponent's Treasury. The key decision is timing. Delayed edicts enter a public queue, so both players can see what is coming. You can commit resources, prepare a combination or respond before the next turn. Garrisoning a fighter gives you extra orders, but that fighter cannot attack.

The playable build has ninety-nine cards and nine rulers. It includes free starter decks, a collection workshop, sequential pack reveals and the imperial arena you see in our demo.

For Solana, we have implemented Phantom support and verified participation messages. First-victory collectible code uses Metaplex Core on devnet. Participation signatures are off-chain, and AI results are self-reported.

The iDos SDK and checkout adapters are prepared. Platform publication, live wallet testing and the required mainnet game token remain our final hackathon tasks. We will update this description after those steps are verified.

You can play the current game in your browser and inspect the code on GitHub. Thank you for trying IMPERIVM.

Этот текст описывает состояние **9 октября**, не финальную готовность. После интеграции заменить предпоследний абзац фактически проверенной формулировкой, указать сеть токена отдельно от devnet NFT. Пользователь добавляет одну правдивую фразу «почему я» из своего опыта; не придумывать компетенции или членов команды. Пробная запись с таймером обязательна: число слов само по себе не гарантирует 2 минуты.

## Перед передачей ссылок

- Демо ≤3:00; питч ≤2:00. Две разные ссылки.
- Открываются без запроса доступа, в приватном окне; слышен голос и читается интерфейс.
- Версия в видео соответствует `main`, README и платформенной сборке.
- Презентация открывается и доступна судьям; слайды про статус обновлены после live-проверки.
- Explorer действительно показывает нужную сеть и подтверждённую транзакцию.
- Не утверждать, что первый фильтр пройден, пока этого не подтверждает Colosseum.
