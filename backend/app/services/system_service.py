import os
import re
import subprocess
from pathlib import Path
from shutil import disk_usage, which
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.upload import Upload
from app.services.display_status_service import DisplayStatusService
from app.services.network_setup_service import NetworkSetupService
from app.services.network_status_service import NetworkStatusService
from app.services.runtime_config_service import RuntimeConfigService
from app.schemas.system import (
    ApplianceInfo,
    ApplianceNetwork,
    ApplianceStorage,
    ApplianceUrls,
    PublicRuntimeInfoResponse,
    StoragePaths,
    SystemActionResponse,
    SystemInfoResponse,
    SystemStatus,
    SystemTelemetry,
)
from app.services.mode_service import ModeService
from app.services.runtime_service import runtime_service
from app.services.selfie_service import SelfieService
from app.services.video_service import VideoService
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
        video_state = VideoService(self.db).get_state()
        visualizer_state = VisualizerService(self.db).get_state()
        display_status = DisplayStatusService(self.db).get_status()
        runtime_config = RuntimeConfigService(self.db).get_remote_visualizer_config()
        runtime_diagnostics = runtime_service.diagnostics()
        telemetry = self._read_telemetry()
        display_state_stale = self._is_display_state_stale(display_status.last_heartbeat_at)
        display_live_connected = bool(display_status.sse_connected and not display_state_stale)
        display_target = (
            display_status.renderer_label
            if display_live_connected and display_status.renderer_label
            else self._display_target_label(current_mode, runtime_config.display_render_mode)
        )
        network_status = NetworkStatusService().get_status()
        setup_mode_status = NetworkSetupService().get_setup_mode_status()

        return SystemInfoResponse(
            app_name=settings.app_name,
            environment=settings.app_env,
            default_mode=settings.default_app_mode,
            video_upload_max_bytes=settings.video_upload_max_bytes,
            status=SystemStatus(
                backend_reachable=True,
                db_reachable=db_reachable,
                internet_reachable=network_status.online,
                upload_count=upload_count,
                current_mode=current_mode,
                moderation_mode=selfie_state.moderation_mode,
                display_target=display_target,
                display_live_connected=display_live_connected,
                display_state_stale=display_state_stale,
                slideshow_enabled=selfie_state.slideshow_enabled,
                video_playlist_enabled=video_state.playlist_enabled,
                visualizer_auto_cycle_enabled=visualizer_state.auto_cycle_enabled,
                rate_limit_trigger_count=int(runtime_diagnostics["rate_limit_trigger_count"] or 0),
                last_rate_limit_at=runtime_diagnostics["last_rate_limit_at"],
                last_cleanup_at=runtime_diagnostics["last_cleanup_at"],
                last_cleanup_removed=int(runtime_diagnostics["last_cleanup_removed"] or 0),
                last_display_heartbeat_at=display_status.last_heartbeat_at,
                last_display_state_sync_at=display_status.last_state_sync_at,
            ),
            network_status=network_status,
            setup_mode_status=setup_mode_status,
            telemetry=telemetry,
            storage=StoragePaths(
                app_data_path=settings.app_data_path,
                uploads_path=settings.uploads_path,
                display_cache_path=settings.display_cache_path,
            ),
            appliance=ApplianceInfo(
                event_name=settings.event_name,
                event_tagline=settings.event_tagline,
                display_overlay_enabled=settings.display_overlay_enabled,
                remote_visualizer_enabled=runtime_config.remote_visualizer_enabled,
                remote_visualizer_url=runtime_config.remote_visualizer_url,
                remote_visualizer_reconnect_ms=runtime_config.remote_visualizer_reconnect_ms,
                remote_visualizer_fallback=runtime_config.remote_visualizer_fallback,
                display_render_mode=runtime_config.display_render_mode,
                remote_renderer_base_url=runtime_config.remote_renderer_base_url,
                remote_renderer_output_path=runtime_config.remote_renderer_output_path,
                remote_renderer_health_url=runtime_config.remote_renderer_health_url,
                remote_renderer_reconnect_ms=runtime_config.remote_renderer_reconnect_ms,
                remote_renderer_fallback=runtime_config.remote_renderer_fallback,
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

    def get_public_info(self) -> PublicRuntimeInfoResponse:
        selfie_state = SelfieService(self.db).get_state()
        runtime_config = RuntimeConfigService(self.db).get_remote_visualizer_config()
        return PublicRuntimeInfoResponse(
            app_name=settings.app_name,
            event_name=settings.event_name,
            event_tagline=settings.event_tagline,
            display_overlay_enabled=settings.display_overlay_enabled,
            remote_visualizer_enabled=runtime_config.remote_visualizer_enabled,
            remote_visualizer_url=runtime_config.remote_visualizer_url,
            remote_visualizer_reconnect_ms=runtime_config.remote_visualizer_reconnect_ms,
            remote_visualizer_fallback=runtime_config.remote_visualizer_fallback,
            display_render_mode=runtime_config.display_render_mode,
            remote_renderer_base_url=runtime_config.remote_renderer_base_url,
            remote_renderer_output_path=runtime_config.remote_renderer_output_path,
            remote_renderer_health_url=runtime_config.remote_renderer_health_url,
            remote_renderer_reconnect_ms=runtime_config.remote_renderer_reconnect_ms,
            remote_renderer_fallback=runtime_config.remote_renderer_fallback,
            moderation_mode=selfie_state.moderation_mode,
            upload_max_bytes=settings.upload_max_bytes,
            video_upload_max_bytes=settings.video_upload_max_bytes,
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
        )

    @staticmethod
    def request_shutdown() -> None:
        command = SystemService._prepare_system_command(SystemService._resolve_shutdown_command())
        SystemService._run_system_command(command, fallback_error="Ausschalten konnte nicht ausgelöst werden.")

    @staticmethod
    def request_restart() -> None:
        command = SystemService._prepare_system_command(SystemService._resolve_restart_command())
        SystemService._run_system_command(command, fallback_error="Neustart konnte nicht ausgelöst werden.")

    @staticmethod
    def _prepare_system_command(command: list[str]) -> list[str]:
        if Path(command[0]).name == "systemctl":
            return [command[0], "--no-block", *command[1:]]
        return command

    @staticmethod
    def _run_system_command(command: list[str], *, fallback_error: str) -> None:
        try:
            subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=True,
                timeout=12,
            )
        except subprocess.CalledProcessError as exc:
            message = (exc.stderr or exc.stdout or "").strip()
            raise RuntimeError(message or fallback_error) from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError(fallback_error) from exc

    @staticmethod
    def shutdown_response() -> SystemActionResponse:
        return SystemActionResponse(message="Ausschalten wurde angefordert.")

    @staticmethod
    def restart_response() -> SystemActionResponse:
        return SystemActionResponse(message="Neustart wurde angefordert.")

    @staticmethod
    def _display_target_label(mode: str, display_render_mode: str) -> str:
        if display_render_mode == "remote_headless":
            return "Remote Headless Renderer"
        if mode == "visualizer":
            return "Visualizer Renderer"
        if mode == "selfie":
            return "Selfie Renderer"
        if mode == "video":
            return "Video Renderer"
        if mode == "blackout":
            return "Blackout Renderer"
        return "Idle Renderer"

    @staticmethod
    def _is_display_state_stale(last_heartbeat_at) -> bool:
        if last_heartbeat_at is None:
            return True
        now = datetime.now(timezone.utc)
        return (now - last_heartbeat_at).total_seconds() > settings.display_heartbeat_stale_seconds

    @staticmethod
    def _read_telemetry() -> SystemTelemetry:
        fan_active, fan_rpm = SystemService._read_fan_status()
        memory_used_bytes, memory_total_bytes, memory_percent = SystemService._read_memory_usage()
        return SystemTelemetry(
            cpu_load_percent=SystemService._read_cpu_load_percent(),
            memory_used_bytes=memory_used_bytes,
            memory_total_bytes=memory_total_bytes,
            memory_percent=memory_percent,
            cpu_temperature_celsius=SystemService._read_cpu_temperature(),
            fan_active=fan_active,
            fan_rpm=fan_rpm,
        )

    @staticmethod
    def _read_cpu_load_percent() -> float | None:
        try:
            load_1m = os.getloadavg()[0]
            cpu_count = max(os.cpu_count() or 1, 1)
            return round((load_1m / cpu_count) * 100, 1)
        except Exception:
            return None

    @staticmethod
    def _read_memory_usage() -> tuple[int | None, int | None, float | None]:
        try:
            values: dict[str, int] = {}
            with open("/proc/meminfo", encoding="utf-8") as handle:
                for line in handle:
                    key, raw_value = line.split(":", maxsplit=1)
                    match = re.search(r"(\d+)", raw_value)
                    if match:
                        values[key] = int(match.group(1)) * 1024
            total = values.get("MemTotal")
            available = values.get("MemAvailable")
            if total is None or available is None or total <= 0:
                return (None, None, None)
            used = max(total - available, 0)
            percent = round((used / total) * 100, 1)
            return (used, total, percent)
        except Exception:
            return (None, None, None)

    @staticmethod
    def _read_cpu_temperature() -> float | None:
        thermal_zone = Path("/sys/class/thermal/thermal_zone0/temp")
        try:
            if thermal_zone.exists():
                return round(int(thermal_zone.read_text(encoding="utf-8").strip()) / 1000, 1)
        except Exception:
            return None

        vcgencmd = which("vcgencmd")
        if not vcgencmd:
            return None

        try:
            result = subprocess.run(
                [vcgencmd, "measure_temp"],
                capture_output=True,
                text=True,
                check=True,
            )
            match = re.search(r"temp=([0-9]+(?:\.[0-9]+)?)", result.stdout)
            if not match:
                return None
            return round(float(match.group(1)), 1)
        except Exception:
            return None

    @staticmethod
    def _read_fan_status() -> tuple[bool | None, int | None]:
        try:
            fan_inputs: list[int] = []
            for candidate in Path("/sys/class/hwmon").glob("hwmon*/fan*_input"):
                try:
                    rpm = int(candidate.read_text(encoding="utf-8").strip())
                except Exception:
                    continue
                if rpm >= 0:
                    fan_inputs.append(rpm)

            if fan_inputs:
                rpm = max(fan_inputs)
                return (rpm > 0, rpm)
        except Exception:
            return (None, None)

        try:
            for candidate in Path("/sys/class/thermal").glob("cooling_device*"):
                type_path = candidate / "type"
                state_path = candidate / "cur_state"
                if not type_path.exists() or not state_path.exists():
                    continue

                try:
                    device_type = type_path.read_text(encoding="utf-8").strip().lower()
                    state = int(state_path.read_text(encoding="utf-8").strip())
                except Exception:
                    continue

                if "fan" in device_type:
                    return (state > 0, None)
        except Exception:
            return (None, None)

        return (None, None)

    @staticmethod
    def _resolve_shutdown_command() -> list[str]:
        for candidate in (
            ["systemctl", "poweroff"],
            ["shutdown", "-h", "now"],
            ["poweroff"],
        ):
            executable = which(candidate[0])
            if executable:
                return [executable, *candidate[1:]]
        raise RuntimeError("No shutdown command available")

    @staticmethod
    def _resolve_restart_command() -> list[str]:
        for candidate in (
            ["systemctl", "reboot"],
            ["shutdown", "-r", "now"],
            ["reboot"],
        ):
            executable = which(candidate[0])
            if executable:
                return [executable, *candidate[1:]]
        raise RuntimeError("No restart command available")
