/**
 * IMPERIVM — procedural SFX library.
 *
 * Every sound is built from oscillators / noise / filters / envelopes. No
 * external files, no CDN. ~15 distinct cues that match the SFX list in
 * the BRIEF (package 3).
 *
 * Public API: `play(name)`. Returns immediately; schedules audio on the
 * shared AudioContext (see manager.ts). All functions are SSR-safe (early
 * return when window / AudioContext is missing).
 */
import { getContext, masterOut, now, setAmbientController, isMusicEnabled, isSfxEnabled } from './manager';

export type SfxName =
  | 'ui-click'
  | 'play'
  | 'attack'
  | 'arcane-impact'
  | 'bolt-impact'
  | 'lightning-impact'
  | 'shield-impact'
  | 'rift-impact'
  | 'damage'
  | 'heal'
  | 'death'
  | 'stake'
  | 'unstake'
  | 'mempool-queue'
  | 'mempool-resolve'
  | 'priority'
  | 'halving'
  | 'rug-pull'
  | 'victory'
  | 'rugged'
  | 'pack-open'
  | 'card-reveal'
  | 'end-turn';

/* ─────────────────────────── low-level helpers ─────────────────────────── */

function envGain(c: AudioContext, when: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + attack);
  g.gain.setValueAtTime(peak, when + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
  return g;
}

function osc(c: AudioContext, type: OscillatorType, freq: number, when: number, end: number, detune = 0): OscillatorNode {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  o.start(when);
  o.stop(end);
  return o;
}

function noiseBuffer(c: AudioContext, duration = 0.6): AudioBuffer {
  const n = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  // Pink-ish noise via simple lowpass on white noise (good enough for SFX).
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.85 + white * 0.15;
    data[i] = last;
  }
  return buf;
}

/* ─────────────────────────── individual cues ─────────────────────────── */

function materialNoise(c: AudioContext,t: number,out: AudioNode,frequency: number,peak: number,duration: number): void {
  const source=c.createBufferSource();source.buffer=noiseBuffer(c,duration);
  const filter=c.createBiquadFilter();filter.type='bandpass';filter.frequency.value=frequency;filter.Q.value=.8;
  const gain=envGain(c,t,.004,.008,duration-.012,peak);
  source.connect(filter).connect(gain).connect(out);source.start(t);source.stop(t+duration);
}
function uiClick(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,820,.22,.065);
  const o=osc(c,'sine',175,t,t+.06),g=envGain(c,t,.002,.005,.05,.1);o.connect(g).connect(out);
}
function playCard(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,1900,.3,.17);
  const o=osc(c,'sine',120,t+.02,t+.15),g=envGain(c,t+.02,.004,.012,.11,.14);o.connect(g).connect(out);
}
function attackClang(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,1400,.38,.16);
  for(const [frequency,peak] of [[210,.17],[790,.07],[1310,.025]]){
    const o=osc(c,'sine',frequency,t,t+.22),g=envGain(c,t,.002,.01,.2,peak);o.connect(g).connect(out);
  }
}
function arcaneImpact(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,2700,.2,.28);
  [620,930,1240].forEach((freq,i)=>{
    const at=t+i*.025,o=osc(c,'sine',freq,at,at+.3),g=envGain(c,at,.012,.025,.24,.09/(i+1));
    o.frequency.exponentialRampToValueAtTime(freq*.65,at+.27);o.connect(g).connect(out);
  });
}
function boltImpact(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,3200,.24,.085);materialNoise(c,t+.02,out,540,.34,.17);
  const o=osc(c,'sine',160,t,t+.18),g=envGain(c,t,.002,.01,.16,.16);o.frequency.exponentialRampToValueAtTime(75,t+.17);o.connect(g).connect(out);
}

