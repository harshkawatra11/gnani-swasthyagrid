"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LiveDot } from "@/components/ds/LiveDot";
import { useClock, useFacilities, useLogisticsKpis, useShipment, useShipments, useWarehouses } from "@/lib/api/hooks";
import { useLiveSimNow, useLiveState } from "@/lib/live/LiveProvider";
import { fmtDateTime } from "@/lib/format";
import { useScope } from "@/lib/scope";
import type { MapFacility } from "@/components/map/FacilityLayer";
import type { MapWarehouse } from "@/components/map/WarehouseLayer";
import { DispatchMap } from "./DispatchMap";
import { DispatchRail } from "./DispatchRail";
import { StatusOverviewCard, VehiclesInTransitCard } from "./SmallCards";
import { VolumeCard } from "./VolumeCard";
import { dispatchTitle } from "./helpers";

export function DispatchView() {
  const { scope } = useScope();
  const district = scope === "all" ? undefined : scope;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: kpis } = useLogisticsKpis(scope);
  const { data: ship } = useShipments({ district_id: district, limit: 200, sort: "created_at" });
  const { data: wh } = useWarehouses(scope);
  const { data: fac } = useFacilities(scope);
  const { data: detail } = useShipment(selectedId);
  const { data: clock } = useClock();
  const liveState = useLiveState();
  const liveSim = useLiveSimNow();
  const simNow = liveSim ?? clock?.sim_now ?? null;

  const shipments = useMemo(() => ship?.items ?? [], [ship]);
  const warehouses = useMemo<MapWarehouse[]>(
    () => (wh?.items ?? []).map((w) => ({ id: w.id, name: w.name, lat: w.lat, lng: w.lng, central: w.type === "central" })),
    [wh],
  );
  const facilities = useMemo<MapFacility[]>(
    () => (fac?.facilities ?? []).map((f) => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng, risk: f.risk_level })),
    [fac],
  );

  return (
    <div className="flex flex-col gap-3 lg:h-[calc(100dvh-136px)] lg:overflow-hidden">
      <h1 className="sr-only">Dispatch: live shipment map</h1>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-muted">
          <Link href="/command" className="hover:text-text">
            Dashboard
          </Link>
          <span className="text-faint">/</span>
          <span className="font-medium text-text">Shipment map</span>
          <span className="ml-3 hidden text-[12px] text-faint md:inline">{dispatchTitle(kpis)}</span>
        </nav>
        <div className="num flex items-center gap-2 text-[12px] text-muted">
          <LiveDot state={liveState} />
          <span>{liveState === "live" ? "LIVE" : liveState === "stale" ? "STALE" : "OFFLINE"}</span>
          {simNow && <span data-testid="sim-clock">Sim {fmtDateTime(simNow)} IST{clock?.scale ? `, x${clock.scale}` : ""}</span>}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <div className="h-[340px] lg:h-auto lg:min-h-0 lg:flex-1">
            <DispatchMap
              shipments={shipments}
              kpis={kpis}
              warehouses={warehouses}
              facilities={facilities}
              selectedId={selectedId}
              onSelect={setSelectedId}
              detail={detail}
              fill
            />
          </div>
          <div className="grid shrink-0 gap-3 md:grid-cols-3">
            <VolumeCard compact />
            <StatusOverviewCard />
            <VehiclesInTransitCard />
          </div>
        </div>
        <DispatchRail shipments={shipments} total={ship?.total ?? shipments.length} simNow={simNow} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  );
}
