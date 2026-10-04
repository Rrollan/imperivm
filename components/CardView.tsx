'use client';

import { useRef, type CSSProperties } from 'react';
import CardOrnament from './CardOrnament';
import { useReducedMotion } from '../lib/prefersReducedMotion';
import { useLocale } from './LocaleContext';
import type { CardDef, Faction, Minion, Rarity } from '../lib/engine/types';
import { CARDS } from '../lib/cards';
import ArtImg from './ArtImg';
import type { UiFloat } from './battleFx';

export const FACTION_COLORS: Record<Faction, string> = {
  DeFi: '#9945FF',
  NFT: '#A89BC0',
  DePIN: '#14F195',
  Meme: '#D4AF37',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#6B7280',
  rare: '#53C7DB',
  epic: '#A855F7',
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
 * cost gem (blue, top-left), attack orb (gold, bottom-left), health orb
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

        {/* cost gem — blue, top-left */}
        <div className="card-cost absolute -top-2.5 -left-2.5 w-8 h-8 rotate-45 bg-gradient-to-br from-[#7dd3fc] to-[#1d4ed8] border-2 border-[#bfdbfe] flex items-center justify-center shadow-[0_0_10px_rgba(59,130,246,0.7)] z-10" title={t(`Стоимость: ${card.cost} газа`, `Cost: ${card.cost} gas`)}>
          <span className="-rotate-45 text-white font-mono font-bold text-sm drop-shadow">{card.cost}</span>
        </div>
        {/* rarity gem — top-right */}
        <div
          className="card-rarity-gem absolute top-1.5 right-1.5 w-3 h-3 rotate-45 border border-black/50 z-10"
          style={{ background: rarityColor, boxShadow: `0 0 6px ${rarityColor}` }}
          title={rarityName(card.rarity)}
        />

        {/* art */}
        <div className="card-art mx-1.5 mt-1 rounded-lg overflow-hidden border border-gold-dark/60 aspect-[3/4] bg-abyss">
          <ArtImg
            src={`/cards/${card.id}.webp`}
            alt={name}
            letter={name.charAt(0)}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover"
          />
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
              <span className="text-abyss font-mono font-bold text-sm">{card.attack}</span>
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
 * Compact board token: art medallion, attack/health orbs, state highlights
 * (selected / attackable / canAct / staked), floating damage numbers,
 * death + play + attack-lunge animations.
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
  const rarityColor = def ? RARITY_COLORS[def.rarity] : '#A89BC0';

  return (
    <div className="minion-token flex flex-col items-center relative">
      <div
        data-minion-uid={minion.uid}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
        aria-label={`${name}, ${minion.attack} ${t("атака", "attack")}, ${minion.health} ${t("здоровье", "health")}${minion.taunt ? `, ${keywordName("Taunt")}` : ""}${minion.staked ? `, ${t("в стейкинге", "staked")}` : ""}`}
        title={def ? `${name} — ${cardText(minion.cardId)}` : name}
        className={[
          'relative w-[4.6rem] h-[5.4rem] md:w-20 md:h-[6rem] rounded-xl bg-gradient-to-b from-[#2a1745] to-abyss',
          'flex flex-col items-center justify-start pt-1 pb-4',
          onClick && !dying ? 'cursor-pointer' : '',
          selected
            ? 'shadow-[0_0_18px_rgba(212,175,55,0.7)]'
            : attackable
              ? 'animate-pulse shadow-[0_0_14px_rgba(255,77,94,0.55)]'
              : canAct
                ? 'shadow-[0_0_10px_rgba(212,175,55,0.35)]'
                : '',
          dying ? 'death-fade grayscale' : '',
          shaking ? 'target-shake' : '',
          justPlayed ? 'play-to-board' : '',
        ].join(' ')}
        style={{
          border: `2px ${minion.staked ? 'dashed' : 'solid'} ${
            selected ? '#D4AF37' : attackable ? '#FF4D5E' : canAct ? 'rgba(212,175,55,0.65)' : minion.staked ? '#8C6A1F' : rarityColor
          }`,
        }}
      >
        {/* art medallion */}
        <div
          className="board-minion-art overflow-hidden shrink-0 bg-abyss"
          style={{ border: `2px solid ${rarityColor}` }}
        >
          <ArtImg
            src={`/cards/${minion.cardId}.webp`}
            alt={name}
            letter={name.charAt(0)}
            className="w-full h-full text-lg"
            imgClassName="w-full h-full object-cover"
          />
        </div>
        <div className="text-[8.5px] md:text-[9px] text-parchment/90 text-center leading-tight px-1 font-semibold mt-0.5 line-clamp-2">
          {name}
        </div>

        {/* status icons */}
        <div className="flex items-center gap-1 mt-0.5">
          {minion.taunt && <span title={mechanicText("Taunt")} aria-label={keywordName("Taunt")} className="token-keyword">◆</span>}
          {minion.rush && <span title={mechanicText("Rush")} aria-label={keywordName("Rush")} className="token-keyword">↯</span>}
          {minion.lifesteal && <span title={mechanicText("Lifesteal")} aria-label={keywordName("Lifesteal")} className="token-keyword">♥</span>}
          {minion.staked && (
            <span className="text-[8px] uppercase tracking-widest text-gold-dark font-bold">{t('⛓ стейкинг', '⛓ staked')}</span>
          )}
          {!minion.canAttack && !minion.staked && !dying && (
            <span className="text-[9px] text-lavender/70" title={t('Не может атаковать в ход призыва', 'Summoning sickness')}>💤</span>
          )}
          {def?.halvingPeriod && (
            <span className="text-[9px] text-mint" title={t(`Халвинг каждые ${def.halvingPeriod} блока: +1/+1`, `Halving every ${def.halvingPeriod} blocks: +1/+1`)}>◈</span>
          )}
          {def?.priority && (
            <span className="text-[9px] text-blood" title={keywordName("Priority")}>⚡</span>
          )}
        </div>

        {/* stat orbs */}
        <div className="absolute -bottom-2.5 left-0.5 w-7 h-7 rounded-full bg-gradient-to-br from-gold-light to-gold-dark border-2 border-[#6b4e12] flex items-center justify-center shadow z-10">
          <span className="text-abyss font-mono font-bold text-xs">{minion.attack}</span>
        </div>
        <div className="absolute -bottom-2.5 right-0.5 w-7 h-7 rounded-full bg-gradient-to-br from-[#ff8a94] to-blood border-2 border-[#7a1f28] flex items-center justify-center shadow z-10">
          <span className="text-white font-mono font-bold text-xs">{minion.health}</span>
        </div>

        {/* floating combat numbers */}
        {floats.map(f => (
          <span
            key={f.key}
            className={`damage-float absolute top-1 left-1/2 font-mono font-bold text-lg z-30 ${
              f.kind === 'damage' ? 'text-blood' : 'text-mint'
            }`}
          >
            {f.kind === 'damage' ? `-${f.amount}` : `+${f.amount}`}
          </span>
        ))}
      </div>

      {(onStake || onUnstake) && !dying && (
        <div className="mt-3.5 flex gap-1">
          {onStake && (
            <button
              onClick={e => {
                e.stopPropagation();
                onStake();
              }}
              className="text-[9px] px-1.5 py-0.5 rounded border border-gold/50 text-gold hover:bg-gold/10 uppercase tracking-wide"
              title={t('Стейкинг: +1 газ каждый ход, атака недоступна', 'Stake: +1 gas each turn, cannot attack')}
            >
              {t('В стейкинг', 'Stake')}
            </button>
          )}
          {onUnstake && (
            <button
              onClick={e => {
                e.stopPropagation();
                onUnstake();
              }}
              className="text-[9px] px-1.5 py-0.5 rounded border border-lavender/50 text-lavender hover:bg-lavender/10 uppercase tracking-wide"
              title={t('Вывести существо из стейкинга', 'Unstake this minion')}
            >
              {t('Вывести', 'Unstake')}
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
