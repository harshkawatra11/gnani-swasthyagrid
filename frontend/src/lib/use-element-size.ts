"use client";

import { useEffect, useRef, useState } from "react";

/** Measures a DOM element's content box live via ResizeObserver, for layouts that
 * size a chart or a page of rows to the space actually available (rather than a
 * guessed fixed height). Returns {width: 0, height: 0} until the first observation
 * (e.g. during SSR or before mount) and whenever ResizeObserver is unavailable. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
}
