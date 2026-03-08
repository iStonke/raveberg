from datetime import datetime

from pydantic import BaseModel

from app.schemas.mode import ModeType
from app.schemas.selfie import ModerationMode


class StoragePaths(BaseModel):
    app_data_path: str
    uploads_path: str
    display_cache_path: str


class SystemStatus(BaseModel):
    backend_reachable: bool
    db_reachable: bool
    upload_count: int
    current_mode: ModeType
    moderation_mode: ModerationMode
    display_target: str
    slideshow_enabled: bool
    visualizer_auto_cycle_enabled: bool
    rate_limit_trigger_count: int
    last_rate_limit_at: datetime | None
    last_cleanup_at: datetime | None
    last_cleanup_removed: int
    last_display_heartbeat_at: datetime | None
    last_display_state_sync_at: datetime | None


class SystemInfoResponse(BaseModel):
    app_name: str
    environment: str
    default_mode: ModeType
    status: SystemStatus
    storage: StoragePaths
    appliance: "ApplianceInfo"


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
    urls: ApplianceUrls
    network: ApplianceNetwork
    storage: ApplianceStorage
