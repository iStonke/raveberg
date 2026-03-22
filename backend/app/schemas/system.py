from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.mode import ModeType
from app.schemas.runtime import (
    AmbientColorPreset,
    DisplayRenderMode,
    RemoteRendererFallback,
    RemoteVisualizerFallback,
)
from app.schemas.selfie import ModerationMode


class StoragePaths(BaseModel):
    app_data_path: str
    uploads_path: str
    display_cache_path: str


class SystemStatus(BaseModel):
    backend_reachable: bool
    db_reachable: bool
    internet_reachable: bool
    upload_count: int
    current_mode: ModeType
    moderation_mode: ModerationMode
    display_target: str
    display_live_connected: bool
    display_state_stale: bool
    slideshow_enabled: bool
    video_playlist_enabled: bool
    visualizer_auto_cycle_enabled: bool
    rate_limit_trigger_count: int
    last_rate_limit_at: datetime | None
    last_cleanup_at: datetime | None
    last_cleanup_removed: int
    last_display_heartbeat_at: datetime | None
    last_display_state_sync_at: datetime | None


class SystemTelemetry(BaseModel):
    cpu_load_percent: float | None
    memory_used_bytes: int | None
    memory_total_bytes: int | None
    memory_percent: float | None
    cpu_temperature_celsius: float | None
    fan_active: bool | None
    fan_rpm: int | None


class ApplianceUrls(BaseModel):
    base_url: str
    guest_upload_url: str
    admin_url: str
    display_url: str
    kiosk_start_url: str


class ApplianceNetwork(BaseModel):
    appliance_mode: bool
    ap_enabled: bool
    ap_ssid: str
    ap_address: str
    local_hostname: str


class ApplianceStorage(BaseModel):
    free_bytes: int | None
    total_bytes: int | None


class ApplianceInfo(BaseModel):
    event_name: str
    event_tagline: str
    display_overlay_enabled: bool
    remote_visualizer_enabled: bool
    remote_visualizer_url: str
    remote_visualizer_reconnect_ms: int
    remote_visualizer_fallback: RemoteVisualizerFallback
    ambient_color_preset: AmbientColorPreset
    ambient_color_custom_hue_degrees: int
    display_render_mode: DisplayRenderMode
    remote_renderer_base_url: str
    remote_renderer_output_path: str
    remote_renderer_health_url: str
    remote_renderer_reconnect_ms: int
    remote_renderer_fallback: RemoteRendererFallback
    urls: ApplianceUrls
    network: ApplianceNetwork
    storage: ApplianceStorage


class PublicRuntimeInfoResponse(BaseModel):
    app_name: str
    event_name: str
    event_tagline: str
    display_overlay_enabled: bool
    remote_visualizer_enabled: bool
    remote_visualizer_url: str
    remote_visualizer_reconnect_ms: int
    remote_visualizer_fallback: RemoteVisualizerFallback
    ambient_color_preset: AmbientColorPreset
    ambient_color_custom_hue_degrees: int
    display_render_mode: DisplayRenderMode
    remote_renderer_base_url: str
    remote_renderer_output_path: str
    remote_renderer_health_url: str
    remote_renderer_reconnect_ms: int
    remote_renderer_fallback: RemoteRendererFallback
    moderation_mode: ModerationMode
    guest_upload_enabled: bool
    guest_upload_requires_approval: bool
    guest_upload_session_timeout_hours: int
    session_expires_at: datetime
    session_is_expired: bool
    upload_max_bytes: int
    video_upload_max_bytes: int
    urls: ApplianceUrls
    network: ApplianceNetwork


NetworkMode = Literal["normal", "setup"]
WifiConnectState = Literal["idle", "pending", "failed", "succeeded"]


class SetupModeStatusRead(BaseModel):
    enabled: bool
    ssid: str
    ip: str
    portal_url: str
    last_error: str | None = None
    connect_state: WifiConnectState = "idle"
    connecting_to_ssid: str | None = None
    last_transition_at: datetime | None = None


class WifiScanResult(BaseModel):
    ssid: str
    signal: int
    security: str
    active: bool


class NetworkStatusRead(BaseModel):
    online: bool
    connected: bool
    ssid: str | None
    ip: str | None
    signal_percent: int | None
    signal_bars: int
    setup_mode: bool
    network_mode: NetworkMode


class SystemInfoResponse(BaseModel):
    app_name: str
    environment: str
    default_mode: ModeType
    video_upload_max_bytes: int
    status: SystemStatus
    network_status: NetworkStatusRead
    setup_mode_status: SetupModeStatusRead
    telemetry: SystemTelemetry
    storage: StoragePaths
    appliance: "ApplianceInfo"


class SystemActionResponse(BaseModel):
    message: str
    pending: bool = False
    network_status: NetworkStatusRead | None = None
    setup_mode_status: SetupModeStatusRead | None = None


class WifiConnectRequest(BaseModel):
    ssid: str
    password: str = ""
