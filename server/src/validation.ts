import {deckError} from '../../lib/engine/deckValidation';
import {HEROES} from '../../lib/heroes';
import type {ClientMessage, GameIntent, PlayerRegistration} from '../../lib/net/protocol';
import {normalizeRoomCode, validRoomCode} from '../../lib/net/roomCode';
import {parseCollectionAuth} from '../../lib/collection/access';

export class ProtocolError extends Error {
  constructor(public code: string, reason: string, public fatal = false) {super(reason);}
}
function fail(reason = 'Некорректное сообщение.'): never {throw new ProtocolError('bad-message', reason);}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 80): string {
  if (typeof value !== 'string' || !value.length || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) fail();
  return value;
}
function registration(value: Record<string, unknown>): PlayerRegistration {
  const playerName = string(value.playerName, 32).trim();
  if (!playerName) fail('Введите имя игрока.');
  const heroId = value.heroId === undefined ? 'builder' : string(value.heroId, 40);
  if (!Object.hasOwn(HEROES, heroId)) fail('Неизвестный предводитель.');
  if (!Array.isArray(value.deckList) || value.deckList.length !== 30) fail('В колоде должно быть ровно 30 карт.');
  const deckList = value.deckList.map(id => string(id));
  const problem = deckError(deckList);
  if (problem) fail(problem);
  const collectionAuth = value.collectionAuth === undefined ? undefined : parseCollectionAuth(value.collectionAuth);
  if (collectionAuth === null) fail('Некорректная сессия коллекции iDos.');
  return {playerName, heroId, deckList, ...(collectionAuth ? {collectionAuth} : {})};
}
function intent(value: unknown): GameIntent {
  const data = object(value);
  switch (data.type) {
    case 'playCard': return {type: 'playCard', cardId: string(data.cardId)};
    case 'attack': return {type: 'attack', cardId: string(data.cardId), targetId: string(data.targetId)};
    case 'endTurn': case 'heroPower': case 'buyCard': case 'concede': return {type: data.type};
    case 'stake': case 'unstake': return {type: data.type, cardId: string(data.cardId)};
    case 'mulligan': {
      if (!Array.isArray(data.cardIds) || data.cardIds.length > 4) fail();
      return {type: 'mulligan', cardIds: data.cardIds.map(id => string(id))};
    }
    default: fail('Неизвестное действие.');
  }
}
export function parseMessage(raw: string): ClientMessage {
  let value: unknown;
  try {value = JSON.parse(raw) as unknown;} catch {fail('Ожидается JSON-сообщение.');}
  const data = object(value);
  switch (data.type) {
    case 'create': return {type: 'create', ...registration(data)};
    case 'join': {
      const roomCode = normalizeRoomCode(string(data.roomCode, 16));
      if (!validRoomCode(roomCode)) fail('Код комнаты состоит из 6 букв и цифр.');
      const resumeToken = data.resumeToken === undefined ? undefined : string(data.resumeToken);
      if (resumeToken !== undefined && !/^[A-Za-z0-9_-]{43}$/.test(resumeToken)) fail();
      return {type: 'join', roomCode, ...registration(data), ...(resumeToken ? {resumeToken} : {})};
    }
    case 'intent': {
      if (data.revision !== undefined && (!Number.isSafeInteger(data.revision) || (data.revision as number) < 0)) fail();
      return {type: 'intent', intent: intent(data.intent), ...(data.revision === undefined ? {} : {revision: data.revision as number})};
    }
    case 'ping': case 'sync': case 'leave': return {type: data.type};
    default: fail();
  }
}
