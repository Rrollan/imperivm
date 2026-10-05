import { CARDS } from './cards';
import { HEROES } from './heroes';
import type { Rarity, CardDef } from './engine/types';

export type Locale = 'ru' | 'en';
export const CARD_RU: Record<string, { name: string; text: string }> = {
  'senate-censure': {name:'Сенатское порицание',text:'Указ: случайный боец врага теряет 1 атаку, минимум до 0.'},
  'restoration-rite': {name:'Обряд восстановления',text:'Указ: восстанавливает 2 здоровья всем вашим бойцам, до их максимума.'},
  'lending-legionnaire': { name: 'Легионер кредитов', text: 'Одолжит щит. Денарии — никогда.' },
  'amm-centurion': { name: 'Центурион AMM', text: 'Постоянное произведение крови и стали. x × y = k, а k — это Рим.' },
  'liquidation-officer': { name: 'Ликвидатор', text: 'Похищение жизни. Боевой клич: наносит 1 урон случайному вражескому существу. Ваш залог был восхитителен.' },
  'frontrun-bot': { name: 'Фронтран-бот', text: 'Приоритет. Боевой клич: отменяет самое дорогое вражеское заклинание в очереди указов. Очередь — его бизнес.' },
  'priority-fee': { name: 'Плата за приоритет', text: 'Приоритет. Даёт 1 приказ. Заплати капитану — пройди без очереди.' },
  'yield-farmer': { name: 'Фермер доходности', text: 'Каждые 4 хода: +1/+1. Эмиссия сокращается. Голод — нет.' },
  'staking-pool': { name: 'Пул стейкинга', text: 'Боевой клич: даёт 2 приказа. Стейкай здесь — приумножай вечно. Каждое существо в стейкинге даёт +1 приказ в начале вашего хода.' },
  'flash-loan': { name: 'Мгновенный заём', text: 'Возьмите 2 карты. Одолжи казну. Верни завтра.' },
  'impermanent-guard': { name: 'Страж непостоянства', text: 'Провокация. Боевой клич: восстанавливает 4 здоровья вашей казне. Потери временны. Верность вечна.' },
  'imperator-liquidus': { name: 'Император Ликвидус', text: 'Боевой клич: наносит 2 урона всем вражеским существам. Долги Риму оплачиваются кровью.' },
  'pixel-squire': { name: 'Пиксельный оруженосец', text: 'Рождён правым кликом.' },
  'whitelist-scout': { name: 'Разведчик вайтлиста', text: 'Боевой клич: возьмите карту. Место гарантировано. Слава тоже.' },
  'profile-pic-phalanx': { name: 'Фаланга аватаров', text: 'Провокация. Правый клик. Сохранить. В строй.' },
  'trait-reroll': { name: 'Переброс признаков', text: 'Все ваши существа получают +1 к атаке. Новый признак уже здесь.' },
  'floor-sweeper': { name: 'Скупщик флора', text: 'Боевой клич: возьмите карту. Подметает флор. Хранит альфу.' },
  'ape-praetorian': { name: 'Преторианец Ape', text: 'Каждые 3 хода: +1/+1. Алмазные руки. Бумажные враги.' },
  'minting-press': { name: 'Пресс минта', text: 'Боевой клич: призывает Пиксельного оруженосца. Пресс никогда не спит.' },
  'reveal-ceremony': { name: 'Церемония раскрытия', text: 'Наносит 2 урона всем вражеским существам. Искусство всё это время было внутри нас.' },
  'blue-chip-basilisk': { name: 'Василиск Blue Chip', text: 'Натиск. Взгляни на минимальную цену.' },
  'genesis-pfp': { name: 'Аватар Genesis', text: 'Боевой клич: все ваши существа получают +1/+1. Первое лицо Империи.' },
  'antenna-auxilia': { name: 'Антенный вспомогатель', text: 'Несёт сигнал сквозь бурю.' },
  'mesh-messenger': { name: 'Вестник mesh-сети', text: 'Каждый пакет найдёт свой легион.' },
  'relay-runner': { name: 'Гонец ретранслятора', text: 'Боевой клич: возьмите карту. Быстрее любых слухов.' },
  'node-sentinel': { name: 'Страж узла', text: 'Каждые 3 хода: +1/+1. Доказательство бесперебойной работы.' },
  'bandwidth-barbarian': { name: 'Варвар пропускной способности', text: 'Завтракает задержкой сети.' },
  'hotspot-hoplite': { name: 'Гоплит хотспота', text: 'Провокация. Отправь в стейкинг — он удержит строй и доходность. Каждое существо в стейкинге даёт +1 приказ в начале вашего хода.' },
  'gps-gladiator': { name: 'Гладиатор GPS', text: 'Боевой клич: наносит 2 урона случайному вражескому существу. Он всегда знает, где ты живёшь.' },
  'solar-sapper': { name: 'Солнечный сапёр', text: 'Наносит 2 урона всем вражеским существам. Собранный солнечный свет стал оружием.' },
  'firmware-phalanx': { name: 'Фаланга прошивки', text: 'Боевой клич: все ваши существа получают +1/+1. Обновление установлено. Боевой дух улучшен.' },
  'the-grand-cartographer': { name: 'Великий картограф', text: 'Боевой клич: даёт 2 приказа. Его карты питают Империю.' },
  'jeet-legion': { name: 'Легион паникёров', text: 'Боевой клич: наносит 1 урон вражеской казне. Бумажные руки. Железная паника.' },
  'gm-greeter': { name: 'Вестник GM', text: 'Боевой клич: восстанавливает 3 здоровья вашей казне. Доброе утро, легион.' },
  dogen: { name: 'Доген', text: 'Такой легион. Вау.' },
  'sandwich-attacker': { name: 'Сэндвич-атакующий', text: 'Приоритет. Боевой клич: наносит 1 урон вражеской казне. Съест спред — и твой обед.' },
  pepito: { name: 'Пепито', text: 'Редкий. Зелёный. Неудержимый.' },
  'pump-chaser': { name: 'Охотник за пампом', text: 'Боевой клич: даёт 1 приказ. Покупает на вершине. Каждый раз.' },
  'diamond-hoarder': { name: 'Хранительница алмазов', text: 'Руки в стейкинге не продают. Отправь её в стейкинг: атака станет недоступна, зато каждый ход она даст +1 приказ.' },
  'fud-hydra': { name: 'Гидра FUD', text: 'Боевой клич: наносит 2 урона всем вражеским существам. Отруби один FUD — появятся два.' },
  'to-the-moon-militia': { name: 'Ополчение «На Луну»', text: 'Боевой клич: наносит 3 урона вражеской казне. Маленький шаг для мемов.' },
  'rug-pull': { name: 'РАГПУЛ', text: 'Уничтожает ВСЕХ существ на обоих полях. Veni. Vidi. Rugi.' },
  audit: { name: 'Аудит', text: 'Приоритет. Сразу отменяет самое дорогое вражеское заклинание в очереди указов. При разрешении: все ваши существа получают +1/+1. Проверка завершится раньше рагпула.' },
};

