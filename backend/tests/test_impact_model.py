from app.impact.model import compute


def test_facilities_total():
    assert compute()["facilities"] == 38241


def test_baseline_stock_out_days():
    assert compute()["baseline_stock_out_days"] == 27162200


def test_base_scenario_avoided_days():
    assert compute()["scenarios"]["base"]["days_avoided"] == 13581100


def test_bull_scenario_avoided_days():
    assert compute()["scenarios"]["bull"]["days_avoided"] == 21729760


def test_base_availability_after():
    assert compute()["scenarios"]["base"]["availability_after"] == 0.861


def test_sensitivity_grid_floor():
    # Every cell of the availability x cut grid clears 58.6 lakh (5,860,000) days avoided.
    grid = compute()["sensitivity_days_avoided"]
    for row in grid.values():
        for value in row.values():
            assert value >= 5_860_000
