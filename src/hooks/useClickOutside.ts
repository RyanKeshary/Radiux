import { useEffect, RefObject } from 'react';

/**
 * Hook to detect clicks/taps outside of a referenced DOM element and trigger a handler.
 * Uses capture-phase listeners to ensure outside clicks are caught even if child components stop propagation,
 * and handles window blur (e.g. clicking into an iframe like Web Preview) as well as the Escape key.
 */
export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  handler: (event: MouseEvent | TouchEvent | KeyboardEvent) => void,
  enabled: boolean = true
) {
  useEffect(() => {
    if (!enabled) return;

    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || (event.target && el.contains(event.target as Node))) {
        return;
      }
      handler(event);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handler(event);
      }
    };

    const handleBlur = () => {
      // When clicking into an iframe (e.g. Web Preview), window blurs
      handler(new MouseEvent('mousedown'));
    };

    document.addEventListener('pointerdown', listener, true);
    document.addEventListener('mousedown', listener, true);
    document.addEventListener('touchstart', listener, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('pointerdown', listener, true);
      document.removeEventListener('mousedown', listener, true);
      document.removeEventListener('touchstart', listener, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('blur', handleBlur);
    };
  }, [ref, handler, enabled]);
}