function lightningImpact(c:AudioContext,t:number,out:AudioNode):void {
  materialNoise(c,t,out,4100,.3,.09);materialNoise(c,t+.025,out,240,.3,.3);
  const o=osc(c,'sine',110,t,t+.3),g=envGain(c,t,.002,.01,.28,.18);o.frequency.exponentialRampToValueAtTime(48,t+.28);o.connect(g).connect(out);
}
function shieldImpact(c:AudioContext,t:number,out:AudioNode):void {
  materialNoise(c,t,out,740,.28,.14);
  [430,645,1075].forEach((f,i)=>{const o=osc(c,'sine',f,t,t+.24),g=envGain(c,t,.003,.02,.21,.10/(i+1));o.connect(g).connect(out);});
}
function riftImpact(c:AudioContext,t:number,out:AudioNode):void {
  materialNoise(c,t,out,390,.23,.32);
  const o=osc(c,'sine',240,t,t+.34),g=envGain(c,t,.025,.035,.27,.18);o.frequency.exponentialRampToValueAtTime(65,t+.3);o.connect(g).connect(out);
}

function damageHit(c: AudioContext, t: number, out: AudioNode): void {
  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer(c, 0.3);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  const g = envGain(c, t, 0.001, 0.01, 0.12, 0.24);
  noise.connect(lp).connect(g).connect(out);
  noise.start(t);
  noise.stop(t + 0.3);
}

function healChime(c: AudioContext, t: number, out: AudioNode): void {
  // Major triad arpeggio.
  const notes = [523.25, 659.25, 783.99];
  for (let i = 0; i < notes.length; i++) {
    const start = t + i * 0.07;
    const o = osc(c, 'sine', notes[i], start, start + 0.45);
    const g = envGain(c, start, 0.01, 0.05, 0.4, 0.12);
    o.connect(g).connect(out);
  }
}

function death(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,430,.24,.38);
  const o=osc(c,'sine',130,t,t+.35),g=envGain(c,t,.003,.015,.32,.14);o.frequency.exponentialRampToValueAtTime(55,t+.34);o.connect(g).connect(out);
}
function chainLatch(c: AudioContext,t: number,out: AudioNode,release: boolean): void {
  for(let i=0;i<2;i++){
    const at=t+i*.055;materialNoise(c,at,out,release?930:650,.19,.065);
    const o=osc(c,'sine',release?460-i*60:350+i*85,at,at+.1),g=envGain(c,at,.002,.008,.09,.07);o.connect(g).connect(out);
  }
}
function stake(c: AudioContext,t: number,out: AudioNode): void {chainLatch(c,t,out,false);}
function unstake(c: AudioContext,t: number,out: AudioNode): void {chainLatch(c,t,out,true);}

function mempoolQueue(c: AudioContext, t: number, out: AudioNode): void {
  // Soft "ping" — turquoise-ish.
  const o = osc(c, 'sine', 880, t, t + 0.18);
  const o2 = osc(c, 'sine', 1320, t, t + 0.18);
  const g = envGain(c, t, 0.005, 0.02, 0.18, 0.1);
  o.connect(g);
  o2.connect(g);
  g.connect(out);
}

function mempoolResolve(c: AudioContext, t: number, out: AudioNode): void {
  // Two-note descending resolve.
  const notes = [880, 587.33];
  for (let i = 0; i < notes.length; i++) {
    const start = t + i * 0.08;
    const o = osc(c, 'triangle', notes[i], start, start + 0.4);
    const g = envGain(c, start, 0.01, 0.04, 0.36, 0.12);
    o.connect(g).connect(out);
  }
}

function priority(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,3600,.27,.12);
  const o=osc(c,'sine',740,t,t+.09),g=envGain(c,t,.002,.005,.08,.07);o.connect(g).connect(out);
}

function halving(c: AudioContext, t: number, out: AudioNode): void {
  // Gold coin-like ascending bell.
  const o = osc(c, 'sine', 523.25, t, t + 0.6);
  const o2 = osc(c, 'sine', 1046.5, t, t + 0.6);
  const g = envGain(c, t, 0.01, 0.1, 0.5, 0.13);
  o.connect(g);
  o2.connect(g);
  g.connect(out);
}

