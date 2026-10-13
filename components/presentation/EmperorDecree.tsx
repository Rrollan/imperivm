'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { GameState } from '../../lib/engine/types';
import { EMPEROR_RULES, EMPEROR_ROUNDS, activeEmperorRule, emperorOf, emperorRound, type EmperorRule } from '../../lib/engine/emperor';
import { useReducedMotion } from '../../lib/prefersReducedMotion';
import { useLocale } from '../LocaleContext';
import { RomanIcon } from './RomanIcon';
import styles from './EmperorDecree.module.css';

type DecreeView = { key: string; index: number; automatic: boolean };

const FAMILIES = {
  court: ['three-seats', 'grand-court', 'royal-favor', 'royal-levy', 'imperial-tax', 'amnesty', 'balanced-books'],
  commerce: ['armory-sale', 'heavy-recruitment', 'scout-duty', 'full-granaries', 'tight-rations', 'reserve-grant', 'festival'],
  mercy: ['mercy-medals', 'field-hospital', 'legion-rations', 'bread-and-games', 'medical-inspection', 'shield-the-smallest', 'emergency-guard'],
  mystery: ['red-tape', 'scholars-grant', 'scribes-insight', 'ink-tax', 'arena-quake', 'mirror-drill'],
} as const;
function familyOf(id: string): string {
  return Object.entries(FAMILIES).find(([, ids]) => (ids as readonly string[]).includes(id))?.[0] ?? 'legion';
}

export type EmperorDecreeProps = {
  state: GameState;
  ready?: boolean;
  busy?: boolean;
  onlineSeconds?: number;
  onOpenChange?: (open: boolean) => void;
};

