'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { getDragData, useDragState } from './dnd';
import { useReducedMotion } from '../lib/prefersReducedMotion';
import { useLocale } from './LocaleContext';

export const slotDropId = (index: number) => `board-slot-${index}`;
export function isBoardSlot(id: unknown): boolean { return /^board-slot-[0-6]$/.test(String(id)); }

function EmptySlot({ index, own, next }: { index: number; own: boolean; next: boolean }) {
  const { t } = useLocale();
  const { active } = useDndContext();
  const data = getDragData(active);
  const { setNodeRef, isOver } = useDroppable({ id: own ? slotDropId(index) : `enemy-empty-${index}`, disabled: !own || !next || data?.type === 'hand-card' && data.cardType === 'spell' });
  const receiving = own && next && data?.type === 'hand-card' && data.cardType !== 'spell';
  return <div ref={setNodeRef} className={`board-slot empty-slot ${receiving ? 'receiving' : ''} ${receiving && isOver ? 'over' : ''}`} aria-label={t(`Свободное место ${index + 1}`, `Empty slot ${index + 1}`)}>
    <span aria-hidden>{receiving ? '↓' : '✧'}</span>
    {receiving && <small>{t('Сюда', 'Drop here')}</small>}
  </div>;
}

/** DOM slots keep keyboard/touch hit areas intact; only their layout animates. */
export default function BoardRank({ cards, own, ghosts }: { cards: { uid: string; node: React.ReactNode }[]; own?: boolean; ghosts?: React.ReactNode }) {
  const reduced = useReducedMotion();
  const { dragType, cardType } = useDragState();
  return <motion.div layoutScroll className={`rank-scroll thin-scroll ${own && dragType === 'hand-card' && cardType !== 'spell' ? 'welcoming' : ''}`}>
    <AnimatePresence initial={false}>
      {cards.map(card => <motion.div key={card.uid} layout={reduced ? false : 'position'} className="board-slot occupied-slot"
        initial={reduced ? false : { opacity: 0, y: -35, scale: 1.08 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .78, filter: 'blur(5px)' }}
        transition={{ type: 'spring', stiffness: 330, damping: 21, mass: .6, opacity: { duration: .2 } }}>
        {card.node}
      </motion.div>)}
      {Array.from({ length: Math.max(0, 7 - cards.length) }, (_, i) => <motion.div key={`empty-${i}`} layout={reduced ? false : 'position'} transition={{ type: 'spring', stiffness: 330, damping: 25 }}>
        <EmptySlot index={cards.length + i} own={!!own} next={i === 0} />
      </motion.div>)}
    </AnimatePresence>
    {ghosts && <div className="rank-ghosts">{ghosts}</div>}
  </motion.div>;
}
