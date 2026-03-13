from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.schemas.mode import ModeType
from app.schemas.selfie import ModerationMode


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "RAVEBERG"
    app_env: str = Field(default="development", alias="APP_ENV")
    database_url: str = Field(
        default="postgresql+psycopg://raveberg:raveberg_dev@db:5432/raveberg",
        alias="DATABASE_URL",
    )
    backend_cors_origins: str = Field(
        default="http://localhost:8085,http://127.0.0.1:8085,http://localhost:5180,http://127.0.0.1:5180",
        alias="BACKEND_CORS_ORIGINS",
    )
    default_app_mode: ModeType = Field(default="idle", alias="DEFAULT_APP_MODE")
    default_admin_username: str = Field(default="admin", alias="DEFAULT_ADMIN_USERNAME")
    default_admin_password: str = Field(default="admin123", alias="DEFAULT_ADMIN_PASSWORD")
    session_ttl_hours: int = Field(default=24, alias="SESSION_TTL_HOURS")
    upload_max_bytes: int = Field(default=15 * 1024 * 1024, alias="UPLOAD_MAX_BYTES")
    video_upload_max_bytes: int = Field(default=500 * 1024 * 1024, alias="VIDEO_UPLOAD_MAX_BYTES")
    appliance_mode: bool = Field(default=False, alias="APPLIANCE_MODE")
    public_base_url: str = Field(default="http://localhost:8085", alias="PUBLIC_BASE_URL")
    guest_upload_url_override: str = Field(
        default="https://indie-bullet-photographer-blessed.trycloudflare.com/guest/upload",
        alias="GUEST_UPLOAD_URL",
    )
    guest_upload_path: str = Field(default="/guest/upload", alias="GUEST_UPLOAD_PATH")
    admin_path: str = Field(default="/admin/login", alias="ADMIN_PATH")
    display_path: str = Field(default="/display", alias="DISPLAY_PATH")
    kiosk_start_url: str | None = Field(default=None, alias="KIOSK_START_URL")
    event_name: str = Field(default="RAVEBERG", alias="EVENT_NAME")
    event_tagline: str = Field(default="Lokaler Foto- und Visualizer-Feed", alias="EVENT_TAGLINE")
    display_overlay_enabled: bool = Field(default=True, alias="DISPLAY_OVERLAY_ENABLED")
    remote_visualizer_enabled: bool = Field(default=False, alias="REMOTE_VISUALIZER_ENABLED")
    remote_visualizer_url: str = Field(default="", alias="REMOTE_VISUALIZER_URL")
    remote_visualizer_reconnect_ms: int = Field(default=3000, alias="REMOTE_VISUALIZER_RECONNECT_MS")
    remote_visualizer_fallback: str = Field(default="local", alias="REMOTE_VISUALIZER_FALLBACK")
    display_render_mode: str = Field(default="local", alias="DISPLAY_RENDER_MODE")
    remote_renderer_base_url: str = Field(default="", alias="REMOTE_RENDERER_BASE_URL")
    remote_renderer_output_path: str = Field(default="/preview", alias="REMOTE_RENDERER_OUTPUT_PATH")
    remote_renderer_health_url: str = Field(default="", alias="REMOTE_RENDERER_HEALTH_URL")
    remote_renderer_reconnect_ms: int = Field(default=3000, alias="REMOTE_RENDERER_RECONNECT_MS")
    remote_renderer_fallback: str = Field(default="local", alias="REMOTE_RENDERER_FALLBACK")
    ap_enabled: bool = Field(default=False, alias="AP_ENABLED")
    ap_ssid: str = Field(default="RAVEBERG", alias="AP_SSID")
    ap_address: str = Field(default="10.77.0.1", alias="AP_ADDRESS")
    local_hostname: str = Field(default="raveberg.local", alias="LOCAL_HOSTNAME")
    default_moderation_mode: ModerationMode = Field(
        default="auto_approve",
        alias="DEFAULT_MODERATION_MODE",
    )
    default_slideshow_enabled: bool = Field(default=True, alias="DEFAULT_SLIDESHOW_ENABLED")
    default_slideshow_interval_seconds: int = Field(
        default=6,
        alias="DEFAULT_SLIDESHOW_INTERVAL_SECONDS",
        ge=2,
        le=20,
    )
    default_slideshow_max_visible_photos: int = Field(
        default=4,
        alias="DEFAULT_SLIDESHOW_MAX_VISIBLE_PHOTOS",
        ge=1,
        le=10,
    )
    default_slideshow_min_uploads_to_start: int = Field(
        default=3,
        alias="DEFAULT_SLIDESHOW_MIN_UPLOADS_TO_START",
        ge=1,
        le=50,
    )
    default_slideshow_shuffle: bool = Field(default=True, alias="DEFAULT_SLIDESHOW_SHUFFLE")
    default_vintage_look_enabled: bool = Field(default=False, alias="DEFAULT_VINTAGE_LOOK_ENABLED")
    default_visualizer_auto_cycle_enabled: bool = Field(
        default=False,
        alias="DEFAULT_VISUALIZER_AUTO_CYCLE_ENABLED",
    )
    default_visualizer_auto_cycle_interval_seconds: int = Field(
        default=45,
        alias="DEFAULT_VISUALIZER_AUTO_CYCLE_INTERVAL_SECONDS",
    )
    upload_rate_limit_count: int = Field(default=8, alias="UPLOAD_RATE_LIMIT_COUNT")
    upload_rate_limit_window_seconds: int = Field(default=60, alias="UPLOAD_RATE_LIMIT_WINDOW_SECONDS")
    max_stored_uploads: int = Field(default=400, alias="MAX_STORED_UPLOADS")
    cleanup_preserve_latest_count: int = Field(default=120, alias="CLEANUP_PRESERVE_LATEST_COUNT")
    cleanup_batch_size: int = Field(default=50, alias="CLEANUP_BATCH_SIZE")
    display_heartbeat_interval_seconds: int = Field(default=15, alias="DISPLAY_HEARTBEAT_INTERVAL_SECONDS")
    display_heartbeat_stale_seconds: int = Field(default=40, alias="DISPLAY_HEARTBEAT_STALE_SECONDS")
    app_data_path: str = Field(default="/app/data", alias="APP_DATA_PATH")
    uploads_path: str = Field(default="/app/data/uploads", alias="UPLOADS_PATH")
    display_cache_path: str = Field(default="/app/data/display-cache", alias="DISPLAY_CACHE_PATH")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def uploads_original_path(self) -> str:
        return f"{self.uploads_path}/original"

    @property
    def uploads_display_path(self) -> str:
        return f"{self.uploads_path}/display"

    @property
    def videos_path(self) -> str:
        return f"{self.app_data_path}/videos"

    @property
    def normalized_public_base_url(self) -> str:
        return self.public_base_url.rstrip("/")

    @property
    def guest_upload_url(self) -> str:
        if self.guest_upload_url_override.strip():
            return self.guest_upload_url_override.strip()
        return f"{self.normalized_public_base_url}{self.guest_upload_path}"

    @property
    def admin_url(self) -> str:
        return f"{self.normalized_public_base_url}{self.admin_path}"

    @property
    def display_url(self) -> str:
        return f"{self.normalized_public_base_url}{self.display_path}"

    @property
    def resolved_kiosk_start_url(self) -> str:
        return self.kiosk_start_url or self.display_url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
