from __future__ import annotations

import subprocess
from shutil import which

from app.core.config import settings
from app.schemas.system import WifiScanResult
from app.services.network_status_service import parse_nmcli_terse_line


class WifiScanService:
    def scan(self) -> list[WifiScanResult]:
        nmcli = which("nmcli")
        if not nmcli:
            raise RuntimeError("Kein WLAN-Manager verfügbar (nmcli fehlt)")

        self._run_command([nmcli, "radio", "wifi", "on"])
        self._run_command([nmcli, "device", "wifi", "rescan", "ifname", settings.wifi_interface], check=False)

        result = self._run_command(
            [
                nmcli,
                "-t",
                "-f",
                "ACTIVE,SSID,SIGNAL,SECURITY",
                "device",
                "wifi",
                "list",
                "ifname",
                settings.wifi_interface,
                "--rescan",
                "no",
            ],
        )

        deduplicated: dict[str, WifiScanResult] = {}
        for raw_line in result.stdout.splitlines():
            fields = parse_nmcli_terse_line(raw_line)
            if len(fields) < 4:
                continue

            active_raw, ssid_raw, signal_raw, security_raw = fields[:4]
            ssid = ssid_raw.strip()
            if not ssid:
                continue

            signal = self._parse_signal(signal_raw)
            current = deduplicated.get(ssid)
            candidate = WifiScanResult(
                ssid=ssid,
                signal=signal,
                security=self._normalize_security(security_raw),
                active=active_raw.lower() == "yes",
            )
            if current is None or candidate.signal > current.signal or (candidate.active and not current.active):
                deduplicated[ssid] = candidate

        return sorted(
            deduplicated.values(),
            key=lambda item: (not item.active, -item.signal, item.ssid.lower()),
        )

    @staticmethod
    def _run_command(command: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
        try:
            return subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=check,
                timeout=20,
            )
        except FileNotFoundError as exc:
            raise RuntimeError("Kein WLAN-Manager verfügbar (nmcli fehlt)") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("WLAN-Scan hat zu lange gedauert") from exc
        except subprocess.CalledProcessError as exc:
            message = (exc.stderr or exc.stdout or "").strip()
            raise RuntimeError(message or "WLAN-Scan konnte nicht gestartet werden") from exc

    @staticmethod
    def _parse_signal(value: str) -> int:
        try:
            return max(0, min(int(value), 100))
        except (TypeError, ValueError):
            return 0

    @staticmethod
    def _normalize_security(value: str) -> str:
        normalized = value.strip().upper()
        if not normalized or normalized == "--":
            return "Open"
        if "WPA3" in normalized:
            return "WPA3"
        if "WPA2" in normalized:
            return "WPA2"
        if "WPA1" in normalized or "WEP" in normalized:
            return "Legacy"
        return normalized.replace(" ", "")