function rugPull(c: AudioContext, t: number, out: AudioNode): void {
  // Massive sub-bass thud + descending roar.
  const sub = osc(c, 'sine', 60, t, t + 0.9);
  sub.frequency.exponentialRampToValueAtTime(20, t + 0.9);
  const subG = envGain(c, t, 0.005, 0.05, 0.85, 0.24);
  sub.connect(subG).connect(out);

  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer(c, 1.2);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(1500, t);
  lp.frequency.exponentialRampToValueAtTime(120, t + 0.9);
  const noiseG = envGain(c, t, 0.01, 0.1, 1.0, 0.25);
  noise.connect(lp).connect(noiseG).connect(out);
  noise.start(t);
  noise.stop(t + 1.2);
}

function victory(c: AudioContext, t: number, out: AudioNode): void {
  // Triumphant brass-like fanfare using square + low-pass.
  const notes = [261.63, 329.63, 392.0, 523.25];
  for (let i = 0; i < notes.length; i++) {
    const start = t + i * 0.13;
    const o = osc(c, 'triangle', notes[i], start, start + 0.35);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    const g = envGain(c, start, 0.01, 0.05, 0.3, 0.13);
    o.connect(lp).connect(g).connect(out);
  }
}

function rugged(c: AudioContext, t: number, out: AudioNode): void {
  // Low descending "crack" — a single sharp noise burst then a thud.
  const noise = c.createBufferSource();
  noise.buffer = noiseBuffer(c, 0.6);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 800;
  const noiseG = envGain(c, t, 0.001, 0.01, 0.25, 0.5);
  noise.connect(hp).connect(noiseG).connect(out);
  noise.start(t);
  noise.stop(t + 0.6);

  const o = osc(c, 'sine', 90, t + 0.18, t + 1.0);
  o.frequency.exponentialRampToValueAtTime(40, t + 1.0);
  const og = envGain(c, t + 0.18, 0.01, 0.05, 0.8, 0.4);
  o.connect(og).connect(out);
}

function packOpen(c: AudioContext, t: number, out: AudioNode): void {
  // Wax-seal crack: high partial that decays, then a low thump.
  const o = osc(c, 'triangle', 1760, t, t + 0.18);
  const g = envGain(c, t, 0.001, 0.01, 0.16, 0.4);
  o.connect(g).connect(out);
  const sub = osc(c, 'sine', 90, t + 0.04, t + 0.4);
  const sg = envGain(c, t + 0.04, 0.005, 0.05, 0.3, 0.3);
  sub.connect(sg).connect(out);
}

function cardReveal(c: AudioContext, t: number, out: AudioNode): void {
  // Quick shimmer.
  const o = osc(c, 'sine', 1318.5, t, t + 0.15);
  const o2 = osc(c, 'sine', 1568, t + 0.04, t + 0.15);
  const g = envGain(c, t, 0.005, 0.02, 0.13, 0.25);
  o.connect(g);
  o2.connect(g);
  g.connect(out);
}

function endTurn(c: AudioContext, t: number, out: AudioNode): void {
  materialNoise(c,t,out,560,.25,.15);
  const o=osc(c,'sine',392,t+.03,t+.28),g=envGain(c,t+.03,.003,.015,.23,.11);o.connect(g).connect(out);
}

/* ─────────────────────────── ambient loop ─────────────────────────── */

interface AmbientController {
  start: () => void;
  stop: () => void;
  resume: () => void;
}

