'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import WalletBar from './WalletBar';
import { useLocale } from './LocaleContext';
import ArenaSettings, { useBoardSkin } from './ArenaSettings';
import HeroArt from './HeroArt';
import { HEROES } from '../lib/heroes';
import styles from './ArenaGates.module.css';

export default function ArenaGates() {
  const params = useSearchParams();
  const { t, heroName, heroTitle, powerName, powerText } = useLocale();
  const [skin, setSkin] = useBoardSkin();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hero, setHero] = useState('whale');
  useEffect(() => {
    const value = params.get('hero');
    if (value && HEROES[value]) setHero(value);
  }, [params]);

  return <div className={`arena-scene board-${skin} ${styles.scene}`} style={{ ['--board-art' as string]: `url('/boards/${skin}.webp')` }}>
    <WalletBar onSettings={() => setSettingsOpen(true)} />
    <div className={styles.dust} aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, top: `${(i * 23) % 100}%`, animationDelay: `${-i * 1.7}s`, animationDuration: `${12 + i % 5 * 3}s` }} />)}</div>
    <main className={styles.main}>
      <header className={styles.heading}>
        <p>{t('Врата империи', 'Gates of the empire')}</p>
        <h1>{t('Арена', 'Arena')}</h1>
        <span>{t('Выберите императора. Возглавьте легион.', 'Choose your Imperator. Lead your legion.')}</span>
      </header>
      <Link href={`/game?hero=${hero}`} className={styles.portal} aria-label={t('В бой — тренировка против ИИ', 'To battle — training against AI')}>
        <span className={styles.keystone} aria-hidden="true">⚔</span>
        <div className={styles.interior} aria-hidden="true" style={{ backgroundImage: "url('/ui/portals/training.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        </div>
        <div className={styles.portalCopy}>
          <h2>{t('Тренировка', 'Training')}</h2>
          <p>{t('Против ИИ · бесплатно', 'Against AI · free')}</p>
          <span className={styles.action}>{t('В бой', 'To battle')} <span aria-hidden="true">→</span></span>
        </div>
      </Link>
      <section className={styles.heroes} aria-label={t('Выбор императора', 'Choose your Imperator')}>
        <h2>{t('Ваш император', 'Your Imperator')}</h2>
        <div className={styles.heroOptions}>{Object.values(HEROES).map(h => <button key={h.id} className={`${styles.hero} hero-choice`} aria-pressed={h.id === hero} aria-label={heroName(h.id)} title={heroTitle(h.id)} onClick={() => setHero(h.id)}>
          <HeroArt heroId={h.id} name={heroName(h.id)} decorative />
          <strong>{heroName(h.id)}</strong>
          {h.id === hero && <span className={styles.selected} aria-hidden="true">✓</span>}
        </button>)}</div>
        <div className={styles.heroBrief} aria-live="polite">
          <strong>{powerName(hero)}</strong>
          <p>{powerText(hero)}</p>
        </div>
      </section>
      <div className={styles.futureModes} aria-label={t('Будущие режимы', 'Upcoming modes')}>
        <div style={{ backgroundImage: "url('/ui/portals/duel.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}><span aria-hidden="true">⚔</span><span>{t('Онлайн-дуэль', 'Online duel')}</span><small>{t('Скоро', 'Soon')}</small></div>
        <div style={{ backgroundImage: "url('/ui/portals/custom.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}><span aria-hidden="true">♜</span><span>{t('Своя игра', 'Private game')}</span><small>{t('Скоро', 'Soon')}</small></div>
      </div>
    </main>
    {settingsOpen && <ArenaSettings skin={skin} onChange={setSkin} onClose={() => setSettingsOpen(false)} />}
  </div>;
}
