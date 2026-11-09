"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { KpiTile } from "@/components/ds/KpiTile";
import { PagerBar } from "@/components/ds/PagerBar";
import { Skeleton } from "@/components/ds/Skeleton";
import { useBeds, useRecommendations } from "@/lib/api/hooks";
import { useScope } from "@/lib/scope";
import { useElementSize } from "@/lib/use-element-size";
import { usePager } from "@/lib/use-pager";
import { CapacityWaterfall, DistrictBedBars, OccupancyStrip, PressureList, RedirectList } from "@/components/operations/BedsPanels";
import { AssumptionRow, Callout, InsightCard, Moneyshot, ScenarioSwitch, useFacRefs } from "@/components/operations/kit";
import {
  DISTRICT_ORDER,
  bedsTitle,
  capacityWaterfall,
  enrichBeds,
  mean,
  scenarioOf,
  shortDistrict,
  weekUnder,
  type ScenarioId,
} from "@/components/operations/derive";

const SOURCE = "Source: SwasthyaGrid bed model, seed admissions. Occupancy = occupied beds / bed capacity";
// Measured row height in OccupancyStrip (30px name line + cell gaps); pagination sizes off this
// estimate so the strip never scrolls.
const STRIP_ROW_PX = 32;

export default function BedsPage() {
  const { scope } = useScope();
  const { data, isLoading } = useBeds(scope);
  const { refs } = useFacRefs(scope);
  const recsQ = useRecommendations({ type: "bed_redirect", status: "pending", district_id: scope === "all" ? undefined : scope });
  const [scenario, setScenario] = useState<ScenarioId>("realistic");
  const factor = scenarioOf(scenario).factor;
  const [stripRef, stripBody] = useElementSize<HTMLDivElement>();
  const [waterfallColRef, waterfallColBody] = useElementSize<HTMLDivElement>();
  const [districtBarsColRef, districtBarsColBody] = useElementSize<HTMLDivElement>();
  const [pressureRef, pressureBody] = useElementSize<HTMLDivElement>();
  const [redirectRef, redirectBody] = useElementSize<HTMLDivElement>();

  const rows = useMemo(() => enrichBeds(data?.beds ?? [], refs).filter((r) => scope === "all" || r.districtId === scope), [data, refs, scope]);
  const recs = useMemo(
    () => (recsQ.data?.recommendations ?? []).filter((r) => r.type === "bed_redirect" && r.status === "pending"),
    [recsQ.data],
  );

  const sortedRows = useMemo(() => [...rows].sort((a, b) => weekUnder(b, factor) - weekUnder(a, factor) || b.now - a.now), [rows, factor]);
  const stripPageSize = Math.max(4, Math.floor(((stripBody.height || 320) - 30) / STRIP_ROW_PX));
  const stripPager = usePager(sortedRows, stripPageSize);

  const s = useMemo(() => {
    const over90 = rows.filter((r) => weekUnder(r, factor) > 90);
    const over100 = rows.filter((r) => r.week * factor >= 100).length;
    const perDistrict = (fn: (rs: typeof rows) => number) => DISTRICT_ORDER.map((d) => fn(rows.filter((r) => r.districtId === d)));
    const w = capacityWaterfall(rows, factor);
    return {
      over90,
      over100,
      avgNow: mean(rows.map((r) => r.now)),
      avgWeek: mean(rows.map((r) => weekUnder(r, factor))),
      w,
      sparkOver: perDistrict((rs) => rs.filter((r) => weekUnder(r, factor) > 90).length),
      sparkNow: perDistrict((rs) => mean(rs.map((r) => r.now))),
      sparkWeek: perDistrict((rs) => mean(rs.map((r) => weekUnder(r, factor)))),
      worst: sortedRows[0],
    };
  }, [rows, factor, sortedRows]);

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
        <PageHeader eyebrow="Beds" title="Bed capacity board" className="mb-2" />
        <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px]" />
          ))}
        </div>
        <Skeleton className="min-h-0 flex-1" />
      </div>
    );
  }
  const scopeName = scope === "all" ? "Rajasthan" : shortDistrict(scope);

  const pressureLimit = Math.max(4, Math.floor(((pressureBody.height || 200) - 8) / 22));
  const redirectLimit = Math.max(3, Math.floor(((redirectBody.height || 160) - 8) / 42));
  // Each chart column is measured on its own (label + component together), since the waterfall
  // carries a trailing note and the district bars carry a leading legend row -- both sit outside
  // the height prop passed to the chart, so they have to be budgeted for separately.
  const waterfallHeight = Math.max(80, (waterfallColBody.height || 220) - 48);
  const districtBarsHeight = Math.max(80, (districtBarsColBody.height || 220) - 42);

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
      <PageHeader
        eyebrow="Beds"
        title="Bed capacity board"
        className="mb-2"
        description={`Occupancy now, tomorrow and next week for ${rows.length} facilities in ${scopeName}, worst first.`}
        actions={<ScenarioSwitch value={scenario} onChange={setScenario} label="Bed pressure scenario" />}
      />

      {/* KPI band: the moneyshot (facilities past the 90% redirect trigger) plus the state-of-play numbers */}
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-5">
        <Moneyshot
          value={s.over90.length}
          unit="facilities"
          label="Above 90% next week"
          note={`${s.over100} forecast at or over full capacity. System average moves from ${Math.round(s.avgNow)}% to ${Math.round(s.avgWeek)}%.`}
          className="col-span-2"
        />
        <KpiTile label="Beds tracked" value={s.w.total} sparkline={[]} hint={`${rows.length} facilities`} className="p-2.5" />
        <KpiTile label="Extra by next week" value={s.w.extra} tone="warning" sparkline={s.sparkWeek} hint="Predicted admissions" className="p-2.5" />
        <KpiTile label="Redirects pending" value={recs.length} tone={recs.length ? "warning" : "default"} sparkline={s.sparkOver} hint="Bed redirect recommendations" className="p-2.5" />
      </div>

      {/* Dense row: occupancy strip, capacity/district pressure, and the two ranked lists, all at once */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
        <InsightCard
          className="min-h-0 lg:col-span-4"
          eyebrow="Occupancy strip"
          title={bedsTitle(rows, factor)}
          source={SOURCE}
          section="Beds / Strip"
          actions={s.worst ? <Callout tone="critical">Worst: {s.worst.name}</Callout> : undefined}
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div ref={stripRef} className="min-h-0 flex-1 overflow-hidden">
            <OccupancyStrip rows={stripPager.slice} factor={factor} />
          </div>
          <div className="mt-1.5 flex shrink-0 justify-end">
            <PagerBar pager={stripPager} />
          </div>
        </InsightCard>

        <InsightCard
          className="min-h-0 lg:col-span-4"
          eyebrow="Capacity and district pressure"
          title={`Beds fill by ${s.w.extra} by next week; ${s.over90.length} sites cross the 90% redirect trigger`}
          source={SOURCE}
          section="Beds / Capacity"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden">
            <div ref={waterfallColRef} className="flex min-h-0 flex-col overflow-hidden">
              <p className="mb-0.5 shrink-0 text-[11px] font-medium text-muted">Capacity waterfall, beds</p>
              <CapacityWaterfall rows={rows} factor={factor} height={waterfallHeight} />
            </div>
            <div ref={districtBarsColRef} className="flex min-h-0 flex-col overflow-hidden">
              <p className="mb-0.5 shrink-0 text-[11px] font-medium text-muted">Average occupancy by district, %</p>
              <DistrictBedBars rows={rows} factor={factor} height={districtBarsHeight} />
            </div>
          </div>
          <div className="mt-1.5 shrink-0">
            <AssumptionRow active={scenario} />
          </div>
        </InsightCard>

        <div className="flex min-h-0 flex-col gap-3 lg:col-span-4">
          <InsightCard
            className="min-h-0 flex-[1.2]"
            eyebrow={`Top ${pressureLimit} pressure list`}
            title={s.worst ? `${s.worst.name} is the tightest site at ${weekUnder(s.worst, factor)}% next week` : "No pressure data"}
            source={SOURCE}
            section="Beds / Ranking"
            bodyClassName="min-h-0 flex-1 overflow-hidden"
          >
            <div ref={pressureRef} className="h-full">
              <PressureList rows={rows} factor={factor} limit={pressureLimit} columns={1} />
            </div>
          </InsightCard>

          <InsightCard
            className="min-h-0 flex-1"
            eyebrow="Redirect recommendations"
            title={recs.length ? `${recs.length} bed redirects are waiting for approval` : "No bed redirect is waiting"}
            source="Source: recommendation engine, redirect when next week occupancy exceeds 90%"
            section="Beds / Actions"
            bodyClassName="min-h-0 flex-1 overflow-hidden"
          >
            <div ref={redirectRef} className="h-full">
              <RedirectList recs={recs} refs={refs} limit={redirectLimit} />
            </div>
          </InsightCard>
        </div>
      </div>
    </div>
  );
}
