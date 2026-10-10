import assert from 'node:assert/strict';
import type {OperationResult, SetUserCustomDataResponse} from '@idosgames/core';
import {DEFAULT_PROFILE_AVATAR, PROFILE_AVATAR_KEY, PROFILE_AVATAR_MAX_BYTES, WalletProfileService, normalizeNickname, readProfileAvatar, validateProfileAvatar, type ProfileAvatar, type ProfileIdentity} from '../../lib/idos/profile';

async function main() {
  assert.equal(normalizeNickname('  Марк   Аврелий  '), 'Марк Аврелий');
  assert.equal(normalizeNickname('Ａdam_123'), 'Adam_123');
  for (const value of ['ab', '_--', 'a'.repeat(25), 'Adam\u202Etest', 'Adam\u200b', 'Adam\ntest', '<script>hi', '🙂hello', 'Adam@example']) assert.throws(() => normalizeNickname(value), /PROFILE_NICKNAME_INVALID/);
  assert.equal(normalizeNickname('E\u0301mile'), 'Émile');
  const jpeg = (width = 128, height = 128) => `data:image/jpeg;base64,${Buffer.from([255,216,255,192,0,8,8,height >> 8,height & 255,width >> 8,width & 255,1,255,217]).toString('base64')}`;
  const photo: ProfileAvatar = {version: 1, kind: 'image', dataURL: jpeg()};
  assert.deepEqual(validateProfileAvatar(photo), photo);
  assert.deepEqual(validateProfileAvatar({version: 1, kind: 'portrait', id: 'athena'}), {version: 1, kind: 'portrait', id: 'athena'});
  for (const avatar of [null, [], {version: 2, kind: 'portrait', id: 'builder'}, {version: 1, kind: 'portrait', id: '../private'}, {version: 1, kind: 'image', dataURL: 'javascript:alert(1)'}, {version: 1, kind: 'image', dataURL: 'data:image/svg+xml;base64,PHN2Zz4='}, {version: 1, kind: 'image', dataURL: jpeg(8192, 8192)}, {version: 1, kind: 'image', dataURL: 'data:image/jpeg;base64,' + 'A'.repeat(PROFILE_AVATAR_MAX_BYTES)}, {version: 1, kind: 'image', dataURL: 'data:image/jpeg;base64,/9j/2Q=='}]) assert.throws(() => validateProfileAvatar(avatar), /PROFILE_AVATAR_INVALID/);
  assert.deepEqual(readProfileAvatar('{"kind":"image","dataURL":"https://tracker.example"}'), DEFAULT_PROFILE_AVATAR);
  assert.deepEqual(readProfileAvatar('null'), DEFAULT_PROFILE_AVATAR);
  assert.deepEqual(readProfileAvatar(JSON.stringify(photo)), photo);

  const alice: ProfileIdentity = {owner: 'wallet-alice', userId: 'user-alice'}, bob: ProfileIdentity = {owner: 'wallet-bob', userId: 'user-bob'};
  const users = new Map<string, {nickname: string; avatar?: string}>([['user-alice', {nickname: 'Alice'}], ['user-bob', {nickname: 'Bob'}]]);
  let current: ProfileIdentity | null = alice, reads = 0, writes = 0, names = 0, failAvatar = false, switchAfterRead = false;
  const port = {
    identity: () => current,
    cachedNickname: () => 'Stale cache',
    user: {
      getUserState: async (fields: string[]) => {
        reads++; assert.deepEqual(fields, ['PublicData']); const identity = current!;
        if (switchAfterRead) current = bob;
        return {ok: true as const, data: {User: {UserID: identity.userId, PublicData: {Username: users.get(identity.userId)!.nickname}}}};
      },
      changeUsername: async (nickname: string) => {names++; users.get(current!.userId)!.nickname = nickname; return {ok: true as const, data: {Username: nickname}};},
    },
    userCustomData: {
      getMyUserCustomData: async () => {reads++; return {ok: true as const, data: {Public: {[PROFILE_AVATAR_KEY]: {Value: users.get(current!.userId)!.avatar}}}};},
      setPublicData: async (key: string, value: string): Promise<OperationResult<SetUserCustomDataResponse>> => {
        writes++; assert.equal(key, PROFILE_AVATAR_KEY);
        if (failAvatar) return {ok: false, reason: 'server', error: 'TEST_AVATAR_REJECTED'};
        users.get(current!.userId)!.avatar = value; return {ok: true, data: {KeyID: key, Bucket: 'Public', Version: writes}};
      },
    },
  };
  const service = new WalletProfileService(port, alice);
  assert.equal((await service.load()).nickname, 'Alice', 'Authoritative PublicData wins over a stale SDK cache');
  assert.equal(await service.changeNickname('  Alice   Caesar '), 'Alice Caesar');
  assert.equal(names, 1);
  await service.changeAvatar(photo);
  const otherDevice = new WalletProfileService({...port}, {...alice});
  assert.deepEqual(await otherDevice.load(), {...alice, nickname: 'Alice Caesar', avatar: photo}, 'A fresh client reads the same server profile without local storage');
  failAvatar = true; await assert.rejects(service.changeAvatar({version: 1, kind: 'portrait', id: 'hermes'}), /TEST_AVATAR_REJECTED/);
  assert.deepEqual((await service.load()).avatar, photo, 'Rejected writes never appear as saved'); failAvatar = false;
  const beforeWrites = writes, beforeNames = names;
  await assert.rejects(service.changeNickname('<img>'), /PROFILE_NICKNAME_INVALID/);
  await assert.rejects(service.changeAvatar({version: 1, kind: 'image', dataURL: 'https://evil.example/image'}), /PROFILE_AVATAR_INVALID/);
  assert.equal(writes, beforeWrites); assert.equal(names, beforeNames);
  current = bob;
  const beforeReads = reads;
  await assert.rejects(service.load(), /PROFILE_ACCOUNT_CHANGED/);
  await assert.rejects(service.changeNickname('Wrong account'), /PROFILE_ACCOUNT_CHANGED/);
  await assert.rejects(service.changeAvatar(photo), /PROFILE_ACCOUNT_CHANGED/);
  assert.equal(reads, beforeReads); assert.equal(names, beforeNames); assert.equal(writes, beforeWrites);
  assert.deepEqual((await new WalletProfileService(port, bob).load()).avatar, DEFAULT_PROFILE_AVATAR, 'Another wallet never inherits an avatar');
  current = alice; switchAfterRead = true;
  const readBoundary = reads;
  await assert.rejects(service.load(), /PROFILE_ACCOUNT_CHANGED/);
  assert.equal(reads, readBoundary + 1, 'Identity switches stop before the next SDK read');
  current = null; await assert.rejects(service.load(), /PROFILE_ACCOUNT_CHANGED/);
  console.log('wallet profile: server persistence, owner switches, nickname validation and bounded raster avatars PASS');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
