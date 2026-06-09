// Lightweight, asset-free sound system. All SFX are synthesized with the Web
// Audio API (oscillators + noise + envelopes), so there are no files to load,
// no 404s, and no licensing concerns. Purely cosmetic; never touches the sim.

type SoundName =
  | 'swing'
  | 'hit'
  | 'crit'
  | 'cast'
  | 'evade'
  | 'death'
  | 'click'
  | 'buy'
  | 'victory'
  | 'defeat';

const LS_MUTED = 'ag_muted';
const LS_VOL = 'ag_vol';

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private volume = 0.6;
  private lastPlayed = new Map<SoundName, number>();
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== 'undefined') {
      this.muted = localStorage.getItem(LS_MUTED) === '1';
      const v = Number(localStorage.getItem(LS_VOL));
      if (!Number.isNaN(v) && v > 0) this.volume = Math.min(1, v);
    }
  }

  /** Lazily create the AudioContext and resume it (call from a user gesture). */
  resume(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);

      // shared white-noise buffer for impacts/swooshes
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // --- settings -----------------------------------------------------------

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): void {
    this.setMuted(!this.muted);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    localStorage.setItem(LS_MUTED, m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
    this.emit();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem(LS_VOL, String(this.volume));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
    this.emit();
  }

  getVolume(): number {
    return this.volume;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  // --- playback -----------------------------------------------------------

  play(name: SoundName): void {
    if (this.muted) return;
    this.resume();
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    // throttle rapid repeats so combat doesn't machine-gun the same blip
    const minGap = THROTTLE[name] ?? 0;
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (minGap > 0 && now - last < minGap) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'swing': return this.swing(ctx, master, now);
      case 'hit': return this.impact(ctx, master, now, false);
      case 'crit': return this.impact(ctx, master, now, true);
      case 'cast': return this.cast(ctx, master, now);
      case 'evade': return this.evade(ctx, master, now);
      case 'death': return this.death(ctx, master, now);
      case 'click': return this.blip(ctx, master, now, 520, 0.05, 0.12, 'square');
      case 'buy': return this.blip(ctx, master, now, 740, 0.08, 0.16, 'triangle');
      case 'victory': return this.arpeggio(ctx, master, now, [523, 659, 784, 1047], 0.11);
      case 'defeat': return this.arpeggio(ctx, master, now, [392, 330, 262, 196], 0.14);
    }
  }

  // --- synth voices -------------------------------------------------------

  private env(gain: GainNode, t: number, peak: number, attack: number, decay: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private noise(ctx: AudioContext, t: number, dur: number): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.start(t);
    src.stop(t + dur);
    return src;
  }

  private swing(ctx: AudioContext, out: GainNode, t: number): void {
    const dur = 0.18;
    const src = this.noise(ctx, t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + dur);
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    this.env(g, t, 0.25, 0.01, dur);
    src.connect(bp).connect(g).connect(out);
  }

  private impact(ctx: AudioContext, out: GainNode, t: number, crit: boolean): void {
    // low body thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(crit ? 220 : 170, t);
    osc.frequency.exponentialRampToValueAtTime(crit ? 60 : 50, t + 0.16);
    const og = ctx.createGain();
    this.env(og, t, crit ? 0.6 : 0.4, 0.005, crit ? 0.22 : 0.16);
    osc.connect(og).connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
    // noise crack
    const dur = crit ? 0.18 : 0.1;
    const src = this.noise(ctx, t, dur);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = crit ? 1800 : 1200;
    const ng = ctx.createGain();
    this.env(ng, t, crit ? 0.45 : 0.3, 0.003, dur);
    src.connect(hp).connect(ng).connect(out);
  }

  private cast(ctx: AudioContext, out: GainNode, t: number): void {
    const dur = 0.32;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + dur);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(660, t);
    osc2.frequency.exponentialRampToValueAtTime(1760, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.28, 0.02, dur);
    osc.connect(g);
    osc2.connect(g);
    g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.05);
    osc2.start(t); osc2.stop(t + dur + 0.05);
  }

  private evade(ctx: AudioContext, out: GainNode, t: number): void {
    const dur = 0.16;
    const src = this.noise(ctx, t, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + dur);
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    this.env(g, t, 0.18, 0.005, dur);
    src.connect(bp).connect(g).connect(out);
  }

  private death(ctx: AudioContext, out: GainNode, t: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const g = ctx.createGain();
    this.env(g, t, 0.4, 0.01, 0.5);
    osc.connect(lp).connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.6);
  }

  private blip(ctx: AudioContext, out: GainNode, t: number, freq: number, dur: number, peak: number, type: OscillatorType): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private arpeggio(ctx: AudioContext, out: GainNode, t: number, notes: number[], step: number): void {
    notes.forEach((f, i) => this.blip(ctx, out, t + i * step, f, 0.18, 0.3, 'triangle'));
  }
}

const THROTTLE: Partial<Record<SoundName, number>> = {
  swing: 0.07,
  hit: 0.04,
  crit: 0.05,
  cast: 0.08,
  evade: 0.06,
};

export const audio = new AudioManager();
