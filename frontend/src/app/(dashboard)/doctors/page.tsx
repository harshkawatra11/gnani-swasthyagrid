"use client";

import { useMemo } from "react";
import { PageHeader } from "@/components/ds/PageHeader";
import { KpiTile } from "@/components/ds/KpiTile";
import { PagerBar } from "@/components/ds/PagerBar";
import { Skeleton } from "@/components/ds/Skeleton";
import { useDoctors } from "@/lib/api/hooks";
import { useScope } from "@/lib/scope";
import { useElementSize } from "@/lib/use-element-size";
import { usePager } from "@/lib/use-pager";
import { AbsenceRanking, AttendanceCalendar, DelayBars } from "@/components/operations/DoctorsPanels";
import { Callout, InsightCard, Moneyshot, StatPill, useFacRefs } from "@/components/operations/kit";
import { DISTRICT_ORDER, WEEKDAYS, doctorsTitle, enrichDoctors, mean, shortDistrict } from "@/components/operations/derive";

const SOURCE = "Source: SwasthyaGrid attendance seed data. Absence likelihood is modelled from the recorded pattern";
// The calendar's own header-day row and legend row sit outside the paged grid; this is the
// vertical space they (plus gaps) take, reserved before splitting what's left across rows.
const CAL_CHROME_PX = 86;
const CAL_ROW_PX = 30;

export default function DoctorsPage() {
  const { scope } = useScope();
  const { data, isLoading } = useDoctors(scope);
  const { refs } = useFacRefs(scope);
  const [calBodyRef, calBody] = useElementSize<HTMLDivElement>();
  const [delayBodyRef, delayBody] = useElementSize<HTMLDivElement>();

  const rows = useMemo(() => enrichDoctors(data?.doctors ?? [], refs).filter((r) => scope === "all" || r.districtKey === scope), [data, refs, scope]);

  const s = useMemo(() => {
    const high = rows.filter((r) => r.risk_level === "high");
    const perDay = WEEKDAYS.map((_, i) => rows.filter((r) => r.week[i] > 0.4).length);
    const worstDay = perDay.indexOf(Math.max(...perDay));
    const per = (fn: (rs: typeof rows) => number) => DISTRICT_ORDER.map((d) => fn(rows.filter((r) => r.districtKey === d)));
    return {
      high,
      perDay,
      worstDay,
      avgDelay: mean(rows.map((r) => r.patient_delay_pct)),
      maxDelay: Math.max(0, ...rows.map((r) => r.patient_delay_pct)),
      sparkHigh: per((rs) => rs.filter((r) => r.risk_level === "high").length),
      sparkDelay: per((rs) => mean(rs.map((r) => r.patient_delay_pct))),
      sparkN: per((rs) => rs.length),
    };
  }, [rows]);

  // Attendance calendar: page the doctors (worst-first, matching the component's own sort) rather
  // than shrinking rows past readability, so the heat values stay legible at any screen height.
  const sortedDocRows = useMemo(() => [...rows].sort((a, b) => b.score - a.score), [rows]);
  const calAvail = Math.max(90, (calBody.height || 260) - CAL_CHROME_PX);
  const calPageSize = Math.max(3, Math.floor(calAvail / CAL_ROW_PX));
  const calPager = usePager(sortedDocRows, calPageSize);

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
        <PageHeader eyebrow="Doctors" title="Roster and attendance" className="mb-2" />
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
  const calCell = Math.min(40, Math.max(24, Math.floor(calAvail / Math.max(1, calPager.slice.length))));
  const delayHeight = Math.max(160, (delayBody.height || 320) - 4);

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
      <PageHeader
        eyebrow="Doctors"
        title="Roster and attendance"
        className="mb-2"
        description={`Attendance risk for ${rows.length} monitored doctors in ${scopeName}, by weekday.`}
        actions={
          <Moneyshot
            value={s.high.length}
            unit="high risk"
            label="High absence risk"
            note={`Of ${rows.length} doctors, worst weekday ${WEEKDAYS[s.worstDay]} with ${s.perDay[s.worstDay]} likely absent.`}
            className="min-w-[260px]"
          />
        }
      />

      {/* KPI band */}
      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label="Doctors monitored" value={rows.length} sparkline={s.sparkN} hint="With an attendance record" className="p-2.5" />
        <KpiTile label="High risk" value={s.high.length} tone="critical" sparkline={s.sparkHigh} hint="Repeated absences on one weekday" className="p-2.5" />
        <KpiTile label="Average patient delay" value={Math.round(s.avgDelay)} unit="%" tone="warning" sparkline={s.sparkDelay} hint="Patients waiting past slot" className="p-2.5" />
        <KpiTile label="Likely absent Monday" value={s.perDay[0]} sparkline={s.perDay} hint="Doctors over 40% likelihood" className="p-2.5" />
      </div>

      {/* Dense row: attendance calendar, absence ranking and patient delay, all at once */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-12">
        <InsightCard
          className="min-h-0 lg:col-span-6"
          eyebrow="Attendance heat calendar"
          title={doctorsTitle(rows)}
          source={SOURCE}
          section="Doctors / Calendar"
          actions={
            <span className="flex items-center gap-2">
              <StatPill label="Avg delay" value={`${Math.round(s.avgDelay)}%`} tone={s.avgDelay > 20 ? "warning" : undefined} />
              {s.high[0] && <Callout tone="critical">Watch: {s.high[0].doctor_name}</Callout>}
              <PagerBar pager={calPager} />
            </span>
          }
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div ref={calBodyRef} className="min-h-0 flex-1 overflow-hidden">
            <AttendanceCalendar rows={calPager.slice} cellPx={calCell} />
          </div>
        </InsightCard>

        <InsightCard
          className="min-h-0 lg:col-span-3"
          eyebrow="Absence risk ranking"
          title={s.high[0] ? `${s.high[0].doctor_name} at ${s.high[0].facilityLabel} ranks first` : "No doctor is ranked at risk"}
          source="Source: risk level, weekday pattern and patient delay combined (0 to 100)"
          section="Doctors / Ranking"
          bodyClassName="min-h-0 flex-1 overflow-auto"
        >
          <AbsenceRanking rows={rows} />
        </InsightCard>

        <InsightCard
          className="min-h-0 lg:col-span-3"
          eyebrow="Patient delay"
          title={`Patient waits reach ${s.maxDelay}% where absence risk is high`}
          source={SOURCE}
          section="Doctors / Delay"
          bodyClassName="min-h-0 flex-1 overflow-hidden"
        >
          <div ref={delayBodyRef} className="h-full">
            <DelayBars rows={rows} height={delayHeight} />
          </div>
        </InsightCard>
      </div>
    </div>
  );
}
