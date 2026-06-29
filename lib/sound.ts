"use client";

import type { GameEvent } from "./engine";

// Procedural audio (Web Audio API). Bell/marimba SFX through a small reverb, a
// physically-modelled rattle, and ambient background music with adjustable
// volume. Every transient node is disconnected once it finishes so the audio
// graph doesn't grow unbounded and crash low-memory iOS tabs.

export type Sfx =
  | "tick"
  | "gather"
  | "craft"
  | "hunt"
  | "fail"
  | "paint"
  | "recruit"
  | "danger"
  | "night"
  | "dawn"
  | "win"
  | "lose"
  // Transient mini-game cues, played directly from HuntMiniGame (not via the
  // engine's lastEvent), so the version-keyed GameSounds dedup is unaffected.
  | "hit"
  | "dodge";

export interface SoundSettings {
  muted: boolean;
  musicVolume: number; // 0..1
}

type Listener = (s: SoundSettings) => void;

const STORE_KEY = "paleo_sound";

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private musicOn = false;

  private muted = false;
  private musicVolume = 0.5;

  private settingsLoaded = false;
  private listeners = new Set<Listener>();

  // --- settings ----------------------------------------------------------
  private loadSettings() {
    if (this.settingsLoaded || typeof window === "undefined") return;
    this.settingsLoaded = true;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.muted === "boolean") this.muted = s.muted;
        if (typeof s.musicVolume === "number") this.musicVolume = s.musicVolume;
      }
    } catch {
      /* ignore */
    }
  }

  private persist() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ muted: this.muted, musicVolume: this.musicVolume }),
      );
    } catch {
      /* ignore */
    }
  }

  get settings(): SoundSettings {
    this.loadSettings();
    return { muted: this.muted, musicVolume: this.musicVolume };
  }

  subscribe(fn: Listener): () => void {
    this.loadSettings();
    this.listeners.add(fn);
    fn(this.settings);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) fn(this.settings);
  }

  // --- audio graph -------------------------------------------------------
  unlock() {
    if (typeof window === "undefined") return;
    this.loadSettings();
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      const softClip = ctx.createBiquadFilter();
      softClip.type = "lowpass";
      softClip.frequency.value = 11000;
      this.master.connect(softClip);
      softClip.connect(ctx.destination);

      const convolver = ctx.createConvolver();
      convolver.buffer = this.makeImpulse(1.6, 2.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.9;
      convolver.connect(wet);
      wet.connect(this.master);
      this.reverb = ctx.createGain();
      this.reverb.gain.value = 0.28;
      this.reverb.connect(convolver);

      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++)
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    this.persist();
    this.emit();
    return this.muted;
  }

  setMusicVolume(v: number) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.musicGain && this.musicOn)
      this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.5, this.ctx.currentTime, 0.05);
    this.persist();
    this.emit();
  }

  // --- synthesis helpers -------------------------------------------------
  private bell(
    freq: number,
    start: number,
    dur: number,
    vol: number,
    dest: AudioNode,
    reverbAmt = 0.6,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const nodes: AudioNode[] = [];
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(vol, start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    env.connect(dest);
    nodes.push(env);
    if (this.reverb && reverbAmt > 0) {
      const send = ctx.createGain();
      send.gain.value = reverbAmt;
      env.connect(send);
      send.connect(this.reverb);
      nodes.push(send);
    }
    const partials: [number, number][] = [
      [1, 1],
      [2.0, 0.45],
      [3.01, 0.22],
      [4.7, 0.1],
    ];
    let last: OscillatorNode | null = null;
    for (const [mult, amp] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.value = amp;
      osc.connect(g);
      g.connect(env);
      osc.start(start);
      osc.stop(start + dur + 0.05);
      nodes.push(osc, g);
      last = osc;
    }
    if (last) last.onended = () => nodes.forEach((n) => n.disconnect());
  }

  private glide(
    from: number,
    to: number,
    start: number,
    dur: number,
    vol: number,
    dest: AudioNode,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(vol, start + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(lp);
    lp.connect(env);
    env.connect(dest);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    osc.onended = () => {
      osc.disconnect();
      lp.disconnect();
      env.disconnect();
    };
  }

  /** A short percussive knock (wood / stone). */
  private clack(start: number, freq: number, vol: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const frames = Math.floor(ctx.sampleRate * 0.05);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++)
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 3);
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq;
    bp.Q.value = 7;
    const bpGain = ctx.createGain();
    bpGain.gain.value = vol;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const lpGain = ctx.createGain();
    lpGain.gain.value = vol * 0.5;

    src.connect(bp);
    bp.connect(bpGain);
    bpGain.connect(this.master);
    src.connect(lp);
    lp.connect(lpGain);
    lpGain.connect(this.master);
    let send: GainNode | null = null;
    if (this.reverb) {
      send = ctx.createGain();
      send.gain.value = 0.25;
      bpGain.connect(send);
      send.connect(this.reverb);
    }
    src.start(start);
    src.stop(start + 0.05);
    src.onended = () => {
      src.disconnect();
      bp.disconnect();
      bpGain.disconnect();
      lp.disconnect();
      lpGain.disconnect();
      send?.disconnect();
    };
  }

  /** A tumble of knocks — used for hunts and rummaging. */
  private rattle(t: number) {
    const impacts = 6 + Math.floor(Math.random() * 4);
    let time = t;
    for (let i = 0; i < impacts; i++) {
      const progress = i / impacts;
      const vol = (0.3 - progress * 0.16) * (0.7 + Math.random() * 0.5);
      const freq = 900 + Math.random() * 1800;
      this.clack(time, freq, Math.max(0.05, vol));
      time += 0.03 + progress * 0.09 + Math.random() * 0.04;
    }
  }

  // --- public SFX --------------------------------------------------------
  play(name: Sfx) {
    this.unlock();
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    const m = this.master;
    switch (name) {
      case "tick":
        this.bell(523.25, t, 0.18, 0.14, m, 0.4);
        break;
      case "gather":
        this.bell(587.33, t, 0.3, 0.26, m, 0.5);
        this.clack(t, 1200, 0.12);
        break;
      case "craft":
        this.clack(t, 800, 0.2);
        this.bell(659.25, t + 0.06, 0.34, 0.26, m, 0.5);
        this.bell(987.77, t + 0.14, 0.34, 0.2, m, 0.5);
        break;
      case "hunt":
        this.rattle(t);
        [659.25, 880].forEach((f, i) => this.bell(f, t + 0.18 + i * 0.08, 0.4, 0.22, m, 0.6));
        break;
      case "fail":
        this.glide(440, 196, t, 0.36, 0.26, m);
        this.glide(330, 150, t + 0.16, 0.42, 0.2, m);
        break;
      case "paint":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.bell(f, t + i * 0.09, 0.6, 0.26, m, 0.75),
        );
        break;
      case "recruit":
        [523.25, 783.99, 1046.5].forEach((f, i) =>
          this.bell(f, t + i * 0.1, 0.5, 0.24, m, 0.7),
        );
        break;
      case "danger":
        this.glide(520, 240, t, 0.3, 0.26, m);
        break;
      case "night":
        this.bell(196, t, 1.2, 0.18, m, 0.85);
        this.bell(261.63, t + 0.18, 1.0, 0.12, m, 0.85);
        break;
      case "dawn":
        [392, 523.25, 659.25].forEach((f, i) =>
          this.bell(f, t + i * 0.12, 0.7, 0.2, m, 0.8),
        );
        break;
      case "win":
        [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
          this.bell(f, t + i * 0.13, 0.7, 0.26, m, 0.85),
        );
        this.bell(261.63, t + 0.13, 1.4, 0.14, m, 0.85);
        break;
      case "lose":
        this.glide(330, 110, t, 0.9, 0.26, m);
        this.bell(146.83, t + 0.2, 1.4, 0.16, m, 0.85);
        break;
      case "hit":
        this.clack(t, 900, 0.14);
        this.bell(196, t, 0.22, 0.24, m, 0.45);
        break;
      case "dodge":
        this.glide(320, 760, t, 0.16, 0.18, m);
        break;
    }
  }

  vibrate(pattern: number | number[]) {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch {
        /* ignore */
      }
    }
  }

  // --- music -------------------------------------------------------------
  startMusic() {
    this.unlock();
    if (!this.ctx || !this.musicGain || this.musicOn) return;
    this.musicOn = true;
    this.musicGain.gain.linearRampToValueAtTime(
      this.musicVolume * 0.5,
      this.ctx.currentTime + 2,
    );
    // Slow, low, tribal-feeling drones.
    const chords = [
      [196.0, 261.63, 392.0],
      [174.61, 261.63, 349.23],
      [220.0, 277.18, 440.0],
      [164.81, 246.94, 329.63],
    ];
    let bar = 0;
    const step = () => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime + 0.05;
      const chord = chords[bar % chords.length];
      chord.forEach((f, i) => this.bell(f, t + i * 0.26, 1.1, 0.07, this.musicGain!, 0.85));
      this.bell(chord[0] / 2, t, 1.6, 0.05, this.musicGain!, 0.6);
      bar++;
    };
    step();
    this.musicTimer = setInterval(step, 2400);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicOn = false;
    if (this.ctx && this.musicGain)
      this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
  }
}

