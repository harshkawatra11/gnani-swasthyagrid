"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ds/Skeleton";
import { KpiTile } from "@/components/ds/KpiTile";
import { PageHeader } from "@/components/ds/PageHeader";
import { HeatmapMatrix } from "@/components/ds/HeatmapMatrix";
import { MultiLineForecast } from "@/components/charts/MultiLineForecast";
import { seriesColor } from "@/components/charts/common";
import { useMedicineMatrix, useStateSummary } from "@/lib/api/hooks";
import { useElementSize } from "@/lib/use-element-size";
import { useScope, withScope } from "@/lib/scope";
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

export function DistrictsLab() {
  const { scope } = useScope();
  const all = useStateSummary("all");
  const matrix = useMedicineMatrix("all");
  const footfalls = useDistrictFootfalls();
  const [heatBodyRef, heatBody] = useElementSize<HTMLDivElement>();
  const [forecastBodyRef, forecastBody] = useElementSize<HTMLDivElement>();

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
  const tot = summary.totals;
  const spark = (f: (r: (typeof rows)[number]) => number) => rows.map(f);

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
  const sortedMeds = [...mdata.medicines].sort((a, b) => Number(b.emergency) - Number(a.emergency));
  const heatCell = Math.min(34, Math.max(16, Math.floor(((heatBody.height || 220) - 30) / (sortedMeds.length + 1.5))));
  const chartHeight = Math.max(120, (forecastBody.height || 220) - 36);

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

      {/* KPI band: state totals, never the main event but part of the at-a-glance read */}
      <div className="grid shrink-0 grid-cols-3 gap-3 md:grid-cols-6">
        <KpiTile label="Critical facilities" value={tot.risk_counts.critical} unit={`of ${tot.facilities}`} tone="critical" href={withScope("/recommendations", scope)} sparkline={spark((r) => r.risk_counts.critical)} className="p-2.5" />
        <KpiTile label="Stock-out items" value={tot.stockout_items} tone="critical" href={withScope("/inventory", scope)} sparkline={spark((r) => r.stockout_items)} className="p-2.5" />
        <KpiTile label="Beds next week" value={Math.round(tot.bed_next_week_avg)} unit="%" tone={tot.bed_next_week_avg > 85 ? "critical" : "warning"} href={withScope("/districts", scope)} sparkline={spark((r) => r.bed_next_week_avg)} className="p-2.5" />
        <KpiTile label="Pending approvals" value={tot.pending_recommendations} href={withScope("/recommendations", scope)} sparkline={spark((r) => r.pending_recommendations)} className="p-2.5" />
        <KpiTile label="In transit" value={tot.shipments_in_transit} href={withScope("/supply", scope)} sparkline={spark((r) => r.shipments_in_transit)} className="p-2.5" />
        <KpiTile label="On time, 7 days" value={Math.round(tot.on_time_rate_7d * 100)} unit="%" tone={tot.on_time_rate_7d < 0.7 ? "warning" : "good"} href={withScope("/supply", scope)} sparkline={spark((r) => r.on_time_rate_7d * 100)} className="p-2.5" />
      </div>

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

      {/* Dense row: comparison matrix, medicine cover heatmap and footfall forecast, all at once */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
        <InsightCard
          className="min-h-0 lg:col-span-5"
          eyebrow="Comparison matrix"
          title={`${shortName(top.name)} leads on ${rows.length > 1 ? "risk index" : "risk"}; each column is coloured against the other four districts`}
          section="Districts / Matrix"
          source="Source: insights/state-summary. Colours rank each metric across districts."
          bodyClassName="min-h-0 flex-1 overflow-auto p-0"
        >
          <ComparisonMatrix rows={rows} scope={scope} />
        </InsightCard>

        <InsightCard
          className="min-h-0 lg:col-span-4"
          eyebrow="Lowest days of cover, medicine by district"
          title={heatTitle(mdata)}
          section="Districts / Medicines"
          source="Source: insights/medicine-matrix, days of cover = units / average daily use"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div ref={heatBodyRef} className="min-h-0 flex-1 overflow-hidden">
            <HeatmapMatrix
              rows={sortedMeds.map((m) => ({ id: m.name, label: shortMedicine(m.name), group: m.emergency ? "Emergency medicines" : "Essential medicines" }))}
              cols={mdata.districts.map((d) => ({ id: d.id, label: shortName(d.name) }))}
              value={(rid, cid) => mdata.cells.find((c) => c.medicine_name === rid && c.district_id === cid)?.min_days_remaining ?? null}
              scale={COVER_SCALE}
              format={(v) => `${v}d`}
              cellSize={heatCell}
            />
          </div>
          {worstCell && worstDistrict && (
            <div className="mt-1.5 shrink-0">
              <Callout tone="critical">
                {shortMedicine(worstCell.medicine_name)} in {shortName(worstDistrict.name)}: {worstCell.min_days_remaining}d, {worstCell.facilities_below_threshold} below threshold
              </Callout>
            </div>
          )}
        </InsightCard>

        <InsightCard
          className="min-h-0 lg:col-span-3"
          eyebrow="Footfall forecast"
          title={footfallTitle(peaks[0] ?? null)}
          section="Districts / Footfall"
          source="Source: footfall/forecast, five districts"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div ref={forecastBodyRef} className="min-h-0 flex-1 overflow-hidden">
            <MultiLineForecast
              data={footRows}
              xKey="day"
              forecastFrom={forecastFrom}
              series={rows.map((r, i) => ({ key: r.district_id, name: shortName(r.name), color: seriesColor(i) }))}
              unit="visits"
              height={chartHeight}
            />
          </div>
          {peaks[0] && (
            <div className="mt-1.5 shrink-0">
              <Callout>{peaks[0].name} peaks {peaks[0].day} at {peaks[0].value}</Callout>
            </div>
          )}
        </InsightCard>
      </div>
    </div>
  );
}
