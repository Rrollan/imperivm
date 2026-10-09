'use client';
import { useEffect, useRef, useState } from 'react';
import { useImperivmWallet } from '../WalletContext';
import { emptyMatchStats, updateMatchStats } from '../../lib/ui/matchStats';
import { saveMatch } from '../../lib/matches';
import type { PlayProof } from '../../lib/solana/proof';
import type { GameState } from '../../lib/engine/types';
import type { PresentationBatch } from './GameSession';
import {playProofEnabled} from '../../lib/solana/features';

/** Participation tracking is outside the engine and never decides the winner. */
export function usePracticeMatch(heroId: string, exhibition: boolean, state: GameState, busy: boolean) {
  const wallet = useImperivmWallet();
  const match = useRef({ id: '', heroId, exhibition, startedAt: '', proof: null as PlayProof | null, stats: emptyMatchStats(), finished: false });
  const [pending, setPending] = useState(playProofEnabled() && !exhibition && !!wallet.owner), [signing, setSigning] = useState(false), [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; reset(heroId, exhibition); return () => { alive.current = false; }; }, []);
  function reset(hero: string, demo = exhibition) {
    match.current = { id: crypto.randomUUID(), heroId: hero, exhibition: demo, startedAt: new Date().toISOString(), proof: null, stats: emptyMatchStats(), finished: false };
    setPending(playProofEnabled() && !demo && !!wallet.owner); setError(null); setSigning(false);
  }
  function track(batch: PresentationBatch) { match.current.stats = updateMatchStats(match.current.stats, batch.before, batch.after, batch.action, batch.events); }
  async function sign() {
    if (!playProofEnabled() || signing || !match.current.id) return;
    const captured = match.current; setSigning(true); setError(null);
    try {
      const proof = await wallet.signPlay(captured.id, captured.heroId);
      if (!alive.current || captured !== match.current) return;
      captured.proof = proof;
      try { sessionStorage.setItem(`imperivm.proof.${captured.id}`, JSON.stringify(proof)); } catch {}
      setPending(false);
    } catch (e) { if (alive.current && captured === match.current) setError(e instanceof Error ? e.message : 'Signature declined. Demo remains available.'); }
    finally { if (alive.current && captured === match.current) setSigning(false); }
  }
  useEffect(() => {
    const current = match.current;
    if (!current.id || current.finished || state.winner === null || busy || pending) return;
    current.finished = true;
    saveMatch({ id: current.id, heroId: current.heroId, owner: current.proof?.owner ?? 'demo', won: state.winner === 0, draw: state.winner === 'draw', blocks: state.block, playedAt: current.startedAt,
      stats: current.stats, exhibition: current.exhibition, proofSignature: current.proof?.signature, proof: current.proof ?? undefined });
  }, [state.winner, state.block, busy, pending]);
  return { pending, signing, error, sign, reset, track, demo: () => { if (!signing) setPending(false); } };
}
