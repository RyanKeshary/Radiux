/**
 * CodeCollab Web Audio API Synthesizer
 * Produces crisp, pleasant, modern chimes for notifications without any external audio files.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays an upbeat, exciting notification chime:
 * Dual-harmonic arpeggio (E5 -> G#5 -> B5 -> E6) with gentle release.
 */
export function playNotificationChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [659.25, 830.61, 987.77, 1318.51]; // E5, G#5, B5, E6
    const noteDuration = 0.07;

    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + index * noteDuration);

      // Subtle warmth with overtone
      gain.gain.setValueAtTime(0.0001, now + index * noteDuration);
      gain.gain.exponentialRampToValueAtTime(0.18, now + index * noteDuration + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * noteDuration + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + index * noteDuration);
      osc.stop(now + index * noteDuration + 0.3);
    });
  } catch (err) {
    // Non-blocking audio fallback
    console.debug('[Audio] Notification sound skipped:', err);
  }
}

/**
 * Plays a subtle action pop / click tone
 */
export function playActionPop(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.07);
  } catch {}
}
