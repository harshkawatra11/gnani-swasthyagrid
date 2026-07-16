import hashlib
import json
import logging
import time
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import FacilityNotFoundError

logger = logging.getLogger("swasthyagrid")

REFRESH_TTL_SECONDS = 20

FIRESTORE_COLLECTIONS = (
    "facilities",
    "medicine_stock",
    "beds",
    "doctors",
    "diagnostics",
)


class DistrictRepository:
    """Abstracts the district data store.

    Tries live Firestore first (the CRM's source of truth); if Firestore is
    unreachable or empty (e.g. not yet seeded), falls back to the bundled
    seed JSON so the app always has something to serve. Data is refreshed on
    a short TTL so edits made in the CRM propagate into forecasts and
    recommendations without a backend restart.
    """

    def __init__(self, seed_path: Path):
        self._seed_path = seed_path
        self._data: dict[str, Any] = self._load_json()
        self._version = 0
        self._last_refresh = time.monotonic()
        self._firestore_client = None
        self._firestore_unavailable = False
        self._try_refresh_from_firestore(force=True)

    def _load_json(self) -> dict[str, Any]:
        with open(self._seed_path, encoding="utf-8") as f:
            return json.load(f)

    def _get_firestore_client(self):
        if self._firestore_unavailable:
            return None
        if self._firestore_client is not None:
            return self._firestore_client
        try:
            from google.cloud import firestore

            self._firestore_client = firestore.Client()
            return self._firestore_client
        except Exception:
            logger.info("Firestore unavailable, using bundled seed JSON.", exc_info=True)
            self._firestore_unavailable = True
            return None

    def _load_from_firestore(self) -> dict[str, Any] | None:
        client = self._get_firestore_client()
        if client is None:
            return None
        try:
            data: dict[str, Any] = {}
            for name in FIRESTORE_COLLECTIONS:
                docs = [d.to_dict() | {"_doc_id": d.id} for d in client.collection(name).stream()]
                data[name] = docs

            if not data.get("facilities"):
                # Firestore not seeded yet — stay on JSON fallback.
                return None

            # Fields not yet CRM-editable stay sourced from the JSON seed.
            base = self._load_json()
            data["district"] = base["district"]
            data["footfall_forecast"] = base["footfall_forecast"]
            data["footfall_breakdown_tomorrow"] = base["footfall_breakdown_tomorrow"]
            data["causal_chain"] = base["causal_chain"]
            data["demand_factors"] = base.get("demand_factors", {})

            # normalize CRM-authored medicine_stock doc ids into `id`
            for m in data["medicine_stock"]:
                m["id"] = m.pop("_doc_id", None) or m.get("id")
            for d in data["doctors"]:
                d["doctor_id"] = d.pop("_doc_id", None) or d.get("doctor_id")
            for f in data["facilities"]:
                f["id"] = f.pop("_doc_id", None) or f.get("id")

            return data
        except Exception:
            logger.warning("Failed to read Firestore, using bundled seed JSON.", exc_info=True)
            return None

    def _try_refresh_from_firestore(self, force: bool = False) -> None:
        now = time.monotonic()
        if not force and (now - self._last_refresh) < REFRESH_TTL_SECONDS:
            return
        self._last_refresh = now

        fresh = self._load_from_firestore()
        if fresh is None:
            return

        new_hash = hashlib.sha256(json.dumps(fresh, sort_keys=True, default=str).encode()).hexdigest()
        old_hash = getattr(self, "_data_hash", None)
        if new_hash != old_hash:
            self._data = fresh
            self._data_hash = new_hash
            self._version += 1

    @property
    def version(self) -> int:
        self._try_refresh_from_firestore()
        return self._version

    @property
    def district(self) -> dict[str, Any]:
        self._try_refresh_from_firestore()
        return self._data["district"]

    @property
    def facilities(self) -> list[dict[str, Any]]:
        self._try_refresh_from_firestore()
        return self._data["facilities"]

    def facility(self, facility_id: str) -> dict[str, Any]:
        for f in self.facilities:
            if f["id"] == facility_id:
                return f
        raise FacilityNotFoundError(facility_id)

    @property
    def medicine_stock(self) -> list[dict[str, Any]]:
        self._try_refresh_from_firestore()
        return self._data["medicine_stock"]

    def medicine_stock_for(self, facility_id: str) -> list[dict[str, Any]]:
        return [m for m in self.medicine_stock if m["facility_id"] == facility_id]

    @property
    def beds(self) -> list[dict[str, Any]]:
        self._try_refresh_from_firestore()
        return self._data["beds"]

    @property
    def doctors(self) -> list[dict[str, Any]]:
        self._try_refresh_from_firestore()
        return self._data["doctors"]

    @property
    def diagnostics(self) -> list[dict[str, Any]]:
        self._try_refresh_from_firestore()
        return self._data["diagnostics"]

    @property
    def footfall_forecast(self) -> list[dict[str, Any]]:
        return self._data["footfall_forecast"]

    @property
    def footfall_breakdown_tomorrow(self) -> dict[str, Any]:
        return self._data["footfall_breakdown_tomorrow"]

    @property
    def causal_chain(self) -> dict[str, Any]:
        return self._data["causal_chain"]

    def demand_factors_for(self, facility_id: str) -> list[str]:
        return self._data.get("demand_factors", {}).get(facility_id, [])


@lru_cache
def get_district_repository() -> DistrictRepository:
    return DistrictRepository(get_settings().seed_data_path)
