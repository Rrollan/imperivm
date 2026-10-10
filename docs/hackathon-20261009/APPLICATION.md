# Тексты заявки — статус интеграции обновлён 10 октября 2026

Тексты соответствуют текущему коду и проверенному демо. Перед submit обновить статус iDos/mainnet после фактической проверки. Поля о команде, финансировании, пользователях и выручке заполняет основатель по своим данным; здесь они не выдуманы.

## Product name

IMPERIVM

## Short description — EN

An imperial card battler where crypto culture becomes tactics: read a public spell queue, build faction combinations and defeat the rival Treasury.

## Product description — EN

IMPERIVM is a browser card battler set in an imperial Rome inspired by crypto culture. Players choose a ruler, build a 30-card deck and try to reduce the rival Treasury from 30 health to zero. Orders limit what can be played each turn. Some spells act immediately; delayed edicts enter a public queue, creating a visible opportunity to respond. Garrisoning a fighter trades its attack for extra resources. DeFi, NFT, DePIN and meme factions reward different sequences and formations.

The current playable build contains 99 cards and nine rulers, with 49 free base cards, 50 pack-exclusive characters, five free rulers and four case rulers. Training works without a wallet. The deck workshop, rarity frames, pack reveals and Babylon.js arena are available in the public demo. Free private duels and random matchmaking use an authoritative WebSocket service and have been tested on the iDos domain with two independent clients.

Solana integration includes Phantom/iDos wallet identity and server-side reading of the real mainnet IMP token balance. Phantom holdings and the deposited iDos game balance are shown separately. Training needs no additional match signature or SOL. Experimental Ed25519 match-participation and Metaplex Core devnet badge code are disabled by default; a live badge mint has not been verified.

iDos Title SI4IPS8B is publicly released as v26. IMP uses Solana mainnet and six decimals. The founder confirmed a real deposit and persistence after reload. Native purchases of five-card packs for 100,000 IMP, ruler cases and player-to-player card trading are enabled. Paid legendary cards have a 0.0001% chance per whole pack. Confirmed sales inform market price history stored in Supabase. Live pack settlement, two-wallet sales and withdrawals are not yet verified; integration tests cover those SDK flows. Wager-based PvP is deferred. Demo IMP is separate local test currency.

Play: https://idosgames.com/app/SI4IPS8B/

Code: https://github.com/Rrollan/imperivm

## Краткое описание — RU

Карточные дуэли в имперском Риме: криптомемы превращаются в тактику. Читай очередь указов, собирай фракционные связки и обнули казну соперника.

## Описание — RU

IMPERIVM — браузерная карточная игра в сеттинге имперского Рима и криптокультуры. Игрок выбирает правителя, собирает колоду из 30 карт и сражается за казну с 30 здоровьем. Приказы ограничивают действия за ход. Мгновенные заклинания работают сразу, отложенные указы попадают в видимую обоим игрокам очередь. Гарнизон приносит ресурс, но лишает бойца атаки. Фракции DeFi, NFT, DePIN и мемов позволяют строить разные комбинации.

Рабочая версия содержит 99 карт и 9 правителей. Бесплатная база — 49 карт и 5 правителей; ещё 50 персонажей и 4 правителя связаны с паками и кейсами. Без кошелька доступны тренировки. Работают конструктор колод, анимированное раскрытие демо-паков и новая Babylon.js арена. Бесплатные дуэли с другом и случайный подбор используют авторитетный WS-сервер; матч двух независимых клиентов проверен на домене iDos.

Реализованы Phantom/iDos вход и серверное чтение реального mainnet IMP. Токены кошелька и внесённый игровой баланс разделены. Для тренировки дополнительная подпись матча и SOL не нужны. Экспериментальный proof/NFT путь выключен по умолчанию; успешный devnet mint не подтверждён. Title SI4IPS8B публично выпущен как v26. Mainnet IMP и 6 decimals проверены; владелец подтвердил пополнение и сохранение игрового баланса. По его разрешению включены покупки паков по 100 000 IMP и торговля картами через iDos. Шанс платной легендарной — 0,0001% на весь пак; история подтверждённых продаж хранится в Supabase. Живые покупка пака, расчёт двух кошельков и вывод пока не подтверждены. Денежный PvP отложен.

## Technology / integration field

Next.js, React, TypeScript, Babylon.js, authoritative Node.js WebSocket server for private duels and random matchmaking; Solana wallet identity and exact mainnet IMP balance reading; iDos Games SDK with Title SI4IPS8B and live static v26. Experimental off-chain participation signatures and Metaplex Core devnet badge code are disabled by default. iDos Main decimals are six; native IMP purchases and card trading are enabled, with real settlement and withdrawals still awaiting live verification. Local demo IMP is separate.

## Development history field

The inspected repository history starts on 3 October 2026, within the Crypto World's Fair build window. During the hackathon the project developed its card engine, new imperial arena, wallet/iDos adapters, collection economy, nine rulers, 99-card library and deck workshop. The founder must disclose any relevant development that existed outside this repository before the event. AI-assisted code and media work should be described accurately; do not imply every illustration or module was handcrafted.

