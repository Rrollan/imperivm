'use client';

import { useEffect, useRef, useState } from 'react';
import { ArenaCardPreview } from '../presentation/ArenaCardPreview';
import { useLocale } from '../LocaleContext';
import styles from './Home.module.css';

/** Keep the catalogue's full-resolution art off the network until it approaches view. */
export function LibraryCardFace({ id }: { id: string }) {
  const { locale, cardName } = useLocale();
  const root = useRef<HTMLSpanElement>(null), [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    if (!('IntersectionObserver' in window)) { setReady(true); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); } }, { rootMargin: '320px 0px' });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, [ready]);
  return <span ref={root} className={styles.catalogueFace}>{ready ? <ArenaCardPreview id={id} locale={locale} label={cardName(id)} /> : <span className={styles.cardPlaceholder} aria-hidden="true" />}</span>;
}
