"""National impact model (Team IdeaForge). Deterministic, no inputs, no network.

Stock-out days = facilities x tracer medicines x 365 x (1 - availability).
Avoided days  = stock-out days x cut.  Availability after = a + (1 - a) x cut.

Inputs:
  facilities   31,882 PHCs + 6,359 CHCs (MoHFW Health Dynamics of India 2022-23, 31 Mar 2023)
  tracer meds  7 (the prototype catalogue: Adrenaline, ARV, ASV, ORS, Oxytocin, Paracetamol, Tetanus Toxoid)
  availability 66% low, 72.2% mid, 80% high (PMC8654139: 50 key medicines, 10 public facilities)
  cut          30% bear, 50% base, 80% bull (bull = eVIN's reported stock-out reduction, UNDP)

Assumption: point-in-time non-availability approximates the share of item-days out of stock.
This is an estimate from a stated model, not a measured outcome.
"""

from __future__ import annotations

PHC = 31882
CHC = 6359
FACILITIES = PHC + CHC
TRACER_MEDICINES = 7
DAYS_PER_YEAR = 365

AVAILABILITY = {"low": 0.66, "mid": 0.722, "high": 0.80}
CUT = {"bear": 0.30, "base": 0.50, "bull": 0.80}


def stock_out_days(availability: float) -> float:
    return FACILITIES * TRACER_MEDICINES * DAYS_PER_YEAR * (1 - availability)


def availability_after(availability: float, cut: float) -> float:
    return availability + (1 - availability) * cut


def compute() -> dict:
    baseline = stock_out_days(AVAILABILITY["mid"])
    scenarios = {
        name: {
            "cut_pct": round(cut * 100),
            "days_avoided": round(baseline * cut),
            "availability_after": round(availability_after(AVAILABILITY["mid"], cut), 4),
        }
        for name, cut in CUT.items()
    }
    sensitivity = {
        avail_name: {
            cut_name: round(stock_out_days(avail_value) * cut_value)
            for cut_name, cut_value in CUT.items()
        }
        for avail_name, avail_value in AVAILABILITY.items()
    }
    return {
        "facilities": FACILITIES,
        "phc": PHC,
        "chc": CHC,
        "tracer_medicines": TRACER_MEDICINES,
        "facility_medicine_lines": FACILITIES * TRACER_MEDICINES,
        "baseline_availability": AVAILABILITY["mid"],
        "baseline_stock_out_days": round(baseline),
        "scenarios": scenarios,
        "sensitivity_days_avoided": sensitivity,
        "sources": {
            "facilities": "MoHFW Health Dynamics of India 2022-23 (31 Mar 2023)",
            "availability": "PMC8654139 (50 key medicines, 10 public facilities)",
            "bull_cut": "UNDP eVIN: 80% reported reduction in vaccine stock-outs",
        },
    }