const HERO_RU: Record<string, { name: string; title: string; powerName: string; powerText: string }> = {
  whale: { name: 'Кит', title: 'Властелин рынка', powerName: 'Обвал рынка', powerText: 'Наносит 2 урона случайному вражескому существу, а если их нет — вражеской казне. Рынок даёт, а Кит забирает.' },
  builder: { name: 'Строитель', title: 'Мастер релизов', powerName: 'Выпустить патч', powerText: 'Восстанавливает 3 здоровья вашей казне. Выпускай исправления, а не оправдания.' },
  degen: { name: 'Деген', title: 'Безрассудный инвестор', powerName: 'Влететь на всё', powerText: 'Возьмите карту и получите 2 урона. Анализ — для трусов.' },
  validator: { name: 'Валидатор', title: 'Хранитель блоков', powerName: 'Подтвердить блок', powerText: 'Даёт 2 приказа на этот ход. Сеть помнит верных.' },
};
export const KEYWORD_RU: Record<string, string> = { Gas: 'Приказы', Treasury: 'Казна', Mempool: 'Указы', Priority: 'Приоритет', Staking: 'Стейкинг', Halving: 'Халвинг', Taunt: 'Провокация', Rush: 'Натиск', Lifesteal: 'Похищение жизни', Pavilion: 'Павильон', Comeback: 'Возвращение', Mulligan: 'Замена стартовых карт', 'RUG PULL': 'РАГПУЛ', Audit: 'Аудит', Fatigue: 'Истощение', Battlecry: 'Боевой клич' };
export const MECHANICS_RU: Record<string, string> = {
  Gas: 'Оплачивает карты и силу героя. Запас растёт на 1 в начале каждого вашего хода, до 10. Каждое существо в стейкинге добавляет 1 приказ при пополнении.',
  Treasury: 'Ваш запас из 30 здоровья. Опустошите казну соперника, чтобы победить. Лечение не поднимает здоровье выше 30.',
  Mempool: 'Разыграйте заклинание сейчас — оно сработает в начале вашего следующего хода. У соперника есть ход, чтобы ответить.',
  Priority: 'Сразу отменяет самое дорогое заклинание противника в очереди. При равной стоимости первым отменяется самое раннее.',
  Staking: 'Существо лишается возможности атаковать и даёт +1 приказ в начале каждого вашего хода. Его по-прежнему можно атаковать. Вывод из стейкинга не возвращает атаку в этом же ходу.',
  Halving: 'Через указанное число блоков существо получает +1 к атаке и +1 к здоровью. Счётчик работает на обоих полях; сначала срабатывают заклинания, затем это усиление.',
  Taunt: 'Атакующие существа сначала должны атаковать существо с провокацией, даже если оно в стейкинге. Заклинания игнорируют провокацию.',
  Rush: 'Позволяет атаковать вражеских существ в ход призыва. Казну можно атаковать со следующего вашего хода. Провокация и стейкинг действуют как обычно.',
  Lifesteal: 'Боевой урон, включая ответный, лечит вашу казну на фактически отнятое здоровье. Избыточный урон не лечит; максимум — 30 здоровья.',
  Pavilion: 'Вторая карта одной фракции за ход возвращает 1 приказ. Один раз за ход для каждой фракции. Разрешение заклинаний не считается.',
  Comeback: 'Если у вас 12 здоровья или меньше, а у соперника минимум на 12 больше, сила героя стоит 1 приказ. Её всё ещё можно использовать лишь раз за ход.',
  Mulligan: 'Выберите стартовые карты для замены или оставьте все. Заменённые карты возвращаются в колоду после получения новых.',
  'RUG PULL': 'Легендарное заклинание, которое при разрешении уничтожает всех существ на обоих полях. Карты с приоритетом могут отменить его заранее.',
  Audit: 'Заклинание за 3 приказа с приоритетом: сразу отменяет заклинание противника, затем в начале вашего следующего хода даёт вашим существам +1/+1.',
  Fatigue: 'Когда колода пуста, каждая попытка взять карту наносит урон вашей казне: сначала 1, затем 2, затем 3…',
};
export function cardName(id: string, locale: Locale) { return locale === 'ru' ? CARD_RU[id]?.name ?? CARDS[id]?.name ?? id : CARDS[id]?.name ?? id; }
export function cardText(id: string, locale: Locale) { return locale === 'ru' ? CARD_RU[id]?.text ?? CARDS[id]?.text ?? '' : (CARDS[id]?.text ?? '').replace(/\bgas\b/gi,'orders').replace(/\bmempool\b/gi,'edict queue'); }
export function displayCard(card: CardDef, locale: Locale): CardDef { return { ...card, name: cardName(card.id, locale), text: cardText(card.id, locale) }; }
export function heroName(id: string, locale: Locale) { return locale === 'ru' ? HERO_RU[id]?.name ?? HEROES[id]?.name ?? id : HEROES[id]?.name ?? id; }
export function heroTitle(id: string, locale: Locale) { return locale === 'ru' ? HERO_RU[id]?.title ?? HEROES[id]?.title ?? '' : HEROES[id]?.title ?? ''; }
export function powerName(id: string, locale: Locale) { return locale === 'ru' ? HERO_RU[id]?.powerName ?? HEROES[id]?.powerName ?? '' : HEROES[id]?.powerName ?? ''; }
export function powerText(id: string, locale: Locale) { return locale === 'ru' ? HERO_RU[id]?.powerText ?? HEROES[id]?.powerText ?? '' : (HEROES[id]?.powerText ?? '').replace(/\bgas\b/gi,'orders'); }
export function rarityName(rarity: Rarity, locale: Locale) { return locale === 'en' ? rarity : ({ common: 'Обычная', rare: 'Редкая', epic: 'Эпическая', legendary: 'Легендарная' }[rarity]); }
export function typeName(type: CardDef['type'], locale: Locale) { return locale === 'en' ? type : type === 'minion' ? 'Существо' : 'Заклинание'; }
export function keywordName(keyword: string, locale: Locale) { return locale === 'ru' ? KEYWORD_RU[keyword] ?? keyword : keyword==='Gas'?'Orders':keyword==='Mempool'?'Edicts':keyword; }

