'use client';
import { useEffect, useRef, useState } from 'react';
import { useIDos } from './IDosContext';
import { useLocale } from './LocaleContext';
import { IDOS_CONFIG } from '../lib/collection/gateway';
import { winsFor } from '../lib/matches';
import type { IDosStandings } from '../lib/idos/client';

export function IDosLeaderboard() {
  const idos = useIDos(), { t, errorText } = useLocale();
  const [standings, setStandings] = useState<IDosStandings | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const generation = useRef(0), lock = useRef(false);
  useEffect(() => {
    generation.current++; setStandings(null); setError(null); setBusy(false); lock.current = false;
    return () => { generation.current++; };
  }, [idos.session.revision, idos.session.status]);
  async function load(sync = false) {
    if (!idos.runtime || lock.current) return;
    const captured = generation.current;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (sync && idos.session.owner) await idos.runtime.publishPracticeWins(winsFor(idos.session.owner));
      const result = await idos.runtime.standings();
      if (generation.current === captured) setStandings(result);
    } catch (e) { if (generation.current === captured) setError(e instanceof Error ? e.message : 'iDos leaderboard unavailable.'); }
    finally { if (generation.current === captured) { lock.current = false; setBusy(false); } }
  }
  if (!idos.configured || !IDOS_CONFIG.leaderboard) return null;
  const ready = ['guest', 'wallet'].includes(idos.session.status);
  return <section className="integration-panel">
    <h2 className="font-display text-2xl text-gold">{t('Тренировочные победы · iDos Games', 'Practice wins · iDos Games')}</h2>
    <p className="integration-note">{t('Общая таблица аккаунтов iDos. Результаты матчей с ИИ сообщаются игроками; это не рейтинг PvP и за них нет денежных или игровых наград.', 'Shared iDos accounts leaderboard. Players report their AI results; this is not a PvP ranking and grants no monetary or game rewards.')}</p>
    <div className="dialog-actions"><button className="secondary-button" disabled={!ready || busy} onClick={() => void load()}>{busy ? t('Обновляем…', 'Updating…') : t('Загрузить таблицу iDos', 'Load iDos standings')}</button>
      <button className="primary-button" disabled={idos.session.status !== 'wallet' || busy || !idos.session.owner || winsFor(idos.session.owner) < 1} onClick={() => void load(true)}>{t('Синхронизировать мои победы', 'Sync my wins')}</button></div>
    {standings && <><p className="integration-note">{t('Ваш счёт на сервере:', 'Your server score:')} {standings.ownScore}</p><div className="leaderboard-table"><div className="leaderboard-row leaderboard-heading"><span>{t('Аккаунт', 'Account')}</span><span>{t('Победы', 'Wins')}</span><span>{t('Место', 'Rank')}</span></div>{(standings.board.TopUsers ?? []).slice(0, 100).map((entry, index) => <div className="leaderboard-row" key={entry.UserID}><span>{entry.UserID === idos.session.userId ? t('Вы', 'You') : `${entry.UserID.slice(0, 6)}…${entry.UserID.slice(-4)}`}</span><strong>{entry.Score ?? 0}</strong><span>{entry.Rank ?? index + 1}</span></div>)}</div></>}
    {error && <p className="integration-error" role="status">{errorText(error)}</p>}
  </section>;
}
