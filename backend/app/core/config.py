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

    # Gnani.ai voice (Vachana API): Prisma STT and Timbre TTS share one key.
    gnani_api_key: str | None = None
    gnani_stt_ws_url: str = "wss://api.vachana.ai/stt/v3/stream"
    gnani_stt_model: str = "prisma-v2.5"
    gnani_stt_format: str = "transcribe"  # digits instead of spelled numbers
    gnani_tts_ws_url: str = "wss://api.vachana.ai/api/v1/tts"
    gnani_tts_rest_url: str = "https://api.vachana.ai/api/v1/tts/inference"
    gnani_tts_model: str = "timbre-v2.5"
    gnani_tts_voice_en: str = "Kaveri"  # set from the Phase 0 probe
    gnani_tts_voice_hi: str = "Nalini"
    gnani_tts_mode: str = "ws"  # "ws" or "rest"
    gnani_tts_sample_rate: int = 24000
    gnani_tts_speed: float = 1.0

    # LLM router (OpenAI-compatible). Evon is primary whenever EVON_BASE_URL is set.
    llm_primary: str = "evon"  # "evon" | "gemini"
    llm_stream_with_tools: bool = True
    evon_base_url: str | None = None  # e.g. http://localhost:8000/v1 or an HF Endpoint /v1
    evon_api_key: str | None = None  # HF token for an Inference Endpoint; empty for local vLLM
    evon_model: str = "gnani-evon-v3.3"  # the vLLM --served-model-name
    gemini_openai_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    gemini_chat_model: str | None = None  # defaults to gemini_model
    gemini_reasoning_effort: str | None = "minimal"  # lowest value Gemini accepts; "none" 400s (probed live)

    frontend_origins: list[str] = []  # deployed frontends; JSON list in env

    data_source: str = "auto"  # auto | seed | firestore
    firebase_service_account: str | None = None  # base64 or raw JSON
    firebase_service_account_file: str | None = None

    logistics_time_scale: float = 60.0
    logistics_scenario_start: str | None = None
    logistics_auto_pod_minutes: int = 240
    logistics_background_traffic: bool = True
    logistics_tick: bool = True
    logistics_admin_enabled: bool = True
    logistics_service_token: str | None = None
    logistics_state_path: Path = Path(__file__).resolve().parents[2] / ".runtime" / "logistics_state.json"

    seed_data_path: Path = Path(__file__).resolve().parents[2] / "data" / "seed_districts.json"

    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ]
    # Dev-only: lets lane worktrees on ports 3000 to 3099 reach the API.
    cors_origin_regex: str | None = r"http://(localhost|127\.0\.0\.1):30\d\d"

    @property
    def effective_cors_origin_regex(self) -> str | None:
        return None if self.environment == "production" else self.cors_origin_regex


@lru_cache
def get_settings() -> Settings:
    return Settings()