## Required links and owner facts

| Field | Value / action |
| --- | --- |
| GitHub | https://github.com/Rrollan/imperivm — repository, not profile |
| Browser demo | https://idosgames.com/app/SI4IPS8B/ |
| iDos public game | https://si4ips8b.idos.games/ |
| iDos catalog URL | https://idosgames.com/app/SI4IPS8B/ — public v26 verified |
| Mainnet token | [Verified mint](https://explorer.solana.com/address/7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos); wallet balance and deposit persistence confirmed; native pack settlement/withdrawals await live verification |
| Demo video | Public/unlisted working-product recording, ≤3 minutes |
| Pitch video | ≤2 minutes in the inspected live form; founder on camera or voice with clear identity |
| Deck | Export/share the reviewed PPTX after final integration-status update |
| Founder | Rollan Rogozhin, Founder & Developer — confirm spelling in profile |
| Other team members | Add only actual participants; each fills a profile |
| City / country, experience, funding, traction | Founder supplies actual facts; not independently established by this audit |
| Colosseum submitted? | Yes only after final submit, with project link |

## After integration is actually complete

Replace the pending integration paragraph with verified facts: TitleID/catalog URL, mainnet mint and real in-game token function, observed wallet flow, NFT network/transaction, exact live payment test status. Keep demo and mainnet balances labelled separately. Do not copy a future-tense plan into a past-tense success claim.

The [official Colosseum form guidance](https://colosseum.com/hackathon) also asks about demand, distribution and team fit. The deck stays within the user's hackathon scope. If the form requires those answers, use actual founder facts rather than inventing traction or adding an unapproved post-hackathon strategy.

## Сохранено в Colosseum

9 октября обновлены project details и Media draft. Новая аватарка создана из эмблемы сайта; category Gaming, сайт и GitHub актуальны. Публичная страница: https://colosseum.com/arena/projects/pichat. Финальная заявка не отправлена. Обязательные ссылки на demo и pitch пустые; профиль участника не завершён.

Следующие тексты обновлены локально для следующего сохранения; это не подтверждение повторного сохранения формы 10 октября.

### Brief introduction

An imperial card battler where crypto culture becomes tactics. Read a public spell queue, build faction combinations and defeat the rival Treasury. 99 cards, nine rulers, free starter decks and a new browser arena. Training works without a wallet.

### What are you building?

IMPERIVM is a browser card battler for card-game players and crypto communities. Choose a ruler, build a 30-card deck and reduce the rival Treasury from 30 health to zero. Orders limit actions; instant spells resolve immediately, while delayed edicts enter a public queue and give the opponent time to respond. Garrisoning a fighter earns resources but gives up its attack. DeFi, NFT, DePIN and meme factions support conditional combinations. The playable build has 99 cards, nine rulers, free starter decks, a collection workshop, sequential pack reveals and an imperial Babylon.js arena. AI training works without a wallet. Free private duels and random matchmaking use an authoritative WebSocket service and have been tested on iDos with two independent clients.

### Why are you building this?

We are building a card game that is enjoyable before players connect a wallet. Crypto culture gives it a distinctive tactical language: public mempools, priority, staking and halving become readable game rules in an imperial Roman setting. The hackathon is an opportunity to turn that theme into a working browser product and connect identity and collectibles through Solana and iDos. Our focus for this submission is the playable duel, useful deck-building tools and clearly labelled integration status.

### Technologies

Next.js, React, TypeScript, Tailwind CSS, Babylon.js, Node.js WebSocket server; Solana web3.js, Phantom and wallet-standard APIs; exact mainnet token balance reading; @idosgames/core and @idosgames/wallet adapters. Experimental Ed25519 participation and Metaplex Core devnet badge code are disabled by default. AI-assisted code and artwork with Codex and Google Flow. Public v26 on iDos; Render hosts the multiplayer and integration services.

### Solana usage

Phantom/iDos wallet identity and exact mainnet IMP balance reading are implemented. Training needs no additional match signature or SOL. The founder launched SPL IMP on mainnet; its mint, six decimals and token balance were verified read-only. iDos Main decimals have been corrected to six. v13 is staged on iDos. Owner wallet/payment testing and catalog release remain pending; purchases are disabled. Experimental participation signatures and devnet badge code are disabled by default; NFT mint is unverified. Demo IMP is local test currency.

### Additional context for judges

The playable demo is on Render and the current staged test is on iDos; GitHub main contains the new imperial arena. Repository history begins 3 Oct 2026. Game blocks are local turns, not chain transactions. Mainnet IMP mint, six decimals and read-only balance are verified. Free random PvP was tested on the iDos domain with the production server. Owner wallet/payment tests and catalog release remain pending. [Current test and integration status](https://github.com/Rrollan/imperivm/blob/main/docs/idos/SI4IPS8B-integration.md). This is an in-progress hackathon draft; wager-based PvP is not implemented and NFT mint is unverified.
