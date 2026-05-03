import { useRef, useEffect, useCallback } from 'react';

/**
 * Focus trap hook for modal dialogs.
 * Traps Tab/Shift+Tab within the container and restores focus on unmount.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(isOpen: boolean) {
  const ref = useRef<T>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      returnFocusRef.current = document.activeElement as HTMLElement;
      // Delay to allow the modal to render
      const timer = setTimeout(() => {
        if (ref.current) {
          const focusable = ref.current.querySelector<HTMLElement>(
            'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          focusable?.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      returnFocusRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !ref.current) return;
    const focusables = ref.current.querySelectorAll<HTMLElement>(
      'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return { ref, handleKeyDown };
}
