from pathlib import Path
from shutil import disk_usage

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.upload import Upload
from app.services.display_status_service import DisplayStatusService
from app.schemas.system import (
    ApplianceInfo,
    ApplianceNetwork,
    ApplianceStorage,
    ApplianceUrls,
    StoragePaths,
    SystemInfoResponse,
    SystemStatus,
)
from app.services.mode_service import ModeService
from app.services.runtime_service import runtime_service
from app.services.selfie_service import SelfieService
from app.services.visualizer_service import VisualizerService


class SystemService:
    def __init__(self, db: Session):
        self.db = db

    def get_info(self) -> SystemInfoResponse:
        db_reachable = True
        upload_count = 0
        free_bytes: int | None = None
        total_bytes: int | None = None
        try:
            self.db.execute(text("SELECT 1"))
            upload_count = int(self.db.scalar(select(func.count()).select_from(Upload)) or 0)
        except Exception:
            db_reachable = False

        try:
            usage = disk_usage(Path(settings.app_data_path))
            free_bytes = usage.free
            total_bytes = usage.total
        except Exception:
            free_bytes = None
            total_bytes = None

        current_mode = ModeService(self.db).get_mode().mode
        selfie_state = SelfieService(self.db).get_state()
        visualizer_state = VisualizerService(self.db).get_state()
        display_status = DisplayStatusService(self.db).get_status()
        runtime_diagnostics = runtime_service.diagnostics()

        return SystemInfoResponse(
            app_name=settings.app_name,
            environment=settings.app_env,
            default_mode=settings.default_app_mode,
            status=SystemStatus(
                backend_reachable=True,
                db_reachable=db_reachable,
                upload_count=upload_count,
                current_mode=current_mode,
                moderation_mode=selfie_state.moderation_mode,
                display_target=self._display_target_label(current_mode),
                slideshow_enabled=selfie_state.slideshow_enabled,
                visualizer_auto_cycle_enabled=visualizer_state.auto_cycle_enabled,
                rate_limit_trigger_count=int(runtime_diagnostics["rate_limit_trigger_count"] or 0),
                last_rate_limit_at=runtime_diagnostics["last_rate_limit_at"],
                last_cleanup_at=runtime_diagnostics["last_cleanup_at"],
                last_cleanup_removed=int(runtime_diagnostics["last_cleanup_removed"] or 0),
                last_display_heartbeat_at=display_status.last_heartbeat_at,
                last_display_state_sync_at=display_status.last_state_sync_at,
            ),
            storage=StoragePaths(
                app_data_path=settings.app_data_path,
                uploads_path=settings.uploads_path,
                display_cache_path=settings.display_cache_path,
            ),
            appliance=ApplianceInfo(
                event_name=settings.event_name,
                urls=ApplianceUrls(
                    base_url=settings.normalized_public_base_url,
                    guest_upload_url=settings.guest_upload_url,
                    admin_url=settings.admin_url,
                    display_url=settings.display_url,
                    kiosk_start_url=settings.resolved_kiosk_start_url,
                ),
                network=ApplianceNetwork(
                    appliance_mode=settings.appliance_mode,
                    ap_enabled=settings.ap_enabled,
                    ap_ssid=settings.ap_ssid,
                    ap_address=settings.ap_address,
                    local_hostname=settings.local_hostname,
                ),
                storage=ApplianceStorage(
                    free_bytes=free_bytes,
                    total_bytes=total_bytes,
                ),
            ),
        )

    @staticmethod
    def _display_target_label(mode: str) -> str:
        if mode == "visualizer":
            return "Visualizer Renderer"
        if mode == "selfie":
            return "Selfie Renderer"
        if mode == "blackout":
            return "Blackout Renderer"
        return "Idle Renderer"