const MESSAGE_RU: Record<string, string> = {
  'Collection unavailable.': 'Коллекция недоступна.', 'The collection is loading.': 'Коллекция загружается.', 'Pack unavailable.': 'Пак недоступен.',
  'Devnet balance unavailable. Retry when the RPC responds.': 'Баланс devnet недоступен. Повторите, когда RPC снова ответит.',
  'Install Phantom to connect. Demo play is always available.': 'Установите Phantom для подключения. Демо всегда доступно.',
  'This wallet account does not support Solana devnet.': 'Этот аккаунт кошелька не поддерживает Solana devnet.',
  'Connection declined. Continue in demo mode.': 'Подключение отклонено. Можно продолжить в демо.',
  'Message signing is unavailable. Continue in demo mode.': 'Подпись сообщений недоступна. Можно продолжить в демо.',
  'A wallet request is already open.': 'В кошельке уже открыт запрос.',
  'Wallet changed. This match remains a demo.': 'Кошелёк изменился. Этот матч остаётся демо.',
  'The wallet signature did not verify.': 'Не удалось проверить подпись кошелька.',
  'Connect the same Phantom account to approve this devnet transaction.': 'Подключите тот же аккаунт Phantom для подтверждения этой транзакции devnet.',
  'This wallet does not support v0 transactions.': 'Этот кошелёк не поддерживает транзакции v0.',
  'Wallet changed while signing. Transaction was not sent.': 'Кошелёк изменился во время подписи. Транзакция не отправлена.',
  'Could not read devnet NFTs. Check collection configuration and retry. Demo cards remain playable.': 'Не удалось прочитать NFT в devnet. Проверьте настройки коллекции и повторите. Демо-карты доступны для игры.',
  'Showing the first 500 wallet assets. Some cards may require a later refresh.': 'Показаны первые 500 активов кошелька. Для остальных карт может потребоваться обновление.',
  'Browser storage is unavailable.': 'Хранилище браузера недоступно.',
  'Could not prepare the devnet pack.': 'Не удалось подготовить пак devnet.',
  'Mint confirmation or NFT read is unresolved.': 'Подтверждение минта или чтение NFT ещё не завершено.',
  'NFT ownership is not readable yet. The transaction is confirmed; retry this read before opening another pack.': 'Владение NFT пока не удалось прочитать. Транзакция подтверждена; повторите чтение перед открытием следующего пака.',
  'Could not prepare the badge.': 'Не удалось подготовить значок.', 'Transaction not confirmed.': 'Транзакция не подтверждена.',
  'Connect the collection update authority to resume setup.': 'Для продолжения подключите кошелёк с правом обновления коллекции.',
  'Could not verify these accounts.': 'Не удалось проверить эти аккаунты.',
  'A deck must contain exactly 30 cards.': 'Колода должна содержать ровно 30 карт.',
  'Deck saved in this browser. Ready for battle.': 'Колода сохранена в этом браузере. Можно начинать бой.',
  'The deck contains an unknown card.': 'Колода содержит неизвестную карту.',
  'The custom deck is invalid.': 'Пользовательская колода составлена неверно.',
  "Devnet state unavailable.": "Состояние devnet недоступно.",
  "Could not prepare this step.": "Не удалось подготовить этот шаг.",
  "Transaction not confirmed. Check the recovery addresses before retrying.": "Транзакция не подтверждена. Проверьте адреса восстановления перед повтором.",
  "A pack is already opening.": "Пак уже открывается.",
  "Not enough demo $RUG. A pack costs 50 $RUG.": "Недостаточно демо-валюты $RUG. Пак стоит 50 $RUG.",
  "Configure the IMPERIVM collection and pack type in this iDos title.": "Настройте коллекцию IMPERIVM и тип пака в этом проекте iDos.",
  "The pack must grant 5 cards and cost exactly 50 virtual RUG. Crypto payments are disabled.": "Пак должен содержать 5 карт и стоить ровно 50 виртуальных RUG. Оплата криптовалютой отключена.",
  "iDos Title ID is not configured.": "Не настроен идентификатор проекта iDos.",
  "iDos returned an invalid RUG balance.": "iDos вернул некорректный баланс RUG.",
  "The pack was processed by iDos, but its card IDs do not match IMPERIVM. Refresh the collection; do not repurchase automatically.": "iDos обработал пак, но идентификаторы карт не соответствуют IMPERIVM. Обновите коллекцию; не покупайте пак повторно автоматически.",
  "iDos leaderboard is not configured.": "Рейтинг iDos не настроен.",
  "Configure the actual public HTTPS metadata origin before minting.": "Перед минтом настройте реальный публичный HTTPS-адрес метаданных.",
  "Unknown Genesis card": "Неизвестная карта Genesis",
  "Invalid devnet deployment.": "Некорректные настройки развёртывания devnet.",
  "Win a match signed by this wallet first. Autoplay exhibitions do not count.": "Сначала победите в матче, подписанном этим кошельком. Показательные матчи в автобое не учитываются.",
  "Your badge already has this win count.": "На вашем значке уже записано это число побед.",
  "Mint First Victory badge": "Создать значок «Первая победа»",
  "Use the proof-of-play message flow.": "Используйте подпись сообщения для записи матча.",
  "The wallet changed the transaction message. It was not sent.": "Кошелёк изменил сообщение транзакции. Она не отправлена.",
  "Approve each devnet transaction separately.": "Подтвердите каждую транзакцию devnet отдельно.",
  "This transaction exceeds the wallet size limit. Split it into smaller steps.": "Размер транзакции превышает ограничение кошелька. Разделите её на несколько шагов.",
  "The blockhash expired. Prepare the transaction again.": "Срок действия хеша блока истёк. Подготовьте транзакцию заново.",
  "The simulation did not return the payer balance. Prepare again.": "Симуляция не вернула баланс плательщика. Повторите подготовку.",
  "Not enough test SOL for account rent and network fees. Use faucet.solana.com on devnet.": "Недостаточно тестовых SOL для аренды аккаунтов и комиссий сети. Пополните кошелёк devnet на faucet.solana.com.",
  "The transaction preview expired. Prepare it again.": "Срок действия предпросмотра транзакции истёк. Подготовьте её заново.",
  "The minted account is not a Metaplex Core asset.": "Созданный аккаунт не является активом Metaplex Core.",
  "NFT ownership, Genesis collection or card metadata did not verify.": "Владение NFT, коллекция Genesis или метаданные карты не прошли проверку.",
  "Wrong network. IMPERIVM only supports Solana devnet.": "Неверная сеть. IMPERIVM поддерживает только Solana devnet.",
  "The configured collection is not a Metaplex Core account.": "Настроенная коллекция не является аккаунтом Metaplex Core.",
  "This collection does not match IMPERIVM Genesis metadata.": "Коллекция не соответствует метаданным IMPERIVM Genesis.",
  "The configured account is not a Core Candy Machine.": "Настроенный аккаунт не является Core Candy Machine.",
  "Candy Machine collection, supply or random configuration is invalid.": "Неверная коллекция, объём выпуска или случайный порядок Candy Machine.",
  "Published card art is unavailable.": "Опубликованные иллюстрации карт недоступны.",
  "Create IMPERIVM Genesis collection": "Создать коллекцию IMPERIVM Genesis",
  "Connect the Genesis collection authority wallet to create its Candy Machine.": "Подключите кошелёк с правами коллекции Genesis для создания Candy Machine.",
  "Create free devnet Candy Machine · 40 cards": "Создать бесплатную Candy Machine devnet · 40 карт",
  "Connect the Candy Machine authority wallet to load cards.": "Для загрузки карт подключите кошелёк с правами Candy Machine.",
  "Config lines cannot be changed after minting starts.": "Записи карт нельзя изменить после начала минта.",
  "All forty Genesis items are already loaded.": "Все сорок карт Genesis уже загружены.",
  "Existing config lines do not match the Genesis manifest.": "Существующие записи не соответствуют списку карт Genesis.",
  "All 40 config lines must be loaded before opening NFT packs.": "Перед открытием NFT-паков необходимо загрузить все 40 карт.",
  "This devnet Genesis edition is sold out. Demo packs remain available.": "Это издание Genesis в devnet закончено. Демо-паки доступны.",
  "Candy Machine items do not match the Genesis manifest.": "Карты Candy Machine не соответствуют списку Genesis.",
  "Candy Machine mint authority does not match its Candy Guard.": "Право минта Candy Machine не соответствует её Candy Guard.",
  "The guard account is owned by the wrong program.": "Аккаунт защиты принадлежит другой программе.",
  "This machine has enabled guards. IMPERIVM permits only free devnet mints with no payment or bot tax.": "В этой машине включены ограничения. IMPERIVM разрешает только бесплатный минт devnet без оплаты и налога на ботов.",
  "Open devnet pack · one random Genesis NFT": "Открыть пак devnet · один случайный NFT Genesis",
  "cannot act: game is over": "Матч завершён; действия недоступны.",
  "summoning sickness": "Существо не может атаковать в ход призыва.",
  "staked cannot attack": "Существо в стейкинге не может атаковать.",
  "rush cannot attack hero on summon turn": "Натиск не позволяет атаковать героя в ход призыва.",
  "hero protected by Taunt": "Героя защищает существо с провокацией.",
  "must attack a Taunt": "Сначала атакуйте существо с провокацией.",
  "mulligan not allowed": "Замена стартовых карт сейчас недоступна.",
  "User rejected the request.": "Вы отклонили запрос в кошельке.",
  "User rejected the request": "Вы отклонили запрос в кошельке.",
  "User rejected the transaction.": "Вы отклонили транзакцию в кошельке.",
};
export function errorText(message: string, locale: Locale): string {
  if (locale === 'en') return message;
  if (MESSAGE_RU[message]) return MESSAGE_RU[message];
  const patterns: Array<[RegExp, (...parts: string[]) => string]> = [
    [/^Update victory badge to (\d+) wins$/, n => `Обновить значок побед: ${n}`],
    [/^Load Genesis cards (\d+)–(\d+) of 40$/, (a, b) => `Загрузить карты Genesis ${a}–${b} из 40`],
    [/^Public metadata is unavailable for (.+)\. Publish the app before creating Genesis\.$/, id => `Публичные метаданные карты «${cardName(id, locale)}» недоступны. Опубликуйте приложение до создания Genesis.`],
    [/^Metadata does not match (.+)\.$/, id => `Метаданные не соответствуют карте «${cardName(id, locale)}».`],
    [/^Devnet simulation failed: (.+)\. Check test SOL and account configuration\.$/, info => `Симуляция devnet завершилась ошибкой: ${info}. Проверьте тестовые SOL и настройки аккаунтов.`],
    [/^Transaction failed: (.+)$/, info => `Ошибка транзакции: ${info}`],
    [/^Transaction submitted \((.+?)\), but confirmation is unresolved\. Check devnet Explorer before retrying\. ?(.*)$/, (signature, info) => `Транзакция отправлена (${signature}), но подтверждение ещё не получено. Проверьте Explorer devnet перед повтором. ${info ? errorText(info, locale) : ''}`],
    [/^hero power costs (\d+), have (\d+)$/, (cost, gas) => `Сила героя стоит ${cost} приказа; доступно ${gas}.`],
    [/^illegal action: (.+)$/, () => 'Это действие сейчас недоступно.'],
    [/^card not in hand: (.+)$/, () => 'Эта карта уже не в руке.'],
    [/^attacker not found: (.+)$/, () => 'Атакующее существо больше недоступно.'],
    [/^attack target not found: (.+)$/, () => 'Цель атаки больше недоступна.'],
    [/^minion not found: (.+)$/, () => 'Существо больше недоступно.'],
  ];
  for (const [pattern, translate] of patterns) { const match = message.match(pattern); if (match) return translate(...match.slice(1)); }

  let match = /^Choose exactly 30 cards \((\d+)\/30\)\.$/.exec(message);
  if (match) return `Выберите ровно 30 карт (${match[1]}/30).`;
  match = /^(Too many copies of|You need another copy of) (.+)\.$/.exec(message);
  if (match) { const card = Object.values(CARDS).find(c => c.name === match![2]); const name = card ? cardName(card.id, locale) : match[2]; return match[1] === 'Too many copies of' ? `Слишком много копий карты «${name}».` : `Нужна ещё одна копия карты «${name}».`; }
  match = /^Deck needs 30 cards \((\d+)\/30\)\.$/.exec(message);
  if (match) return `В колоде должно быть 30 карт (${match[1]}/30).`;
  match = /^(.+): maximum (\d+) cop(?:y|ies)\.$/.exec(message);
  if (match) { const card = Object.values(CARDS).find(c => c.name === match![1]); return `${card ? cardName(card.id, locale) : match[1]}: максимум ${match[2]} копии.`; }
  return message;
}

