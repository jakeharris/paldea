import { useEffect, type RefObject } from "react";

interface Focusable {
  focus: () => void;
}

/**
 * Listen for keystrokes anywhere on the page.
 * If a printable character is typed and no input is focused, focus the search.
 */
export function useKeyboardSearch(ref: RefObject<Focusable | null>) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) {
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        ref.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [ref]);
}
