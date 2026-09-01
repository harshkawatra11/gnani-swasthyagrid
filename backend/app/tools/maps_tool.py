"""
Smart Health AI Platform — Gemini Tool: Nearby PHC Finder

Uses Google Maps API to find the nearest Primary Health Centres
based on user GPS coordinates.
"""

from __future__ import annotations

import logging
import math

import httpx
from tenacity import Retrying, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import get_settings
from app.core.exceptions import MapsAPIException

logger = logging.getLogger(__name__)

# Google Places API endpoint
PLACES_NEARBY_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS coordinates in kilometres."""
    R = 6371  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def find_nearby_phc(
    latitude: float,
    longitude: float,
    radius_km: int = 10,
) -> dict:
    """
    Find nearest PHCs and hospitals using Google Maps Places API.

    Args:
        latitude: User's latitude.
        longitude: User's longitude.
        radius_km: Search radius in kilometres.

    Returns:
        dict with 'places' list and 'summary' string.
    """
    settings = get_settings()
    api_key = settings.google_maps_api_key

    if not api_key or api_key == "test-maps-key":
        logger.warning("Google Maps API key not configured — returning mock data")
        return _mock_nearby_response(latitude, longitude, radius_km)

    try:
        radius_meters = radius_km * 1000

        for attempt in Retrying(
            reraise=True,
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=0.5, min=1, max=5),
            retry=retry_if_exception_type(httpx.HTTPError),
            before_sleep=lambda retry_state: logger.warning(
                f"Maps API HTTP request failed. Retrying... attempt={retry_state.attempt_number}"
            ),
        ):
            with attempt, httpx.Client(timeout=10.0) as client:
                response = client.get(
                    PLACES_NEARBY_URL,
                    params={
                        "location": f"{latitude},{longitude}",
                        "radius": radius_meters,
                        "keyword": "primary health centre PHC hospital",
                        "key": api_key,
                    },
                )
                response.raise_for_status()
                data = response.json()

        if data.get("status") not in ("OK", "ZERO_RESULTS"):
            raise MapsAPIException(f"Maps API returned status: {data.get('status')}")

        results = data.get("results", [])
        places = []

        for place in results[:10]:  # Limit to 10 results
            loc = place.get("geometry", {}).get("location", {})
            place_lat = loc.get("lat", 0)
            place_lon = loc.get("lng", 0)
            distance = _haversine_distance(latitude, longitude, place_lat, place_lon)

            places.append(
                {
                    "name": place.get("name", ""),
                    "address": place.get("vicinity", ""),
                    "place_id": place.get("place_id", ""),
                    "latitude": place_lat,
                    "longitude": place_lon,
                    "distance_km": distance,
                    "rating": place.get("rating"),
                    "open_now": place.get("opening_hours", {}).get("open_now"),
                    "maps_url": (
                        f"https://www.google.com/maps/place/?q=place_id:{place.get('place_id', '')}"
                    ),
                }
            )

        # Sort by distance
        places.sort(key=lambda p: p["distance_km"])

        summary = (
            f"Found {len(places)} healthcare facilities within {radius_km}km of your location."
        )
        if places:
            nearest = places[0]
            summary += f" Nearest: {nearest['name']} ({nearest['distance_km']}km away)."

        logger.info(
            f"Nearby PHC search lat={latitude} lon={longitude} radius_km={radius_km} results={len(places)}"
        )

        return {
            "places": places,
            "summary": summary,
            "total": len(places),
        }

    except httpx.HTTPError as e:
        logger.error(f"Maps API HTTP error: {e}")
        raise MapsAPIException(str(e)) from e
    except Exception as e:
        logger.error(f"Nearby PHC search failed: {e}")
        return {
            "places": [],
            "summary": f"Error finding nearby PHCs: {e}",
            "total": 0,
            "error": str(e),
        }


def _mock_nearby_response(lat: float, lon: float, radius_km: int) -> dict:
    """Return mock data when Maps API key is not configured."""
    mock_places = [
        {
            "name": "PHC Koramangala",
            "address": "5th Block, Koramangala, Bengaluru",
            "place_id": "mock_1",
            "latitude": lat + 0.01,
            "longitude": lon + 0.01,
            "distance_km": 1.2,
            "rating": 4.1,
            "open_now": True,
            "maps_url": "https://maps.google.com",
        },
        {
            "name": "CHC Indiranagar",
            "address": "100 Feet Road, Indiranagar, Bengaluru",
            "place_id": "mock_2",
            "latitude": lat + 0.02,
            "longitude": lon - 0.01,
            "distance_km": 2.8,
            "rating": 3.9,
            "open_now": True,
            "maps_url": "https://maps.google.com",
        },
        {
            "name": "District Hospital Bengaluru",
            "address": "K.R. Road, Bengaluru",
            "place_id": "mock_3",
            "latitude": lat - 0.03,
            "longitude": lon + 0.02,
            "distance_km": 4.5,
            "rating": 4.3,
            "open_now": True,
            "maps_url": "https://maps.google.com",
        },
    ]
    return {
        "places": mock_places,
        "summary": (
            f"[DEMO DATA] Found {len(mock_places)} healthcare facilities within {radius_km}km. "
            "Configure GOOGLE_MAPS_API_KEY for real results."
        ),
        "total": len(mock_places),
    }


MAPS_TOOL_DECLARATION = {
    "name": "find_nearby_phc",
    "description": (
        "Find the nearest Primary Health Centres (PHCs) and hospitals using GPS coordinates. "
        "Use when the user asks about nearby hospitals, closest PHC, or healthcare facilities "
        "near a location."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "latitude": {
                "type": "number",
                "description": "User's latitude coordinate.",
            },
            "longitude": {
                "type": "number",
                "description": "User's longitude coordinate.",
            },
            "radius_km": {
                "type": "integer",
                "description": "Search radius in kilometres. Default is 10.",
            },
        },
        "required": ["latitude", "longitude"],
    },
}
