/**
 * Focus Tracker Hook
 * 
 * PURPOSE:
 * Tracks when UI elements (inputs, textareas, etc.) are focused to prevent
 * keyboard movement controls from interfering with text input.
 * 
 * BUG-030 FIX:
 * When a user clicks on chat input or other form elements, keyboard events
 * should go to those elements, not trigger avatar movement. This hook tracks
 * focus state to enable conditional keyboard handling.
 * 
 * USAGE:
 * ```typescript
 * const isUIFocused = useFocusTracker();
 * 
 * useEffect(() => {
 *   const handleKeyDown = (e: KeyboardEvent) => {
 *     if (isUIFocused) return; // Don't handle when typing
 *     // Handle movement...
 *   };
 * }, [isUIFocused]);
 * ```
 * 
 * @author GitHub Copilot
 * @see docs/bugs/movement/BUG-030-keyboard-controls-stop-working.md
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to track when UI form elements are focused
 * 
 * @returns boolean - true when a form element (input, textarea, select, contenteditable) is focused
 */
export function useFocusTracker(): boolean {
  const [isUIFocused, setIsUIFocused] = useState(false);

  /**
   * Check if an element is a form element that should capture keyboard input
   */
  const isFormElement = useCallback((element: Element | null): boolean => {
    if (!element) return false;
    
    const tagName = element.tagName.toUpperCase();
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      (element instanceof HTMLElement && element.isContentEditable)
    );
  }, []);

  useEffect(() => {
    /**
     * Handle focus moving to an element
     * BUG-030: Detect when user clicks into a form field
     */
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as Element;
      if (isFormElement(target)) {
        setIsUIFocused(true);
        console.log('[FocusTracker] UI element focused:', target.tagName);
      }
    };

    /**
     * Handle focus leaving an element
     * BUG-030: Use small delay to handle focus transfer between elements
     */
    const handleFocusOut = () => {
      // Small delay to handle focus transfer between elements
      // Without this, we'd briefly report no focus when clicking from one input to another
      setTimeout(() => {
        const active = document.activeElement;
        const focused = isFormElement(active);
        setIsUIFocused(focused);
        if (!focused) {
          console.log('[FocusTracker] Focus returned to document');
        }
      }, 10);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    // Check initial state
    setIsUIFocused(isFormElement(document.activeElement));

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isFormElement]);

  return isUIFocused;
}

/**
 * Global Escape Key Handler Hook
 * 
 * BUG-030 FIX:
 * Provides a universal way to blur focused elements and return keyboard control
 * to the game. When user presses Escape, any focused input is blurred.
 * 
 * USAGE:
 * ```typescript
 * useGlobalEscape(); // Call once in root component
 * ```
 */
export function useGlobalEscape(): void {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Blur any focused element
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
          console.log('[GlobalEscape] Blurred active element');
        }
        // Dispatch custom event for components to handle
        window.dispatchEvent(new CustomEvent('global-escape'));
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);
}

export default useFocusTracker;
