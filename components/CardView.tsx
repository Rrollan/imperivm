'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import BattleIcon from './BattleIcon';
import NumberFlow from '@number-flow/react';
import CardOrnament from './CardOrnament';
import { useReducedMotion } from '../lib/prefersReducedMotion';
import { useLocale } from './LocaleContext';
import type { CardDef, Faction, Minion, Rarity } from '../lib/engine/types';
import { CARDS } from '../lib/cards';
import ArtImg from './ArtImg';
import type { UiFloat } from './battleFx';
import { HoloCard } from 'react-holo-card';

export const FACTION_COLORS: Record<Faction, string> = {
  DeFi: '#795297',
  NFT: '#57718c',
  DePIN: '#587d82',
  Meme: '#a56855',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#a3a3a3',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

interface CardViewProps {
  card: CardDef;
  size?: 'sm' | 'md' | 'lg';
  selected?: boolean;
  disabled?: boolean;
  playable?: boolean;
  tilt?: boolean;
  onClick?: () => void;
}

/**
 * Full card with 3D tilt on hover, rarity frame, art from /cards/<id>.webp,
 * blue hexagonal cost crystal, gold attack orb, red health teardrop
 * (red, bottom-right), name + rules text, Priority/Halving badges,
 * and a hover tooltip with the full rules text.
 */
export default function CardView({
  card,
  size = 'md',
  selected = false,
  disabled = false,
  playable = false,
  tilt = true,
  onClick,
}: CardViewProps) {
  const { t, cardName, cardText, rarityName, typeName, keywordName, mechanicText } = useLocale();
  const name = cardName(card.id), text = cardText(card.id);
  const ruleKeywords = ['Priority', 'Taunt', 'Rush', 'Lifesteal', 'Halving', 'Battlecry']
    .flatMap(word => [keywordName(word), word]);
  const firstKeyword = new RegExp(
    `(?<![\\p{L}\\p{N}])(${ruleKeywords.join('|')})(?![\\p{L}\\p{N}])`, 'iu',
  ).exec(text);
  const rulesText = firstKeyword ? <>
    {text.slice(0, firstKeyword.index)}<strong>{firstKeyword[0]}</strong>
    {text.slice(firstKeyword.index + firstKeyword[0].length)}
  </> : text;
  const innerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const rarityColor = RARITY_COLORS[card.rarity];
  const isMinion = card.type === 'minion';
  const isLegendary = card.rarity === 'legendary';

  const dims =
    size === 'sm'
      ? 'w-28'
      : size === 'lg'
        ? 'w-52 md:w-56'
        : 'w-32 md:w-36';
  const nameSize = size === 'sm' ? 'text-[10px]' : 'text-xs md:text-sm';
  const textSize = size === 'sm' ? 'text-[8.5px] leading-tight' : 'text-[10px] md:text-[11px] leading-snug';

  const onMove = (e: React.MouseEvent) => {
    if (!tilt || reduced || !innerRef.current) return;
    const r = innerRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    innerRef.current.style.transform = `rotateY(${(px * 14).toFixed(2)}deg) rotateX(${(-py * 11).toFixed(2)}deg) translateY(-5px)`;
  };
  const onLeave = () => {
    if (innerRef.current) innerRef.current.style.transform = '';
  };

  return (
    <div className={`card3d imperial-card-wrap card-size-${size} group/card ${dims} shrink-0`}>
      <div
        ref={innerRef}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={[
          'card3d-inner card-shine hs-card relative rounded-xl flex flex-col',
          `imperial-card card-family-${card.type} card-tier-${card.rarity} card-faction-${card.faction.toLowerCase()}`,
          selected ? 'card-selected -translate-y-2' : '',
          playable ? 'playable-card' : '',
          onClick && !disabled ? 'cursor-pointer' : '',
          disabled ? 'card-unavailable' : '',
          isLegendary ? 'legendary-glow' : '',
        ].join(' ')}
        style={{
          '--card-rarity': rarityColor,
          '--card-faction': FACTION_COLORS[card.faction],
          boxShadow: selected
            ? '0 0 22px rgba(212,175,55,0.65)'
            : playable
              ? '0 0 16px rgba(34,197,94,0.65)'
              : undefined,
        } as CSSProperties}
      >
        <CardOrnament spell={!isMinion} legendary={isLegendary} />
        {/* faction ribbon */}
        <div
          className="card-faction-ribbon h-1 rounded-t-[9px] shrink-0"
          style={{ background: `linear-gradient(90deg, transparent, ${FACTION_COLORS[card.faction]}, transparent)` }}
        />

        {/* blue hexagonal cost crystal */}
        <div className="card-cost absolute flex items-center justify-center z-10" title={t(`Стоимость: ${card.cost} газа`, `Cost: ${card.cost} gas`)}>
          <span className="text-white font-mono font-bold text-sm drop-shadow">{card.cost}</span>
        </div>
        {/* art — holo for epic/legendary, standard for others */}
        <div className="card-art bg-abyss">
          <div className="hs-card-art-inner">
            {(card.rarity === 'epic' || card.rarity === 'legendary') && !reduced ? (
              <HoloCard
                url={`/cards/${card.id}.webp`}
                width={size === 'lg' ? 200 : size === 'sm' ? 100 : 120}
                height={size === 'lg' ? 267 : size === 'sm' ? 133 : 160}
                radius="md"
                showSparkles={card.rarity === 'legendary'}
                maxTilt={18}
                scale={1.03}
                perspective={900}
                gyro={false}
                alt={name}
                className="w-full h-full"
              />
            ) : (
              <ArtImg
                src={`/cards/${card.id}.webp`}
                alt={name}
                letter={name.charAt(0)}
                className="w-full h-full"
                imgClassName="w-full h-full object-cover"
              />
            )}
          </div>
        </div>

        {/* name plate */}
        <div className="card-name px-1.5 pt-1 text-center">
          <div className={`font-display font-bold ${nameSize} leading-tight`}>
            {name}
          </div>
        </div>

        <span className="hs-card-gem" title={rarityName(card.rarity)} aria-label={rarityName(card.rarity)} />

        {/* rules text */}
        <div className={`card-rules px-2 pt-1 pb-1 text-center ${textSize} flex-1`}>
          {rulesText}
        </div>

        {/* keyword badges */}
        <div className="card-keywords flex justify-center gap-1 pb-1.5 flex-wrap px-1">
          {(['Taunt', 'Rush', 'Lifesteal'] as const).filter(word => card[word.toLowerCase() as 'taunt' | 'rush' | 'lifesteal']).map(word =>
            <span key={word} tabIndex={0} aria-label={`${keywordName(word)}: ${mechanicText(word)}`} className="keyword-chip">
              {keywordName(word)}
              <span className="keyword-tooltip" role="tooltip">{mechanicText(word)}</span>
            </span>)}
          {card.priority && (
            <span tabIndex={0} aria-label={mechanicText("Priority")} className="keyword-chip text-[8px] px-1.5 py-0.5 rounded hs-card-priority border uppercase tracking-wide font-semibold">
              <BattleIcon kind="priority" /> {t('Приоритет', 'Priority')}
              <span className="keyword-tooltip" role="tooltip">{mechanicText('Priority')}</span>
            </span>
          )}
          {card.halvingPeriod && (
            <span tabIndex={0} aria-label={mechanicText("Halving")} className="keyword-chip text-[8px] px-1.5 py-0.5 rounded hs-card-halving border uppercase tracking-wide font-semibold">
              ◈ {t('Халвинг', 'Halving')} {card.halvingPeriod}
              <span className="keyword-tooltip" role="tooltip">{mechanicText('Halving')}</span>
            </span>
          )}
        </div>

        <div className="hs-card-type">{typeName(card.type)} · {card.faction}</div>

        {/* stat orbs */}
        {isMinion && (
          <>
            <div className="card-attack absolute -bottom-3 left-1 w-9 h-9 rounded-full bg-gradient-to-br from-gold-light to-gold-dark border-2 border-[#6b4e12] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-10" title={t('Атака', 'Attack')}>
              <svg className="gladius" viewBox="0 0 12 24" aria-hidden><path d="M6 1 9 5 7 15H5L3 5ZM1 16h10M6 16v6M3 22h6" /></svg><span className="text-white font-mono font-bold text-sm">{card.attack}</span>
            </div>
            <div className="card-health absolute -bottom-3 right-1 w-9 h-9 rounded-full bg-gradient-to-br from-[#ff8a94] to-blood border-2 border-[#7a1f28] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-10" title={t('Здоровье', 'Health')}>
              <span className="text-white font-mono font-bold text-sm">{card.health}</span>
            </div>
          </>
        )}

        {/* hover tooltip with full rules text (positioning + visibility in CSS:
            desktop precise pointers only, sits to the side of the card) */}
        <div className="card-tip absolute w-52 z-40 rounded-lg border border-gold/60 bg-abyss/95 p-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.7)] backdrop-blur">
          <div className="font-display font-bold text-sm text-gold-light">{name}</div>
          <div className="text-[9px] uppercase tracking-[0.18em] text-lavender mt-0.5">
            {rarityName(card.rarity)} · {typeName(card.type)} · {card.faction} · ⬢{card.cost}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-parchment/90">{text}</p>
          {isMinion && (
            <div className="mt-1 text-[10px] font-mono text-lavender">
              <BattleIcon kind="attack" /> {card.attack} / <BattleIcon kind="health" /> {card.health}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MinionTokenProps {
  minion: Minion;
  inFlight?: boolean;
  visualOnly?: boolean;
  selected?: boolean;
  attackable?: boolean;
  canAct?: boolean;
  shaking?: boolean;
  dying?: boolean;
  justPlayed?: boolean;
  floats?: UiFloat[];
  onClick?: () => void;
  onStake?: () => void;
  onUnstake?: () => void;
}

/**
 * Hearthstone-style oval minion medallion: art fills the oval, attack shield
 * bottom-left, HP crystal bottom-right, metal frame by rarity.
 */
export function MinionToken({
  minion,
  inFlight = false,
  visualOnly = false,
  selected = false,
  attackable = false,
  canAct = false,
  shaking = false,
  dying = false,
  justPlayed = false,
  floats = [],
  onClick,
  onStake,
  onUnstake,
}: MinionTokenProps) {
  const { t, cardName, keywordName, mechanicText } = useLocale();
  const reduced = useReducedMotion();
  const def = CARDS[minion.cardId];
  const name = def ? cardName(minion.cardId) : minion.name;
  const rarity = def?.rarity ?? 'common';
  const [previewPosition, setPreviewPosition] = useState<{ left: number; top: number } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);
  const hovered = useRef(false);
  const cancelPreviewTimer = () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = null;
  };
  const closePreview = () => {
    cancelPreviewTimer();
    if (!focused.current && !hovered.current) setPreviewPosition(null);
  };
  const openPreview = (element: HTMLElement) => {
    cancelPreviewTimer();
    if (!def || visualOnly || dying || inFlight) return;
    const rect = element.getBoundingClientRect();
    setPreviewPosition({
      left: Math.max(12, Math.min(rect.right + 16, window.innerWidth - 292)),
      top: Math.max(12, Math.min(rect.top, window.innerHeight - 484)),
    });
  };
  useEffect(() => () => { if (previewTimer.current) clearTimeout(previewTimer.current); }, []);

  return (
    <div className="hs-minion relative" style={inFlight ? { visibility: 'hidden' } : undefined}>
      <div
        data-minion-uid={visualOnly ? undefined : minion.uid}
        data-rarity={rarity}
        role={onClick ? 'button' : undefined}
        tabIndex={!visualOnly ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
        aria-label={`${name}, ${minion.attack} ${t("атака", "attack")}, ${minion.health} ${t("здоровье", "health")}${minion.taunt ? `, ${keywordName("Taunt")}` : ""}${minion.staked ? `, ${t("в стейкинге", "staked")}` : ""}`}
        onPointerEnter={e => {
          if (e.pointerType === 'touch') return;
          hovered.current = true;
          const element = e.currentTarget;
          cancelPreviewTimer();
          previewTimer.current = setTimeout(() => openPreview(element), 180);
        }}
        onPointerLeave={() => { hovered.current = false; closePreview(); }}
        onFocus={e => { focused.current = true; openPreview(e.currentTarget); }}
        onBlur={() => { focused.current = false; closePreview(); }}
        className={[
          'hs-minion-oval',
          minion.taunt ? 'hs-taunt' : '',
          onClick && !dying ? 'cursor-pointer' : '',
          selected ? 'hs-selected' : '',
          attackable ? 'hs-attackable' : '',
          canAct && !dying ? 'hs-can-act' : '',
          !minion.canAttack && !dying ? 'hs-exhausted' : '',
          minion.staked ? 'hs-staked' : '',
          dying ? 'death-fade' : '',
          shaking ? 'target-shake' : '',
          justPlayed ? 'play-to-board' : '',
        ].join(' ')}
      >
        <ArtImg
          src={`/cards/${minion.cardId}.webp`}
          alt={name}
          letter={name.charAt(0)}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover"
        />
        {minion.staked && <div className="hs-staked-overlay" aria-hidden />}
        {minion.fresh && !minion.rush && !minion.staked && !dying && (
          <div className="hs-sleep" aria-label={t('Не может атаковать в ход призыва', 'Summoning sickness')}><BattleIcon kind="sleep" /></div>
        )}
        <div className="hs-pips">
          {minion.rush && <span aria-label={mechanicText("Rush")} className="hs-pip"><BattleIcon kind="priority" /></span>}
          {minion.lifesteal && <span aria-label={mechanicText("Lifesteal")} className="hs-pip"><BattleIcon kind="health" /></span>}
          {def?.halvingPeriod && <span aria-label={t(`Халвинг каждые ${def.halvingPeriod} блока: +1/+1`, `Halving every ${def.halvingPeriod} blocks: +1/+1`)} className="hs-pip">◈</span>}
          {def?.priority && <span aria-label={keywordName("Priority")} className="hs-pip"><BattleIcon kind="priority" /></span>}
        </div>
      </div>
      <span data-rarity-gem={rarity} aria-label={rarity} />
      {def && previewPosition && !visualOnly && !dying && !inFlight && <CardPreview
        card={{ ...def, attack: minion.attack, health: minion.health, taunt: minion.taunt, rush: minion.rush, lifesteal: minion.lifesteal }}
        position={previewPosition}
      />}
      {floats.map(f => (
        <span
          key={f.key}
          className={`damage-float font-mono font-black text-3xl ${
            f.kind === 'damage' ? 'text-blood' : 'text-mint'
          }`}
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 12px currentColor' }}
        >
          {f.kind === 'damage' ? `-${f.amount}` : `+${f.amount}`}
        </span>
      ))}
      <div className="hs-attack" aria-hidden>
        <span>{minion.attack}</span>
      </div>
      <div className="hs-hp" aria-hidden>
        <span><NumberFlow value={minion.health} animated={!reduced} /></span>
      </div>
      {dying && <span className="golden-death-dust" aria-hidden>{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--dust-x': `${Math.cos(i * Math.PI / 6) * (25 + i * 2)}px`, '--dust-y': `${Math.sin(i * Math.PI / 6) * 34 - 18}px`, animationDelay: `${i % 3 * 35}ms` } as CSSProperties} />)}</span>}
      {(onStake || onUnstake) && !dying && (
        <div className="hs-stake-row">
          {onStake && (
            <button
              onClick={e => { e.stopPropagation(); onStake(); }}
              className="hs-stake-btn"
            >
              {t('Стейк', 'Stake')}
            </button>
          )}
          {onUnstake && (
            <button
              onClick={e => { e.stopPropagation(); onUnstake(); }}
              className="hs-unstake-btn"
            >
              {t('Снять', 'Unstake')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}


/** Card back used in the mempool strip and pack openings. */
export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const { t } = useLocale();
  const dims = size === 'sm' ? 'w-10 h-14' : 'w-36 h-52';
  return (
    <div
      className={`${dims} rounded-lg border-2 border-gold/50 bg-gradient-to-b from-void to-abyss overflow-hidden shrink-0 shadow-[0_0_12px_rgba(212,175,55,0.25)]`}
    >
      <ArtImg
        src="/cards/card-back.webp"
        alt={t('Рубашка карты', 'Card back')}
        letter="◈"
        className="w-full h-full text-3xl"
        imgClassName="w-full h-full object-cover"
      />
    </div>
  );
}

/** Shared portal for hand and battlefield cards. */
export function CardPreview({ card, position }: { card: CardDef; position: { left: number; top: number } }) {
  if (typeof document === 'undefined') return null;
  return createPortal(<div className="hand-full-preview" style={position}>
    <CardView card={card} size="lg" tilt={false} />
  </div>, document.body);
}
