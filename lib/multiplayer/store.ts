import {createHash, randomBytes, randomInt} from 'node:crypto';
import {applyAction, createGame, effectivePowerCost, legalActions, mempoolOf, mulliganAvailable} from '../engine/engine';
import {boardCapacity} from '../engine/tactics';
import {FREE_DECKS as DECKS} from '../collection/starterDecks';
import {HEROES,isFreeHero} from '../heroes';
import {cardName, heroName, powerName} from '../locale';
import type {Action, GameState, PlayerId} from '../engine/types';
import type {OnlineCommand, OnlinePlayer, OnlineRoom, OnlineSession} from './types';

const SESSION_TTL = 6 * 60 * 60_000;
const WAIT_TTL = 10 * 60_000;
const QUEUE_TTL = 5 * 60_000;
const ROOM_TTL = 60 * 60_000;
const RESULT_TTL = 15 * 60_000;
export const TURN_MS = 90_000;
export const DISCONNECT_MS = 150_000;
const MAX_SESSIONS = 2000, MAX_ROOMS = 500;
interface Guest {expiresAt: number; seenAt: number; roomId: string | null; window: number; reads: number; writes: number}
interface Room {
  id: string; mode: 'friend' | 'random'; seats: [string, string | null]; heroes: [string, string | null];
  revision: number; expiresAt: number; game: GameState | null; turnDeadline: number;
  reason: OnlineRoom['resultReason']; history: OnlineRoom['history'];
}
interface QueueEntry {heroId: string; enteredAt: number; expiresAt: number}
export class OnlineError extends Error {
  constructor(public status: number, public code: string, message: string) {super(message);}
}
function fail(status: number, code: string, message: string): never {throw new OnlineError(status, code, message);}
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Single-process authority. For several instances, replace with transactional durable storage. */
export class MultiplayerStore {
  private sessions = new Map<string, Guest>();
  private rooms = new Map<string, Room>();
  private queue = new Map<string, QueueEntry>();
  private createWindow = 0;
  private creates = 0;
  constructor(private clock = () => Date.now()) {}

