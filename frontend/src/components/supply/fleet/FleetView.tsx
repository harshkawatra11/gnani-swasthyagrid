"use client";

import { useMemo, useState } from "react";
import { KpiTile } from "@/components/ds/KpiTile";
import { PageHeader } from "@/components/ds/PageHeader";
import { Skeleton } from "@/components/ds/Skeleton";
import { runPlanner } from "@/lib/api/mutations";
import { useShipment, useShipments, useVehicle, useVehicles } from "@/lib/api/hooks";
import { fmtPct } from "@/lib/format";
import { useScope } from "@/lib/scope";
import { fleetKpis, fleetTitle, planningQueue } from "../lib/metrics";
import { FillColumn } from "../lib/parts";
import { DriverCam } from "./DriverCam";
import { ShipmentQueue } from "./ShipmentQueue";
import { TruckVisualization } from "./TruckVisualization";
import { VehicleList } from "./VehicleList";

export function FleetView() {
  const { scope } = useScope();
  const district = scope === "all" ? undefined : scope;
  const { data: vdata, isLoading } = useVehicles({ district_id: district });
  const vehicles = useMemo(() => vdata?.items ?? [], [vdata]);
  const { data: queueData } = useShipments({ status: "recommended,approved", district_id: district, limit: 100, sort: "priority" });
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const kpis = useMemo(() => fleetKpis(vehicles), [vehicles]);
  const queue = useMemo(() => planningQueue(queueData?.items ?? []), [queueData]);

  const defaultId = useMemo(
    () => (vehicles.find((v) => v.current_shipment_id)?.id ?? vehicles[0]?.id ?? null),
    [vehicles],
  );
  const selectedId = picked && vehicles.some((v) => v.id === picked) ? picked : defaultId;
  const { data: detail } = useVehicle(selectedId);
  const { data: activeShipment } = useShipment(detail?.current_shipment_id ?? null);

  async function plan() {
    setBusy(true);
    await runPlanner();
    setBusy(false);
  }

  if (isLoading && vehicles.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Supply chain / Fleet" title="Fleet" />
        <div className="grid gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-4 h-96" />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Supply chain / Fleet" title={fleetTitle(kpis)} description="Trucks Management: every vehicle, what it carries and when it is next free." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Vehicles" value={kpis.total} hint="Fleet in scope" />
        <KpiTile label="In use" value={kpis.inUse} hint="Loading, moving or returning" />
        <KpiTile label="Available" value={kpis.available} tone="good" hint="Ready to dispatch" />
        <KpiTile label="Maintenance" value={kpis.maintenance} tone={kpis.maintenance > 0 ? "warning" : "default"} hint="Out of service" />
        <KpiTile label="Service due" value={kpis.serviceDue} tone={kpis.serviceDue > 0 ? "warning" : "default"} hint="Past 15,000 km" />
        <KpiTile label="Avg utilisation" value={fmtPct(kpis.avgUtilisation, 1)} hint="Share of 7 days on trips" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)_270px]">
        <FillColumn minHeight={420}><VehicleList vehicles={vehicles} selectedId={selectedId} onSelect={setPicked} /></FillColumn>
        <div className="min-w-0 space-y-4">
          <TruckVisualization vehicle={detail ?? undefined} />
          {detail && (
            <DriverCam
              driverName={activeShipment?.driver?.name ?? null}
              moving={detail.live_status === "in_transit" || detail.live_status === "delayed"}
            />
          )}
        </div>
        <FillColumn minHeight={420} className="lg:col-span-2 xl:col-span-1">
          <ShipmentQueue queue={queue} busy={busy} onAutoAssign={plan} onLoad={() => void plan()} />
        </FillColumn>
      </div>
    </>
  );
}
