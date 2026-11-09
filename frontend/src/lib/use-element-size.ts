"use client";

import { useCallback, useRef, useState } from "react";

/** Measures a DOM element's content box live via ResizeObserver, for layouts that
 * size a chart or a page of rows to the space actually available (rather than a
 * guessed fixed height). Returns {width: 0, height: 0} until the first observation
 * (e.g. during SSR or before mount) and whenever ResizeObserver is unavailable.
 *
 * Uses a callback ref rather than `useRef` + `useEffect(fn, [])`: the latter only
 * attaches the observer once, at the component's first mount, so it misses an
 * element that first exists on a *later* render (e.g. one hidden behind a loading
 * skeleton on first paint, as every one-screen page here is). A callback ref re-runs
 * whenever the DOM node it's attached to changes, which is exactly the signal we need. */
export function useElementSize<T extends HTMLElement>() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    ro.observe(el);
    observerRef.current = ro;
  }, []);

  return [ref, size] as const;
}
