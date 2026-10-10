import assert from 'node:assert/strict';
import type {IDosGamesClient} from '@idosgames/core';
import {PublicKey} from '@solana/web3.js';
import {IDosRuntime} from '../../lib/idos/client';
import {WalletSessionMemory} from '../../lib/idos/session';
import {IDOS_CONFIG} from '../../lib/collection/gateway';
const owner = new PublicKey(new Uint8Array(32).fill(17)).toBase58();
const other = new PublicKey(new Uint8Array(32).fill(19)).toBase58();
function fixture() {
  const storage = new Map<string,string>();
  const memory = new WalletSessionMemory('TEST', IDOS_CONFIG.network, {getItem: key => storage.get(key) ?? null, setItem: (key,value) => {storage.set(key,value);}, removeItem: key => {storage.delete(key);}});
  const calls = {auto: 0, logout: 0, guest: 0, remember: false};
  const state: {Blockchain?: {LastWalletLogin?: {NetworkID: string; Address: string}}} = {};
  const auth = {
    lastAuthType: 'Wallet', context: {userID: 'verified-player', clientSessionTicket: 'test-only'}, isLoggedIn: true,
    playAccess: {Granted: true}, fail: false,
    setRememberSession: (enabled: boolean) => {calls.remember=enabled;},
    logout: () => {calls.logout++; auth.lastAuthType='None';},
    autoLogin: async () => {calls.auto++; return auth.fail ? {ok:false, reason:'network', error:'temporarily unavailable'} : {ok:true,data:{}};},
    loginWithDeviceID: async () => {calls.guest++; auth.context.userID='guest'; auth.lastAuthType='Device'; return {ok:true,data:{}};},
  };
  const client = {titleID: 'TEST', auth, data: {user: {state}}, on: () => {}} as unknown as IDosGamesClient;
  return {memory, calls, auth, state, runtime: () => new IDosRuntime('TEST',client,memory)};
}
async function main() {
  const f=fixture(); f.memory.save(owner,'verified-player');
  const runtime=f.runtime(); assert(f.calls.remember);
  await Promise.all([runtime.start(),runtime.start()]);
  assert.equal(f.calls.auto,1); assert.equal(f.calls.logout,0); assert.equal(f.calls.guest,0);
  assert.equal(runtime.getSnapshot().status,'wallet'); assert.equal(runtime.getSnapshot().owner,owner);
  await runtime.start(); assert.equal(f.calls.auto,1,'React remount does not rotate twice');
  assert.equal((await runtime.collectionAuth()).userId,'verified-player');
  await runtime.disconnect(); assert.equal(f.memory.read(),null);
  await f.runtime().start(); assert.equal(f.calls.guest,1); assert.equal(f.calls.logout,1,'Explicit sign-out survives a reload');

  const cold=fixture(); cold.memory.save(owner,'verified-player');
  await cold.runtime().start(); assert.equal(cold.calls.logout,0,'Cold refresh does not erase a valid token');
  const switched=fixture(); switched.memory.save(owner,'verified-player'); const r=switched.runtime();
  await r.start(async()=>other); assert.equal(r.getSnapshot().status,'guest'); assert.equal(switched.memory.read(),null);
  const stale=fixture(); stale.memory.save(owner,'different-player'); const sr=stale.runtime();
  await assert.rejects(sr.start(),/different account/); await assert.rejects(sr.collectionAuth(),/Sign in/);
  const wrong=fixture(); wrong.memory.save(owner,'verified-player'); wrong.state.Blockchain={LastWalletLogin:{NetworkID:IDOS_CONFIG.network,Address:other}};
  await assert.rejects(wrong.runtime().start(),/Sign in with your wallet/);
  const network=fixture(); network.memory.save(owner,'verified-player'); network.auth.fail=true; const nr=network.runtime();
  await assert.rejects(nr.start(),/temporarily/); assert.equal(network.memory.read()?.owner,owner); assert.equal(network.calls.logout,0);
  network.auth.fail=false; await nr.start(); assert.equal(nr.getSnapshot().status,'wallet');
  const guest=fixture(); guest.auth.lastAuthType='Device'; await guest.runtime().start(); assert.equal(guest.calls.logout,0);
  const verified=fixture(); verified.state.Blockchain={LastWalletLogin:{NetworkID:IDOS_CONFIG.network,Address:owner}};
  const vr=verified.runtime(); await vr.start(); assert.equal(vr.getSnapshot().owner,owner);
  assert.equal(verified.memory.read()?.userId,'verified-player');
  assert.throws(()=>f.memory.save('not-a-wallet','player'),/Invalid/);
  console.log('Session checks passed: cold refresh, single rotation, explicit logout, switched accounts, server identity mismatch, temporary failure/retry and optional wallet cache. No signatures or transactions.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
