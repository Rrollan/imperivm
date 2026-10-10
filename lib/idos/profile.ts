import type {ChangeUsernameResponse, GetMyUserCustomDataResponse, OperationResult, SetUserCustomDataResponse, UserStateSlice} from '@idosgames/core';
import {idosResult} from './auth';

export const PROFILE_AVATAR_KEY = 'imperivm_avatar_v1';
export const PROFILE_AVATAR_MAX_BYTES = 32_768;
export const PROFILE_PORTRAITS = ['builder', 'validator', 'whale', 'degen', 'strategist', 'athena', 'hermes', 'hephaestus', 'poseidon'] as const;
export type ProfilePortrait = typeof PROFILE_PORTRAITS[number];
export type ProfileAvatar = {version: 1; kind: 'portrait'; id: ProfilePortrait} | {version: 1; kind: 'image'; dataURL: string};
export type ProfileIdentity = {owner: string; userId: string};
export type WalletProfile = ProfileIdentity & {nickname: string; avatar: ProfileAvatar};
export const DEFAULT_PROFILE_AVATAR: ProfileAvatar = {version: 1, kind: 'portrait', id: 'builder'};
const nicknameCharacters = new RegExp('^[\\p{L}\\p{N}\\p{M}_ -]+$', 'u');
const nicknameLetterOrNumber = new RegExp('[\\p{L}\\p{N}]', 'u');

/** Names are plain text. Unicode letters support both English and Cyrillic accounts. */
export function normalizeNickname(value: string): string {
  const nickname = value.normalize('NFKC').trim().replace(/ +/g, ' ');
  if (Array.from(nickname).length < 3 || Array.from(nickname).length > 24 || !nicknameCharacters.test(nickname) || !nicknameLetterOrNumber.test(nickname)) {
    throw new Error('PROFILE_NICKNAME_INVALID');
  }
  return nickname;
}

/** Only an approved portrait or our bounded raster thumbnail can reach an img src. */
export function validateProfileAvatar(value: unknown): ProfileAvatar {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROFILE_AVATAR_INVALID');
  const avatar = value as Record<string, unknown>;
  if (avatar.version !== 1) throw new Error('PROFILE_AVATAR_INVALID');
  if (avatar.kind === 'portrait' && typeof avatar.id === 'string' && (PROFILE_PORTRAITS as readonly string[]).includes(avatar.id)) return {version: 1, kind: 'portrait', id: avatar.id as ProfilePortrait};
  if (avatar.kind !== 'image' || typeof avatar.dataURL !== 'string' || avatar.dataURL.length > PROFILE_AVATAR_MAX_BYTES - 100 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar.dataURL)) throw new Error('PROFILE_AVATAR_INVALID');
  try {
    const bytes = atob(avatar.dataURL.slice('data:image/jpeg;base64,'.length));
    if (bytes.length < 4 || bytes.charCodeAt(0) !== 255 || bytes.charCodeAt(1) !== 216 || bytes.charCodeAt(2) !== 255 || bytes.charCodeAt(bytes.length - 2) !== 255 || bytes.charCodeAt(bytes.length - 1) !== 217) throw new Error();
    // Read the JPEG frame before an untrusted stored value reaches the browser decoder.
    let offset = 2, boundedFrame = false;
    const frameMarkers = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
    while (offset < bytes.length - 2) {
      if (bytes.charCodeAt(offset++) !== 255) throw new Error();
      while (bytes.charCodeAt(offset) === 255) offset++;
      const marker = bytes.charCodeAt(offset++);
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = bytes.charCodeAt(offset) * 256 + bytes.charCodeAt(offset + 1);
      if (length < 2 || offset + length > bytes.length) throw new Error();
      if (frameMarkers.includes(marker)) {
        if (length < 8) throw new Error();
        const height = bytes.charCodeAt(offset + 3) * 256 + bytes.charCodeAt(offset + 4), width = bytes.charCodeAt(offset + 5) * 256 + bytes.charCodeAt(offset + 6);
        if (width !== 128 || height !== 128) throw new Error();
        boundedFrame = true; break;
      }
      offset += length;
    }
    if (!boundedFrame) throw new Error();
  } catch { throw new Error('PROFILE_AVATAR_INVALID'); }
  return {version: 1, kind: 'image', dataURL: avatar.dataURL};
}

export function readProfileAvatar(raw: string | null | undefined): ProfileAvatar {
  if (!raw || raw.length > PROFILE_AVATAR_MAX_BYTES) return {...DEFAULT_PROFILE_AVATAR};
  try {return validateProfileAvatar(JSON.parse(raw));} catch {return {...DEFAULT_PROFILE_AVATAR};}
}

type ProfilePort = {
  identity: () => ProfileIdentity | null;
  user: {
    getUserState: (fields: string[]) => Promise<OperationResult<UserStateSlice>>;
    changeUsername: (nickname: string) => Promise<OperationResult<ChangeUsernameResponse>>;
  };
  userCustomData: {
    getMyUserCustomData: () => Promise<OperationResult<GetMyUserCustomDataResponse>>;
    setPublicData: (key: string, value: string) => Promise<OperationResult<SetUserCustomDataResponse>>;
  };
  cachedNickname: () => string | null | undefined;
};

/** Runtime serializes these calls against sign-in/logout; identity is checked at each boundary. */
export class WalletProfileService {
  constructor(private port: ProfilePort, private expected: ProfileIdentity) {}
  private guard() {
    const current = this.port.identity();
    if (!current || current.owner !== this.expected.owner || current.userId !== this.expected.userId) throw new Error('PROFILE_ACCOUNT_CHANGED');
  }
  async load(): Promise<WalletProfile> {
    this.guard();
    const state = idosResult(await this.port.user.getUserState(['PublicData']));
    this.guard();
    if (state.User?.UserID && state.User.UserID !== this.expected.userId) throw new Error('PROFILE_ACCOUNT_CHANGED');
    const data = idosResult(await this.port.userCustomData.getMyUserCustomData());
    this.guard();
    const nickname = state.User?.PublicData?.Username ?? this.port.cachedNickname() ?? '';
    return {...this.expected, nickname: typeof nickname === 'string' ? nickname.slice(0, 100) : '', avatar: readProfileAvatar(data.Public?.[PROFILE_AVATAR_KEY]?.Value)};
  }
  async changeNickname(value: string): Promise<string> {
    const nickname = normalizeNickname(value);
    this.guard();
    const response = idosResult(await this.port.user.changeUsername(nickname));
    this.guard();
    if (typeof response.Username !== 'string' || !response.Username.trim() || response.Username.length > 100) throw new Error('PROFILE_RESPONSE_INVALID');
    // changeUsername intentionally leaves the SDK cache untouched; use its authoritative response.
    return response.Username;
  }
  async changeAvatar(value: ProfileAvatar): Promise<ProfileAvatar> {
    const avatar = validateProfileAvatar(value), serialized = JSON.stringify(avatar);
    if (new TextEncoder().encode(serialized).length > PROFILE_AVATAR_MAX_BYTES) throw new Error('PROFILE_AVATAR_INVALID');
    this.guard();
    const result = idosResult(await this.port.userCustomData.setPublicData(PROFILE_AVATAR_KEY, serialized));
    this.guard();
    if (result.KeyID !== PROFILE_AVATAR_KEY || (result.Bucket && result.Bucket !== 'Public')) throw new Error('PROFILE_RESPONSE_INVALID');
    return avatar;
  }
}
