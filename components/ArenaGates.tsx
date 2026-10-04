'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import WalletBar from './WalletBar';
import { useLocale } from './LocaleContext';
import ArenaSettings, { useBoardSkin } from './ArenaSettings';
import { CoinPreview } from './3d/CoinPreview';
import { HEROES } from '../lib/heroes';
import styles from './ArenaGates.module.css';

export default function ArenaGates() {
  const params = useSearchParams();
  const { t, heroName } = useLocale();
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
      <h1 className={styles.heading}>{t('Арена', 'Arena')}</h1>
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
        <p>{heroName(hero)}</p>
        <div className={styles.heroOptions}>{Object.values(HEROES).map(h => <button key={h.id} className={styles.hero} aria-pressed={h.id === hero} aria-label={heroName(h.id)} title={heroName(h.id)} onClick={() => setHero(h.id)}><img src={`/heroes/${h.id}.webp`} alt="" />{h.id === hero && <span aria-hidden="true">✓</span>}</button>)}</div>
      </section>
      <div className={styles.futureModes} aria-label={t('Будущие режимы', 'Upcoming modes')}>
        <div style={{ backgroundImage: "url('/ui/portals/duel.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}><span aria-hidden="true">⚔</span><span>{t('Онлайн-дуэль', 'Online duel')}</span><small>{t('Скоро', 'Soon')}</small></div>
        <div style={{ backgroundImage: "url('/ui/portals/custom.webp')", backgroundSize: 'cover', backgroundPosition: 'center' }}><span aria-hidden="true">♜</span><span>{t('Своя игра', 'Private game')}</span><small>{t('Скоро', 'Soon')}</small></div>
      </div>
    </main>
    {settingsOpen && <ArenaSettings skin={skin} onChange={setSkin} onClose={() => setSettingsOpen(false)} />}
  </div>;
}
