'use client';

/**
 * Drag-and-drop слой для IMPERIVM на @dnd-kit (touch-friendly, MIT).
 *
 * Всё в одном файле. Движок (lib/engine/*) и app/game/page.tsx этот файл
 * не трогает: page.tsx только ОБОРАЧИВАЕТ свои узлы в компоненты ниже
 * и маппит onDragEnd на СУЩЕСТВУЮЩИЕ хендлеры (onHandClick, onMyMinionClick,
 * onFoeMinionClick, onFoeHeroClick). Клик как fallback остаётся нетронутым.
 *
 * См. инструкцию по интеграции в отчёте инженера (раздел «ИНТЕГРАЦИЯ»).
 */

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Active,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import CardView from './CardView';
import { useLocale } from './LocaleContext';
import type { CardDef } from '../lib/engine/types';

/* ───────────────────────────── типы и id ───────────────────────────── */

/** Payload, который мы кладём в `data` каждого перетаскиваемого элемента. */
export type DragItemData =
  | { type: 'hand-card'; uid: string; cardType?: 'minion' | 'spell' }
  | { type: 'attacker'; uid: string };

export type DragItemType = DragItemData['type'];

/** Id дроп-зон. Дроп id вражеского миньона: `minion-<uid>`. */
export const DROP_BOARD_ID = 'my-board';
export const DROP_MEMPOOL_ID = 'mempool';
export const DROP_FOE_HERO_ID = 'foe-hero';
export const minionDropId = (uid: string): string => `minion-${uid}`;
export const ownMinionDropId = (uid: string): string => `own-minion-${uid}`;

/** Id перетаскиваемых элементов (префиксы, чтобы не пересекались с дроп-зонами). */
export const handDragId = (uid: string): string => `hand-${uid}`;
export const attackerDragId = (uid: string): string => `attacker-${uid}`;

/** uid миньона обратно из id дропа `minion-<uid>`; null для прочих id. */
export function minionUidFromDropId(id: UniqueIdentifier): string | null {
  const s = String(id);
  const prefix = 'minion-';
  return s.startsWith(prefix) ? s.slice(prefix.length) : null;
}

/**
 * Безопасно достаёт DragItemData из Active (типы для data в событиях).
 * Использовать в onDragStart / onDragEnd / onDragCancel:
 *
 *   const data = getDragData(event.active); // DragItemData | null
 */
export function getDragData(active: Active | null | undefined): DragItemData | null {
  const raw = active?.data?.current;
  if (!raw || typeof raw !== 'object') return null;
  const type = (raw as { type?: unknown }).type;
  const uid = (raw as { uid?: unknown }).uid;
  if ((type === 'hand-card' || type === 'attacker') && typeof uid === 'string') {
    const cardType = (raw as { cardType?: unknown }).cardType;
    return type === 'hand-card' ? { type, uid, cardType: cardType === 'spell' || cardType === 'minion' ? cardType : undefined } : { type, uid };
  }
  return null;
}

/* ───────────────────────────── провайдер ───────────────────────────── */

interface DndProviderProps {
  children: React.ReactNode;
  /** Маппится на существующие хендлеры page.tsx (см. инструкцию). */
  onDragEnd?: (event: DragEndEvent) => void;
  onDragStart?: (event: DragStartEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
}

/**
 * Корневой DndContext. Сенсоры:
 * - TouchSensor: delay 120ms + tolerance 6px — долгое нажатие = драг,
 *   короткий свайп = нативный скролл карусели руки (не конфликтует);
 * - MouseSensor: distance 6px — обычный клик не превращается в драг;
 * - KeyboardSensor: доступность с клавиатуры.
 *
 * Своей обработки onDragEnd внутри НЕТ — провайдер только прокидывает пропсы.
 */
export function DndProvider({ children, onDragEnd, onDragStart, onDragCancel }: DndProviderProps) {
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 280, tolerance: 8 },
    }),
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  return (
    <DndContext
      sensors={sensors}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      onDragCancel={onDragCancel}
    >
      {children}
    </DndContext>
  );
}

/* ─────────────────────── хелпер состояния драга ─────────────────────── */

/**
 * Хук для подсветки валидных целей во время драга.
 * Вызывать ТОЛЬКО внутри <DndProvider> (useDndContext).
 *
 * Пример: <DroppableBoard active={dragType === 'hand-card'}>…
 */
export function useDragState(): {
  active: boolean;
  dragType: DragItemType | null;
  dragUid: string | null;
  cardType: 'minion' | 'spell' | null;
} {
  const { active } = useDndContext();
  const data = getDragData(active);
  return {
    active: active !== null,
    dragType: data?.type ?? null,
    dragUid: data?.uid ?? null,
    cardType: data?.type === 'hand-card' ? data.cardType ?? null : null,
  };
}

/* ─────────────────────────── перетаскиваемое ─────────────────────────── */

interface DraggableHandCardProps {
  /** uid карты в руке (me.hand[].uid) */
  id: string;
  /** true для неиграбельных карт — их таскать нельзя */
  disabled?: boolean;
  cardType?: 'minion' | 'spell';
  children: React.ReactNode;
}

/**
 * Обёртка для карты в руке. data: { type: 'hand-card', uid }.
 * touchAction: pan-x — горизонтальный скролл карусели руки остаётся нативным.
 * Исходник во время драга приглушается (opacity), превью — в DragOverlay.
 */
export function DraggableHandCard({ id, disabled = false, cardType, children }: DraggableHandCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: handDragId(id),
    disabled,
    data: { type: 'hand-card', uid: id, cardType } satisfies DragItemData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      role="group"
      tabIndex={undefined}
      aria-disabled={undefined}
      {...listeners}
      style={{
        flexShrink: 0,
        touchAction: 'pan-x',
        opacity: isDragging ? 0.35 : undefined,
      }}
    >
      {children}
    </div>
  );
}

