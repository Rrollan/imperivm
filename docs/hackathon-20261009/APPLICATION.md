# Тексты заявки — статус интеграции обновлён 10 октября 2026

Тексты соответствуют текущему коду и проверенному демо. Заявки отправлены; последующие проверки интеграции отмечаются отдельно. Поля о команде, финансировании, пользователях и выручке заполняет основатель по своим данным; здесь они не выдуманы.

## Product name

IMPERIVM

## Short description — EN

An imperial card battler where crypto culture becomes tactics: read a public spell queue, build faction combinations and defeat the rival Treasury.

## Product description — EN

IMPERIVM is a browser card battler set in an imperial Rome inspired by crypto culture. Players choose a ruler, build a 30-card deck and try to reduce the rival Treasury from 30 health to zero. Orders limit what can be played each turn. Some spells act immediately; delayed edicts enter a public queue, creating a visible opportunity to respond. Garrisoning a fighter trades its attack for extra resources. DeFi, NFT, DePIN and meme factions reward different sequences and formations.

The current playable build contains 99 cards and nine rulers, with 49 free base cards, 50 pack-exclusive characters, five free rulers and four case rulers. Training works without a wallet. The deck workshop, rarity frames, pack reveals and Babylon.js arena are available in the public demo. Free private duels and random matchmaking use an authoritative WebSocket service and have been tested on the iDos domain with two independent clients.

Solana integration includes Phantom/iDos wallet identity and server-side reading of the real mainnet IMP token balance. Phantom holdings and the deposited iDos game balance are shown separately. Training needs no additional match signature or SOL. Experimental Ed25519 match-participation and Metaplex Core devnet badge code are disabled by default; a live badge mint has not been verified.

iDos Title SI4IPS8B is publicly released as v28. IMP uses Solana mainnet and six decimals. The founder confirmed a real deposit and persistence after reload. Native purchases of five-card packs for 100,000 IMP, ruler cases and player-to-player card trading are enabled. Paid legendary cards have a 0.0001% chance per whole pack. Confirmed sales inform market price history stored in Supabase. The owner also confirmed opening a paid pack; two-wallet sales and withdrawals are not yet verified; integration tests cover those SDK flows. Wager-based PvP is deferred. Demo IMP is separate local test currency.

Play: https://idosgames.com/app/SI4IPS8B/

Code: https://github.com/Rrollan/imperivm

## Краткое описание — RU

Карточные дуэли в имперском Риме: криптомемы превращаются в тактику. Читай очередь указов, собирай фракционные связки и обнули казну соперника.

## Описание — RU

IMPERIVM — браузерная карточная игра в сеттинге имперского Рима и криптокультуры. Игрок выбирает правителя, собирает колоду из 30 карт и сражается за казну с 30 здоровьем. Приказы ограничивают действия за ход. Мгновенные заклинания работают сразу, отложенные указы попадают в видимую обоим игрокам очередь. Гарнизон приносит ресурс, но лишает бойца атаки. Фракции DeFi, NFT, DePIN и мемов позволяют строить разные комбинации.

Рабочая версия содержит 99 карт и 9 правителей. Бесплатная база — 49 карт и 5 правителей; ещё 50 персонажей и 4 правителя связаны с паками и кейсами. Без кошелька доступны тренировки. Работают конструктор колод, анимированное раскрытие демо-паков и новая Babylon.js арена. Бесплатные дуэли с другом и случайный подбор используют авторитетный WS-сервер; матч двух независимых клиентов проверен на домене iDos.

Реализованы Phantom/iDos вход и серверное чтение реального mainnet IMP. Токены кошелька и внесённый игровой баланс разделены. Для тренировки дополнительная подпись матча и SOL не нужны. Экспериментальный proof/NFT путь выключен по умолчанию; успешный devnet mint не подтверждён. Title SI4IPS8B публично выпущен как v28. Mainnet IMP и 6 decimals проверены; владелец подтвердил пополнение и сохранение игрового баланса. По его разрешению включены покупки паков по 100 000 IMP и торговля картами через iDos. Шанс платной легендарной — 0,0001% на весь пак; история подтверждённых продаж хранится в Supabase. Владелец также подтвердил открытие платного пака. Расчёт двух кошельков и вывод пока не подтверждены. Денежный PvP отложен.

## Technology / integration field

Next.js, React, TypeScript, Babylon.js, authoritative Node.js WebSocket server for private duels and random matchmaking; Solana wallet identity and exact mainnet IMP balance reading; iDos Games SDK with Title SI4IPS8B and live static v28. Experimental off-chain participation signatures and Metaplex Core devnet badge code are disabled by default. iDos Main decimals are six; native IMP purchases and card trading are enabled, with real settlement and withdrawals still awaiting live verification. Local demo IMP is separate.

## Development history field

The inspected repository history starts on 3 October 2026, within the Crypto World's Fair build window. During the hackathon the project developed its card engine, new imperial arena, wallet/iDos adapters, collection economy, nine rulers, 99-card library and deck workshop. The founder must disclose any relevant development that existed outside this repository before the event. AI-assisted code and media work should be described accurately; do not imply every illustration or module was handcrafted.

## Required links and owner facts

