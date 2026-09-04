import { useCallback, useState } from "react";

interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initialValue: T) {
  const [history, setHistory] = useState<History<T>>({
    past: [],
    present: initialValue,
    future: [],
  });

  const commit = useCallback((next: T | ((current: T) => T)) => {
    setHistory((current) => {
      const nextValue = typeof next === "function"
        ? (next as (value: T) => T)(current.present)
        : next;
      if (Object.is(nextValue, current.present)) return current;
      return {
        past: [...current.past.slice(-39), current.present],
        present: nextValue,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => {
      const previous = current.past.at(-1);
      if (!previous) return current;
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      return {
        past: [...current.past, current.present],
        present: next,
        future: current.future.slice(1),
      };
    });
  }, []);

  const reset = useCallback((value: T) => {
    setHistory({ past: [], present: value, future: [] });
  }, []);

  return {
    value: history.present,
    commit,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