function localizeNames(line: string) {
  const names = [...Object.values(CARDS).map(card => [card.name, CARD_RU[card.id]?.name ?? card.name]), ...Object.values(HEROES).flatMap(hero => [[hero.name, HERO_RU[hero.id]?.name ?? hero.name], [hero.powerName, HERO_RU[hero.id]?.powerName ?? hero.powerName]])].sort(([a], [b]) => b.length - a.length);
  for (const [en, ru] of names) line = line.split(en).join(ru);
  return line;
}
/** Display-only translation of the engine's authoritative English battle log. */
export function logLine(line: string, locale: Locale): string {
  if (locale === 'en') return line.replace(/\bgas\b/g,'orders').replace(/\bmempool\b/g,'edict queue');
  const player = (pid: string) => pid === '0' ? 'Вы' : 'Соперник';
  const possessive = (pid: string) => pid === '0' ? 'Ваши существа' : 'Существа соперника';
  const rules: Array<[RegExp, (...captures: string[]) => string]> = [
    [/^Game over: draw$/, () => 'Матч завершён: ничья'],
    [/^Game over: P([01]) wins$/, p => p === '0' ? 'Матч завершён: ваша победа' : 'Матч завершён: победа соперника'],
    [/^P([01]) fatigue (\d+)$/, (p, n) => `${player(p)}: истощение, ${n} урона`],
    [/^P([01]) burns (.+)$/, (p, name) => `${player(p)}: карта «${name}» сгорает`],
    [/^(.+) dies$/, name => `${name} погибает`],
    [/^P([01]) lifesteals (\d+)$/, (p, n) => `${player(p)}: похищение жизни восстанавливает ${n} здоровья казне`],
    [/^P([01]) counter fizzles \(enemy mempool empty\)$/, p => `${player(p)}: отмена не сработала — очередь указов противника пуста`],
    [/^P([01]) counters (.+)$/, (p, name) => `${player(p)}: «${name}» отменено`],
    [/^(\d+) damage to all enemy minions$/, n => `${n} урона всем вражеским существам`],
    [/^(\d+) damage to random enemy (.+)$/, (n, name) => `${n} урона случайному врагу: ${name}`],
    [/^(\d+) damage to enemy treasury$/, n => `${n} урона вражеской казне`],
    [/^P([01]) restores (\d+) treasury$/, (p, n) => `${player(p)}: казна восстанавливает ${n} здоровья`],
    [/^P([01]) restores (\d+) to own minions$/, (p, n) => `${possessive(p)} восстанавливают до ${n} здоровья`],
    [/^P([01]) weakens (.+) to (\d+) attack$/, (p, name, n) => `${player(p)}: «${name}» ослаблен, атака — ${n}`],
    [/^P([01]) weakening fizzles \(no enemy minions\)$/, p => `${player(p)}: ослабление не сработало — вражеских бойцов нет`],
    [/^P([01]) draws (\d+)$/, (p, n) => `${player(p)}: взято карт — ${n}`],
    [/^P([01]) minions \+(\d+)\/\+(\d+)$/, (p, a, h) => `${possessive(p)} получают +${a}/+${h}`],
    [/^P([01]) gains (\d+) gas$/, (p, n) => `${player(p)}: приказы +${n}`],
    [/^RUG PULL! All minions destroyed$/, () => 'РАГПУЛ! Все существа уничтожены'],
    [/^Summon fizzles \(no cardId\)$/, () => 'Призыв не сработал: карта не указана'],
    [/^Summon fizzles \(not a minion\)$/, () => 'Призыв не сработал: эта карта не существо'],
    [/^Board full — summon fizzles$/, () => 'Поле заполнено — призыв не сработал'],
    [/^P([01]) summons (.+)$/, (p, name) => `${player(p)}: призыв «${name}»`],
    [/^P([01]) pavilion bonus: (.+) \(\+1 gas\)$/, (p, faction) => `${player(p)}: бонус павильона ${faction} (+1 приказ)`],
    [/^Block (\d+) — P([01]) mulligan window open$/, (n, p) => `Блок ${n} — ${player(p)}: замена стартовых карт`],
    [/^Block (\d+) — P([01]) turn$/, (n, p) => `Блок ${n} — ${p === '0' ? 'ваш ход' : 'ход соперника'}`],
    [/^(.+) fizzles$/, name => `${name} не срабатывает`],
    [/^(.+) resolves$/, name => `${name} срабатывает`],
    [/^Halving: (.+) \+1\/\+1$/, name => `Халвинг: ${name} +1/+1`],
    [/^Game start: (.+) \(P0\) vs (.+) \(P1\)$/, (a, b) => `Начало матча: ${a} (вы) против ${b} (соперник)`],
    [/^Mulligan phase open for both players$/, () => 'Оба игрока могут заменить стартовые карты'],
    [/^P([01]) keeps opening hand$/, p => `${player(p)}: стартовая рука сохранена`],
    [/^P([01]) mulligans (\d+) card\(s\)$/, (p, n) => `${player(p)}: заменено карт — ${n}`],
    [/^P([01]) plays (.+)$/, (p, name) => `${player(p)}: разыграно «${name}»`],
    [/^P([01]) casts (.+) -> mempool$/, (p, name) => `${player(p)}: «${name}» отправлено в очередь указов`],
    [/^P([01]) (.+) hits treasury for (\d+)$/, (p, name, n) => `${player(p)}: ${name} наносит казне ${n} урона`],
    [/^(.+) trades with (.+)$/, (a, b) => `${a} сражается с ${b}`],
    [/^P([01]) hero power: (.+?)( \(comeback\))?$/, (p, name, comeback) => `${player(p)}: сила героя «${name}»${comeback ? ' (возвращение)' : ''}`],
    [/^P([01]) takes (\d+) damage$/, (p, n) => `${player(p)}: получено ${n} урона`],
    [/^P([01]) stakes (.+)$/, (p, name) => `${player(p)}: «${name}» отправлено в стейкинг`],
    [/^P([01]) unstakes (.+)$/, (p, name) => `${player(p)}: «${name}» выведено из стейкинга`],
  ];
  for (const [pattern, translate] of rules) { const match = line.match(pattern); if (match) return localizeNames(translate(...match.slice(1))); }
  return localizeNames(line);
}
