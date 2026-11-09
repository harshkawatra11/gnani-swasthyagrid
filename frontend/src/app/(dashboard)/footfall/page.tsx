"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { KpiTile } from "@/components/ds/KpiTile";
import { Select } from "@/components/ds/Select";
import { Skeleton } from "@/components/ds/Skeleton";
import { useFootfall } from "@/lib/api/hooks";
import { DISTRICT_IDS, useScope } from "@/lib/scope";
import { useElementSize } from "@/lib/use-element-size";
import { DistrictMultiple, FactorChips, FanChart, FootfallCalendar, TomorrowBreakdown } from "@/components/operations/FootfallPanels";
import { AssumptionRow, Callout, InsightCard, Moneyshot, ScenarioSwitch, useFacRefs } from "@/components/operations/kit";
import {
  DISTRICT_ORDER,
  deriveFootfall,
  footfallPoints,
  footfallTitle,
  forecastStart,
  scenarioOf,
  shortDistrict,
  type ScenarioId,
} from "@/components/operations/derive";
import type { FootfallForecast } from "@/lib/api/types";

const SOURCE = "Source: SwasthyaGrid footfall model, seed history. Band width follows model confidence and widens with horizon";

function tomorrowOf(f: FootfallForecast, factor: number): number {
  const p = footfallPoints(f);
  const s = forecastStart(p);
  return Math.round((p[s]?.predicted ?? 0) * factor);
}

function peakOf(f: FootfallForecast): number {
  return Math.max(0, ...footfallPoints(f).map((p) => p.predicted ?? 0));
}

