import {createHash, randomBytes, randomInt, timingSafeEqual} from 'node:crypto';
import {WebSocket} from 'ws';
import {actionForIntent, applyMove, createGame, endExpiredTurn, gameSnapshot} from '../../lib/engine/network';
import type {GameState, PlayerId} from '../../lib/engine/types';
import type {ClientMessage, GameIntent, JoinMessage, NetSnapshot, PlayerRegistration, ServerMessage} from '../../lib/net/protocol';
import {createRoomCode} from '../../lib/net/roomCode';
import {ProtocolError} from './validation';

export const TURN_MS = 75_000;
export const ROOM_TTL_MS = 30 * 60_000;
export const QUEUE_TTL_MS = 5 * 60_000;
interface Player {
  name: string; heroId: string; deck: string[]; token: string; socket: WebSocket | null;
}
interface Room {
  code: string; mode: 'friend' | 'random'; players: [Player, Player | null]; game: GameState | null; revision: number;
  lastActivity: number; turnDeadline: number; reason: NetSnapshot['resultReason']; history: NetSnapshot['history'];
}
const digest = (value: string) => createHash('sha256').update(value).digest();
const sameName = (a: string, b: string) => a.normalize('NFKC').toLocaleLowerCase('en-US') === b.normalize('NFKC').toLocaleLowerCase('en-US');
export function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  if (socket.bufferedAmount > 1024 * 1024) {socket.terminate(); return;}
  socket.send(JSON.stringify(message));
}

