'use client';
import {useEffect, useId, useRef} from 'react';
import {useLocale} from '../LocaleContext';
import styles from './PurchaseConfirm.module.css';
export function PurchaseConfirm({kind, amount, onClose, onConfirm}: {kind: 'pack' | 'ruler'; amount: number; onClose: () => void; onConfirm: () => void}) {
  const {t, locale} = useLocale(), dialog = useRef<HTMLDialogElement>(null), title = useId();
  const price = new Intl.NumberFormat(locale === 'ru' ? 'ru-RU' : 'en-US').format(amount);
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; element.showModal();
    return () => {element.close(); document.body.style.overflow = overflow; previous?.focus({preventScroll: true});};
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onCancel={event => {event.preventDefault(); onClose();}}>
    <p className={styles.kicker}>{t('ПОКУПКА ЗА IMP', 'IMP PURCHASE')}</p>
    <h2 id={title}>{kind === 'pack' ? t('Пак Agora', 'Agora pack') : t('Кейс Олимпа', 'Olympus case')}</h2>
    <strong className={styles.price}>{price} <span>IMP</span></strong>
    <p>{t('Сумма будет списана с вашего игрового счёта iDos.', 'This amount will be charged to your iDos game balance.')}</p>
    <p className={styles.note}>{kind === 'pack' ? t('5 случайных карт. Повторы дают валюту коллекции; это не IMP и её нельзя вывести.', '5 random cards. Duplicates grant collection currency, which is not IMP and cannot be withdrawn.') : t('1 правитель, каждый с шансом 25%. Повтор даёт 100 валюты коллекции, которую нельзя вывести.', '1 ruler, each at 25%. A duplicate grants 100 collection currency, which cannot be withdrawn.')}</p>
    <div className={styles.actions}><button type="button" onClick={onClose} autoFocus>{t('Отмена', 'Cancel')}</button><button type="button" className={styles.confirm} onClick={onConfirm}>{t('Купить', 'Buy')} · {price} IMP</button></div>
  </dialog>;
}
