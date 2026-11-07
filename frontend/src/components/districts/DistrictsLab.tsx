"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Skeleton } from "@/components/ds/Skeleton";
import { PageHeader } from "@/components/ds/PageHeader";
import { HeatmapMatrix } from "@/components/ds/HeatmapMatrix";
import { SegmentedControl } from "@/components/ds/SegmentedControl";
import { MultiLineForecast } from "@/components/charts/MultiLineForecast";
import { seriesColor } from "@/components/charts/common";
import { useMedicineMatrix, useStateSummary } from "@/lib/api/hooks";
import { useElementSize } from "@/lib/use-element-size";
import { useScope } from "@/lib/scope";
import { ComparisonMatrix } from "./ComparisonMatrix";
import { DistrictCard } from "./DistrictCard";
import { useDistrictFootfalls, toSeries } from "./data";
import { Callout, COVER_SCALE, InsightCard, Moneyshot } from "./kit";
import {
  footfallTitle,
  heatTitle,
  leagueTitle,
  peakDay,
  shortMedicine,
  shortName,
  topShortage,
} from "./metrics";

type Tab = "matrix" | "medicine" | "footfall";
const TAB_OPTIONS = [
  { value: "matrix" as const, label: "Comparison matrix" },
  { value: "medicine" as const, label: "Medicine cover" },
  { value: "footfall" as const, label: "Footfall forecast" },
];

