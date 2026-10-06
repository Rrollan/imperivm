'use client';
import {useEffect, useRef, useState} from 'react';
import type {OnlineGame} from '../../lib/multiplayer/types';
import type {OnlineFx} from './OnlineContact';
import {cardIdentity} from '../presentation/cardIdentity';

const deployment: Record<ReturnType<typeof cardIdentity>['role'], OnlineFx['id']> = {legionary:'10-deploy-legionary',guard:'11-deploy-guard',commander:'12-deploy-commander',minister:'13-deploy-minister',priest:'14-deploy-priest',engineer:'15-deploy-engineer',edict:'10-deploy-legionary'};

/** Only observed public stat changes trigger contact. Buff growth is never shown as healing. */
export function useOnlineEffects(game: OnlineGame, revision: number) {
  const previous = useRef<OnlineGame | null>(null), [effects, setEffects] = useState<Record<string, OnlineFx>>({});
  useEffect(() => {
    const before = previous.current; previous.current = game;
    if (!before) return;
    const next: Record<string, OnlineFx> = {};
    game.players.forEach((player, seat) => {
      const old = before.players[seat];
      const treasury = player.treasury - old.treasury;
      if (treasury) next[`hero-${seat}`] = {key: `${revision}-hero-${seat}`, id: treasury < 0 ? '01-impact' : '02-builder-heal', health: treasury, attack: 0};
      player.board.forEach(minion => {
        const previousMinion = old.board.find(m => m.uid === minion.uid);
        if (!previousMinion) {next[minion.uid] = {key: `${revision}-${minion.uid}`, id: deployment[cardIdentity(minion.cardId).role], health: 0, attack: 0}; return;}
        const health = minion.health - previousMinion.health, attack = minion.attack - previousMinion.attack;
        if (!health && !attack) return;
        const id: OnlineFx['id'] = health < 0 ? '01-impact' : attack < 0 ? '16-edict-weaken' : minion.maxHealth > previousMinion.maxHealth || attack > 0 ? '08-spell-buff' : '17-edict-heal';
        next[minion.uid] = {key: `${revision}-${minion.uid}`, id, health, attack};
      });
    });
    setEffects(next);
    const timer = window.setTimeout(() => setEffects({}), 1100);
    return () => clearTimeout(timer);
    // Server polls create new object identities even when no action occurred.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);
  return effects;
}