| Field | Value / action |
| --- | --- |
| GitHub | https://github.com/Rrollan/imperivm — repository, not profile |
| Browser demo | https://idosgames.com/app/SI4IPS8B/ |
| iDos public game | https://si4ips8b.idos.games/ |
| iDos catalog URL | https://idosgames.com/app/SI4IPS8B/ — public v28 verified |
| Mainnet token | [Verified mint](https://explorer.solana.com/address/7nfdxHzxab9UBhsZd8RCbWqDN45xJMuX33Pkpibeidos); wallet balance and deposit persistence confirmed; paid pack opening confirmed by owner; two-wallet settlement/withdrawals await live verification |
| Demo video | https://youtu.be/qCE7RaiwSAQ — загружено пользователем 10 октября; демо-монтаж 1:48, 1080p. URL сохранён в форме Colosseum 10 октября |
| Pitch video | https://youtu.be/EQX3xrAf2e4 — загружено пользователем, 1:52; URL сохранён в Colosseum 10 октября. [PITCH-READY.md](PITCH-READY.md). Форма Colosseum указывает до 2 минут |
| Deck | Export/share the reviewed PPTX after final integration-status update |
| Founder | Rollan Rogozhin, Founder & Developer — confirm spelling in profile |
| Other team members | Add only actual participants; each fills a profile |
| Submission profile | Сохранён и отмечен Complete в Colosseum 10 октября по данным пользователя. Финансирование и метрики не выдуманы |
| Colosseum submitted? | Yes — Submitted, https://colosseum.com/arena/projects/pichat |

## After integration is actually complete

Replace the pending integration paragraph with verified facts: TitleID/catalog URL, mainnet mint and real in-game token function, observed wallet flow, NFT network/transaction, exact live payment test status. Keep demo and mainnet balances labelled separately. Do not copy a future-tense plan into a past-tense success claim.

The [official Colosseum form guidance](https://colosseum.com/hackathon) also asks about demand, distribution and team fit. The deck stays within the user's hackathon scope. If the form requires those answers, use actual founder facts rather than inventing traction or adding an unapproved post-hackathon strategy.

## Заявки отправлены

10 октября 2026 Colosseum подтвердил **Submitted** и entered for judging (11:22 AM PDT / 23:22 Asia/Almaty). Project details, оба видео и профиль основателя сохранены; Team — 1 of 1 complete. Публичная страница: https://colosseum.com/arena/projects/pichat. Второй ролик: [PITCH-READY.md](PITCH-READY.md).

Superteam: пользователь подал заявку самостоятельно. По его отдельному разрешению ответ о подаче в Colosseum обновлён с No на **Yes**, сохранён и повторно проверен. Трек: https://superteam.fun/earn/listing/superteam-kazakhstan-x-idos-games-side-track. Профиль участника: https://superteam.fun/earn/t/Rollan.

iDos: заявка сохранена; UI показал **Принята · В лидeрборде**. https://idosgames.com/contest/solana-superteam-kz/?tab=leaderboard#row-SI4IPS8B. Это подтверждение подачи, не результат судейства.

Владелец дополнительно подтвердил открытие платного пака. Живые сделка двух кошельков и вывод ещё требуют проверки.

Ниже — развёрнутые исходные тексты. В форме Colosseum 10 октября сохранены их версии с учётом лимитов 500/1000 символов; текущий проверенный статус интеграции сохранён.

### Brief introduction

An imperial card battler where crypto culture becomes tactics. Read a public spell queue, build faction combinations and defeat the rival Treasury. 99 cards, nine rulers, free starter decks and a new browser arena. Training works without a wallet.

### What are you building?

IMPERIVM is a browser card battler for card-game players and crypto communities. Choose a ruler, build a 30-card deck and reduce the rival Treasury from 30 health to zero. Orders limit actions; instant spells resolve immediately, while delayed edicts enter a public queue and give the opponent time to respond. Garrisoning a fighter earns resources but gives up its attack. DeFi, NFT, DePIN and meme factions support conditional combinations. The playable build has 99 cards, nine rulers, free starter decks, a collection workshop, sequential pack reveals and an imperial Babylon.js arena. AI training works without a wallet. Free private duels and random matchmaking use an authoritative WebSocket service and have been tested on iDos with two independent clients.

### Why are you building this?

We are building a card game that is enjoyable before players connect a wallet. Crypto culture gives it a distinctive tactical language: public mempools, priority, staking and halving become readable game rules in an imperial Roman setting. The hackathon is an opportunity to turn that theme into a working browser product and connect identity and collectibles through Solana and iDos. Our focus for this submission is the playable duel, useful deck-building tools and clearly labelled integration status.

### Technologies

Next.js, React, TypeScript, Tailwind CSS, Babylon.js, Node.js WebSocket server; Solana web3.js, Phantom and wallet-standard APIs; exact mainnet token balance reading; @idosgames/core and @idosgames/wallet adapters. Experimental Ed25519 participation and Metaplex Core devnet badge code are disabled by default. AI-assisted code and artwork with Codex and Google Flow. Public v28 on iDos; Render hosts the multiplayer and integration services.

### Solana usage

Phantom/iDos wallet identity and exact mainnet IMP balance reading are implemented. Training needs no additional match signature or SOL. The founder launched SPL IMP on mainnet; its mint, six decimals and token balance were verified read-only. iDos Main decimals have been corrected to six. v28 is publicly live on iDos. The owner confirmed a real deposit and persistence after reloading. Native pack purchases and player-to-player card trading are enabled; two-wallet settlement and withdrawals still need verification. Current source code is in the rebirth branch. Experimental participation signatures and devnet badge code are disabled by default; NFT mint is unverified. Demo IMP is local test currency.

### Additional context for judges

The game is publicly available on iDos Games; Render hosts multiplayer and integration services. Current source code is in the rebirth branch. Repository history begins 3 Oct 2026. Game turns are local game actions, not chain transactions. Mainnet IMP mint, six decimals, balance reading and a real deposit with persistence have been verified. Free random PvP was tested with two independent clients. Native purchases and card trading are enabled; two-wallet settlement and withdrawals still need verification. Wager-based PvP is deferred and experimental NFT badges are disabled. [Release evidence](https://github.com/Rrollan/imperivm/blob/rebirth/docs/idos/public-release-20261010.md).
