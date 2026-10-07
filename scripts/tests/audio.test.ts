import assert from 'node:assert/strict';
import { getContext, unlockAudio, setMuted, isMuted, setSfxEnabled, setMusicEnabled, isMusicEnabled } from '../../lib/audio/manager';
import { play, startAmbient, stopAmbient, type SfxName } from '../../lib/audio/sfx';

let constructors = 0, resumes = 0, starts = 0;
const storage = new Map<string, string>([['imperivm.audio.muted', '1']]);
function param(value = 0) { return { value, setValueAtTime(v: number) { this.value = v; }, linearRampToValueAtTime(v: number) { this.value = v; }, exponentialRampToValueAtTime(v: number) { this.value = v; }, cancelScheduledValues() {} }; }
function node() { return { connect() { return this; }, disconnect() {}, start() { starts++; }, stop() {}, gain: param(), frequency: param(), detune: param(), Q: param(), playbackRate: param(), type: '', buffer: null }; }
class FakeAudioContext {
  state = 'suspended'; currentTime = 3; sampleRate = 44100; destination = node();
  constructor() { constructors++; }
  async resume() { resumes++; this.state = 'running'; }
  createGain() { return node(); }
  createOscillator() { return node(); }
  createBiquadFilter() { return node(); }
  createBufferSource() { return node(); }
  createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
  createBuffer(_channels: number, length: number) { return { getChannelData() { return new Float32Array(length); } }; }
}
async function main() {
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
Object.assign(globalThis, { window: { AudioContext: FakeAudioContext, localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } }, document: { hidden: false, addEventListener() {} } });
assert.equal(getContext(), null);
assert.equal(play('play'), false);
startAmbient();
assert.equal(constructors, 0, 'Render/AI/ambient before gesture must never construct AudioContext');
await unlockAudio();
assert.equal(constructors, 1); assert.equal(resumes, 1); assert.equal(isMuted(), true, 'Load persisted master mute before starting sound');
setMuted(false);
const cues: SfxName[] = ['ui-click', 'play', 'attack', 'arcane-impact', 'bolt-impact', 'damage', 'heal', 'death', 'stake', 'unstake', 'mempool-queue', 'mempool-resolve', 'priority', 'halving', 'rug-pull', 'victory', 'rugged', 'pack-open', 'card-reveal', 'end-turn'];
for (const cue of cues) assert.equal(play(cue), true, cue);
assert.ok(starts > 18);
setSfxEnabled(false); assert.equal(play('attack'), false); assert.equal(storage.get('imperivm.audio.sfx'), '0');
setMusicEnabled(false); assert.equal(isMusicEnabled(), false); const before = starts; startAmbient(); assert.equal(starts, before, 'Disabled music cannot schedule a loop');
setMusicEnabled(true); startAmbient(); assert.ok(starts > before, 'Ambient can start after a pre-gesture no-op'); stopAmbient();
await unlockAudio(); assert.equal(constructors, 1, 'One context for all cues');
setMuted(true); assert.equal(storage.get('imperivm.audio.muted'), '1');
console.log('PASS gesture-only context, 20 procedural cues, independent persisted music/effects, master mute, ambient restart');

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
