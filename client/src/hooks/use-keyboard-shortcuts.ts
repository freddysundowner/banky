import { useEffect, useRef } from "react";

interface Shortcut {
  sequence?: string[];
  key?: string;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  const pendingKey = useRef<string | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      if (isInput) return;
      if (e.defaultPrevented) return;

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.sequence && shortcut.sequence.length === 2) {
          const [first, second] = shortcut.sequence;

          if (pendingKey.current === first && e.key.toLowerCase() === second.toLowerCase()) {
            e.preventDefault();
            pendingKey.current = null;
            if (pendingTimer.current) clearTimeout(pendingTimer.current);
            shortcut.action();
            return;
          }

          if (e.key.toLowerCase() === first.toLowerCase() && !e.ctrlKey && !e.metaKey && !e.altKey) {
            pendingKey.current = first;
            if (pendingTimer.current) clearTimeout(pendingTimer.current);
            pendingTimer.current = setTimeout(() => {
              pendingKey.current = null;
            }, 800);
            return;
          }
          continue;
        }

        if (shortcut.key) {
          const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
          const metaMatch = shortcut.meta ? e.metaKey : true;
          const altMatch = shortcut.alt ? e.altKey : !e.altKey;
          const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
          const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

          if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
            e.preventDefault();
            shortcut.action();
            return;
          }
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);
}
