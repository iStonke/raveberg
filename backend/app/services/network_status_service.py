from __future__ import annotations

import socket
import subprocess
from dataclasses import dataclass
from shutil import which

from app.core.config import settings
from app.schemas.system import NetworkStatusRead


def parse_nmcli_terse_line(line: str) -> list[str]:
    values: list[str] = []
    current: list[str] = []
    escaping = False

    for char in line:
        if escaping:
            current.append(char)
            escaping = False
            continue
        if char == "\\":
            escaping = True
            continue
        if char == ":":
            values.append("".join(current))
            current = []
            continue
        current.append(char)

    values.append("".join(current))
    return values


@dataclass(slots=True)
class ActiveWifiSnapshot:
    connected: bool = False
    ssid: str | None = None
    ip: str | None = None
    signal_percent: int | None = None


class NetworkStatusService:
    def get_status(self) -> NetworkStatusRead:
        from app.services.network_setup_service import NetworkSetupService

        setup_status = NetworkSetupService().get_setup_mode_status()
        if setup_status.enabled:
            return NetworkStatusRead(
                online=False,
                connected=True,
                ssid=setup_status.ssid,
                ip=setup_status.ip,
                signal_percent=None,
                signal_bars=0,
                setup_mode=True,
                network_mode="setup",
            )

        snapshot = self._read_active_wifi_snapshot()
        return NetworkStatusRead(
            online=self._internet_reachable() if snapshot.connected else False,
            connected=snapshot.connected,
            ssid=snapshot.ssid,
            ip=snapshot.ip,
            signal_percent=snapshot.signal_percent,
            signal_bars=self._signal_bars(snapshot.signal_percent),
            setup_mode=False,
            network_mode="normal",
        )

    def _read_active_wifi_snapshot(self) -> ActiveWifiSnapshot:
        nmcli = which("nmcli")
        if not nmcli:
            return ActiveWifiSnapshot()

        device_details = self._run_command(
            [
                nmcli,
                "-t",
                "-f",
                "GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS",
                "device",
                "show",
                settings.wifi_interface,
            ],
        )
        if not device_details:
            return ActiveWifiSnapshot()

        connected = False
        ip_address: str | None = None
        for raw_line in device_details.splitlines():
            if not raw_line.strip():
                continue
            field, _, value = raw_line.partition(":")
            normalized = value.strip()
            if field == "GENERAL.STATE":
                connected = "connected" in normalized.lower()
            elif field.startswith("IP4.ADDRESS"):
                ip_address = normalized.split("/", maxsplit=1)[0] or None

        wifi_details = self._run_command(
            [
                nmcli,
                "-t",
                "-f",
                "ACTIVE,SSID,SIGNAL",
                "device",
                "wifi",
                "list",
                "ifname",
                settings.wifi_interface,
                "--rescan",
                "no",
            ],
        )
        ssid: str | None = None
        signal_percent: int | None = None
        for raw_line in wifi_details.splitlines():
            fields = parse_nmcli_terse_line(raw_line)
            if len(fields) < 3:
                continue
            active, candidate_ssid, signal = fields[:3]
            if active.lower() != "yes":
                continue
            ssid = candidate_ssid.strip() or None
            signal_percent = self._parse_signal_percent(signal)
            break

        if not connected and ssid is None and ip_address is None:
            return ActiveWifiSnapshot()

        return ActiveWifiSnapshot(
            connected=connected or bool(ssid or ip_address),
            ssid=ssid,
            ip=ip_address,
            signal_percent=signal_percent,
        )

    @staticmethod
    def _run_command(command: list[str], timeout: int = 12) -> str:
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=timeout,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return ""

        return (result.stdout or "").strip()

    @staticmethod
    def _parse_signal_percent(value: str) -> int | None:
        try:
            return max(0, min(int(value), 100))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _signal_bars(signal_percent: int | None) -> int:
        if signal_percent is None:
            return 0
        return min(5, max(1, (signal_percent // 20) + 1))

    @staticmethod
    def _internet_reachable() -> bool:
        for host, port in (("1.1.1.1", 443), ("8.8.8.8", 53)):
            try:
                with socket.create_connection((host, port), timeout=1.5):
                    return True
            except OSError:
                continue
        return False
