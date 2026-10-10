'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AccountPanel } from '../AccountPanel';
import { useImperivmWallet } from '../WalletContext';
import { useIDos } from '../IDosContext';
import { useLocale } from '../LocaleContext';
import {PaintedIcon} from '../PaintedIcon';
import {ImperivmLogo} from '../ImperivmLogo';
import {RomanIcon} from '../presentation/RomanIcon';
import {heroPortraitPath} from '../presentation/heroPortrait';
import chrome from './SiteChrome.module.css';
import styles from './Home.module.css';

export function SiteHeader({ active = 'home' }: { active?: 'home' | 'library' | 'packs' | 'collection' | 'play' | 'market' }) {
  const { t, locale, setLocale } = useLocale();
  const wallet = useImperivmWallet(), idos = useIDos();
  const [accountOpen, setAccountOpen] = useState(false);
  const owner = idos.session.owner ?? wallet.owner;
  const profile = idos.profile;
  const accountLabel = profile?.nickname || (owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : t('Аккаунт', 'Account'));
  return <><header className={styles.header}>
    <Link href="/" className={styles.wordmark} aria-label={t('IMPERIVM — главная', 'IMPERIVM — home')}><ImperivmLogo/></Link>
    <nav className={styles.navigation} aria-label={t('Основная навигация', 'Main navigation')}>
      <Link href="/" aria-current={active === 'home' ? 'page' : undefined}><PaintedIcon name="home" size={36}/><span>{t('Главная', 'Home')}</span></Link>
      <Link href="/library" aria-current={active === 'library' ? 'page' : undefined}><PaintedIcon name="library" size={36}/><span>{t('Библиотека', 'Library')}</span></Link>
      <Link href="/collection" aria-current={active === 'collection' ? 'page' : undefined}><PaintedIcon name="cards" size={36}/><span>{t('Колоды', 'Decks')}</span></Link>
      <Link href="/packs" aria-current={active === 'packs' ? 'page' : undefined}><PaintedIcon name="pack" size={36}/><span>{t('Паки', 'Packs')}</span></Link>
      <Link href="/market" aria-current={active === 'market' ? 'page' : undefined}><PaintedIcon name="rug" size={36}/><span>{t('Рынок', 'Market')}</span></Link>
      <Link href="/arena" className={styles.navPlay} aria-current={active === 'play' ? 'page' : undefined}><PaintedIcon name="play" size={36}/><span>{t('Играть', 'Play')}</span></Link>
      <button type="button" className={styles.accountButton} onClick={() => setAccountOpen(true)} title={profile?.nickname || owner || undefined} aria-label={t(`Открыть аккаунт: ${accountLabel}`, `Open account: ${accountLabel}`)}>{profile ? <img className={chrome.accountAvatar} src={profile.avatar.kind === 'image' ? profile.avatar.dataURL : heroPortraitPath(profile.avatar.id)} alt="" width={30} height={30}/> : <PaintedIcon name="wallet" size={30}/>}<span className={chrome.accountName}>{accountLabel}</span></button>
      <button type="button" onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')} aria-label={t('Переключить язык на английский', 'Switch language to Russian')} className={styles.language}>{locale.toUpperCase()} <span aria-hidden="true">/ {locale === 'ru' ? 'EN' : 'RU'}</span></button>
    </nav>
  </header>{accountOpen && <AccountPanel onClose={() => setAccountOpen(false)}/>}</>;
}

export function SiteFooter() {
  const { t } = useLocale();
  return <footer className={styles.footer}>
    <span className={styles.footerMotto}>Veni. Vidi. Rugi.</span>
    <Link href="/library#rules">{t('Правила игры', 'Game rules')} <RomanIcon name="next" size={18}/></Link>
  </footer>;
}