/** One process / one Map. A name is a display label; only the secret can resume a seat. */
export class RoomAuthority {
  private rooms = new Map<string, Room>();
  private membership = new Map<WebSocket, Room>();
  private queue = new Map<WebSocket, {player: Player; enteredAt: number}>();
  constructor(private clock: () => number = Date.now, private log: (line: string) => void = console.warn) {}
  get size(): number {return this.rooms.size;}
  get queued(): number {return this.queue.size;}
  private error(code: string, reason: string, fatal = false): never {throw new ProtocolError(code, reason, fatal);}
  private makePlayer(data: PlayerRegistration, socket: WebSocket): Player {
    return {name: data.playerName, heroId: data.heroId ?? 'builder', deck: [...data.deckList], token: randomBytes(32).toString('base64url'), socket};
  }
  private view(room: Room, seat: PlayerId): NetSnapshot {
    const now = this.clock(), player = room.players[seat]!;
    return {id: room.code, roomCode: room.code, mode: room.mode, seat, heroId: player.heroId,
      revision: room.revision, status: !room.game ? 'waiting' : room.game.winner === null ? 'playing' : 'finished',
      names: [room.players[0].name, room.players[1]?.name ?? null], serverTime: now, turnDuration: 75,
      expiresAt: room.lastActivity + ROOM_TTL_MS, opponentPresent: room.players[(1 - seat) as PlayerId]?.socket?.readyState === WebSocket.OPEN,
      disconnectDeadline: null, resultReason: room.reason, history: room.history.slice(-12).map(e => ({...e})),
      game: room.game ? gameSnapshot(room.game, seat, room.turnDeadline) : null};
  }
  private publish(room: Room, joined = false): void {
    room.players.forEach((player, index) => {
      if (!player?.socket) return;
      const seat = index as PlayerId;
      if (joined) send(player.socket, {type: 'joined', you: seat === 0 ? 'p1' : 'p2', roomCode: room.code,
        resumeToken: player.token, opponent: {name: room.players[(1 - seat) as PlayerId]?.name ?? ''}});
      send(player.socket, {type: 'state', snapshot: this.view(room, seat)});
      if (room.game?.winner !== null && room.game?.winner !== undefined) send(player.socket, {type: 'gameOver',
        winner: room.game.winner === 'draw' ? 'draw' : room.game.winner === 0 ? 'p1' : 'p2', reason: room.reason ?? 'battle'});
    });
  }
  private remember(room: Room, text: string, textEn: string): void {
    room.history.push({revision: room.revision, text, textEn});
    if (room.history.length > 120) room.history.shift();
  }
  private requireRoom(socket: WebSocket): {room: Room; seat: PlayerId} {
    const room = this.membership.get(socket);
    if (!room || !this.rooms.has(room.code)) return this.error('not-joined', 'Сначала подключитесь к комнате.', true);
    const seat = room.players.findIndex(player => player?.socket === socket);
    if (seat < 0) return this.error('seat', 'Это место принадлежит другому подключению.', true);
    return {room, seat: seat as PlayerId};
  }
  private join(socket: WebSocket, message: JoinMessage): void {
    const room = this.rooms.get(message.roomCode);
    if (!room) return this.error('room-expired', 'Комната не найдена или закрыта. Создайте новую.', true);
    const existing = message.resumeToken ? room.players.find(player => player && timingSafeEqual(digest(player.token), digest(message.resumeToken!))) : room.players.find(player => player && sameName(player.name, message.playerName));
    if (message.resumeToken || existing) {
      if (!existing || !message.resumeToken || !timingSafeEqual(digest(existing.token), digest(message.resumeToken))) {
        return this.error('resume-denied', 'Место занято. Вернуться можно только из вкладки, где вы начали бой.', true);
      }
      // The old close event must not clear the socket that just replaced it.
      const old = existing.socket;
      existing.socket = socket; this.membership.set(socket, room);
      if (old && old !== socket) {this.membership.delete(old); old.close(4001, 'Seat resumed elsewhere');}
    } else {
      if (room.players[1] || room.game) return this.error('room-full', 'В комнате уже два игрока.', true);
      room.players[1] = this.makePlayer(message, socket); this.membership.set(socket, room);
      // Assign first-player position fairly without changing opening-hand / engine rules.
      if (randomInt(2)) room.players.reverse();
      const [a, b] = room.players;
      room.game = createGame(a.heroId, a.deck, b!.heroId, b!.deck, {enableMulligan: true}, randomInt(0x7fffffff));
      room.revision++; room.turnDeadline = this.clock() + TURN_MS;
      this.remember(room, 'Оба игрока за столом. Выберите стартовые карты.', 'Both players are seated. Choose your opening cards.');
    }
    room.lastActivity = this.clock(); this.publish(room, true);
  }
  private enqueue(socket: WebSocket, message: PlayerRegistration): void {
    if (this.queue.size >= 500 || this.rooms.size >= 500) return this.error('capacity', 'Все столы заняты. Попробуйте позже.', true);
    const available = this.queue.entries().next().value as [WebSocket, {player: Player; enteredAt: number}] | undefined;
    if (!available) {
      const enteredAt = this.clock();
      this.queue.set(socket, {player: this.makePlayer(message, socket), enteredAt});
      send(socket, {type: 'queued', enteredAt, expiresAt: enteredAt + QUEUE_TTL_MS, serverTime: this.clock()}); return;
    }
    const [opponentSocket, opponent] = available; this.queue.delete(opponentSocket);
    let code: string; do {code = createRoomCode();} while (this.rooms.has(code));
    const players: [Player, Player] = [opponent.player, this.makePlayer(message, socket)];
    if (randomInt(2)) players.reverse();
    const [a, b] = players;
    const room: Room = {code, mode: 'random', players, game: createGame(a.heroId, a.deck, b.heroId, b.deck, {enableMulligan: true}, randomInt(0x7fffffff)), revision: 1,
      lastActivity: this.clock(), turnDeadline: this.clock() + TURN_MS, reason: null, history: []};
    this.rooms.set(code, room); players.forEach(player => this.membership.set(player.socket!, room));
    this.remember(room, 'Соперник найден. Выберите стартовые карты.', 'Opponent found. Choose your opening cards.'); this.publish(room, true);
  }
  handle(socket: WebSocket, message: ClientMessage): void {
    this.tick();
    if (message.type === 'ping') {send(socket, {type: 'pong', serverTime: this.clock()}); return;}
    if (message.type === 'leave') {this.disconnect(socket, true); return;}
    if (message.type === 'sync' && this.queue.has(socket)) {const entry = this.queue.get(socket)!; send(socket, {type: 'queued', enteredAt: entry.enteredAt, expiresAt: entry.enteredAt + QUEUE_TTL_MS, serverTime: this.clock()}); return;}
    if (message.type === 'create' || message.type === 'join' || message.type === 'queue') {
      if (this.membership.has(socket) || this.queue.has(socket)) return this.error('already-joined', 'Сначала отмените поиск или выйдите из комнаты.');
      if (message.type === 'queue') {this.enqueue(socket, message); return;}
      if (message.type === 'join') {this.join(socket, message); return;}
      if (this.rooms.size >= 500) return this.error('capacity', 'Все столы заняты. Попробуйте позже.', true);
      let code: string;
      do {code = createRoomCode();} while (this.rooms.has(code));
      const room: Room = {code, mode: 'friend', players: [this.makePlayer(message, socket), null], game: null, revision: 0,
        lastActivity: this.clock(), turnDeadline: 0, reason: null, history: []};
      this.rooms.set(code, room); this.membership.set(socket, room); this.publish(room, true); return;
    }
    const {room, seat} = this.requireRoom(socket);
    if (message.type === 'sync') {this.publish(room); return;}
    if (message.revision !== undefined && message.revision !== room.revision) {
      send(socket, {type: 'state', snapshot: this.view(room, seat)});
      return this.error('revision', 'Бой изменился. Состояние обновлено — повторите действие.');
    }
    if (!room.game || room.game.winner !== null) return this.error('not-playing', 'Бой ещё не начался или уже завершён.');
    const before = room.game;
    if (message.intent.type === 'concede') {
      room.game = {...before, winner: (1 - seat) as PlayerId}; room.reason = 'concede';
    } else {
      if (before.turn !== seat) return this.error('wrong-turn', 'Сейчас ход противника.');
      try {room.game = applyMove(before, seat, actionForIntent(before, message.intent));}
      catch (error: unknown) {return this.error('illegal-action', error instanceof Error ? error.message : 'Нелегальное действие.');}
      if (before.turn !== room.game.turn) room.turnDeadline = this.clock() + TURN_MS;
      if (room.game.winner !== null) room.reason = 'battle';
    }
    room.revision++; room.lastActivity = this.clock();
    const descriptions: Record<GameIntent['type'], [string, string]> = {
      playCard: ['разыграна карта', 'card played'], attack: ['атака', 'attack'], endTurn: ['ход завершён', 'turn ended'],
      heroPower: ['применена сила предводителя', 'ruler power used'], mulligan: ['выбрана стартовая рука', 'opening hand chosen'],
      buyCard: ['куплена карта подкрепления за 2 приказа', 'reserve card bought for 2 orders'],
      stake: ['боец отправлен в стейкинг', 'fighter staked'], unstake: ['боец возвращён', 'fighter unstaked'], concede: ['сдаётся', 'concedes'],
    };
    const description = descriptions[message.intent.type];
    this.remember(room, `${room.players[seat]!.name}: ${description[0]}.`, `${room.players[seat]!.name}: ${description[1]}.`);
    this.publish(room);
  }
  rejected(socket: WebSocket, error: unknown): void {
    const problem = error instanceof ProtocolError ? error : new ProtocolError('internal', 'Сервер не смог обработать действие.');
    this.log(`[ws] rejected ${problem.code}: ${problem.message}`);
    send(socket, {type: 'error', code: problem.code, reason: problem.message, ...(problem.fatal ? {fatal: true} : {})});
  }
  disconnect(socket: WebSocket, explicit = false): void {
    this.queue.delete(socket);
    const room = this.membership.get(socket); this.membership.delete(socket);
    if (!room) return;
    const player = room.players.find(p => p?.socket === socket);
    if (!player) return;
    player.socket = null;
    if (explicit && !room.game) {this.rooms.delete(room.code); return;}
    // Once both claimed seats leave there is nobody to retain the room for.
    if (room.players[1] && room.players.every(p => !p?.socket)) {this.rooms.delete(room.code); return;}
    room.players.forEach(p => {if (p?.socket) send(p.socket, {type: 'opponentLeft'});});
    this.publish(room);
  }
  tick(): void {
    const now = this.clock();
    for (const [socket, entry] of this.queue) {
      if (socket.readyState !== WebSocket.OPEN || now - entry.enteredAt >= QUEUE_TTL_MS) {
        this.queue.delete(socket);
        send(socket, {type: 'error', code: 'queue-expired', reason: 'За 5 минут соперник не нашёлся. Можно начать поиск снова.', fatal: true});
      }
    }
    for (const room of this.rooms.values()) {
      if (now - room.lastActivity >= ROOM_TTL_MS) {
        this.rooms.delete(room.code);
        room.players.forEach(p => {if (p?.socket) {
          this.membership.delete(p.socket);
          send(p.socket, {type: 'error', code: 'room-expired', reason: 'Комната закрыта после 30 минут без действий игроков.', fatal: true});
          p.socket.close(1000, 'Room expired');
        }});
        continue;
      }
      if (room.game && room.game.winner === null && now >= room.turnDeadline) {
        room.game = endExpiredTurn(room.game); room.revision++; room.turnDeadline = now + TURN_MS;
        if (room.game.winner !== null) room.reason = 'battle';
        this.remember(room, '75 секунд истекли: ход передан противнику.', '75 seconds elapsed: the turn passed to the opponent.');
        this.publish(room);
      }
    }
  }
}
