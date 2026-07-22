from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "SwasthyaGrid AI"
    environment: str = "local"

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    google_maps_api_key: str | None = None
    use_vertex_ai: bool = False
    use_secret_manager: bool = False
    google_cloud_project: str | None = None

    seed_data_path: Path = Path(__file__).resolve().parents[2] / "data" / "seed_district.json"

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
