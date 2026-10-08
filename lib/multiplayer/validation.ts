import type {Action} from '../engine/types';
import type {OnlineCommand} from './types';
import {OnlineError} from './store';

const invalid = (): never => {throw new OnlineError(400, 'payload', 'Некорректный запрос.');};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key)) || allowed.some(key => !Object.hasOwn(value, key))) invalid();
}
const uid = (value: unknown): string => typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value) ? value : invalid();
const roomId = (value: unknown): string => typeof value === 'string' && /^[a-f0-9]{32}$/.test(value) ? value : invalid();
const revision = (value: unknown): number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 2 ** 31 ? value : invalid();
export function parseAction(input: unknown): Action {
  const value = object(input);
  switch (value.type) {
    case 'play-minion': case 'cast-spell': case 'stake': case 'unstake':
      keys(value, ['type', 'uid']); return {type: value.type, uid: uid(value.uid)};
    case 'attack': keys(value, ['type', 'attackerUid', 'target']); return {type: 'attack', attackerUid: uid(value.attackerUid), target: uid(value.target)};
    case 'hero-power': case 'end-turn': case 'buy-card': keys(value, ['type']); return {type: value.type};
    case 'mulligan':
      keys(value, ['type', 'uids']);
      if (!Array.isArray(value.uids) || value.uids.length > 4) return invalid();
      return {type: 'mulligan', uids: value.uids.map(uid)};
    default: return invalid();
  }
}
export function parseCommand(input: unknown): OnlineCommand {
  const value = object(input);
  switch (value.type) {
    case 'session': case 'cancel': keys(value, ['type']); return {type: value.type};
    case 'create': case 'queue': keys(value, ['type', 'heroId']); return {type: value.type, heroId: uid(value.heroId)};
    case 'join': keys(value, ['type', 'heroId', 'roomId']); return {type: 'join', heroId: uid(value.heroId), roomId: roomId(value.roomId)};
    case 'action': keys(value, ['type', 'roomId', 'revision', 'action']); return {type: 'action', roomId: roomId(value.roomId), revision: revision(value.revision), action: parseAction(value.action)};
    case 'concede': keys(value, ['type', 'roomId', 'revision']); return {type: 'concede', roomId: roomId(value.roomId), revision: revision(value.revision)};
    default: return invalid();
  }
}
