export type RiskLevel = "healthy" | "monitor" | "stress" | "critical";

export interface Facility {
  id: string;
  name: string;
  type: "PHC" | "CHC";
  lat: number;
  lng: number;
  riskLevel: RiskLevel;
  performance: {
    overall: number;
    inventory: number;
    attendance: number;
    diagnostics: number;
    patientWait: number;
    forecastAccuracy: number;
  };
}

export interface Recommendation {
  id: string;
  type: "stock_transfer" | "staff_transfer" | "bed_redirect" | "diagnostic_redirect";
  sourceFacilityId: string;
  targetFacilityId: string;
  subject: string;
  quantityOrDetail: string;
  confidence: number;
  reasons: string[];
  status: "pending" | "approved" | "rejected" | "modified";
}

export interface Alert {
  id: string;
  facilityId: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
}

export interface ForecastPoint {
  day: string;
  predicted: number;
  actual?: number;
}

export const facilities: Facility[] = [
  { id: "phc_18", name: "PHC Rural-14", type: "PHC", lat: 26.912, lng: 75.7873, riskLevel: "critical", performance: { overall: 58, inventory: 41, attendance: 62, diagnostics: 70, patientWait: 55, forecastAccuracy: 91 } },
  { id: "phc_12", name: "PHC Sector-12", type: "PHC", lat: 26.95, lng: 75.82, riskLevel: "healthy", performance: { overall: 88, inventory: 94, attendance: 85, diagnostics: 90, patientWait: 82, forecastAccuracy: 95 } },
  { id: "chc_east", name: "CHC East", type: "CHC", lat: 26.88, lng: 75.85, riskLevel: "monitor", performance: { overall: 74, inventory: 78, attendance: 68, diagnostics: 80, patientWait: 70, forecastAccuracy: 89 } },
  { id: "phc_09", name: "PHC Nindar", type: "PHC", lat: 26.83, lng: 75.75, riskLevel: "stress", performance: { overall: 66, inventory: 60, attendance: 71, diagnostics: 58, patientWait: 65, forecastAccuracy: 87 } },
  { id: "phc_04", name: "PHC Bassi", type: "PHC", lat: 26.97, lng: 75.72, riskLevel: "healthy", performance: { overall: 91, inventory: 93, attendance: 90, diagnostics: 92, patientWait: 88, forecastAccuracy: 96 } },
  { id: "phc_21", name: "PHC Chaksu", type: "PHC", lat: 26.79, lng: 75.94, riskLevel: "monitor", performance: { overall: 76, inventory: 80, attendance: 66, diagnostics: 77, patientWait: 73, forecastAccuracy: 90 } },
  { id: "chc_north", name: "CHC North", type: "CHC", lat: 27.01, lng: 75.83, riskLevel: "healthy", performance: { overall: 85, inventory: 88, attendance: 82, diagnostics: 86, patientWait: 80, forecastAccuracy: 93 } },
  { id: "phc_27", name: "PHC Phagi", type: "PHC", lat: 26.7, lng: 75.5, riskLevel: "stress", performance: { overall: 63, inventory: 55, attendance: 70, diagnostics: 62, patientWait: 60, forecastAccuracy: 85 } },
];

export const recommendations: Recommendation[] = [
  {
    id: "rec_001",
    type: "stock_transfer",
    sourceFacilityId: "phc_12",
    targetFacilityId: "phc_18",
    subject: "Paracetamol",
    quantityOrDetail: "250 strips",
    confidence: 96,
    reasons: [
      "Projected stock depletion in 3.4 days",
      "Rain forecast increasing fever cases districtwide",
      "Recent dengue cluster trend near PHC Rural-14",
      "PHC Sector-12 holds 650 strips surplus, 6 km away",
    ],
    status: "pending",
  },
  {
    id: "rec_002",
    type: "stock_transfer",
    sourceFacilityId: "phc_04",
    targetFacilityId: "phc_18",
    subject: "ORS Packets",
    quantityOrDetail: "450 packets",
    confidence: 92,
    reasons: [
      "ORS reserves at 2 days remaining",
      "Heatwave forecast next 5 days (+72% demand)",
      "PHC Bassi has 1,100 packets in surplus, 9 km away",
    ],
    status: "pending",
  },
  {
    id: "rec_003",
    type: "bed_redirect",
    sourceFacilityId: "phc_09",
    targetFacilityId: "chc_east",
    subject: "Maternity Cases",
    quantityOrDetail: "Redirect new admissions",
    confidence: 88,
    reasons: [
      "Bed occupancy forecast: 96% next week at PHC Nindar",
      "CHC East has maternity capacity slack of 34%",
    ],
    status: "pending",
  },
  {
    id: "rec_004",
    type: "staff_transfer",
    sourceFacilityId: "chc_north",
    targetFacilityId: "phc_27",
    subject: "Dr. Meera Singh (General Physician)",
    quantityOrDetail: "Temporary 2-week transfer",
    confidence: 81,
    reasons: [
      "Doctor absent 5 consecutive Mondays at PHC Phagi",
      "Projected patient delay of 38% if unresolved",
      "CHC North has attendance slack this cycle",
    ],
    status: "approved",
  },
  {
    id: "rec_005",
    type: "stock_transfer",
    sourceFacilityId: "chc_north",
    targetFacilityId: "phc_27",
    subject: "Anti-Snake Venom (ASV)",
    quantityOrDetail: "6 vials",
    confidence: 52,
    reasons: [
      "Projected stock depletion in 2.0 days",
      "Historical consumption trend for snakebite cases",
      "CHC North has surplus, 48 km away — confidence lowered by distance",
    ],
    status: "pending",
  },
];

