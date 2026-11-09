"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pager } from "@/lib/use-pager";

/** Compact "from-to of total" strip with prev/next, for a one-screen panel that pages
 * a long list instead of scrolling it (see src/lib/use-pager.ts). */
export function PagerBar<T>({ pager, className }: { pager: Pager<T>; className?: string }) {
  return (
    <span className={className ?? "flex shrink-0 items-center gap-1.5 text-[11px] text-faint"}>
      <span className="num">{pager.total === 0 ? "0 of 0" : `${pager.from}–${pager.to} of ${pager.total}`}</span>
      <button
        type="button"
        onClick={pager.prev}
        disabled={pager.page === 0}
        aria-label="Previous page"
        className="rounded-sm p-0.5 text-muted hover:bg-surface-3 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        onClick={pager.next}
        disabled={pager.page >= pager.pages - 1}
        aria-label="Next page"
        className="rounded-sm p-0.5 text-muted hover:bg-surface-3 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronRight size={14} />
      </button>
    </span>
  );
}