/** Presentation only. Acknowledging an announcement never changes its engine effect. */
export function EmperorDecree({ state, ready = true, busy = false, onlineSeconds, onOpenChange }: EmperorDecreeProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const emperor = emperorOf(state);
  const history = emperor?.history ?? [];
  const latestIndex = history.length - 1;
  const latest = history[latestIndex];
  const latestRule = latest && EMPEROR_RULES.find(rule => rule.id === latest.id);
  const active = activeEmperorRule(state);
  const latestKey = latest ? `${latestIndex}:${latest.id}:${latest.round}:${latest.block}` : '';
  const seen = useRef(new Set<string>());
  const [view, setView] = useState<DecreeView | null>(null);
  const [closing, setClosing] = useState(false);
  const [seconds, setSeconds] = useState(10);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const reading = useRef(false);
  const closingRef = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const panel = useRef<HTMLElement>(null);
  const badge = useRef<HTMLButtonElement>(null);
  const openChange = useRef(onOpenChange);
  openChange.current = onOpenChange;
  const titleId = useId(), textId = useId(), historyId = useId();
  const open = view !== null;
  const entry = view ? history[view.index] : undefined;
  const rule = entry && EMPEROR_RULES.find(candidate => candidate.id === entry.id);
  const isCurrent = !!rule && rule.kind === 'law' && active?.id === rule.id;
  const badgeRule = active ?? latestRule;
  const nextRound = state.winner === null ? EMPEROR_ROUNDS.find(round => round > emperorRound(state)) : undefined;
  const finalLaw = isCurrent && entry?.round === EMPEROR_ROUNDS.at(-1);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const finish = () => { setView(null); setClosing(false); closingRef.current = false; };
    if (reduced) finish();
    else closeTimer.current = setTimeout(finish, 160);
  }, [reduced]);

  const show = useCallback((index: number, key: string, automatic: boolean) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closingRef.current = false;
    reading.current = false;
    setClosing(false);
    setHistoryExpanded(false);
    setView({ index, key, automatic });
  }, []);

  useEffect(() => {
    if (latestKey) return;
    seen.current.clear();
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closingRef.current = false;
    setView(null);
    setClosing(false);
  }, [latestKey]);

  useEffect(() => {
    if (!latestRule || !latestKey || !ready || busy || seen.current.has(latestKey)) return;
    seen.current.add(latestKey);
    show(latestIndex, latestKey, true);
  }, [latestKey, latestIndex, latestRule, ready, busy, show]);

  useEffect(() => { openChange.current?.(open); }, [open]);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openChange.current?.(false);
  }, []);

  // Ten seconds of visible reading time. Hidden tabs and hovering the rule do not consume it.
  useEffect(() => {
    if (!view?.automatic || closing) return;
    let remaining = 10_000, last = performance.now();
    setSeconds(10);
    const visibilityChanged = () => { last = performance.now(); };
    document.addEventListener('visibilitychange', visibilityChanged);
    const timer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden && !reading.current) remaining -= Math.min(now - last, 500);
      last = now;
      setSeconds(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) { clearInterval(timer); close(); }
    }, 100);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, [view?.key, view?.automatic, closing, close]);

  useEffect(() => {
    if (!open || !panel.current) return;
    const root = panel.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href], [tabindex="0"]'))
      .filter(element => element.getClientRects().length > 0);
    focusable()[0]?.focus({ preventScroll: true });
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== 'Tab') return;
      // Intentional keyboard exploration keeps the text open until the player dismisses it.
      setView(current => current ? { ...current, automatic: false } : current);
      const items = focusable(), first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); root.focus(); return; }
      if (!root.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !root.contains(event.target)) focusable()[0]?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', key, true);
    document.addEventListener('focusin', focus);
    return () => {
      window.removeEventListener('keydown', key, true);
      document.removeEventListener('focusin', focus);
      const destination = previous?.isConnected ? previous : badge.current;
      destination?.focus({ preventScroll: true });
    };
  }, [open, close]);

  if (!latestRule || !badgeRule) return null;

  const title = (item: EmperorRule) => locale === 'ru' ? item.titleRu : item.titleEn;
  const text = (item: EmperorRule) => locale === 'ru' ? item.textRu : item.textEn;
  const keepOpen = () => setView(current => current ? { ...current, automatic: false } : current);

  return <>
    <button ref={badge} type="button" className={`${styles.badge} ${open ? styles.badgeOpen : ''}`}
      disabled={!ready} aria-expanded={open} aria-haspopup="dialog"
      aria-label={t('Открыть приказ Императора: ', 'Open the Emperor’s decree: ') + title(badgeRule)}
      onClick={() => { seen.current.add(latestKey); show(latestIndex, latestKey, false); }}>
      <img src={`/ui/emperor/v1/${badgeRule.id}.webp`} alt="" width="42" height="42" />
      <span><small>{t('Император повелевает', 'The Emperor commands')}</small><strong>{title(badgeRule)}</strong></span>
      <RomanIcon name="scroll" size={18} />
    </button>

    {open && rule && entry && <div className={`${styles.backdrop} ${closing ? styles.leaving : ''}`}
      onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={panel} tabIndex={-1} className={styles.dialog} data-family={familyOf(rule.id)} data-rule={rule.id} role="dialog" aria-modal="true"
        aria-labelledby={titleId} aria-describedby={textId} onKeyDown={event => event.stopPropagation()}>
        <button type="button" className={styles.close} onClick={close} aria-label={t('Закрыть приказ', 'Close decree')}>
          <RomanIcon name="close" size={22} /><span>{t('Закрыть', 'Close')}</span>
        </button>

        <div className={styles.decree} onMouseEnter={() => { reading.current = true; }} onMouseLeave={() => { reading.current = false; }}>
          <div className={styles.eyebrow}>
            <RomanIcon name="crown" size={22} />
            <span>{t('Император повелевает', 'The Emperor commands')}</span>
          </div>
          <h2 id={titleId}>{title(rule)}</h2>
          <div className={styles.decreeBody}>
            <div className={styles.artifact} key={rule.id} aria-hidden="true">
              <img src={`/ui/emperor/v1/${rule.id}.webp`} alt="" width="600" height="400" decoding="async" />
              <i /><i /><i /><i /><i /><i />
            </div>
            <div className={styles.ruleCopy}>
              <p id={textId} className={styles.ruleText}>{text(rule)}</p>
              <p className={styles.duration}>
                {rule.kind === 'event'
                  ? t('Разовое событие · уже исполнено для обоих игроков', 'One-time event · already applied to both players')
                  : isCurrent
                    ? finalLaw
                      ? t('Действует для обоих игроков до конца боя', 'Applies to both players until the battle ends')
                      : t('Действует для обоих игроков до следующего приказа', 'Applies to both players until the next decree')
                    : t('Предыдущий приказ · больше не действует', 'Previous decree · no longer active')}
              </p>
              {view.index === latestIndex && nextRound !== undefined && <p className={styles.forecast}>
                <RomanIcon name="hourglass" size={17} /><span>{t('Следующий приказ — раунд ', 'Next decree — round ')}<strong>{nextRound}</strong></span>
              </p>}
            </div>
          </div>
        </div>

        {active && active.id !== rule.id && <div className={styles.activeLaw}>
          <RomanIcon name="scroll" size={20} /><div><span>{t('Сейчас действует', 'Current law')}</span><strong>{title(active)}</strong><p>{text(active)}</p></div>
        </div>}

        <div className={styles.controls}>
          <button type="button" className={styles.accept} onClick={close}>{t('Продолжить бой', 'Continue battle')}<RomanIcon name="next" size={22} /></button>
          {view.automatic
            ? <button type="button" className={styles.readMore} onClick={keepOpen}>{t('Читать без таймера', 'Keep reading')}<span>{seconds}{t(' с', ' s')}</span></button>
            : <p className={styles.manualHint}>{t('Этот приказ всегда доступен на арене', 'Reopen this decree from the arena badge')}</p>}
          {onlineSeconds !== undefined && <p className={styles.onlineHint}>
            <RomanIcon name="hourglass" size={19} /><span>{t('Онлайн-таймер продолжает идти', 'The online turn timer keeps running')} · <strong>{Math.max(0, Math.ceil(onlineSeconds))}{t(' с', ' s')}</strong></span>
          </p>}
        </div>

        {history.length > 1 && <div className={styles.history}>
          <button type="button" className={styles.historyToggle} aria-expanded={historyExpanded} aria-controls={historyId}
            onClick={() => { keepOpen(); setHistoryExpanded(value => !value); }}>
            <RomanIcon name="history" size={19} /><span>{t('Приказы этого боя', 'This battle’s decrees')} · {history.length}</span>
            <RomanIcon name={historyExpanded ? 'minus' : 'plus'} size={18} />
          </button>
          {historyExpanded && <ol id={historyId} className={styles.historyList}>
            {history.map((item, index) => {
              const previousRule = EMPEROR_RULES.find(candidate => candidate.id === item.id);
              if (!previousRule) return null;
              return <li key={`${index}:${item.id}:${item.block}`}><button type="button" aria-current={view.index === index ? 'true' : undefined}
                onClick={() => { setView({ index, key: `${index}:${item.id}:${item.round}:${item.block}`, automatic: false }); }}>
                <span>{t('Раунд', 'Round')} {item.round}</span><strong>{title(previousRule)}</strong>
                <small>{previousRule.kind === 'law' && active?.id === previousRule.id ? t('Действует', 'Active') : t('Исполнен', 'Applied')}</small>
              </button></li>;
            })}
          </ol>}
        </div>}
      </section>
    </div>}
  </>;
}
