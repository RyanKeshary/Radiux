/**
 * CodeCollab Micro-Haptics & Tactile Feedback Helper
 * Uses navigator.vibrate when available to give crisp mobile/trackpad feedback.
 */

export function triggerHaptic(style: 'light' | 'medium' | 'success' | 'warning' | 'selection' | 'notification' = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

  try {
    if ('vibrate' in navigator) {
      switch (style) {
        case 'light':
        case 'selection':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(20);
          break;
        case 'notification':
        case 'success':
          navigator.vibrate([10, 30, 15]);
          break;
        case 'warning':
          navigator.vibrate([25, 40, 25]);
          break;
      }
    }
  } catch {}
}
