'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import WalletBar from './WalletBar';
import { useLocale } from './LocaleContext';
import { useCollection } from './CollectionContext';
import ArenaSettings, { useBoardSkin } from './ArenaSettings';
import ArtImg from './ArtImg';
import { CoinPreview } from './3d/CoinPreview';
import { HEROES } from '../lib/heroes';
import { CARDS } from '../lib/cards';
import { ARENA_RARITIES, RUG_STAKES, createRoomCode, normalizeRoomCode, validRoomCode, validateLobbyTerms, type LobbyTerms, type StakeMode } from '../lib/ui/arenaLobby';

type Screen = 'gates' | 'online' | 'private' | 'confirm' | 'search' | 'room';
type Room = { code: string; joining: boolean };
const INITIAL_TERMS: LobbyTerms = { mode: 'rug', amount: 25, cardId: '', rarity: 'common' };

export default function ArenaGates() {
  const params = useSearchParams();
  const { t, heroName, cardName, rarityName } = useLocale();
  const { snapshot, busy, error, refresh } = useCollection();
  const [skin, setSkin] = useBoardSkin();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hero, setHero] = useState('whale');
  const [screen, setScreen] = useState<Screen>('gates');
  const [origin, setOrigin] = useState<'online' | 'private'>('online');
  const [terms, setTerms] = useState<LobbyTerms>(INITIAL_TERMS);
  const [join, setJoin] = useState(false), [code, setCode] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => { const value = params.get('hero'); if (value && HEROES[value]) setHero(value); }, [params]);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [screen]);
  // A refresh after opening packs/settings cannot leave a stale stake confirmation enabled.
  const problem = validateLobbyTerms(terms, snapshot);
  const problemText = problem === 'collection' ? t('Дождитесь загрузки коллекции.', 'Wait for your collection to load.')
    : problem === 'balance' ? t('Недостаточно $RUG для этой ставки.', 'Not enough $RUG for this stake.')
    : problem === 'ownership' ? t('Выберите одну карту из своей коллекции.', 'Select one card from your collection.')
    : problem === 'rarity' ? t('Редкость карты должна совпадать с редкостью дуэли.', 'Your card rarity must match the duel rarity.')
    : problem === 'amount' ? t('Выберите доступную ставку.', 'Choose an available stake.') : '';
  const titles: Record<Screen, string> = {
    gates: t('Врата арены', 'Arena gates'), online: t('Онлайн-дуэль', 'Online duel'), private: t('Своя игра', 'Private game'),
    confirm: t('Печать дуэли', 'Seal the duel'), search: t('Поиск соперника', 'Finding an opponent'), room: t('Комната для друга', 'Room for a friend'),
  };
  function chooseOrigin(value: 'online' | 'private') {
    setOrigin(value); setTerms({ ...INITIAL_TERMS, mode: value === 'private' ? 'free' : 'rug' });
    setJoin(false); setCode(''); setRoom(null); setAcknowledged(false); setScreen(value);
  }
  function setMode(mode: StakeMode) { setTerms(value => ({ ...value, mode })); setAcknowledged(false); }
  function confirm() { if (!problem) { setAcknowledged(false); setScreen('confirm'); } }
  function enter() {
    if (problem || (terms.mode !== 'free' && !acknowledged)) return;
    if (origin === 'online') setScreen('search');
    else { setRoom({ code: createRoomCode(), joining: false }); setCopyState('idle'); setScreen('room'); }
  }
  async function copyCode() {
    if (!room) return;
    try { await navigator.clipboard.writeText(room.code); setCopyState('copied'); }
    catch { setCopyState('failed'); }
  }
  const stakeLabel = terms.mode === 'free' ? t('Бесплатно', 'Free') : terms.mode === 'rug' ? `${terms.amount} $RUG` : `${cardName(terms.cardId)} · ${rarityName(terms.rarity)}`;
  const ownedCards = Object.values(CARDS).filter(card => (snapshot?.owned[card.id] ?? 0) > 0);

  return <div className={`arena-scene board-${skin}`} style={{ ['--board-art' as string]: `url('/boards/${skin}.webp')` }}>
    <WalletBar onSettings={() => setSettingsOpen(true)} />
    <main className={`gates-main gates-screen-${screen}`}>
      <div className="gates-topline"><Link href="/" className="quiet-link">{t('← Императоры', '← Imperators')}</Link><span>{t('РИМСКИЙ ФОРУМ · ВЫБОР РЕЖИМА', 'ROMAN FORUM · CHOOSE YOUR MODE')}</span><span className="gates-chapter">III · ARENA</span></div>
      <div className="gates-heading"><p className="eyebrow">VENI · VIDI · RUGI</p><h1 ref={heading} tabIndex={-1}>{titles[screen]}</h1><p>{screen === 'gates' ? t('Каждые врата — свой путь к победе.', 'Every gate leads to a different kind of victory.') : t('Условия ясны до первого хода.', 'Know the terms before the first move.')}</p></div>
      {screen === 'gates' ? <>
        <div className="arena-gates">
          <article className="arena-gate gate-training"><span className="gate-numeral">I</span><div className="gate-arch"><CoinPreview model="brazier" size="100%" autoRotate={false} className="gate-vignette" label={t('Жаровня тренировочного легиона', 'Training legion brazier')} /></div><div className="gate-copy"><p className="gate-kicker">{t('ОТТОЧИТЕ ТАКТИКУ', 'HONE YOUR TACTICS')}</p><h2>{t('Тренировка', 'Training')}</h2><p>{t('Ваш легион против ИИ. Учитесь читать мемпул и управлять казной.', 'Your legion against AI. Master the mempool and command your Treasury.')}</p><span className="gate-terms">{t('Всегда бесплатно · без кошелька', 'Always free · no wallet needed')}</span><Link className="gold-button" href={`/game?hero=${hero}`}>{t('Начать тренировку', 'Start training')} →</Link></div></article>
          <article className="arena-gate gate-duel"><span className="gate-numeral">II</span><div className="gate-arch"><CoinPreview model="coin-rug" size="100%" autoRotate={false} className="gate-vignette" label={t('Золотая монета $RUG', 'Golden $RUG coin')} /></div><div className="gate-copy"><p className="gate-kicker">{t('ПОБЕДИТЕЛЮ — ВСЁ', 'WINNER TAKES ALL')}</p><h2>{t('Онлайн-дуэль', 'Online duel')}</h2><p>{t('Испытайте волю соперника. Дуэль на ставку $RUG или на карту.', 'Test a rival’s resolve. Duel for a $RUG stake or a card.')}</p><span className="gate-terms">{t('Лобби доступно · сеть позже', 'Lobby ready · network coming later')}</span><button className="gold-button" onClick={() => chooseOrigin('online')}>{t('Выбрать ставку', 'Choose a stake')} →</button></div></article>
          <article className="arena-gate gate-private"><span className="gate-numeral">III</span><div className="gate-arch"><CoinPreview model="laurel-wreath" size="100%" autoRotate={false} className="gate-vignette" label={t('Лавровый венок союзников', 'Allies’ laurel wreath')} /></div><div className="gate-copy"><p className="gate-kicker">{t('ПРИГЛАСИТЕ СОЮЗНИКА', 'INVITE AN ALLY')}</p><h2>{t('Своя игра', 'Private game')}</h2><p>{t('Вызовите друга. Одна комната, один код, ваши правила дуэли.', 'Challenge a friend. One room, one code, your duel terms.')}</p><span className="gate-terms">{t('Бесплатно / на карту / на $RUG', 'Free / a card / $RUG')}</span><button className="gold-button" onClick={() => chooseOrigin('private')}>{t('Открыть комнату', 'Open a room')} →</button></div></article>
        </div>
        <section className="gates-hero-strip" aria-label={t('Ваш император', 'Your Imperator')}><div><span className="eyebrow">{t('ВАШ ИМПЕРАТОР', 'YOUR IMPERATOR')}</span><strong>{heroName(hero)}</strong></div><div className="gates-hero-options">{Object.values(HEROES).map(h => <button key={h.id} className="hero-seal" aria-pressed={h.id === hero} aria-label={heroName(h.id)} title={heroName(h.id)} onClick={() => setHero(h.id)}><img src={`/heroes/${h.id}.webp`} alt="" />{h.id === hero && <span>✓</span>}</button>)}</div><p>{t('Сетевой бой — следующий этап. Сейчас ставки и комнаты — предпросмотр без списаний.', 'Network battles are the next stage. Stakes and rooms are previews with no deductions.')}</p></section>
      </> : <section className="lobby-stone">
        <div className="lobby-breadcrumb"><button className="secondary-button" onClick={() => { setScreen('gates'); setAcknowledged(false); }}>{t('← Все врата', '← All gates')}</button><span>{heroName(hero)}</span></div>
        {(screen === 'online' || screen === 'private') && <>
          <p className="lobby-preview-note">{t('ПРЕДПРОСМОТР ЛОББИ · СЕТЕВОЙ БОЙ — СЛЕДУЮЩИЙ ЭТАП', 'LOBBY PREVIEW · NETWORK BATTLES ARE THE NEXT STAGE')}</p>
          {screen === 'private' && <div className="lobby-tabs" role="group" aria-label={t('Действие с комнатой', 'Room action')}><button className="secondary-button" aria-pressed={!join} onClick={() => setJoin(false)}>{t('Создать комнату', 'Create a room')}</button><button className="secondary-button" aria-pressed={join} onClick={() => setJoin(true)}>{t('Войти по коду', 'Join by code')}</button></div>}
          {screen === 'private' && join ? <form className="join-form" onSubmit={e => { e.preventDefault(); if (validRoomCode(code)) { setRoom({ code: normalizeRoomCode(code), joining: true }); setCopyState('idle'); setScreen('room'); } }}>
            <label htmlFor="room-code">{t('Код комнаты · 6 символов', 'Room code · 6 characters')}</label><input id="room-code" className="room-code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} pattern="[A-Za-z0-9]{6}" placeholder="ABC123" aria-describedby="room-code-hint" />
            <p id="room-code-hint">{code && !validRoomCode(code) ? t('Нужны ровно 6 латинских букв или цифр.', 'Enter exactly 6 Latin letters or digits.') : t('Попросите код у друга. Условия появятся после подключения сети.', 'Ask your friend for the code. Terms will appear once networking is connected.')}</p>
            <button className="gold-button" type="submit" disabled={!validRoomCode(code)}>{t('Войти в комнату', 'Enter room')} →</button><p className="small-note">{t('Сейчас открывается предпросмотр. Существование комнаты и код на сервере пока не проверяются.', 'This opens a preview. Room existence and the code are not checked by a server yet.')}</p>
          </form> : <>
            <div className="stake-tabs" role="group" aria-label={t('Условия дуэли', 'Duel terms')}>{(screen === 'private' ? ['free', 'rug', 'card'] as const : ['rug', 'card'] as const).map(mode => <button key={mode} className="secondary-button" aria-pressed={terms.mode === mode} onClick={() => setMode(mode)}>{mode === 'free' ? t('Бесплатно', 'Free') : mode === 'rug' ? t('На ставку $RUG', 'For $RUG') : t('На карту', 'For a card')}</button>)}</div>
            {terms.mode === 'free' && <div className="free-lobby"><span aria-hidden>❧</span><h2>{t('Дружеская дуэль', 'Friendly duel')}</h2><p>{t('Без ставки. Только тактика и честь легиона.', 'No stake. Just tactics and the honor of your legion.')}</p></div>}
            {terms.mode === 'rug' && <div className="rug-lobby"><h2>{t('Размер ставки', 'Stake amount')}</h2><p>{t('Оба вносят одинаковую сумму. Победитель забирает весь банк.', 'Both players contribute the same amount. The winner takes the whole pot.')}</p><div className="rug-amounts">{RUG_STAKES.map(amount => <button className="secondary-button" key={amount} aria-pressed={terms.amount === amount} onClick={() => setTerms(value => ({ ...value, amount }))}>{amount} <small>$RUG</small></button>)}</div><div className="stake-ledger"><span>{t('Ваша ставка', 'Your stake')}<b>{terms.amount} $RUG</b></span><span>{t('Банк победителя', 'Winner’s pot')}<b>{terms.amount * 2} $RUG</b></span><span>{t('Баланс коллекции', 'Collection balance')}<b>{snapshot?.rug ?? '—'} $RUG</b></span></div></div>}
            {terms.mode === 'card' && <div className="card-lobby"><h2>{t('Дуэль до карты', 'Duel for a card')}</h2><p>{t('Каждый ставит одну карту. Победитель забирает обе. Допускаются только карты одинаковой редкости.', 'Each player stakes one card. The winner takes both. Only cards of the same rarity can be paired.')}</p><div className="rarity-tabs" role="group" aria-label={t('Редкость дуэли', 'Duel rarity')}>{ARENA_RARITIES.map(rarity => <button key={rarity} className="secondary-button" aria-pressed={terms.rarity === rarity} onClick={() => setTerms(value => ({ ...value, rarity, cardId: '' }))}>{rarityName(rarity)}</button>)}</div><p className="rarity-rule">{t('Карта соперника должна иметь редкость:', 'Opponent’s card must be:')} <b>{rarityName(terms.rarity)}</b></p><p>{t('Выберите свою карту явно — автоматической ставки нет.', 'Choose your own card explicitly — there is no automatic stake.')}</p><div className="stake-card-grid">{ownedCards.map(card => <button key={card.id} className="stake-card" aria-pressed={terms.cardId === card.id} disabled={card.rarity !== terms.rarity} onClick={() => setTerms(value => ({ ...value, cardId: card.id }))}><ArtImg src={`/cards/${card.id}.webp`} alt="" letter="✦" /><span><b>{cardName(card.id)}</b><small>{rarityName(card.rarity)} · ×{snapshot?.owned[card.id]}</small></span>{terms.cardId === card.id && <i>✓</i>}</button>)}</div>{!busy && !ownedCards.some(card => card.rarity === terms.rarity) && <p className="lobby-error">{t('У вас нет карт этой редкости. Выберите другую редкость или откройте пак.', 'You have no cards of this rarity. Choose another rarity or open a pack.')} <Link href="/packs">{t('К пакам →', 'Open packs →')}</Link></p>}</div>}
            {busy && <p role="status">{t('Загружаем коллекцию…', 'Loading collection…')}</p>}
            {error && <p className="lobby-error" role="status">{t('Коллекция недоступна.', 'Collection unavailable.')} <button className="secondary-button" onClick={() => void refresh()}>{t('Повторить', 'Retry')}</button></p>}
            {problemText && <p className="lobby-error" role="status">{problemText}</p>}
            <p className="small-note">{t('Это макет условий: $RUG и карты не блокируются и не списываются.', 'These are preview terms: $RUG and cards are neither locked nor deducted.')}</p><button className="gold-button lobby-next" disabled={!!problem || busy} onClick={confirm}>{t('Проверить условия', 'Review terms')} →</button>
          </>}
        </>}
        {screen === 'confirm' && <>
          <p className="lobby-preview-note">{t('ПОДТВЕРЖДЕНИЕ · ПРЕДПРОСМОТР', 'CONFIRMATION · PREVIEW')}</p><div className="duel-confirm"><span className="seal-emblem" aria-hidden>⚔</span><h2>{origin === 'private' ? t('Создать комнату на этих условиях?', 'Create a room with these terms?') : t('Войти в лобби на этих условиях?', 'Enter the lobby with these terms?')}</h2><dl><div><dt>{t('Ваш император', 'Your Imperator')}</dt><dd>{heroName(hero)}</dd></div><div><dt>{t('Ваша ставка', 'Your stake')}</dt><dd>{stakeLabel}</dd></div><div><dt>{t('Победителю', 'Winner receives')}</dt><dd>{terms.mode === 'rug' ? `${terms.amount * 2} $RUG` : terms.mode === 'card' ? t('Обе карты', 'Both cards') : t('Честь и слава', 'Honor and glory')}</dd></div>{terms.mode === 'card' && <div><dt>{t('Допуск соперника', 'Opponent eligibility')}</dt><dd>{t('Только', 'Only')} {rarityName(terms.rarity)}</dd></div>}</dl>
          {terms.mode !== 'free' && <div className="stake-warning"><strong>{t('Внимание: риск потери ставки', 'Warning: you can lose your stake')}</strong><p>{terms.mode === 'card' ? t('В будущем сетевом бою проигравший отдаёт выбранную карту победителю. Соперник должен поставить карту той же редкости; иная пара недопустима.', 'In a future network battle, the loser gives the selected card to the winner. The opponent must stake a card of the same rarity; a different rarity cannot be paired.') : t('В будущем сетевом бою проигравший теряет всю сумму ставки. Победитель забирает обе ставки.', 'In a future network battle, the loser loses the full stake. The winner receives both stakes.')}</p><label><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} />{t('Я понимаю условия и риск потери ставки.', 'I understand the terms and the risk of losing my stake.')}</label></div>}
          <p className="small-note">{t('Сейчас подтверждение открывает только UX лобби. Нет перевода средств, карт или запроса подписи.', 'Confirmation currently opens only the lobby preview. No funds or cards are transferred and no signature is requested.')}</p>{problemText && <p className="lobby-error" role="status">{problemText}</p>}<div className="lobby-actions"><button className="secondary-button" onClick={() => setScreen(origin)}>{t('Изменить условия', 'Edit terms')}</button><button className="gold-button" disabled={!!problem || busy || (terms.mode !== 'free' && !acknowledged)} onClick={enter}>{origin === 'private' ? t('Создать комнату', 'Create room') : t('В бой', 'To battle')} →</button></div></div>
        </>}
        {screen === 'search' && <div className="waiting-lobby"><div className="search-seal" aria-hidden><span>⚔</span></div><p className="eyebrow">{t('ЛОББИ ОНЛАЙН-ДУЭЛИ', 'ONLINE DUEL LOBBY')}</p><h2>{t('Поиск соперника', 'Finding an opponent')}</h2><p className="waiting-terms">{stakeLabel}</p>{terms.mode === 'card' && <p>{t('Будет подобрана только карта той же редкости.', 'Only a card of the same rarity will be matched.')}</p>}<div className="network-boundary"><b>{t('Сетевой бой — следующий этап', 'Network battles are the next stage')}</b><p>{t('Это экран ожидания для предпросмотра. Поиск на сервере ещё не запущен. Ставка остаётся у вас.', 'This is the waiting screen preview. Server matchmaking is not running yet. Your stake stays with you.')}</p></div><div className="lobby-actions"><button className="secondary-button" onClick={() => { setAcknowledged(false); setScreen('online'); }}>{t('Отменить поиск', 'Cancel search')}</button><Link className="gold-button" href={`/game?hero=${hero}`}>{t('Пока — тренировка', 'Train while you wait')} →</Link></div></div>}
        {screen === 'room' && room && <div className="waiting-lobby"><p className="eyebrow">{room.joining ? t('ВХОД ПО КОДУ · ПРЕДПРОСМОТР', 'JOIN BY CODE · PREVIEW') : t('ВАША КОМНАТА · ПРЕДПРОСМОТР', 'YOUR ROOM · PREVIEW')}</p><h2>{t('Ожидание друга', 'Waiting for a friend')}</h2><p>{t('Код комнаты', 'Room code')}</p><strong className="room-code-display" aria-label={`${t('Код комнаты', 'Room code')}: ${room.code}`}>{room.code}</strong><button className="secondary-button" onClick={() => void copyCode()}>{copyState === 'copied' ? t('✓ Скопировано', '✓ Copied') : t('Скопировать код', 'Copy code')}</button><p className="copy-status" role="status">{copyState === 'failed' ? t('Не удалось скопировать. Выделите код и скопируйте вручную.', 'Could not copy. Select the code and copy it manually.') : copyState === 'copied' ? t('Код в буфере обмена.', 'Code copied to clipboard.') : ''}</p><p className="waiting-terms">{room.joining ? t('Условия друга пока неизвестны', 'Your friend’s terms are not known yet') : stakeLabel}</p>{!room.joining && terms.mode === 'card' && <p>{t('Друг должен выбрать карту той же редкости:', 'Your friend must choose a card of the same rarity:')} {rarityName(terms.rarity)}</p>}<div className="network-boundary"><b>{t('Комната пока локальный предпросмотр', 'This room is a local preview')}</b><p>{t('Код не зарегистрирован на сервере и не связывает устройства. Подключение друга, проверка условий и запуск боя появятся на сетевом этапе. Карты и $RUG остаются у вас.', 'The code is not registered with a server and does not connect devices. Friend connections, term checks and battles will arrive in the networking stage. Your cards and $RUG stay with you.')}</p></div><div className="lobby-actions"><button className="secondary-button" onClick={() => { setRoom(null); setScreen('private'); setAcknowledged(false); }}>{t('Покинуть комнату', 'Leave room')}</button><Link className="gold-button" href={`/game?hero=${hero}`}>{t('Начать тренировку', 'Start training')} →</Link></div></div>}
      </section>}
      <footer className="gates-footer"><span>IMPERIVM · SOLANA DEVNET</span><Link href="/collection">{t('Коллекция и колоды', 'Collection & decks')} ↗</Link><Link href="/packs">{t('Открыть паки', 'Open packs')} ↗</Link></footer>
    </main>
    {settingsOpen && <ArenaSettings skin={skin} onChange={setSkin} onClose={() => setSettingsOpen(false)} />}
  </div>;
}
