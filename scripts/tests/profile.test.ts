import assert from 'node:assert/strict';
import type {OperationResult, SetUserCustomDataResponse} from '@idosgames/core';
import {DEFAULT_PROFILE_AVATAR, PROFILE_AVATAR_KEY, PROFILE_AVATAR_MAX_BYTES, WalletProfileService, normalizeNickname, readProfileAvatar, validateProfileAvatar, type ProfileAvatar, type ProfileIdentity} from '../../lib/idos/profile';
import {WalletProfileStore, type WalletProfileScope} from '../../lib/idos/profileState';

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
  const aliceScope: WalletProfileScope = {...alice, revision: 1}, bobScope: WalletProfileScope = {...bob, revision: 2};
  const aliceProfile = {...alice, nickname: 'Alice Caesar', avatar: photo};
  const bobProfile = {...bob, nickname: 'Bob', avatar: DEFAULT_PROFILE_AVATAR};
  const store = new WalletProfileStore();
  store.activate(aliceScope);
  await store.load(aliceScope, async () => aliceProfile);
  assert.equal(store.getSnapshot().profile?.nickname, 'Alice Caesar');
  let finishStale!: (value: typeof aliceProfile) => void;
  const staleRead = store.load(aliceScope, () => new Promise(resolve => {finishStale = resolve;}));
  assert.equal(store.confirm(aliceScope, {...aliceProfile, nickname: 'New confirmed nickname'}), true);
  finishStale(aliceProfile); await staleRead;
  assert.equal(store.getSnapshot().profile?.nickname, 'New confirmed nickname', 'Header/lobby keep the confirmed save even if an older read finishes later');
  assert.equal(store.confirm(aliceScope, {...aliceProfile, avatar: {version: 1, kind: 'portrait', id: 'poseidon'}}), true);
  assert.deepEqual(store.getSnapshot().profile?.avatar, {version: 1, kind: 'portrait', id: 'poseidon'}, 'Avatar saves publish the same shared profile immediately');
  const oldWalletRead = store.load(aliceScope, () => new Promise(resolve => {finishStale = resolve;}));
  store.activate(bobScope);
  assert.equal(store.getSnapshot().profile, null, 'Switching a wallet removes its nickname and avatar immediately');
  await store.load(bobScope, async () => bobProfile);
  finishStale(aliceProfile); await oldWalletRead;
  assert.deepEqual(store.getSnapshot().profile, bobProfile);
  assert.equal(store.confirm(aliceScope, aliceProfile), false, 'An old editor cannot publish another wallet profile');
  store.activate(null);
  assert.equal(store.getSnapshot().profile, null);
  const aliceNewLogin = {...aliceScope, revision: 3}; store.activate(aliceNewLogin);
  assert.equal(store.confirm(aliceScope, aliceProfile), false, 'A new login is isolated even when wallet and user ID are unchanged');
  await store.load(aliceNewLogin, async () => bobProfile);
  assert.equal(store.getSnapshot().profile, null); assert.equal(store.getSnapshot().error, 'PROFILE_ACCOUNT_CHANGED');
  console.log('wallet profile: shared header/lobby state, confirmed edits, persistence, owner switches and bounded raster avatars PASS');
}
void main().catch(error => {console.error(error); process.exitCode = 1;});