export function DistrictsLab() {
  const { scope } = useScope();
  const all = useStateSummary("all");
  const matrix = useMedicineMatrix("all");
  const footfalls = useDistrictFootfalls();
  const [tab, setTab] = useState<Tab>("matrix");
  const [bodyRef, body] = useElementSize<HTMLDivElement>();

  const summary = all.data;
  const rows = useMemo(() => summary?.districts ?? [], [summary]);
  const series = useMemo(() => {
    const out: Record<string, ReturnType<typeof toSeries>> = {};
    for (const r of rows) out[r.district_id] = toSeries(footfalls[r.district_id]);
    return out;
  }, [rows, footfalls]);

  const axis = useMemo(() => {
    const vals = Object.values(series).flatMap((s) => s.map((p) => p.actual ?? p.predicted ?? 0)).filter((v) => v > 0);
    return { min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 1 };
  }, [series]);

  if (!summary || rows.length === 0 || !matrix.data) {
    return (
      <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
        <PageHeader eyebrow="Districts" title="District comparison lab" className="mb-2" />
        <div className="grid shrink-0 gap-3 xl:grid-cols-5 md:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[220px]" />
          ))}
        </div>
        <Skeleton className="min-h-0 flex-1" />
      </div>
    );
  }

  const ranked = [...rows].sort((a, b) => b.risk_index - a.risk_index);
  const rankOf = (id: string) => ranked.findIndex((r) => r.district_id === id) + 1;
  const mdata = matrix.data;
  const top = ranked[0];

  const peaks = rows
    .map((r) => {
      const p = peakDay(series[r.district_id] ?? []);
      return p ? { name: shortName(r.name), ...p } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => b.value - a.value);

  const worstCell = mdata.cells.filter((c) => c.min_days_remaining !== null).sort((a, b) => (a.min_days_remaining as number) - (b.min_days_remaining as number))[0];
  const worstDistrict = rows.find((r) => r.district_id === worstCell?.district_id);

  const dayKeys = (series[rows[0].district_id] ?? []).map((p) => p.day);
  const footRows = dayKeys.map((day, i) => {
    const row: Record<string, string | number | null> = { day };
    for (const r of rows) {
      const p = series[r.district_id]?.[i];
      row[r.district_id] = p ? (p.actual ?? p.predicted ?? null) : null;
    }
    return row;
  });
  const forecastFrom = (series[rows[0].district_id] ?? []).find((p) => p.actual === undefined)?.day;

  // Fall back to a sensible size on the first paint (ResizeObserver has not fired yet) or in jsdom.
  const bodyHeight = body.height || 320;
  const sortedMeds = [...mdata.medicines].sort((a, b) => Number(b.emergency) - Number(a.emergency));
  const heatCell = Math.min(38, Math.max(20, Math.floor((bodyHeight - 56) / (sortedMeds.length + 1.5))));
  const chartHeight = Math.max(160, bodyHeight - 44);

  const tabMeta: Record<Tab, { eyebrow: string; title: ReactNode; source: string; read: ReactNode }> = {
    matrix: {
      eyebrow: "Comparison matrix",
      title: `${shortName(top.name)} leads on ${rows.length > 1 ? "risk index" : "risk"}; each column is coloured against the other four districts`,
      source: "Source: SwasthyaGrid insights/state-summary. Colours rank each metric across districts. Click a cell for the rows behind it.",
      read: "Read across a row to see where a district is weak, down a column to see who is the outlier.",
    },
    medicine: {
      eyebrow: "Lowest days of cover, medicine by district",
      title: heatTitle(mdata),
      source: "Source: insights/medicine-matrix, days of cover = units / average daily use",
      read: "Red cells are under 3 days. Click a cell to open the inventory for that district.",
    },
    footfall: {
      eyebrow: "Footfall forecast, five districts",
      title: footfallTitle(peaks[0] ?? null),
      source: "Source: footfall/forecast per district, actual up to Friday, model forecast after",
      read: "Lines share one axis. Districts that rise together need the same surge stock.",
    },
  };
  const meta = tabMeta[tab];

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
      <PageHeader
        eyebrow="Districts / Comparison lab"
        title="Five districts, one yardstick"
        className="mb-2"
        actions={
          <Moneyshot
            value={top.risk_index}
            unit="risk index"
            label={`${shortName(top.name)} is the district to watch, ${top.risk_counts.critical} critical ${top.risk_counts.critical === 1 ? "facility" : "facilities"}`}
            href={`/districts/${top.district_id}`}
          />
        }
      />

      {/* Hero: five identical small multiples */}
      <section aria-label="District small multiples" className="shrink-0">
        <div className="mb-1 flex items-baseline justify-between">
          <div>
            <p className="eyebrow">Small multiples</p>
            <h2 className="text-[14px] font-semibold text-text">{leagueTitle(rows)}</h2>
          </div>
          <p className="text-[11px] text-faint">Ranked by risk index, left to right.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {ranked.map((r) => (
            <DistrictCard
              key={r.district_id}
              row={r}
              rank={rankOf(r.district_id)}
              series={series[r.district_id] ?? []}
              axis={axis}
              shortage={topShortage(mdata, r.district_id)}
              facilityName={r.critical_facilities[0]?.name}
              selected={scope === r.district_id}
              dimmed={scope !== "all" && scope !== r.district_id}
              compact
            />
          ))}
        </div>
      </section>

      <InsightCard
        className="min-h-0 flex-1"
        eyebrow={meta.eyebrow}
        title={meta.title}
        section="Districts / Matrix"
        source={meta.source}
        read={meta.read}
        bodyClassName={tab === "matrix" ? "min-h-0 flex-1 p-0" : "min-h-0 flex-1"}
        actions={<SegmentedControl value={tab} onChange={setTab} options={TAB_OPTIONS} ariaLabel="District comparison view" />}
      >
        <div ref={bodyRef} className="h-full min-h-[200px] lg:min-h-0">
          {tab === "matrix" && <ComparisonMatrix rows={rows} scope={scope} />}
          {tab === "medicine" && (
            <>
              <HeatmapMatrix
                rows={sortedMeds.map((m) => ({ id: m.name, label: shortMedicine(m.name), group: m.emergency ? "Emergency medicines" : "Essential medicines" }))}
                cols={mdata.districts.map((d) => ({ id: d.id, label: shortName(d.name) }))}
                value={(rid, cid) => mdata.cells.find((c) => c.medicine_name === rid && c.district_id === cid)?.min_days_remaining ?? null}
                scale={COVER_SCALE}
                format={(v) => `${v}d`}
                cellSize={heatCell}
              />
              {worstCell && worstDistrict && (
                <div className="mt-2">
                  <Callout tone="critical">
                    {shortMedicine(worstCell.medicine_name)} in {shortName(worstDistrict.name)}: {worstCell.min_days_remaining} days, {worstCell.facilities_below_threshold} facilities below threshold
                  </Callout>
                </div>
              )}
            </>
          )}
          {tab === "footfall" && (
            <>
              <MultiLineForecast
                data={footRows}
                xKey="day"
                forecastFrom={forecastFrom}
                series={rows.map((r, i) => ({ key: r.district_id, name: shortName(r.name), color: seriesColor(i) }))}
                unit="visits"
                height={chartHeight}
              />
              {peaks[0] && <div className="mt-2"><Callout>{peaks[0].name} peaks on {peaks[0].day} at {peaks[0].value} visits</Callout></div>}
            </>
          )}
        </div>
      </InsightCard>
    </div>
  );
}