  createSession(): string {
    const now = this.clock(); this.prune(now);
    const window = Math.floor(now / 60_000);
    if (window !== this.createWindow) {this.createWindow = window; this.creates = 0;}
    if (++this.creates > 100 || this.sessions.size >= MAX_SESSIONS) fail(429, 'capacity', 'Слишком много подключений. Попробуйте через минуту.');
    const token = randomBytes(32).toString('base64url');
    this.sessions.set(hash(token), {expiresAt: now + SESSION_TTL, seenAt: now, roomId: null, window, reads: 0, writes: 0});
    return token;
  }
  validSession(token: string | undefined): boolean {
    return !!token && /^[A-Za-z0-9_-]{43}$/.test(token) && (this.sessions.get(hash(token))?.expiresAt ?? 0) > this.clock();
  }
  private guest(token: string, write: boolean): [string, Guest, number] {
    const now = this.clock(); this.prune(now);
    if (!this.validSession(token)) fail(401, 'session-expired', 'Гостевая сессия истекла. Обновите страницу.');
    const key = hash(token), guest = this.sessions.get(key)!;
    const window = Math.floor(now / 60_000);
    if (guest.window !== window) {guest.window = window; guest.reads = 0; guest.writes = 0;}
    if ((write ? ++guest.writes > 60 : ++guest.reads > 90)) fail(429, 'rate-limit', 'Слишком много действий. Подождите немного.');
    // Evaluate an elapsed grace period before this reconnect renews presence.
    if (guest.roomId) {const room = this.rooms.get(guest.roomId); if (room) this.tick(room, now);}
    guest.seenAt = now;
    return [key, guest, now];
  }
  private prune(now: number) {
    for (const [key, guest] of Array.from(this.sessions)) if (guest.expiresAt <= now) {this.sessions.delete(key); this.queue.delete(key);}
    for (const [key, entry] of Array.from(this.queue)) if (entry.expiresAt <= now || !this.sessions.has(key)) this.queue.delete(key);
    for (const [id, room] of Array.from(this.rooms)) if (room.expiresAt <= now) {
      this.rooms.delete(id);
      for (const key of room.seats) if (key) {const guest = this.sessions.get(key); if (guest?.roomId === id) guest.roomId = null;}
    }
  }
  private hero(heroId: string, verifiedHero?: string) {
    if (!Object.hasOwn(HEROES, heroId) || !DECKS[heroId]) fail(400, 'hero', 'Выберите одного из доступных предводителей.');
    if(!isFreeHero(heroId)&&verifiedHero!==heroId)fail(403,'hero-locked','Правитель из кейса требует подтверждённой коллекции iDos.');
  }
  private clearFinished(guest: Guest) {
    if (!guest.roomId) return;
    const room = this.rooms.get(guest.roomId);
    if (!room || room.game?.winner !== null && room.game !== null) guest.roomId = null;
    else fail(409, 'already-in-room', 'У вас уже есть комната. Завершите бой или отмените приглашение.');
  }
  private createRoom(key: string, guest: Guest, heroId: string, mode: Room['mode'], now: number): Room {
    if (this.rooms.size >= MAX_ROOMS) fail(503, 'capacity', 'Все столы заняты. Попробуйте позже.');
    const room: Room = {id: randomBytes(16).toString('hex'), mode, seats: [key, null], heroes: [heroId, null], revision: 0,
      expiresAt: now + WAIT_TTL, game: null, turnDeadline: 0, reason: null, history: []};
    this.rooms.set(room.id, room); guest.roomId = room.id; this.queue.delete(key); return room;
  }
  private start(room: Room, key: string, guest: Guest, heroId: string, now: number) {
    room.seats[1] = key; room.heroes[1] = heroId; guest.roomId = room.id; this.queue.delete(key);
    // Randomly assign the first turn instead of giving the inviter / oldest queue entry an advantage.
    if (randomInt(2)) {room.seats.reverse(); room.heroes.reverse();}
    room.game = createGame(room.heroes[0]!, DECKS[room.heroes[0]!], room.heroes[1]!, DECKS[room.heroes[1]!], {enableMulligan: true}, randomInt(0x7fffffff));
    room.revision++; room.expiresAt = now + ROOM_TTL; room.turnDeadline = now + TURN_MS;
    room.history.push({revision: room.revision, text: 'Оба игрока за столом. Выберите стартовые карты.', textEn: 'Both players are seated. Choose your opening cards.'});
  }
  private roomFor(key: string, roomId: string): {room: Room; seat: PlayerId} {
    const room = this.rooms.get(roomId);
    if (!room) fail(404, 'room-expired', 'Комната закрыта или срок приглашения истёк.');
    const seat = room.seats.indexOf(key);
    if (seat < 0) fail(403, 'seat', 'Эта комната принадлежит другим игрокам.');
    return {room, seat: seat as PlayerId};
  }
  private finish(room: Room, winner: PlayerId | 'draw', reason: OnlineRoom['resultReason'], now: number) {
    room.game = {...room.game!, winner}; room.reason = reason; room.revision++; room.expiresAt = now + RESULT_TTL;
    room.history.push({revision: room.revision, text: reason === 'concede' ? 'Игрок сдался.' : reason === 'disconnect' ? 'Бой завершён: игрок не вернулся за 150 секунд.' : 'Время комнаты истекло.', textEn: reason === 'concede' ? 'A player conceded.' : reason === 'disconnect' ? 'Match ended: a player did not return within 150 seconds.' : 'The room expired.'});
  }
  private tick(room: Room, now: number) {
    if (!room.game || room.game.winner !== null) return;
    const absent = room.seats.map(key => !key || now - (this.sessions.get(key)?.seenAt ?? 0) >= DISCONNECT_MS);
    if (absent[0] || absent[1]) {this.finish(room, absent[0] && absent[1] ? 'draw' : absent[0] ? 1 : 0, 'disconnect', now); return;}
    if (room.turnDeadline <= now) {
      let game = room.game;
      if (mulliganAvailable(game)) game = applyAction(game, {type: 'mulligan', uids: []});
      if (game.winner === null) game = applyAction(game, {type: 'end-turn'});
      room.game = game; room.revision++; room.turnDeadline = now + TURN_MS;
      room.history.push({revision: room.revision, text: '90 секунд истекли: ход передан противнику.', textEn: '90 seconds elapsed: the turn passed to the opponent.'});
      if (game.winner !== null) {room.reason = 'battle'; room.expiresAt = now + RESULT_TTL;}
    }
  }
  private view(key: string, guest: Guest, now: number): OnlineSession {
    const queued = this.queue.get(key);
    if (!guest.roomId) return {room: null, queue: queued ? {...queued} : null};
    const {room, seat} = this.roomFor(key, guest.roomId); this.tick(room, now);
    const foe = (1 - seat) as PlayerId, foeGuest = room.seats[foe] ? this.sessions.get(room.seats[foe]!) : null;
    const opponentPresent = !!foeGuest && now - foeGuest.seenAt < 10_000;
    const game = room.game;
    const players = game?.players.map((p, index): OnlinePlayer => ({id: p.id, heroId: p.heroId, treasury: p.treasury, gas: p.gas,
      maxGas: p.maxGas, boardCapacity:boardCapacity(p), factionPlaysThisTurn:{...p.factionPlaysThisTurn},pavilionBonuses:[...(p.pavilionBonuses??[])],...(p.powerIncome?{powerIncome:p.powerIncome}:{}), fatigue: p.fatigue, heroPowerUsed: p.heroPowerUsed, reinforcementUsed: !!p.reinforcementUsed, powerCost: effectivePowerCost(game, index as PlayerId), handCount: p.hand.length, deckCount: p.deck.length,
      board: p.board.map(m => ({uid: m.uid, cardId: m.cardId, name: m.name, attack: m.attack, health: m.health, maxHealth: m.maxHealth,
        canAttack: m.canAttack, staked: m.staked, taunt: !!m.taunt, rush: !!m.rush, lifesteal: !!m.lifesteal, fresh: !!m.fresh})),
      edicts: mempoolOf(game, index as PlayerId).map(e => ({...e})), ...(index === seat ? {hand: p.hand.map(h => ({...h}))} : {})})) as [OnlinePlayer, OnlinePlayer] | undefined;
    return {queue: null, room: {id: room.id, mode: room.mode, revision: room.revision, seat, heroId: room.heroes[seat]!, expiresAt: room.expiresAt,
      status: !game ? 'waiting' : game.winner !== null ? 'finished' : 'playing', opponentPresent,
      disconnectDeadline: game && game.winner === null && !opponentPresent && foeGuest ? foeGuest.seenAt + DISCONNECT_MS : null,
      resultReason: room.reason, history: room.history.slice(-12).map(e => ({...e})),
      game: game && players ? {block: game.block, turn: game.turn, winner: game.winner, players,
        actions: game.turn === seat && game.winner === null ? legalActions(game) : [],
        mulliganOpen: game.turn === seat && mulliganAvailable(game), turnDeadline: room.turnDeadline} : null}};
  }
  status(token: string): OnlineSession {const [key, guest, now] = this.guest(token, false); return this.view(key, guest, now);}
  command(token: string, command: OnlineCommand, verifiedHero?: string): OnlineSession {
    const [key, guest, now] = this.guest(token, true);
    if (command.type === 'session') return this.view(key, guest, now);
    if (command.type === 'cancel') {
      this.queue.delete(key);
      if (guest.roomId) {const {room} = this.roomFor(key, guest.roomId); if (room.game?.winner === null) fail(409, 'active-match', 'Чтобы выйти из активного боя, нажмите «Сдаться».'); if (!room.game) this.rooms.delete(room.id); guest.roomId = null;}
      return this.view(key, guest, now);
    }
    if (command.type === 'create' || command.type === 'queue' || command.type === 'join') {
      this.hero(command.heroId,verifiedHero);
      if (command.type === 'join' && guest.roomId === command.roomId) return this.view(key, guest, now);
      this.clearFinished(guest);
      if (command.type === 'create') this.createRoom(key, guest, command.heroId, 'friend', now);
      else if (command.type === 'join') {
        const room = this.rooms.get(command.roomId);
        if (!room || room.mode !== 'friend') fail(404, 'room-expired', 'Приглашение недоступно или истекло.');
        if (room.game || room.seats[1]) fail(409, 'room-full', 'Оба места в комнате уже заняты.');
        this.start(room, key, guest, command.heroId, now);
      } else {
        if (this.queue.has(key)) return this.view(key, guest, now);
        const opponent = Array.from(this.queue).find(([other]) => other !== key && !this.sessions.get(other)?.roomId && now - this.sessions.get(other)!.seenAt < 15_000);
        if (opponent) {
          const [other, entry] = opponent, otherGuest = this.sessions.get(other)!;
          const room = this.createRoom(other, otherGuest, entry.heroId, 'random', now);
          this.start(room, key, guest, command.heroId, now);
        } else this.queue.set(key, {heroId: command.heroId, enteredAt: now, expiresAt: now + QUEUE_TTL});
      }
      return this.view(key, guest, now);
    }
    const {room, seat} = this.roomFor(key, command.roomId); this.tick(room, now);
    if (room.revision !== command.revision) fail(409, 'revision', 'Бой изменился. Обновляем состояние — повторите действие.');
    if (!room.game || room.game.winner !== null) fail(409, 'not-playing', 'Бой ещё не начался или уже завершён.');
    if (command.type === 'concede') this.finish(room, (1 - seat) as PlayerId, 'concede', now);
    else {
      if (room.game.turn !== seat) fail(403, 'wrong-turn', 'Сейчас ход противника.');
      const before = room.game;
      try {room.game = applyAction(before, command.action);} catch {fail(400, 'illegal-action', 'Это действие сейчас недоступно.');}
      room.revision++;
      if (before.turn !== room.game.turn) room.turnDeadline = now + TURN_MS;
      room.history.push({revision: room.revision, text: describeAction(before, seat, command.action, 'ru'), textEn: describeAction(before, seat, command.action, 'en')});
      if (room.game.winner !== null) {room.reason = 'battle'; room.expiresAt = now + RESULT_TTL;}
    }
    if (room.history.length > 120) room.history.splice(0, room.history.length - 120);
    return this.view(key, guest, now);
  }
}

