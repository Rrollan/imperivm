'use client';

import { useRef, type CSSProperties } from 'react';
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
  common: '#b97845',
  rare: '#c2c7d0',
  epic: '#d4af37',
  legendary: '#D4AF37',
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
 * gas crystal (amber, top-left), attack orb (gold, bottom-left), health shield
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
          'card3d-inner card-shine relative rounded-xl flex flex-col',
          `imperial-card card-family-${card.type} card-tier-${card.rarity} card-faction-${card.faction.toLowerCase()}`,
          'bg-gradient-to-b from-[#2a1745] via-void to-abyss',
          selected ? '-translate-y-2' : '',
          playable ? 'playable-card' : '',
          onClick && !disabled ? 'cursor-pointer' : '',
          disabled ? 'opacity-40 saturate-50' : '',
          isLegendary ? 'legendary-glow' : '',
        ].join(' ')}
        style={{
          '--card-rarity': rarityColor,
          '--card-faction': FACTION_COLORS[card.faction],
          boxShadow: selected
            ? '0 0 22px rgba(212,175,55,0.65)'
            : playable
              ? '0 0 12px rgba(212,175,55,0.4)'
              : undefined,
        } as CSSProperties}
      >
        <CardOrnament spell={!isMinion} legendary={isLegendary} />
        {/* faction ribbon */}
        <div
          className="card-faction-ribbon h-1 rounded-t-[9px] shrink-0"
          style={{ background: `linear-gradient(90deg, transparent, ${FACTION_COLORS[card.faction]}, transparent)` }}
        />

        {/* gas crystal — amber, top-left */}
        <div className="card-cost absolute -top-2.5 -left-2.5 w-8 h-8 rotate-45 border-2 border-[#f5d76e] flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.6)] z-10" title={t(`Стоимость: ${card.cost} газа`, `Cost: ${card.cost} gas`)}>
          <span className="-rotate-45 text-white font-mono font-bold text-sm drop-shadow">{card.cost}</span>
        </div>
        {/* art — holo for epic/legendary, standard for others */}
        <div className="card-art mx-1.5 mt-1 rounded-lg overflow-hidden border border-gold-dark/60 aspect-[3/4] bg-abyss">
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

        {/* name plate */}
        <div className="card-name px-1.5 pt-1 text-center">
          <div className={`font-display font-bold ${nameSize} text-parchment leading-tight`}>
            {name}
          </div>
          <div className="text-[8px] uppercase tracking-[0.18em] text-lavender/80">
            {typeName(card.type)} · {card.faction}
          </div>
        </div>

        <span className="rarity-coin" title={`${rarityName(card.rarity)} · $RUG`} aria-label={`${rarityName(card.rarity)} · $RUG`}>
          <span>$RUG</span>{isLegendary && <span className="coin-laurels" aria-hidden><img src="/ornaments/laurel.svg" alt="" /><img src="/ornaments/laurel.svg" alt="" /></span>}
        </span>

        {/* rules text */}
        <div className={`card-rules px-2 pt-1 pb-1 text-center text-parchment/80 ${textSize} flex-1`}>
          {text}
        </div>

        {/* keyword badges */}
        <div className="card-keywords flex justify-center gap-1 pb-1.5 flex-wrap px-1">
          {(['Taunt', 'Rush', 'Lifesteal'] as const).filter(word => card[word.toLowerCase() as 'taunt' | 'rush' | 'lifesteal']).map(word =>
            <span key={word} title={mechanicText(word)} className="keyword-chip">{keywordName(word)}</span>)}
          {card.priority && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-blood/20 text-blood border border-blood/50 uppercase tracking-wide font-semibold">
              ⚡ {t('Приоритет', 'Priority')}
            </span>
          )}
          {card.halvingPeriod && (
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-mint/10 text-mint border border-mint/40 uppercase tracking-wide font-semibold">
              ◈ {t('Халвинг', 'Halving')} {card.halvingPeriod}
            </span>
          )}
        </div>

        {/* stat orbs */}
        {isMinion && (
          <>
            <div className="card-attack absolute -bottom-3 left-1 w-9 h-9 rounded-full bg-gradient-to-br from-gold-light to-gold-dark border-2 border-[#6b4e12] flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.6)] z-10" title={t('Атака', 'Attack')}>
              <svg className="gladius" viewBox="0 0 12 24" aria-hidden><path d="M6 1 9 5 7 15H5L3 5ZM1 16h10M6 16v6M3 22h6" /></svg><span className="text-abyss font-mono font-bold text-sm">{card.attack}</span>
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
              ⚔ {card.attack} / ♥ {card.health}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface MinionTokenProps {
  minion: Minion;
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
  const { t, cardName, cardText, keywordName, mechanicText } = useLocale();
  const def = CARDS[minion.cardId];
  const name = def ? cardName(minion.cardId) : minion.name;
  const rarity = def?.rarity ?? 'common';

  return (
    <div className="hs-minion relative">
      <div
        data-minion-uid={minion.uid}
        data-rarity={rarity}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
        aria-label={`${name}, ${minion.attack} ${t("атака", "attack")}, ${minion.health} ${t("здоровье", "health")}${minion.taunt ? `, ${keywordName("Taunt")}` : ""}${minion.staked ? `, ${t("в стейкинге", "staked")}` : ""}`}
        title={def ? `${name} — ${cardText(minion.cardId)}` : name}
        className={[
          'hs-minion-oval',
          minion.taunt ? 'hs-taunt' : '',
          onClick && !dying ? 'cursor-pointer' : '',
          selected ? 'hs-selected' : '',
          attackable ? 'hs-attackable' : '',
          canAct && !dying ? 'hs-can-act' : '',
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
        {!minion.canAttack && !minion.staked && !dying && (
          <div className="hs-sleep" title={t('Не может атаковать в ход призыва', 'Summoning sickness')}>💤</div>
        )}
        <div className="hs-pips">
          {minion.rush && <span title={mechanicText("Rush")} className="hs-pip">↯</span>}
          {minion.lifesteal && <span title={mechanicText("Lifesteal")} className="hs-pip">♥</span>}
          {def?.halvingPeriod && <span title={t(`Халвинг каждые ${def.halvingPeriod} блока: +1/+1`, `Halving every ${def.halvingPeriod} blocks: +1/+1`)} className="hs-pip">◈</span>}
          {def?.priority && <span title={keywordName("Priority")} className="hs-pip">⚡</span>}
        </div>
        {floats.map(f => (
          <span
            key={f.key}
            className={`damage-float absolute top-0 left-1/2 font-mono font-black text-3xl z-30 ${
              f.kind === 'damage' ? 'text-blood' : 'text-mint'
            }`}
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 12px currentColor' }}
          >
            {f.kind === 'damage' ? `-${f.amount}` : `+${f.amount}`}
          </span>
        ))}
      </div>
      <div className="hs-attack" aria-hidden>
        <span>{minion.attack}</span>
      </div>
      <div className="hs-hp" aria-hidden>
        <span>{minion.health}</span>
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


/** Attack-lunge wrapper: moves the whole token (art + orbs + buttons) toward the target. */
export function LungeWrap({
  active,
  up,
  children,
}: {
  active: boolean;
  up: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={active ? `attack-lunge ${up ? 'lunge-up' : 'lunge-down'}` : ''}>
      {children}
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
