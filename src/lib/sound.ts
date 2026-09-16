/**
 * Radiux Notification & Feedback Audio Synthesizer
 * Uses Web Audio API for lightweight, high-fidelity, offline-ready micro-sound feedback.
 */

class SoundEffectsManager {
  private ctx: AudioContext | null = null;
  private lastPlayTime = 0;
  private minIntervalMs = 1200; // Throttling to prevent audio fatigue

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

  public isEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = localStorage.getItem('radiux_editor_settings') || localStorage.getItem('codecollab_editor_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.soundEnabled === false) return false;
      }
      const direct = localStorage.getItem('radiux_sound_enabled') || localStorage.getItem('codecollab_sound_enabled');
      if (direct === 'false') return false;
    } catch (e) {}
    return true;
  }

  public setEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('radiux_sound_enabled', enabled ? 'true' : 'false');
      localStorage.setItem('codecollab_sound_enabled', enabled ? 'true' : 'false');
      const raw = localStorage.getItem('radiux_editor_settings') || localStorage.getItem('codecollab_editor_settings');
      const settings = raw ? JSON.parse(raw) : {};
      settings.soundEnabled = enabled;
      localStorage.setItem('radiux_editor_settings', JSON.stringify(settings));
      localStorage.setItem('codecollab_editor_settings', JSON.stringify(settings));
    } catch (e) {}
  }

  /**
   * Play a subtle, pleasant notification chime (dual harmonic tone)
   */
  public playNotification(): void {
    if (!this.isEnabled()) return;
    const now = Date.now();
    if (now - this.lastPlayTime < this.minIntervalMs) return;
    this.lastPlayTime = now;

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.08, t);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      masterGain.connect(ctx.destination);

      // Primary crystal note (E6 ~ 1318.5 Hz)
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, t); // E5
      osc1.frequency.exponentialRampToValueAtTime(1046.5, t + 0.08); // Jump to C6
      osc1.connect(masterGain);
      osc1.start(t);
      osc1.stop(t + 0.35);

      // Warm harmonic overtone (G5 ~ 783.99 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.04, t + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.5, t + 0.05); // E6 sparkle
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t + 0.05);
      osc2.stop(t + 0.35);
    } catch (err) {
      // Ignore audio context errors gracefully
    }
  }

  /**
   * Soft action confirmation tone (e.g. accepted request or saved shortcut)
   */
  public playSuccess(): void {
    if (!this.isEnabled()) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      gain.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1760, t + 0.12);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch (e) {}
  }
}

export const soundManager = new SoundEffectsManager();