function describeAction(before: GameState, seat: PlayerId, action: Action, locale: 'ru' | 'en'): string {
  const label = heroName(before.players[seat].heroId, locale), ru = locale === 'ru';
  switch (action.type) {
    case 'play-minion': case 'cast-spell': {
      const card = before.players[seat].hand.find(h => h.uid === action.uid);
      return `${label}: ${card ? cardName(card.cardId, locale) : ru ? 'разыграна карта' : 'card played'}.`;
    }
    case 'attack': return `${label}: ${ru ? `атака ${action.target === 'hero' ? 'казны' : 'бойца'}` : `attacks the ${action.target === 'hero' ? 'treasury' : 'fighter'}`}.`;
    case 'hero-power': return `${label}: ${powerName(before.players[seat].heroId, locale)}.`;
    case 'buy-card': return `${label}: ${ru ? 'куплена карта подкрепления за 2 приказа' : 'reserve card bought for 2 orders'}.`;
    case 'stake': return `${label}: ${ru ? 'боец поставлен в стейкинг' : 'fighter staked'}.`;
    case 'unstake': return `${label}: ${ru ? 'боец возвращён из стейкинга' : 'fighter unstaked'}.`;
    case 'mulligan': return `${label}: ${ru ? 'заменено стартовых карт' : 'opening cards replaced'} — ${action.uids.length}.`;
    case 'end-turn': return `${label}: ${ru ? 'ход завершён' : 'turn ended'}.`;
  }
}

// Next route chunks and development reloads share one authority per Node process.
const globalStore = globalThis as typeof globalThis & {imperivmMultiplayer?: MultiplayerStore};
export const multiplayer = globalStore.imperivmMultiplayer ??= new MultiplayerStore();
