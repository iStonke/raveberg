from __future__ import annotations

import json
import logging
import subprocess
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from shutil import which

from fastapi import Request

from app.core.config import settings
from app.schemas.system import SetupModeStatusRead, SystemActionResponse, WifiConnectRequest
from app.services.network_status_service import NetworkStatusService
from app.services.wifi_scan_service import WifiScanService

logger = logging.getLogger(__name__)


class NetworkSetupService:
    _operation_lock = threading.Lock()
    _monitor_lock = threading.RLock()
    _offline_checks = 0
    _last_auto_start_at: datetime | None = None

    def start_setup_mode(self, trigger: str = "manual") -> SystemActionResponse:
        with self._operation_lock:
            if self._service_is_active():
                self._write_state(connect_state="idle", last_error=None, connecting_to_ssid=None)
                return SystemActionResponse(
                    message="Setup-Modus ist bereits aktiv.",
                    network_status=NetworkStatusService().get_status(),
                    setup_mode_status=self.get_setup_mode_status(),
                )

            self._ensure_service_available()
            self._run_systemctl("start")
            self._reset_monitor()
            now = datetime.now(timezone.utc)
            self._write_state(
                connect_state="idle",
                last_error=None,
                connecting_to_ssid=None,
                last_transition_at=now,
                last_trigger=trigger,
            )
            return SystemActionResponse(
                message="Setup-Modus wurde gestartet.",
                network_status=NetworkStatusService().get_status(),
                setup_mode_status=self.get_setup_mode_status(),
            )

    def stop_setup_mode(self, trigger: str = "manual") -> SystemActionResponse:
        with self._operation_lock:
            if not self._service_is_active():
                self._write_state(connect_state="idle", connecting_to_ssid=None)
                return SystemActionResponse(
                    message="Setup-Modus ist bereits beendet.",
                    network_status=NetworkStatusService().get_status(),
                    setup_mode_status=self.get_setup_mode_status(),
                )

            self._ensure_service_available()
            self._run_systemctl("stop")
            self._reset_monitor()
            now = datetime.now(timezone.utc)
            self._write_state(
                connect_state="idle",
                connecting_to_ssid=None,
                last_transition_at=now,
                last_trigger=trigger,
            )
            return SystemActionResponse(
                message="Setup-Modus wurde beendet.",
                network_status=NetworkStatusService().get_status(),
                setup_mode_status=self.get_setup_mode_status(),
            )

    def get_setup_mode_status(self) -> SetupModeStatusRead:
        state = self._read_state()
        return SetupModeStatusRead(
            enabled=self._service_is_active(),
            ssid=settings.setup_mode_ssid,
            ip=settings.setup_mode_address,
            portal_url=settings.setup_mode_portal_url,
            last_error=state.get("last_error"),
            connect_state=state.get("connect_state", "idle"),
            connecting_to_ssid=state.get("connecting_to_ssid"),
            last_transition_at=self._parse_state_datetime(state.get("last_transition_at")),
        )

    def connect_wifi(self, payload: WifiConnectRequest) -> SystemActionResponse:
        ssid = payload.ssid.strip()
        if not ssid:
            raise RuntimeError("SSID fehlt")

        if self.get_setup_mode_status().connect_state == "pending":
            raise RuntimeError("Es läuft bereits ein WLAN-Verbindungsaufbau.")

        setup_active = self._service_is_active()
        if setup_active:
            self._write_state(
                connect_state="pending",
                last_error=None,
                connecting_to_ssid=ssid,
            )
            worker = threading.Thread(
                target=self._connect_wifi_worker,
                args=(ssid, payload.password),
                name="raveberg-wifi-connect",
                daemon=True,
            )
            worker.start()
            return SystemActionResponse(
                message=(
                    f"Verbinde mit '{ssid}'. Das Setup-WLAN wird jetzt beendet. "
                    "Falls die Verbindung fehlschlägt, bleibt der Setup-Hotspot verfügbar."
                ),
                pending=True,
                network_status=NetworkStatusService().get_status(),
                setup_mode_status=self.get_setup_mode_status(),
            )

        with self._operation_lock:
            network_status = self._connect_wifi_locked(ssid, payload.password, restart_setup_on_failure=False)
            self._write_state(
                connect_state="succeeded",
                last_error=None,
                connecting_to_ssid=None,
                last_transition_at=datetime.now(timezone.utc),
            )
            return SystemActionResponse(
                message=f"Verbunden mit '{ssid}'.",
                network_status=network_status,
                setup_mode_status=self.get_setup_mode_status(),
            )

    def auto_start_if_needed(self) -> None:
        if not settings.auto_setup_mode_enabled:
            return
        if self._service_is_active():
            self._reset_monitor()
            return
        if self.get_setup_mode_status().connect_state == "pending":
            return

        network_status = NetworkStatusService().get_status()
        if network_status.connected:
            self._reset_monitor()
            return

        with self._monitor_lock:
            cooldown_until = self._cooldown_until()
            if cooldown_until is not None and cooldown_until > datetime.now(timezone.utc):
                return

            self.__class__._offline_checks += 1
            if self.__class__._offline_checks < settings.auto_setup_mode_failure_threshold:
                return

            self.__class__._offline_checks = 0
            logger.warning("[NetworkSetup] auto_start_setup_mode")
            self.start_setup_mode(trigger="auto-fallback")
            self.__class__._last_auto_start_at = datetime.now(timezone.utc)

    def is_local_request_allowed(self, request: Request) -> bool:
        candidate = (
            request.headers.get("x-real-ip")
            or request.headers.get("x-forwarded-for", "").split(",", maxsplit=1)[0].strip()
            or (request.client.host if request.client else "")
        )
        if not candidate:
            return False

        try:
            import ipaddress

            address = ipaddress.ip_address(candidate)
        except ValueError:
            return False

        return bool(address.is_private or address.is_loopback)

    def _connect_wifi_worker(self, ssid: str, password: str) -> None:
        try:
            with self._operation_lock:
                network_status = self._connect_wifi_locked(ssid, password, restart_setup_on_failure=True)
            self._write_state(
                connect_state="succeeded",
                last_error=None,
                connecting_to_ssid=None,
                last_transition_at=datetime.now(timezone.utc),
            )
            logger.info("[NetworkSetup] wifi_connected ssid=%s ip=%s", ssid, network_status.ip or "n/a")
        except Exception as exc:  # pragma: no cover - exercised only on real hardware
            message = str(exc) or "WLAN-Verbindung konnte nicht hergestellt werden."
            logger.warning("[NetworkSetup] wifi_connect_failed ssid=%s detail=%s", ssid, message)
            self._write_state(
                connect_state="failed",
                last_error=message,
                connecting_to_ssid=None,
                last_transition_at=datetime.now(timezone.utc),
            )

    def _connect_wifi_locked(
        self,
        ssid: str,
        password: str,
        *,
        restart_setup_on_failure: bool,
    ):
        nmcli = which("nmcli")
        if not nmcli:
            raise RuntimeError("Kein WLAN-Manager verfügbar (nmcli fehlt)")

        setup_was_active = self._service_is_active()
        if setup_was_active:
            self._run_systemctl("stop")

        try:
            self._run_command([nmcli, "radio", "wifi", "on"])
            self._run_command([nmcli, "device", "wifi", "rescan", "ifname", settings.wifi_interface], check=False)
            self._ensure_network_visible(ssid)

            connect_command = [
                nmcli,
                "--wait",
                "30",
                "device",
                "wifi",
                "connect",
                ssid,
                "ifname",
                settings.wifi_interface,
            ]
            if password:
                connect_command.extend(["password", password])

            self._run_command(connect_command, timeout=40)

            network_status = self._wait_for_network_status(ssid)
            if setup_was_active:
                self._write_state(last_error=None)
            return network_status
        except Exception:
            if setup_was_active and restart_setup_on_failure:
                try:
                    self._run_systemctl("start")
                except Exception as restart_exc:  # pragma: no cover - hardware/systemd path
                    logger.warning("[NetworkSetup] setup_restart_failed detail=%s", restart_exc)
            raise

    def _ensure_network_visible(self, ssid: str) -> None:
        try:
            scanned_networks = WifiScanService().scan()
        except RuntimeError as exc:
            raise RuntimeError(str(exc)) from exc

        if any(network.ssid == ssid for network in scanned_networks):
            return
        raise RuntimeError("Das ausgewählte WLAN wurde nicht gefunden.")

    def _wait_for_network_status(self, expected_ssid: str):
        deadline = time.monotonic() + 20
        service = NetworkStatusService()
        while time.monotonic() < deadline:
            status = service.get_status()
            if status.connected and status.ssid == expected_ssid and status.ip:
                return status
            time.sleep(1)
        raise RuntimeError("Die Verbindung zum WLAN hat zu lange gedauert.")

    def _ensure_service_available(self) -> None:
        if not which("systemctl"):
            raise RuntimeError(
                "Setup-Modus ist im laufenden Backend-Container nicht verfügbar "
                "(systemctl fehlt). Das Backend-Image wurde wahrscheinlich noch "
                "nicht mit dem aktualisierten Dockerfile neu gebaut. "
                "Bitte den Stack mit 'docker compose up -d --build' neu erstellen."
            )

    def _run_systemctl(self, action: str) -> None:
        systemctl = which("systemctl")
        if not systemctl:
            raise RuntimeError("Setup-Modus ist nicht verfügbar (systemctl fehlt).")

        try:
            subprocess.run(
                [systemctl, action, settings.setup_mode_service_name],
                capture_output=True,
                text=True,
                check=True,
                timeout=45,
            )
        except subprocess.CalledProcessError as exc:
            message = (exc.stderr or exc.stdout or "").strip()
            raise RuntimeError(message or f"Setup-Modus konnte nicht per systemctl {action} werden.") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("Setup-Modus reagiert nicht rechtzeitig.") from exc

    def _service_is_active(self) -> bool:
        systemctl = which("systemctl")
        if not systemctl:
            return False

        try:
            result = subprocess.run(
                [systemctl, "is-active", "--quiet", settings.setup_mode_service_name],
                capture_output=True,
                text=True,
                check=False,
                timeout=10,
            )
        except (subprocess.TimeoutExpired, OSError):
            return False
        return result.returncode == 0

    def _run_command(self, command: list[str], *, check: bool = True, timeout: int = 20) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=check,
                timeout=timeout,
            )
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(self._map_wifi_error(exc.stderr or exc.stdout or "")) from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("Die Verbindung zum WLAN hat zu lange gedauert.") from exc
        except FileNotFoundError as exc:
            raise RuntimeError("Kein WLAN-Manager verfügbar (nmcli fehlt)") from exc

    @staticmethod
    def _map_wifi_error(raw_message: str) -> str:
        message = raw_message.strip()
        lowered = message.lower()
        if "no network with ssid" in lowered or "not found" in lowered:
            return "Das ausgewählte WLAN wurde nicht gefunden."
        if "secrets were required" in lowered or "wrong password" in lowered or "802-11-wireless-security.key-mgmt" in lowered:
            return "Das WLAN-Passwort ist falsch oder unvollständig."
        if "timeout" in lowered:
            return "Die Verbindung zum WLAN hat zu lange gedauert."
        if "no wi-fi device" in lowered or "no wifi device" in lowered:
            return "Kein verfügbares WLAN-Interface gefunden."
        if "device could not be readied" in lowered:
            return "Das WLAN-Interface ist aktuell nicht bereit."
        return message or "WLAN-Verbindung konnte nicht hergestellt werden."

    def _state_file(self) -> Path:
        return Path(settings.setup_mode_runtime_dir) / "state.json"

    def _read_state(self) -> dict[str, object]:
        state_file = self._state_file()
        if not state_file.exists():
            return {}

        try:
            return json.loads(state_file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def _write_state(self, **changes) -> None:
        state_file = self._state_file()
        state_file.parent.mkdir(parents=True, exist_ok=True)
        state = self._read_state()
        for key, value in changes.items():
            if isinstance(value, datetime):
                state[key] = value.isoformat()
            elif value is None:
                state.pop(key, None)
            else:
                state[key] = value
        state_file.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")

    @staticmethod
    def _parse_state_datetime(value: str | None) -> datetime | None:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None

    def _reset_monitor(self) -> None:
        with self._monitor_lock:
            self.__class__._offline_checks = 0

    def _cooldown_until(self) -> datetime | None:
        if self.__class__._last_auto_start_at is None:
            return None
        return self.__class__._last_auto_start_at + timedelta(
            seconds=settings.auto_setup_mode_cooldown_seconds,
        )
