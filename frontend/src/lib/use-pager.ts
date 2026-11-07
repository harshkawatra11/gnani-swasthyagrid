"use client";

import { useMemo, useState } from "react";

export interface Pager<T> {
  page: number;
  pages: number;
  slice: T[];
  from: number;
  to: number;
  total: number;
  next: () => void;
  prev: () => void;
  goToIndex: (i: number) => void;
}

/** Paginates `items` at `pageSize` per page instead of scrolling a list, for a
 * one-screen layout with a fixed content height. The current page clamps
 * automatically when `items` or `pageSize` change (e.g. the container resizes
 * or the underlying data shrinks). `goToIndex` jumps to the page containing a
 * given item index, e.g. when a map click selects a row off the current page. */
export function usePager<T>(items: readonly T[], pageSize: number): Pager<T> {
  const [page, setPage] = useState(0);
  const size = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const clamped = Math.min(page, pages - 1);

  const slice = useMemo(() => items.slice(clamped * size, clamped * size + size), [items, clamped, size]);

  const from = items.length === 0 ? 0 : clamped * size + 1;
  const to = Math.min(items.length, clamped * size + size);

  return {
    page: clamped,
    pages,
    slice,
    from,
    to,
    total: items.length,
    next: () => setPage((p) => Math.min(pages - 1, p + 1)),
    prev: () => setPage((p) => Math.max(0, p - 1)),
    goToIndex: (i: number) => {
      if (i < 0) return;
      setPage(Math.floor(i / size));
    },
  };
}
