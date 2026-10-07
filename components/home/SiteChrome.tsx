'use client';

import Link from 'next/link';
import { useLocale } from '../LocaleContext';
import styles from './Home.module.css';

export function SiteHeader({ active = 'home' }: { active?: 'home' | 'library' | 'packs' | 'collection' | 'play' }) {
  const { t, locale, setLocale } = useLocale();
  return <header className={styles.header}>
    <Link href="/" className={styles.wordmark} aria-label={t('IMPERIVM — главная', 'IMPERIVM — home')}><span className={styles.seal} aria-hidden="true">IV</span>IMPERIVM</Link>
    <nav className={styles.navigation} aria-label={t('Основная навигация', 'Main navigation')}>
      <Link href="/" aria-current={active === 'home' ? 'page' : undefined}>{t('Главная', 'Home')}</Link>
      <Link href="/library" aria-current={active === 'library' ? 'page' : undefined}>{t('Библиотека', 'Library')}</Link>
      <Link href="/packs" aria-current={active === 'packs' ? 'page' : undefined}>{t('Паки', 'Packs')}</Link>
      <Link href="/arena" className={styles.navPlay} aria-current={active === 'play' ? 'page' : undefined}>{t('Играть', 'Play')}</Link>
      <button type="button" onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')} aria-label={t('Переключить язык на английский', 'Switch language to Russian')} className={styles.language}>{locale.toUpperCase()} <span aria-hidden="true">/ {locale === 'ru' ? 'EN' : 'RU'}</span></button>
    </nav>
  </header>;
}

export function SiteFooter() {
  const { t } = useLocale();
  return <footer className={styles.footer}>
    <span className={styles.footerMotto}>Veni. Vidi. Rugi.</span>
    <p>{t('Рим, мемы и решения, которые меняют бой.', 'Rome, memes, and decisions that change the battle.')}</p>
    <Link href="/collection">{t('Коллекция и редактор колод', 'Collection & deckbuilder')} <span aria-hidden="true">↗</span></Link>
  </footer>;
}