interface DraggableAttackerProps {
  /** uid своего миньона на столе */
  uid: string;
  children: React.ReactNode;
}

/**
 * Обёртка для СВОЕГО миньона на столе, которым можно атаковать.
 * data: { type: 'attacker', uid }.
 * Оборачивать только когда миньон реально может атаковать
 * (то же условие, что canAct в page.tsx: myTurn && m.canAttack && !m.staked).
 */
export function DraggableAttacker({ uid, children }: DraggableAttackerProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: attackerDragId(uid),
    data: { type: 'attacker', uid } satisfies DragItemData,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      role="group"
      tabIndex={undefined}
      aria-disabled={undefined}
      {...listeners}
      className="inline-block"
      style={{
        touchAction: 'none',
        opacity: isDragging ? 0.35 : undefined,
      }}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────── дроп-зоны ───────────────────────────── */

interface DroppableBoardProps {
  children: React.ReactNode;
  /**
   * Подсветить стол как валидную цель. Если не передан — определяется
   * автоматически: пунктир, пока тянется карта руки.
   * В page.tsx можно вообще не передавать: <DroppableBoard>…
   */
  active?: boolean;
}

/**
 * Дроп-зона «мой стол», id 'my-board'.
 * Зелёная рамка: пунктир — валидная цель во время драга,
 * сплошная + свечение — карта прямо над столом.
 */
export function DroppableBoard({ children, active }: DroppableBoardProps) {
  const { isOver, setNodeRef, active: currentActive } = useDroppable({ id: DROP_BOARD_ID });
  const isValidTarget = getDragData(currentActive)?.type === 'hand-card';
  const showHint = active ?? isValidTarget;

  return (
    <div
      ref={setNodeRef}
      className={[
        'transition-shadow duration-150',
        showHint && isValidTarget ? 'outline outline-2 outline-dashed outline-mint/60 outline-offset-2' : '',
        isOver && isValidTarget
          ? 'outline outline-2 outline-mint outline-offset-2 shadow-[0_0_28px_rgba(20,241,149,0.45)]'
          : '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

interface DroppableMinionProps {
  uid: string;
  /** true = вражеский миньон (цель атаки, красная пульсация) */
  foe?: boolean;
  attackable?: boolean;
  children: React.ReactNode;
}

/**
 * Дроп-зона на миньоне, id `minion-<uid>` (враг) / `own-minion-<uid>` (свой).
 * Красная пульсация, когда атакующего тянут над вражеским миньоном.
 * Совместимо с существующим `attackable`-хайлайтом page.tsx.
 */
export function DroppableMinion({ uid, foe = true, attackable = true, children }: DroppableMinionProps) {
  const id = foe ? minionDropId(uid) : ownMinionDropId(uid);
  const { isOver, setNodeRef, active: currentActive } = useDroppable({ id, disabled: !attackable });
  const isValidTarget = attackable && getDragData(currentActive)?.type === 'attacker';

  return (
    <div
      ref={setNodeRef}
      className={[
        'inline-block rounded-xl transition-shadow duration-150',
        isOver && isValidTarget
          ? foe
            ? 'animate-pulse shadow-[0_0_24px_rgba(255,77,94,0.8)] ring-2 ring-blood/70'
            : 'shadow-[0_0_24px_rgba(20,241,149,0.6)] ring-2 ring-mint/70'
          : '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/**
 * Дроп-зона на портрете вражеского героя, id 'foe-hero'.
 * Красная пульсация, когда атакующего тянут над монетой врага.
 */
export function DroppableFoeHero({ children, attackable = true }: { children: React.ReactNode; attackable?: boolean }) {
  const { isOver, setNodeRef, active: currentActive } = useDroppable({ id: DROP_FOE_HERO_ID, disabled: !attackable });
  const isValidTarget = attackable && getDragData(currentActive)?.type === 'attacker';

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded-xl transition-shadow duration-150',
        isOver && isValidTarget
          ? 'animate-pulse shadow-[0_0_24px_rgba(255,77,94,0.8)] ring-2 ring-blood/70'
          : '',
      ].join(' ')}
    >
      {children}
    </div>
  );
}

/* ───────────────────────────── оверлей ───────────────────────────── */

/**
 * Превью перетаскиваемого: увеличенная карта поверх всего (портал в body, z 999).
 * Рендерится ОДИН раз рядом с корнем внутри <DndProvider>:
 *
 *   const dragCard = dragUid ? findCardDef(dragUid) : undefined;
 *   <CardDragOverlay card={dragCard} />
 *
 * card ищется из me.hand / me.board по dragUid (см. useDragState).
 */
export function CardDragOverlay({ card }: { card: CardDef | undefined }) {
  return (
    <DragOverlay dropAnimation={null}>
      {card ? (
        <div className="pointer-events-none rotate-3 scale-110 cursor-grabbing">
          <CardView card={card} size="md" playable tilt={false} />
        </div>
      ) : null}
    </DragOverlay>
  );
}

/** Spell drop target; casting is still validated by the unchanged engine. */
export function DroppableMempool({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const { active } = useDndContext();
  const data = getDragData(active), accepting = data?.type === 'hand-card' && data.cardType === 'spell';
  const { isOver, setNodeRef } = useDroppable({ id: DROP_MEMPOOL_ID, disabled: !accepting });
  return <div ref={setNodeRef} className={`mempool-drop ${accepting ? 'accepting-spell' : ''} ${accepting && isOver ? 'spell-over' : ''}`}>{children}{accepting && <span className="mempool-drop-hint">{t('Отпусти заклинание здесь', 'Drop your spell here')}</span>}</div>;
}
