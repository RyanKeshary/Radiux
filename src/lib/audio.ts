'use client';

/**
 * Synthesized Web Audio API sound generator.
 * No external MP3/WAV assets needed — produces pristine, pleasant, crisp chimes!
 */

class SoundEffects {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Play an exciting, high-end, crystalline notification chime.
   * Uses two harmonious sine tones with soft attack and sparkling decay.
   */
  playNotificationChime() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note 1 (E5: ~659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.18, now + 0.03);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.7);

      // Note 2 (B5: ~987.77Hz - sparkling chime)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.08);
      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.22, now + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.08);
      osc2.stop(now + 0.9);

      // Note 3 (E6: ~1318.51Hz - crystalline harmonic)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(1318.51, now + 0.16);
      gain3.gain.setValueAtTime(0, now + 0.16);
      gain3.gain.linearRampToValueAtTime(0.15, now + 0.19);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);

      osc3.connect(gain3);
      gain3.connect(ctx.destination);

      osc3.start(now + 0.16);
      osc3.stop(now + 1.1);
    } catch (e) {
      // Non-fatal if browser audio autoplay policy blocks before user interaction
    }
  }

  /**
   * Subtle micro-haptic pop for quick user interactions (clicks, toggles, success)
   */
  playHapticPop() {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.04);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {}
  }

  notification() {
    this.playNotificationChime();
  }

  haptic() {
    this.playHapticPop();
  }
}

export const Sound = new SoundEffects();
