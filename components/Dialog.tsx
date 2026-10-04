'use client';
import { useEffect, useRef } from 'react';
import { useLocale } from './LocaleContext';
export default function Dialog({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    root?.querySelector<HTMLElement>('button, a, input')?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key !== 'Tab' || !root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, [tabindex="0"]'));
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop" onClick={onClose}>
    <div ref={ref} className={`imperial-dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
      <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={t('Закрыть окно', 'Close dialog')}>✕</button></div>
      {children}
    </div>
  </div>;
}
