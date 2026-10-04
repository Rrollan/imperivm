'use client';

/**
 * IMPERIVM — accessible mute toggle. Visible on landing / game / packs.
 * Persists in localStorage; exposes aria-pressed + label. Sound is a
 * separate concern from reduced motion (independent settings).
 */
import { useEffect, useState } from 'react';
import { initMute, isMuted, onMuteChange, setMuted, unlockAudio } from '../lib/audio/manager';

interface MuteButtonProps {
  className?: string;
}

export default function MuteButton({ className = '' }: MuteButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [muted, setLocalMuted] = useState(false);

  useEffect(() => {
    initMute();
    setLocalMuted(isMuted());
    setMounted(true);
    const unsub = onMuteChange(v => setLocalMuted(v));
    return unsub;
  }, []);

  const onToggle = async () => {
    if (!mounted) return;
    // First interaction also unlocks the AudioContext (gesture requirement).
    await unlockAudio();
    setMuted(!isMuted());
  };

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={mounted ? muted : false}
      aria-label={mounted && muted ? 'Unmute sounds' : 'Mute sounds'}
      title={mounted && muted ? 'Unmute sounds' : 'Mute sounds'}
      className={
        'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border text-xs uppercase tracking-widest transition ' +
        (muted
          ? 'border-blood/50 text-blood hover:bg-blood/10'
          : 'border-mint/40 text-mint hover:bg-mint/10') +
        ' ' +
        className
      }
    >
      <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
      <span>{muted ? 'Muted' : 'Sound'}</span>
    </button>
  );
}
