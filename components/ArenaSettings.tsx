'use client';
import { useEffect, useState } from 'react';
import Dialog from './Dialog';
import { useLocale } from './LocaleContext';
import { useAnimationPreference } from '../lib/prefersReducedMotion';
import { startAmbient } from '../lib/audio/sfx';
import { initMute, isSfxEnabled, setSfxEnabled, isMusicEnabled, setMusicEnabled, onAudioPreferenceChange, unlockAudio } from '../lib/audio/manager';
export type BoardSkin = 'marble' | 'lava' | 'neon';
const SKINS: BoardSkin[] = ['marble', 'lava', 'neon'];
export function useBoardSkin() {
  const [skin, setSkin] = useState<BoardSkin>('marble');
  useEffect(() => { try { const saved = localStorage.getItem('imperivm.board'); if (SKINS.includes(saved as BoardSkin)) setSkin(saved as BoardSkin); } catch {} }, []);
  function change(value: BoardSkin) { setSkin(value); try { localStorage.setItem('imperivm.board', value); } catch {} }
  return [skin, change] as const;
}
export default function ArenaSettings({ skin, onChange, onClose }: { skin: BoardSkin; onChange: (value: BoardSkin) => void; onClose: () => void }) {
  const { t, locale, setLocale } = useLocale();
  const [sound, setSound] = useState(true), [music, setMusic] = useState(true);
  const [animations, setAnimations] = useAnimationPreference();
  useEffect(() => { initMute(); const sync = () => { setSound(isSfxEnabled()); setMusic(isMusicEnabled()); }; sync(); return onAudioPreferenceChange(sync); }, []);
  const labels: Record<BoardSkin, string> = { marble: t('Мрамор', 'Marble'), lava: t('Лава', 'Lava'), neon: t('Неон', 'Neon') };
  return <Dialog title={t('Ваша арена', 'Your arena')} onClose={onClose}>
    <p className="dialog-copy">{t('Империи нужен дом. Выберите поле сражения.', 'An empire deserves a home. Choose your battlefield.')}</p>
    <div className="skin-picker">{SKINS.map(value => <button key={value} className={skin === value ? 'skin-option selected' : 'skin-option'} onClick={() => onChange(value)} aria-pressed={skin === value}>
      <img src={`/boards/${value}.webp`} alt="" /><span>{labels[value]}</span>{skin === value && <b>✓</b>}
    </button>)}</div>
    <div className="setting-row"><span>{t('Язык', 'Language')}</span><div className="flex gap-2">{(['ru', 'en'] as const).map(value => <button key={value} className="secondary-button" onClick={() => setLocale(value)} aria-pressed={locale === value}>{value === 'ru' ? 'Русский' : 'English'} {locale === value && '✓'}</button>)}</div></div>
    <div className="setting-row"><span>{t('Звуковые эффекты', 'Sound effects')}</span><button className="secondary-button" aria-pressed={sound} onClick={() => { setSfxEnabled(!sound); if (!sound) void unlockAudio(); }}>{sound ? t('Включены', 'On') : t('Выключены', 'Off')}</button></div>
    <div className="setting-row"><span>{t('Музыка', 'Music')}</span><button className="secondary-button" aria-pressed={music} onClick={() => { setMusicEnabled(!music); if (!music) void unlockAudio().then(() => startAmbient()); }}>{music ? t('Включена', 'On') : t('Выключена', 'Off')}</button></div>
    <div className="setting-row"><span>{t('Анимации', 'Animations')}</span><button className="secondary-button" aria-pressed={animations} onClick={() => setAnimations(!animations)}>{animations ? t('Включены', 'On') : t('Выключены', 'Off')}</button></div>
    <p className="small-note">{t('Настройки сохраняются в этом браузере. Предпочтение устройства «уменьшить движение» действует всегда. Кнопка звука в верхней панели выключает всё аудио.', 'Settings are saved in this browser. Your device’s reduced motion preference is always honored. The header mute button silences all audio.')}</p>
  </Dialog>;
}
