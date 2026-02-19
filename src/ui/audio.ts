export class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmEnabled = true;
  private sfxEnabled = true;
  private bgmVolume = 0.35;
  private sfxVolume = 0.8;
  private started = false;
  private bgmTimer: number | null = null;
  private seqStep = 0;
  private readonly visibilityHandler = () => {
    if (!this.ctx || !this.started) return;
    if (document.hidden) {
      void this.ctx.suspend();
    } else if (this.bgmEnabled) {
      void this.ctx.resume();
    }
  };

  constructor() {
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  async initFromGesture(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state !== "running") {
      await this.ctx.resume();
    }
    this.started = true;
    if (this.bgmEnabled) {
      this.startBgmLoop();
    }
  }

  setBgmEnabled(enabled: boolean): void {
    this.bgmEnabled = enabled;
    if (!this.started) return;
    if (enabled) {
      this.startBgmLoop();
      if (this.ctx && this.ctx.state !== "running" && !document.hidden) {
        void this.ctx.resume();
      }
    } else {
      this.stopBgmLoop();
    }
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
  }

  setBgmVolume(v: number): void {
    this.bgmVolume = clamp01(v);
  }

  setSfxVolume(v: number): void {
    this.sfxVolume = clamp01(v);
  }

  playPlaceSfx(): void {
    if (!this.canPlaySfx()) return;
    this.playTone({
      type: "triangle",
      fromHz: 880,
      toHz: 700,
      duration: 0.06,
      volume: this.sfxVolume * 0.5
    });
  }

  playSkillSfx(): void {
    if (!this.canPlaySfx()) return;
    this.playTone({
      type: "sawtooth",
      fromHz: 220,
      toHz: 760,
      duration: 0.14,
      volume: this.sfxVolume * 0.45
    });
  }

  dispose(): void {
    this.stopBgmLoop();
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.started = false;
  }

  private canPlaySfx(): boolean {
    return !!this.ctx && this.started && this.sfxEnabled;
  }

  private startBgmLoop(): void {
    if (!this.ctx || !this.started || !this.bgmEnabled) return;
    if (this.bgmTimer !== null) return;

    this.playBgmStep();
    this.bgmTimer = window.setInterval(() => this.playBgmStep(), 560);
  }

  private stopBgmLoop(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private playBgmStep(): void {
    if (!this.ctx || !this.bgmEnabled || document.hidden) {
      return;
    }

    const sequence = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 392.0, 349.23];
    const base = sequence[this.seqStep % sequence.length];
    this.seqStep += 1;

    this.playTone({
      type: "sine",
      fromHz: base,
      toHz: base,
      duration: 0.5,
      volume: this.bgmVolume * 0.22
    });

    this.playTone({
      type: "sine",
      fromHz: base * 1.5,
      toHz: base * 1.5,
      duration: 0.45,
      volume: this.bgmVolume * 0.12
    });
  }

  private playTone(opts: {
    type: OscillatorType;
    fromHz: number;
    toHz: number;
    duration: number;
    volume: number;
  }): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.fromHz, now);
    osc.frequency.linearRampToValueAtTime(opts.toHz, now + opts.duration);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(opts.volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + opts.duration + 0.02);
  }
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
