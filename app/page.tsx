'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { HEROES } from '../lib/heroes';
import { CARDS } from '../lib/cards';
import WalletBar from '../components/WalletBar';
import { startAmbient } from '../lib/audio/sfx';
import { markAmbientStarted, shouldStartAmbient } from '../lib/audio/events';
import { unlockAudio } from '../lib/audio/manager';
import { useLocale } from '../components/LocaleContext';
import { CoinPreview, Whale3D } from '../components/3d/CoinPreview';
import type { ModelKey } from '../components/3d/modelManifest';
import styles from './Landing.module.css';

const STYLES: Record<string, [string, string]> = {
  whale: ['Управляйте рынком. Зачищайте поле. Оставьте последний ход за собой.', 'Control the market. Clear the board. Make the last move.'],
  builder: ['Держите строй. Восстанавливайте казну. Стройте армию надолго.', 'Hold the line. Heal your Treasury. Build an army that lasts.'],
  degen: ['Заполняйте поле. Атакуйте первыми. Каждая карта — новый шанс.', 'Go wide. Strike early. Every draw is another chance.'],
  validator: ['Наращивайте газ. Отправляйте войска в стейкинг. Встречайте бурю во всеоружии.', 'Grow your gas. Stake your ranks. Counter the coming storm.'],
};
export default function LandingPage() {
  const [selected, select] = useState('whale'); const hero = HEROES[selected];
  const { t, heroName, heroTitle, powerName, powerText } = useLocale();
  useEffect(() => {
    if (!shouldStartAmbient()) return;
    const handler = () => {
      void unlockAudio().then(() => { startAmbient(); markAmbientStarted(true); });
      window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler, { once: true }); window.addEventListener('keydown', handler, { once: true });
    return () => { window.removeEventListener('pointerdown', handler); window.removeEventListener('keydown', handler); };
  }, []);
  return <div className="landing-shell"><WalletBar /><main className="landing-main">
    <section className="landing-hero">
      <div className="landing-copy"><p className="eyebrow">{t('РИМСКАЯ КАРТОЧНАЯ БИТВА · SOLANA DEVNET', 'A ROMAN CARD BATTLER · SOLANA DEVNET')}</p>
        <h1>Veni.<br />Vidi.<br /><em>Rugi.</em></h1>
        <p className="hero-description">{t('Соберите легион. Читайте мемпул.', 'Raise a legion. Read the mempool.')}<br />{t('Обрушьте империю.', 'Rug an empire.')}</p>
        <p className="hero-subcopy">{t('Тактическая дуэль с ИИ, где газ, стейкинг и фронтран становятся вашим оружием. Кошелёк необязателен. Каждый ход решает.', 'A tactical duel against AI where gas, staking and front-running become your weapons. Your wallet is optional. Your next move matters.')}</p>
        <a className="gold-button hero-cta" href="#heroes">{t('Выберите императора', 'Choose your Imperator')} <span>↗</span></a>
        <div className="hero-facts"><span><b>{Object.keys(CARDS).length}</b> {t('карта', 'cards')}</span><span><b>4</b> {t('фракции', 'factions')}</span><span><b>30</b> {t('здоровья казны', 'Treasury HP')}</span></div>
      </div>
      <div className="imperator-art" aria-label={t('Иллюстрации римских имперских карт', 'Imperial Roman card illustrations')}>
        <img className="imperator-main" src="/cards/imperator-liquidus.webp" alt={t('Император Ликвидус в золотой броне среди имперских колонн', 'Imperator Liquidus in gold armor beneath imperial columns')} />
        <div className="art-caption"><span>{t('ИМПЕРАТОР ЛИКВИДУС', 'IMPERATOR LIQUIDUS')}</span><small>DeFi · {t('Легендарная', 'Legendary')}</small></div>
        <img className="hero-card hero-card-left" src="/cards/fud-hydra.webp" alt={t('Иллюстрация карты FUD Гидра', 'FUD Hydra card illustration')} />
        <img className="hero-card hero-card-right" src="/cards/genesis-pfp.webp" alt={t('Иллюстрация карты Genesis PFP', 'Genesis PFP card illustration')} />
        <span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" />
      </div>
    </section>
    <section id="heroes" className="hero-select-section">
      <div className="section-heading"><div><p className="eyebrow">{t('ЧЕТЫРЕ КОШЕЛЬКА. ЧЕТЫРЕ ПУТИ К ВЛАСТИ.', 'FOUR WALLETS. FOUR WAYS TO RULE.')}</p><h2>{t('Выберите императора', 'Choose your Imperator')}</h2></div><span className="demo-label">{t('Бесплатное демо · без кошелька', 'Free demo · no wallet needed')}</span></div>
      <div className="hero-select-grid">{Object.values(HEROES).map(h => <button key={h.id} className={`hero-select ${h.id === selected ? 'active' : ''}`} onClick={() => select(h.id)} aria-pressed={h.id === selected}>
        {h.id === 'whale' ? <Whale3D size={58} autoRotate={false} className={styles.choiceCoin} label={t('Золотая монета Кита', 'Golden Whale coin')} /> : <img src={`/heroes/${h.id}.webp`} alt="" />}<div><b>{heroName(h.id)}</b><span>{heroTitle(h.id)}</span></div><i>{h.id === selected ? '✓' : '↗'}</i>
      </button>)}</div>
      <div className={`hero-brief ${styles.briefWithArt}`}>
        <CoinPreview key={selected} model={`hero-${selected}` as ModelKey} size={160} speed={0.18} className={styles.briefArt} label={t(`Монета героя: ${heroName(hero.id)}`, `Hero coin: ${heroName(hero.id)}`)} />
        <div className={styles.briefCopy}><h3>{powerName(hero.id)} <span>2 {t('ГАЗА', 'GAS')}</span></h3><p>{powerText(hero.id)}</p><small>{t(...STYLES[selected])}</small></div>
        <Link className="gold-button" href={`/game?hero=${selected}`}>{t('Играть за', 'Play as')} {t(({ whale: 'Кита', builder: 'Строителя', degen: 'Дегена', validator: 'Валидатора' } as Record<string, string>)[hero.id], heroName(hero.id))} →</Link>
      </div>
    </section>
    <section className="strategy-triptych"><article><span>I</span><h3>{t('Готовьте заклинания', 'Commit your spells')}</h3><p>{t('Заклинание ждёт в открытом мемпуле. Соперник видит угрозу и получает ход, чтобы ответить.', 'Your spell waits in a public mempool. Your rival sees it coming and has a turn to answer.')}</p></article>
      <article><span>II</span><h3>{t('Выбирайте экономику', 'Choose your economy')}</h3><p>{t('Атакуйте сейчас или отправьте воина в стейкинг ради газа. Легион в стейкинге всё ещё уязвим.', 'Attack now, or stake a minion for extra gas. A staked legion is still vulnerable.')}</p></article>
      <article><span>III</span><h3>{t('Остерегайтесь рагпула', 'Never trust the rug')}</h3><p>{t('Халвинг умножает ваши войска. Рагпул уничтожает их. Сохраните приоритетный контрспелл для решающего момента.', 'Halving grows your ranks. RUG PULL erases them. Hold a Priority counter for the moment that matters.')}</p></article></section>
    <footer className="landing-footer"><Link href="/packs">✦ {t('Открыть паки', 'Open packs')} →</Link><Link href="/collection">{t('Коллекция и колоды', 'Collection & decks')}</Link><Link href="/leaderboard">{t('Зал побед', 'Hall of victories')}</Link><span>Crypto World’s Fair · {t('Дуэли с ИИ вне блокчейна', 'Off-chain AI gameplay')}</span><a href="https://github.com/Rrollan/imperivm" target="_blank" rel="noreferrer">{t('Исходный код', 'Source')} ↗</a></footer>
  </main></div>;
}
