'use client';
import { useEffect, useState } from 'react';
import Dialog from './Dialog';
import MuteButton from './MuteButton';
export type BoardSkin = 'marble' | 'lava' | 'neon';
const SKINS: BoardSkin[] = ['marble', 'lava', 'neon'];
export function useBoardSkin() {
  const [skin, setSkin] = useState<BoardSkin>('marble');
  useEffect(() => { try { const saved = localStorage.getItem('imperivm.board'); if (SKINS.includes(saved as BoardSkin)) setSkin(saved as BoardSkin); } catch {} }, []);
  function change(value: BoardSkin) { setSkin(value); try { localStorage.setItem('imperivm.board', value); } catch {} }
  return [skin, change] as const;
}
export default function ArenaSettings({ skin, onChange, onClose }: { skin: BoardSkin; onChange: (value: BoardSkin) => void; onClose: () => void }) {
  return <Dialog title="Your arena" onClose={onClose}>
    <p className="dialog-copy">An empire deserves a home. Choose your battlefield.</p>
    <div className="skin-picker">{SKINS.map(value => <button key={value} className={skin === value ? 'skin-option selected' : 'skin-option'} onClick={() => onChange(value)} aria-pressed={skin === value}>
      <img src={`/boards/${value}.webp`} alt="" /><span>{value}</span>{skin === value && <b>✓</b>}
    </button>)}</div>
    <div className="setting-row"><span>Procedural sound & ambient</span><MuteButton /></div>
    <p className="small-note">Animations follow your device’s reduced motion setting.</p>
  </Dialog>;
}
