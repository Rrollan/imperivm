'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import * as content from '../lib/locale';
import { MECHANICS } from '../lib/mechanics';
import { useReducedMotion } from '../lib/prefersReducedMotion';
import type { Rarity, CardDef } from '../lib/engine/types';

type LocaleState = { locale: content.Locale; setLocale: (locale: content.Locale) => void };
const Context = createContext<LocaleState>({ locale: 'ru', setLocale: () => {} });
const KEY = 'imperivm.locale';
export default function LocaleProvider({ children }: { children: React.ReactNode }) {
  useReducedMotion(); // Apply the combined motion preference to global CSS on every route.
  const [locale, updateLocale] = useState<content.Locale>('ru');
  useEffect(() => {
    const sync = () => { try { const saved = localStorage.getItem(KEY); updateLocale(saved === 'en' ? 'en' : 'ru'); } catch {} };
    sync(); window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  function setLocale(value: content.Locale) { updateLocale(value); try { localStorage.setItem(KEY, value); } catch {} }
  return <Context.Provider value={{ locale, setLocale }}>{children}</Context.Provider>;
}
export function useLocale() {
  const state = useContext(Context), { locale } = state;
  return { ...state, t: (ru: string, en: string) => locale === 'ru' ? ru : en,
    cardName: (id: string) => content.cardName(id, locale), cardText: (id: string) => content.cardText(id, locale), displayCard: (card: CardDef) => content.displayCard(card, locale),
    heroName: (id: string) => content.heroName(id, locale), heroTitle: (id: string) => content.heroTitle(id, locale), powerName: (id: string) => content.powerName(id, locale), powerText: (id: string) => content.powerText(id, locale),
    rarityName: (rarity: Rarity) => content.rarityName(rarity, locale), typeName: (type: CardDef['type']) => content.typeName(type, locale), keywordName: (keyword: string) => content.keywordName(keyword, locale),
    mechanicText: (keyword: string) => locale === 'ru' ? content.MECHANICS_RU[keyword] ?? MECHANICS[keyword] ?? '' : MECHANICS[keyword] ?? '',
    errorText: (message: string) => content.errorText(message, locale), logLine: (line: string) => content.logLine(line, locale),
  };
}
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();
  return <button className={`secondary-button language-switch ${className}`} onClick={() => setLocale(locale === 'ru' ? 'en' : 'ru')} aria-label={t('Переключить язык на английский', 'Switch language to Russian')} title={t('Язык интерфейса', 'Interface language')}><b>{locale.toUpperCase()}</b> / {locale === 'ru' ? 'EN' : 'RU'}</button>;
}
