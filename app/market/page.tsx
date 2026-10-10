'use client';

import {SiteHeader, SiteFooter} from '../../components/home/SiteChrome';
import {CardMarketPanel} from '../../components/CardMarketPanel';
import {useLocale} from '../../components/LocaleContext';
import shell from '../../components/home/Home.module.css';
import styles from '../../components/CardMarketPanel.module.css';

export default function MarketPage() {
  const {t} = useLocale();
  return <div className={shell.shell}>
    <SiteHeader active="market"/>
    <main className={`${shell.hubMain} ${styles.main}`}>
      <header className={shell.pageTitle}><span className={shell.kicker}>AGORA · CARD EXCHANGE</span><h1>{t('Рынок карт', 'Card market')}</h1><p>{t('Собирайте колоду. Находите редкости. Торгуйте с игроками за IMP.', 'Build a deck. Discover rare cards. Trade with players for IMP.')}</p></header>
      <CardMarketPanel/>
    </main>
    <SiteFooter/>
  </div>;
}