/** Imperial ambient: slow detuned drone + sparse triangle melody loop. */
function makeAmbient(): AmbientController {
  let c = getContext();
  if (!c) {
    return { start: () => {}, stop: () => {}, resume: () => {} };
  }
  let nodes: { stop: () => void }[] = [];
  let isPlaying = false;

  function startImpl(): void {
    if (isPlaying) return;
    c = getContext();
    if (!c || c.state !== 'running' || !isMusicEnabled()) return;
    isPlaying = true;
    const t0 = now();
    // Drone: two detuned saws through a slow low-pass.
    const drone1 = osc(c, 'sawtooth', 55, t0, t0 + 60);
    const drone2 = osc(c, 'sawtooth', 55, t0, t0 + 60, +7);
    const drone3 = osc(c, 'sine', 82.5, t0, t0 + 60);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const droneG = c.createGain();
    droneG.gain.value = 0.0;
    droneG.gain.setValueAtTime(0.0, t0);
    droneG.gain.linearRampToValueAtTime(0.02, t0 + 2.0);
    drone1.connect(lp); drone2.connect(lp); drone3.connect(lp);
    lp.connect(droneG).connect(masterOut() as AudioNode);

    // Sparse triangle motif (a few notes, looped every 6s).
    const motif = [329.63, 392.0, 329.63, 293.66, 261.63];
    for (let i = 0; i < motif.length; i++) {
      const start = t0 + i * 1.2;
      const o = osc(c, 'triangle', motif[i], start, start + 0.9);
      const og = c.createGain();
      og.gain.setValueAtTime(0.0, start);
      og.gain.linearRampToValueAtTime(0.016, start + 0.05);
      og.gain.linearRampToValueAtTime(0.0, start + 0.9);
      o.connect(og).connect(masterOut() as AudioNode);
    }

    // Schedule the next loop iteration ~6s later (very simple loop).
    const timer = setTimeout(() => {
      const continuePlaying = isPlaying;
      stopImpl();
      if (continuePlaying) startImpl();
    }, 6000);

    nodes.push(
      { stop: () => { try { drone1.stop(); } catch {} try { drone2.stop(); } catch {} try { drone3.stop(); } catch {} } },
      { stop: () => { /* droneG handled by gain ramp */ } },
      { stop: () => clearTimeout(timer) },
    );
  }

  function stopImpl(): void {
    for (const n of nodes) n.stop();
    nodes = [];
    isPlaying = false;
  }

  return {
    start: startImpl,
    stop: stopImpl,
    resume: startImpl,
  };
}

/* ─────────────────────────── public dispatch ─────────────────────────── */

let ambientInst: AmbientController | null = null;

export function startAmbient(): void {
  if (!getContext()) return;
  if (!ambientInst) {
    ambientInst = makeAmbient();
    setAmbientController({
      stop: () => ambientInst?.stop(),
      resume: () => ambientInst?.resume(),
    });
  }
  ambientInst.start();
}

export function stopAmbient(): void {
  ambientInst?.stop();
}

/** Play a named cue. SSR-safe. Returns true if scheduled, false on no-op. */
export function play(name: SfxName): boolean {
  const c = getContext();
  if (!c || c.state !== 'running' || !isSfxEnabled()) return false;
  const out = masterOut();
  if (!out) return false;
  const t = now() + 0.01;

  switch (name) {
    case 'ui-click': uiClick(c, t, out); return true;
    case 'play': playCard(c, t, out); return true;
    case 'attack': attackClang(c, t, out); return true;
    case 'arcane-impact': arcaneImpact(c, t, out); return true;
    case 'bolt-impact': boltImpact(c, t, out); return true;
    case 'lightning-impact': lightningImpact(c,t,out);return true;
    case 'shield-impact': shieldImpact(c,t,out);return true;
    case 'rift-impact': riftImpact(c,t,out);return true;
    case 'damage': damageHit(c, t, out); return true;
    case 'heal': healChime(c, t, out); return true;
    case 'death': death(c, t, out); return true;
    case 'stake': stake(c, t, out); return true;
    case 'unstake': unstake(c, t, out); return true;
    case 'mempool-queue': mempoolQueue(c, t, out); return true;
    case 'mempool-resolve': mempoolResolve(c, t, out); return true;
    case 'priority': priority(c, t, out); return true;
    case 'halving': halving(c, t, out); return true;
    case 'rug-pull': rugPull(c, t, out); return true;
    case 'victory': victory(c, t, out); return true;
    case 'rugged': rugged(c, t, out); return true;
    case 'pack-open': packOpen(c, t, out); return true;
    case 'card-reveal': cardReveal(c, t, out); return true;
    case 'end-turn': endTurn(c, t, out); return true;
  }
}
