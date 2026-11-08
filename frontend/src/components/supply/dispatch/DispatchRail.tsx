"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Snowflake } from "lucide-react";
import { DataTable, type Column } from "@/components/ds/DataTable";
import { EmptyState } from "@/components/ds/EmptyState";
import { Select } from "@/components/ds/Select";
import { StatusChip } from "@/components/ds/StatusChip";
import { cn } from "@/lib/cn";
import { useScope, withScope } from "@/lib/scope";
import { fmtDateTime, fmtDuration, fmtKg } from "@/lib/format";
import { useElementSize } from "@/lib/use-element-size";
import { usePager } from "@/lib/use-pager";
import type { ShipmentSummary } from "@/lib/api/types";
import { ORDER_PERIOD_LABEL, filterOrders, sortOrders, type OrderPeriod } from "./helpers";
import { SourceLine } from "./SourceLine";

// Measured from the rendered row (px-4 py-3.5 padding, the two-line route block, border):
// about 128px tall at the default text size. Pagination sizes itself off this estimate
// rather than off a scrollbar, so the rail never scrolls.
const ORDER_ROW_PX = 128;
// Exceptions sit in a fixed strip at the bottom of the rail (header + up to 4 compact
// rows), so Orders and Exceptions are both visible at once rather than tabbed.
const EXCEPTIONS_STRIP_PX = 208;
const EXCEPTIONS_SHOWN = 4;

/** Route block from the reference: filled marker on top, dashed line, diamond at the bottom. */
function OrderRoute({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex gap-3">
      <div aria-hidden className="flex w-3 shrink-0 flex-col items-center pt-1">
        <span className="h-0 w-0 border-x-[5px] border-t-[8px] border-x-transparent border-t-text-muted" style={{ borderTopColor: "var(--text-muted)" }} />
        <span className="my-1 w-px flex-1 border-l border-dashed border-border-strong" />
        <span className="h-2 w-2 rotate-45 bg-text-muted" style={{ background: "var(--text-muted)" }} />
      </div>
      <div className="min-w-0 flex-1 text-[12px]">
        <p className="mb-1.5 text-[11px] text-faint">Shipment Route</p>
        <p className="mb-3 leading-snug text-text">{from}</p>
        <p className="leading-snug text-text">{to}</p>
      </div>
    </div>
  );
}

function OrderRow({
  s,
  selected,
  onSelect,
  href,
}: {
  s: ShipmentSummary;
  selected: boolean;
  onSelect: (id: string) => void;
  href: string;
}) {
  return (
    <li
      className={cn(
        "border-b border-border px-4 py-3.5 transition-colors last:border-b-0",
        selected ? "bg-surface-2 shadow-[inset_2px_0_0_var(--brand)]" : "hover:bg-surface-2/60",
      )}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(s.id)}
            aria-pressed={selected}
            aria-label={`Select ${s.id} on the map`}
            className="num text-[13px] font-medium text-text hover:text-brand"
          >
            {s.id}
          </button>
          <StatusChip status={s.status} size="sm" live />
          {s.cold_chain && (
            <span title="Cold chain" className="inline-flex text-cyan">
              <Snowflake size={13} aria-label="Cold chain" />
            </span>
          )}
        </div>
        <Link href={href} prefetch={false} aria-label={`Open tracking for ${s.id}`} className="rounded-sm p-1 text-muted hover:bg-surface-3 hover:text-text">
          <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <OrderRoute from={s.origin.name} to={s.destination.name} />
        <dl className="min-w-[92px] text-right text-[12px]">
          <dt className="text-[11px] text-faint">Est. delivery</dt>
          <dd className="num mb-3 text-text">{s.eta ? fmtDateTime(s.eta) : "Pending"}</dd>
          <dt className="text-[11px] text-faint">Total weight</dt>
          <dd className="num text-text">{fmtKg(s.weight_kg)}</dd>
        </dl>
      </div>
    </li>
  );
}

function exceptionRows(items: readonly ShipmentSummary[]): ShipmentSummary[] {
  return items
    .filter((s) => s.status === "delayed" || (s.status === "approved" && s.blocked_reason) || s.delay_minutes >= 30)
    .filter((s) => s.status !== "delivered" && s.status !== "cancelled")
    .sort((a, b) => b.delay_minutes - a.delay_minutes)
    .slice(0, 8);
}

function PagerControls({ from, to, total, onPrev, onNext, disabled }: { from: number; to: number; total: number; onPrev: () => void; onNext: () => void; disabled: { prev: boolean; next: boolean } }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="num">{total === 0 ? "0 of 0" : `${from}–${to} of ${total}`}</span>
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled.prev}
        aria-label="Previous page"
        className="rounded-sm p-0.5 text-muted hover:bg-surface-3 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={disabled.next}
        aria-label="Next page"
        className="rounded-sm p-0.5 text-muted hover:bg-surface-3 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <ChevronRight size={14} />
      </button>
    </span>
  );
}