export const sound = new SoundManager();

/** Play the SFX + haptics for a game event. Shared by the synced sound
 * component and the play page's immediate (optimistic) local playback. */
export function playEventSfx(event: GameEvent): void {
  switch (event.kind) {
    case "pick":
      sound.play("tick");
      break;
    case "gather":
      sound.play("gather");
      sound.vibrate(20);
      break;
    case "craft":
      sound.play("craft");
      sound.vibrate([0, 20, 30, 20]);
      break;
    case "hunt":
      sound.play("hunt");
      sound.vibrate([0, 30, 40, 30]);
      break;
    case "fail":
      sound.play("fail");
      sound.vibrate([0, 80, 40, 120]);
      break;
    case "paint":
      sound.play("paint");
      sound.vibrate([0, 30, 30, 60]);
      break;
    case "recruit":
      sound.play("recruit");
      sound.vibrate(40);
      break;
    case "danger":
      sound.play("danger");
      sound.vibrate([0, 60, 40, 60]);
      break;
    case "night":
      sound.play("night");
      break;
    case "dawn":
      sound.play("dawn");
      break;
    case "win":
      sound.play("win");
      sound.vibrate([0, 60, 40, 60, 40, 120]);
      break;
    case "lose":
      sound.play("lose");
      sound.vibrate([0, 120, 60, 200]);
      break;
  }
}
