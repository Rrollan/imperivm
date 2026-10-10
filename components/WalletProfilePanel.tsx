'use client';
import {useEffect, useRef, useState} from 'react';
import {useIDos} from './IDosContext';
import {useLocale} from './LocaleContext';
import {heroPortraitPath} from './presentation/heroPortrait';
import {DEFAULT_PROFILE_AVATAR, PROFILE_PORTRAITS, normalizeNickname, type ProfileAvatar} from '../lib/idos/profile';
import {prepareProfileImage} from '../lib/idos/profileImage';
import styles from './WalletProfilePanel.module.css';

function avatarSource(avatar: ProfileAvatar) {return avatar.kind === 'image' ? avatar.dataURL : heroPortraitPath(avatar.id);}
function sameAvatar(a: ProfileAvatar, b: ProfileAvatar) {return JSON.stringify(a) === JSON.stringify(b);}

export function WalletProfilePanel() {
  const {runtime, session, busy: authBusy, profile, profileIdentity: identity, profileLoading: reading, profileError, refreshProfile, confirmProfile} = useIDos();
  const {t, heroName, errorText} = useLocale();
  const identityKey = identity ? `${identity.owner}:${identity.userId}:${session.revision}` : '';
  const currentKey = useRef(identityKey); currentKey.current = identityKey;
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState<ProfileAvatar>({...DEFAULT_PROFILE_AVATAR});
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<'nickname' | 'avatar' | 'image' | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const mounted = useRef(true), mutation = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
  useEffect(() => {
    setNickname(''); setAvatar({...DEFAULT_PROFILE_AVATAR}); setBusy(null); mutation.current = false;
    setError(''); setNotice(''); setExpanded(false);
  }, [identityKey]);
  const active = profile && profile.owner === identity?.owner && profile.userId === identity?.userId ? profile : null;
  useEffect(() => {setNickname(active?.nickname ?? ''); if (active && !active.nickname) setExpanded(true);}, [identityKey, active?.nickname]);
  useEffect(() => {setAvatar(active?.avatar ?? {...DEFAULT_PROFILE_AVATAR});}, [identityKey, active?.avatar]);
  const disabled = !!busy || authBusy || reading || !active;
  const live = (key: string) => mounted.current && currentKey.current === key;
  function humanError(message: string) {
    if (message.includes('PROFILE_NICKNAME_INVALID') || message.includes('INVALID_USERNAME')) return t('Никнейм: 3–24 символа. Буквы, цифры, пробел, дефис или подчёркивание.', 'Nickname: 3–24 characters. Letters, numbers, spaces, hyphens or underscores.');
    if (message.includes('PROFILE_IMAGE_FILE_INVALID')) return t('Выберите PNG, JPG или WebP до 5 МБ. Очень большие изображения не поддерживаются.', 'Choose a PNG, JPG or WebP under 5 MB. Very large images are not supported.');
    if (message.includes('PROFILE_ACCOUNT_CHANGED')) return t('Кошелёк изменился. Откройте профиль заново.', 'The wallet changed. Open your profile again.');
    if (message.includes('PROFILE_AVATAR_INVALID')) return t('Не удалось прочитать аватарку. Выберите изображение заново.', 'Could not read the avatar. Choose the image again.');
    if (message.includes('PROFILE_RESPONSE_INVALID')) return t('iDos вернул неполный ответ. Обновите профиль для проверки.', 'iDos returned an incomplete response. Refresh your profile to check.');
    return errorText(message);
  }
  async function save(kind: 'nickname' | 'avatar') {
    if (!runtime || !identity || !active || mutation.current || disabled) return;
    mutation.current = true; setBusy(kind); setError(''); setNotice('');
    const key = identityKey, expected = {...identity};
    try {
      if (kind === 'nickname') {
        const value = await runtime.changeNickname(expected, normalizeNickname(nickname));
        if (live(key)) {confirmProfile({...active, nickname: value}); setNickname(value); setNotice(t('Никнейм сохранён.', 'Nickname saved.'));}
      } else {
        const value = await runtime.changeAvatar(expected, avatar);
        if (live(key)) {confirmProfile({...active, avatar: value}); setAvatar(value); setNotice(t('Аватарка сохранена.', 'Avatar saved.'));}
      }
    } catch (reason) {if (live(key)) setError(reason instanceof Error ? reason.message : 'PROFILE_SAVE_FAILED');}
    finally {if (live(key)) {setBusy(null); mutation.current = false;}}
  }
  async function upload(file: File | undefined) {
    if (!file || disabled || mutation.current) return;
    const key = identityKey; mutation.current = true; setBusy('image'); setError(''); setNotice('');
    try {const prepared = await prepareProfileImage(file); if (live(key)) setAvatar(prepared);}
    catch (reason) {if (live(key)) setError(reason instanceof Error ? reason.message : 'PROFILE_IMAGE_FILE_INVALID');}
    finally {if (live(key)) {setBusy(null); mutation.current = false;} if (fileInput.current) fileInput.current.value = '';}
  }
  if (!identity) return null;
  return <section className={styles.panel} aria-label={t('Профиль игрока', 'Player profile')}>
    <div className={styles.summary}>
      <img className={styles.portrait} src={avatarSource(active?.avatar ?? DEFAULT_PROFILE_AVATAR)} alt={t('Аватарка игрока', 'Player avatar')} width={64} height={64}/>
      <div className={styles.identity}><strong>{active?.nickname || t('Ваш профиль', 'Your profile')}</strong><a href={`https://explorer.solana.com/address/${encodeURIComponent(identity.owner)}`} title={identity.owner} target="_blank" rel="noreferrer">{identity.owner.slice(0, 4)}…{identity.owner.slice(-4)} ↗</a>{reading && <small>{t('Загрузка…', 'Loading…')}</small>}</div>
      <button type="button" className={styles.toggle} disabled={!!busy || reading} aria-expanded={expanded} aria-controls="wallet-profile-editor" onClick={() => setExpanded(value => !value)}>{expanded ? t('Готово', 'Done') : t('Профиль', 'Edit profile')}</button>
    </div>
    {expanded && active && <div className={styles.editor} id="wallet-profile-editor">
      <form onSubmit={event => {event.preventDefault(); void save('nickname');}} className={styles.nicknameForm}>
        <label htmlFor="wallet-profile-nickname">{t('Никнейм', 'Nickname')}<input id="wallet-profile-nickname" autoComplete="nickname" value={nickname} onChange={event => {setNickname(event.target.value); setNotice(''); setError('');}} minLength={3} maxLength={24} required disabled={disabled} placeholder={t('Как вас узнают на арене?', 'How will the arena know you?')}/></label>
        <button className={styles.primary} disabled={disabled || nickname === active.nickname} type="submit">{busy === 'nickname' ? t('Сохраняем…', 'Saving…') : t('Сохранить ник', 'Save nickname')}</button>
      </form>
      <p className={styles.hint}>{t('3–24 символа · вход только кошельком', '3–24 characters · wallet sign-in only')}</p>
      <fieldset className={styles.avatars} disabled={disabled}><legend>{t('Аватарка', 'Avatar')}</legend><div className={styles.portraits}>{PROFILE_PORTRAITS.map(id => <button key={id} type="button" title={heroName(id)} aria-label={heroName(id)} aria-pressed={avatar.kind === 'portrait' && avatar.id === id} onClick={() => {setAvatar({version: 1, kind: 'portrait', id}); setNotice('');}}><img src={heroPortraitPath(id)} alt="" width={48} height={48}/></button>)}</div></fieldset>
      <div className={styles.avatarActions}><div className={styles.preview}><img src={avatarSource(avatar)} alt={t('Выбранная аватарка', 'Selected avatar')} width={56} height={56}/><div><label className={styles.uploadLabel} htmlFor="wallet-profile-avatar-file">{t('Загрузить своё фото', 'Upload your photo')}</label><input ref={fileInput} id="wallet-profile-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled} onChange={event => void upload(event.target.files?.[0])}/><small>{t('PNG, JPG, WebP · до 5 МБ', 'PNG, JPG, WebP · under 5 MB')}</small></div></div><button className={styles.primary} type="button" disabled={disabled || sameAvatar(avatar, active.avatar)} onClick={() => void save('avatar')}>{busy === 'avatar' ? t('Сохраняем…', 'Saving…') : busy === 'image' ? t('Готовим фото…', 'Preparing photo…') : t('Сохранить аву', 'Save avatar')}</button></div>
      <p className={styles.hint}>{t('Публичный профиль · сохраняется на всех устройствах', 'Public profile · saved across your devices')}</p>
    </div>}
    {(error || profileError) && <div className={styles.error} role="alert">{humanError(error || profileError!)} {!active && <button type="button" className={styles.retry} disabled={reading} onClick={() => void refreshProfile()}>{t('Повторить', 'Retry')}</button>}</div>}
    {notice && <p className={styles.success} role="status">✓ {notice}</p>}
  </section>;
}