export function DispatchRail({
  shipments,
  total,
  simNow,
  selectedId,
  onSelect,
}: {
  shipments: readonly ShipmentSummary[];
  total: number;
  simNow: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { scope } = useScope();
  const [period, setPeriod] = useState<OrderPeriod>("all");
  const [listRef, listSize] = useElementSize<HTMLUListElement>();

  const orderRows = useMemo(() => sortOrders(filterOrders([...shipments], period, simNow)), [shipments, period, simNow]);
  const excRows = useMemo(() => exceptionRows(shipments), [shipments]);
  const excShown = excRows.slice(0, EXCEPTIONS_SHOWN);

  // listRef is on the <ul> itself, which flexbox already shrinks to "whatever is left"
  // once the header, pager strip, fixed exceptions strip and footer take their space.
  const pageSize = Math.max(2, Math.floor((listSize.height || 300) / ORDER_ROW_PX));
  const pager = usePager(orderRows, pageSize);

  useEffect(() => {
    if (!selectedId) return;
    const i = orderRows.findIndex((o) => o.id === selectedId);
    if (i >= 0) pager.goToIndex(i);
    // Only re-run when the selection or the row set changes, not on every pager identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, orderRows]);

  const maxDelay = Math.max(30, ...excRows.map((r) => r.delay_minutes));
  const excCols: Column<ShipmentSummary>[] = [
    {
      key: "id",
      header: "Shipment",
      accessor: (r) => r.id,
      cell: (r) => (
        <Link href={withScope(`/supply/shipments/${r.id}`, scope)} className="num text-brand hover:underline">
          {r.id}
        </Link>
      ),
    },
    { key: "status", header: "Status", accessor: (r) => r.status, cell: (r) => <StatusChip status={r.status} size="sm" /> },
    { key: "dest", header: "Destination", accessor: (r) => r.destination.name },
    {
      key: "delay",
      header: "Delay",
      accessor: (r) => r.delay_minutes,
      sortable: true,
      cell: (r) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, (r.delay_minutes / maxDelay) * 100)}%`, background: "var(--status-delayed)" }} />
          </div>
          <span className="num text-muted">{fmtDuration(r.delay_minutes)}</span>
        </div>
      ),
    },
  ];

  return (
    <section className="flex h-full flex-col rounded-md border border-border bg-surface-1 shadow-[var(--inset-highlight)]">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <p className="eyebrow">Orders</p>
          <h3 className="num text-[13px] font-semibold text-text">Total: {total}</h3>
        </div>
        <Select
          ariaLabel="Orders period"
          value={period}
          onValueChange={(v) => setPeriod(v as OrderPeriod)}
          options={(Object.keys(ORDER_PERIOD_LABEL) as OrderPeriod[]).map((p) => ({ value: p, label: ORDER_PERIOD_LABEL[p] }))}
        />
      </header>

      {orderRows.length === 0 ? (
        <div className="flex-1 p-4">
          <EmptyState icon={ArrowUpRight} title="No orders in this window" body="Widen the period to see earlier shipments." />
        </div>
      ) : (
        <ul ref={listRef} data-testid="orders-list" className="min-h-0 flex-1">
          {pager.slice.map((s) => (
            <OrderRow
              key={s.id}
              s={s}
              selected={s.id === selectedId}
              onSelect={onSelect}
              href={withScope(`/supply/shipments/${s.id}`, scope)}
            />
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 border-y border-border px-4 py-1.5 text-[11px] text-faint">
        <PagerControls
          from={pager.from}
          to={pager.to}
          total={pager.total}
          onPrev={pager.prev}
          onNext={pager.next}
          disabled={{ prev: pager.page === 0, next: pager.page >= pager.pages - 1 }}
        />
        <span className="num">{excRows.length === 0 ? "No exceptions" : `${excRows.length} exception${excRows.length === 1 ? "" : "s"}`}</span>
      </div>

      {/* Exceptions: always visible, a fixed-height strip rather than a second tab. */}
      <div className="shrink-0" style={{ height: EXCEPTIONS_STRIP_PX }} data-testid="exceptions-table">
        {excShown.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <EmptyState icon={ArrowUpRight} title="All clear" body="No shipment is behind plan or blocked." />
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            <DataTable columns={excCols} rows={excShown} rowKey={(r) => r.id} density="compact" stickyHeader initialSort={{ key: "delay", dir: "desc" }} empty={<p className="p-4 text-muted">All clear.</p>} />
          </div>
        )}
      </div>

      <footer className="border-t border-border px-4 py-2 text-[11px] text-faint">
        <SourceLine source="simulated shipment ledger" sub="Supply chain / Dispatch" />
      </footer>
    </section>
  );
}