export const alerts: Alert[] = [
  { id: "al_1", facilityId: "phc_18", severity: "critical", title: "ORS — 2 days remaining", detail: "Heatwave forecast pushing demand +72%. Recommend transferring stock today." },
  { id: "al_2", facilityId: "phc_09", severity: "warning", title: "Bed occupancy trending to 96%", detail: "Next week's forecast breaches safe capacity for maternity ward." },
  { id: "al_3", facilityId: "phc_27", severity: "warning", title: "Doctor absence pattern detected", detail: "Dr. Meera Singh absent 5 consecutive Mondays — 38% patient delay risk." },
  { id: "al_4", facilityId: "phc_21", severity: "info", title: "X-Ray unit under maintenance", detail: "Nearest alternative: CHC North, 4 km away." },
  { id: "al_5", facilityId: "phc_27", severity: "critical", title: "Anti-Snake Venom — 2 days remaining", detail: "Nearest surplus is 48 km away at CHC North; recommend expedited transfer today." },
  { id: "al_6", facilityId: "phc_18", severity: "critical", title: "Adrenaline (Epinephrine) — 2.5 days remaining", detail: "No district surplus available for this crash-cart drug; flag for emergency procurement." },
];

export const footfallForecast: ForecastPoint[] = [
  { day: "Mon", actual: 182, predicted: 178 },
  { day: "Tue", actual: 191, predicted: 188 },
  { day: "Wed", actual: 176, predicted: 181 },
  { day: "Thu", actual: 203, predicted: 198 },
  { day: "Fri", actual: 197, predicted: 201 },
  { day: "Sat", predicted: 212 },
  { day: "Sun", predicted: 218 },
];

export const footfallBreakdown = [
  { label: "Children", value: 38 },
  { label: "Women", value: 91 },
  { label: "Elderly", value: 42 },
  { label: "Emergency", value: 18 },
  { label: "General", value: 29 },
];

export const causalChain = {
  headline: "Why medicine demand increased this week",
  chain: ["Rainfall across the district", "Dengue cluster reported near Rural-14", "Local schools reopened", "Higher fever-case footfall"],
};

export const districtKpis = {
  todaysRisk: { value: "2 Critical", detail: "PHC Rural-14, PHC Phagi" },
  footfall: { value: 218, confidence: 91 },
  bedOccupancy: { value: "82%", nextWeek: "96%" },
  doctorsAbsent: { value: 1, detail: "Dr. Meera Singh, PHC Phagi" },
  medicineRisk: { value: 3, detail: "ORS, Adrenaline, ASV below safety stock" },
};

export function facilityById(id: string): Facility | undefined {
  return facilities.find((f) => f.id === id);
}

export const riskColor: Record<RiskLevel, string> = {
  healthy: "var(--color-risk-healthy)",
  monitor: "var(--color-risk-monitor)",
  stress: "var(--color-risk-stress)",
  critical: "var(--color-risk-critical)",
};

export const riskLabel: Record<RiskLevel, string> = {
  healthy: "Healthy",
  monitor: "Monitor",
  stress: "Resource Stress",
  critical: "Critical",
};

const riskOrder: RiskLevel[] = ["critical", "stress", "monitor", "healthy"];

export function downgradeRisk(level: RiskLevel): RiskLevel {
  const idx = riskOrder.indexOf(level);
  return riskOrder[Math.min(idx + 1, riskOrder.length - 1)];
}