export default function FootfallPage() {
  const { scope } = useScope();
  const { refs } = useFacRefs("all");
  const [pick, setPick] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioId>("realistic");
  const factor = scenarioOf(scenario).factor;
  const selected = scope !== "all" ? scope : (pick ?? "district_jaipur_rural");
  const [fanBodyRef, fanBody] = useElementSize<HTMLDivElement>();

  const q0 = useFootfall(DISTRICT_IDS[0]);
  const q1 = useFootfall(DISTRICT_IDS[1]);
  const q2 = useFootfall(DISTRICT_IDS[2]);
  const q3 = useFootfall(DISTRICT_IDS[3]);
  const q4 = useFootfall(DISTRICT_IDS[4]);
  const loading = q0.isLoading && q1.isLoading;

  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of refs.values()) counts.set(f.districtId, (counts.get(f.districtId) ?? 0) + 1);
    const raw = [q0.data, q1.data, q2.data, q3.data, q4.data];
    const out: Array<{ districtId: string; forecast: FootfallForecast }> = [];
    DISTRICT_IDS.forEach((id, i) => {
      const f = raw[i];
      if (f) out.push({ districtId: id, forecast: deriveFootfall(f, id, counts.get(id) ?? 8) });
    });
    return out;
  }, [q0.data, q1.data, q2.data, q3.data, q4.data, refs]);

  const visible = scope === "all" ? data : data.filter((d) => d.districtId === scope);
  const current = data.find((d) => d.districtId === selected) ?? data[0];

  const model = useMemo(() => {
    if (!current) return null;
    const pts = footfallPoints(current.forecast);
    const start = forecastStart(pts);
    const all = data.map((d) => tomorrowOf(d.forecast, factor));
    const stateMean = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0;
    const dayMean = data.length
      ? data.reduce((s, d) => {
          const p = footfallPoints(d.forecast);
          const fut = p.slice(forecastStart(p)).map((x) => x.predicted ?? 0);
          return s + (fut.length ? fut.reduce((a, b) => a + b, 0) / fut.length : 0);
        }, 0) / data.length
      : 0;
    const busiest = data.reduce((a, b) => (peakOf(b.forecast) > peakOf(a.forecast) ? b : a), data[0]);
    return {
      pts,
      start,
      tomorrow: tomorrowOf(current.forecast, factor),
      stateMean,
      stateTomorrow: all.reduce((a, b) => a + b, 0),
      weekTotal: Math.round(pts.slice(start).reduce((s, p) => s + (p.predicted ?? 0), 0) * factor),
      dayMean: dayMean * factor,
      tomorrowLabel: pts[start]?.day ?? "tomorrow",
      busiest,
      maxTomorrow: Math.max(0, ...all),
    };
  }, [current, data, factor]);

  if (!current || !model) {
    return (
      <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
        <PageHeader eyebrow="Footfall" title="Footfall forecast studio" className="mb-2" />
        {loading ? <Skeleton className="min-h-0 flex-1" /> : <p className="text-[13px] text-muted">No footfall forecast is available.</p>}
      </div>
    );
  }

  const name = shortDistrict(current.districtId);
  const scaledPts = model.pts.map((p, i) => ({ ...p, predicted: p.predicted === null ? null : Math.round(p.predicted * (i >= model.start ? factor : 1)) }));
  const spark = scaledPts.map((p) => p.predicted ?? 0);
  const bd = current.forecast.tomorrow_breakdown;
  const bdTotal = Object.values(bd).reduce((a, b) => a + b, 0);
  const emergencyShare = bdTotal > 0 ? Math.round(((bd.emergency ?? 0) / bdTotal) * 100) : 0;
  const topGroup = Object.entries(bd).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "general";
  const fanHeight = Math.max(160, (fanBody.height || 320) - 108);

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
      <PageHeader
        eyebrow="Footfall"
        title="Footfall forecast studio"
        className="mb-2"
        description="Predicted outpatient visits for the coming week, with the uncertainty shown as a band and the scenario named."
        actions={
          <>
            <Select
              value={current.districtId}
              onValueChange={setPick}
              ariaLabel="District"
              options={DISTRICT_ORDER.map((d) => ({ value: d, label: shortDistrict(d) }))}
            />
            <ScenarioSwitch value={scenario} onChange={setScenario} label="Footfall scenario" />
          </>
        }
      />

      {/* KPI band: the state-of-play numbers for the selected district */}
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-5">
        <Moneyshot
          tone="brand"
          value={model.tomorrow}
          unit="visits"
          label={`${name}, ${model.tomorrowLabel}`}
          note={`${model.tomorrow >= model.stateMean ? "Above" : "Below"} the five district mean of ${Math.round(model.stateMean)}.`}
          className="col-span-2"
        />
        <KpiTile label="State visits tomorrow" value={model.stateTomorrow} sparkline={data.map((d) => tomorrowOf(d.forecast, 1))} hint="Sum of the five districts" className="p-2.5" />
        <KpiTile label={`${name} next 7 days`} value={model.weekTotal} sparkline={spark} hint="Predicted visits in the window" className="p-2.5" />
        <KpiTile label="Emergency share" value={emergencyShare} unit="%" tone={emergencyShare > 15 ? "warning" : "default"} hint="Of tomorrow's predicted visits" className="p-2.5" />
      </div>

      {/* Dense row: daily forecast, tomorrow breakdown and the district-by-day calendar, all at once */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
        <InsightCard
          className="min-h-0 lg:col-span-6"
          eyebrow={`Daily visits, ${name}`}
          title={footfallTitle(name, scaledPts, model.dayMean)}
          source={SOURCE}
          section="Footfall / Forecast"
          actions={<Callout>Confidence {current.forecast.confidence}%</Callout>}
          bodyClassName="min-h-0 flex-1 overflow-hidden"
        >
          <div ref={fanBodyRef} className="flex h-full flex-col">
            <FanChart forecast={current.forecast} factor={factor} height={fanHeight} />
            <AssumptionRow active={scenario} />
          </div>
        </InsightCard>

        <InsightCard
          className="min-h-0 lg:col-span-3"
          eyebrow="Tomorrow breakdown"
          title={`${name} sees ${model.tomorrow} visits, led by ${topGroup} cases`}
          source="Source: footfall model, tomorrow breakdown by patient group"
          section="Footfall / Tomorrow"
          bodyClassName="min-h-0 flex-1 overflow-auto"
        >
          <TomorrowBreakdown breakdown={bd} factor={factor} />
          <div className="mt-3 border-t border-border pt-2">
            <p className="mb-1.5 text-[11px] font-medium text-muted">Forecast drivers, model confidence {current.forecast.confidence}%</p>
            <FactorChips factors={current.forecast.factors} />
          </div>
        </InsightCard>

        <InsightCard
          className="min-h-0 lg:col-span-3"
          eyebrow="District by day calendar"
          title={`${shortDistrict(model.busiest.districtId)} carries the heaviest single day at ${peakOf(model.busiest.forecast)} visits`}
          source={SOURCE}
          section="Footfall / Calendar"
          bodyClassName="min-h-0 flex-1 overflow-auto"
        >
          <FootfallCalendar data={visible.length ? visible : data} selected={current.districtId} factor={factor} onSelect={setPick} />
        </InsightCard>
      </div>

      {/* Five district comparison strip, always visible rather than tabbed away */}
      <div className="shrink-0">
        <p className="mb-1.5 text-[11px] text-faint">
          Tomorrow&apos;s load peaks at <span className="num font-semibold text-text">{model.maxTomorrow}</span> visits. Grey bars are observed days, blue bars are forecast; click a district to load it above.
        </p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {data.map((d) => (
            <DistrictMultiple
              key={d.districtId}
              districtId={d.districtId}
              forecast={d.forecast}
              factor={factor}
              stateMean={model.stateMean}
              active={d.districtId === current.districtId}
              onSelect={() => setPick(d.districtId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
