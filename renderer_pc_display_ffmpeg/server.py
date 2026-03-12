#!/usr/bin/env python3
from __future__ import annotations

import argparse
import logging
import shlex
import signal
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass
from http import HTTPStatus
from pathlib import Path

from flask import Flask, Response, jsonify, redirect, send_from_directory


DEFAULT_DISPLAY_URL = "http://192.168.178.92:8085/display"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 9003
DEFAULT_WIDTH = 1920
DEFAULT_HEIGHT = 1080
DEFAULT_FPS = 20
DEFAULT_SCREEN_DEVICE = "1"
DEFAULT_PIXEL_FORMAT = "uyvy422"
DEFAULT_ENCODER = "h264_videotoolbox"
DEFAULT_VIDEO_BITRATE = "5000k"
DEFAULT_MAXRATE = "6500k"
DEFAULT_BUFSIZE = "10000k"
DEFAULT_HLS_TIME = 1
DEFAULT_HLS_LIST_SIZE = 4
PLAYLIST_FILENAME = "playlist.m3u8"
BASE_DIR = Path(__file__).resolve().parent
DEFAULT_HLS_DIRECTORY = BASE_DIR / "runtime" / "hls"


@dataclass(frozen=True)
class RendererConfig:
    display_url: str
    width: int
    height: int
    fps: int
    host: str
    port: int
    browser_path: str
    ffmpeg_path: str
    browser_x: int
    browser_y: int
    capture_x: int
    capture_y: int
    screen_device: str
    pixel_format: str
    encoder: str
    video_bitrate: str
    maxrate: str
    bufsize: str
    hls_time: int
    hls_list_size: int
    hls_directory: str
    browser_profile_dir: str


class BrowserProcess:
    def __init__(self, config: RendererConfig) -> None:
        self.config = config
        self.process: subprocess.Popen[bytes] | None = None

    def start(self) -> None:
        if self.process and self.process.poll() is None:
            return

        cmd = [
            self.config.browser_path,
            f"--app={self.config.display_url}",
            f"--window-position={self.config.browser_x},{self.config.browser_y}",
            f"--window-size={self.config.width},{self.config.height}",
            f"--user-data-dir={self.config.browser_profile_dir}",
            "--autoplay-policy=no-user-gesture-required",
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-component-update",
            "--disable-default-apps",
            "--disable-features=Translate,BackForwardCache,MediaRouter,GlobalMediaControls",
            "--disable-hang-monitor",
            "--disable-infobars",
            "--disable-popup-blocking",
            "--disable-renderer-backgrounding",
            "--disable-session-crashed-bubble",
            "--force-device-scale-factor=1",
            "--kiosk",
            "--new-window",
            "--no-default-browser-check",
            "--no-first-run",
            "--password-store=basic",
            "--use-fake-ui-for-media-stream",
        ]

        logging.info("Starting browser: %s", shlex.join(cmd))
        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            start_new_session=True,
        )

    def stop(self) -> None:
        if not self.process:
            return
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)

    def pid(self) -> int | None:
        if not self.process:
            return None
        return self.process.pid

    def running(self) -> bool:
        return bool(self.process and self.process.poll() is None)


class FFmpegCapture(threading.Thread):
    def __init__(self, config: RendererConfig, stop_event: threading.Event) -> None:
        super().__init__(daemon=True)
        self.config = config
        self.stop_event = stop_event
        self.process: subprocess.Popen[bytes] | None = None
        self._status_lock = threading.Lock()
        self._status = {
            "running": False,
            "last_error": "",
            "stderr_tail": "",
            "last_stderr_at": 0.0,
            "command": "",
            "pixel_format": self.config.pixel_format,
            "encoder": self.config.encoder,
            "hardware_encoding": self.config.encoder.endswith("_videotoolbox"),
            "output_mode": "hls_only",
            "hls_directory": self.config.hls_directory,
        }

    def status(self) -> dict[str, object]:
        with self._status_lock:
            return dict(self._status)

    def run(self) -> None:
        while not self.stop_event.is_set():
            try:
                self._run_once()
            except Exception as exc:  # pragma: no cover - defensive long-running loop
                logging.exception("ffmpeg capture loop failed")
                self._set_status(running=False, last_error=str(exc))
                self.stop_event.wait(2.0)

    def stop(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)

    def _run_once(self) -> None:
        self._prepare_hls_directory()
        cmd = self._build_ffmpeg_command()
        command_str = shlex.join(cmd)
        playlist_path = Path(self.config.hls_directory) / PLAYLIST_FILENAME
        logging.info("Starting ffmpeg: %s", command_str)
        logging.info(
            "ffmpeg avfoundation captures screen device %s natively with pixel format %s",
            self.config.screen_device,
            self.config.pixel_format,
        )
        logging.info(
            "Target output size %sx%s is produced in the ffmpeg filter chain, not via avfoundation -video_size",
            self.config.width,
            self.config.height,
        )
        logging.info(
            "Primary output uses encoder %s (%s)",
            self.config.encoder,
            "hardware" if self.config.encoder.endswith("_videotoolbox") else "software",
        )
        logging.info("HLS-only mode active. MJPEG stdout path is disabled.")
        logging.info("HLS output directory: %s", Path(self.config.hls_directory).resolve())
        logging.info("HLS playlist path: %s", playlist_path.resolve())
        self.process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            stdin=subprocess.DEVNULL,
            bufsize=0,
            start_new_session=True,
        )
        self._set_status(running=True, last_error="", command=command_str)

        stderr_reader = threading.Thread(target=self._read_stderr, args=(self.process,), daemon=True)
        stderr_reader.start()

        try:
            while not self.stop_event.is_set():
                if self.process.poll() is not None:
                    raise RuntimeError(f"ffmpeg exited with code {self.process.returncode}")
                time.sleep(0.5)
        finally:
            self._set_status(running=False)
            if self.process and self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait(timeout=5)
            self.process = None

    def _build_ffmpeg_command(self) -> list[str]:
        video_filter = ",".join(
            [
                f"crop={self.config.width}:{self.config.height}:{self.config.capture_x}:{self.config.capture_y}",
                f"scale={self.config.width}:{self.config.height}:flags=lanczos",
                "setsar=1",
            ]
        )
        hls_dir = Path(self.config.hls_directory)
        hls_output = hls_dir / PLAYLIST_FILENAME
        hls_segment_pattern = hls_dir / "segment_%05d.ts"

        return [
            self.config.ffmpeg_path,
            "-hide_banner",
            "-loglevel",
            "warning",
            "-f",
            "avfoundation",
            "-pixel_format",
            self.config.pixel_format,
            "-framerate",
            str(self.config.fps),
            "-capture_cursor",
            "0",
            "-capture_mouse_clicks",
            "0",
            "-i",
            f"{self.config.screen_device}:none",
            "-an",
            "-vf",
            video_filter,
            *self._h264_output_args(),
            "-f",
            "hls",
            "-hls_time",
            str(self.config.hls_time),
            "-hls_list_size",
            str(self.config.hls_list_size),
            "-hls_allow_cache",
            "0",
            "-hls_flags",
            "delete_segments+append_list+omit_endlist+independent_segments+program_date_time",
            "-hls_segment_filename",
            str(hls_segment_pattern),
            str(hls_output),
        ]

    def _h264_output_args(self) -> list[str]:
        gop = max(self.config.fps * 2, self.config.fps)
        args = [
            "-c:v",
            self.config.encoder,
            "-pix_fmt",
            "yuv420p",
            "-g",
            str(gop),
            "-keyint_min",
            str(gop),
            "-b:v",
            self.config.video_bitrate,
            "-maxrate",
            self.config.maxrate,
            "-bufsize",
            self.config.bufsize,
            "-profile:v",
            "main",
        ]
        if self.config.encoder.endswith("_videotoolbox"):
            args.extend(["-realtime", "1"])
        else:
            args.extend(["-preset", "veryfast", "-tune", "zerolatency", "-sc_threshold", "0"])
        return args

    def _prepare_hls_directory(self) -> None:
        hls_dir = Path(self.config.hls_directory)
        hls_dir.mkdir(parents=True, exist_ok=True)
        for pattern in ("*.m3u8", "*.ts", "*.m4s", "*.mp4"):
            for candidate in hls_dir.glob(pattern):
                try:
                    candidate.unlink()
                except FileNotFoundError:
                    continue

    def _read_stderr(self, process: subprocess.Popen[bytes]) -> None:
        if process.stderr is None:
            return
        lines: list[str] = []
        while not self.stop_event.is_set():
            raw = process.stderr.readline()
            if not raw:
                break
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            lines.append(line)
            lines = lines[-20:]
            self._set_status(stderr_tail="\n".join(lines), last_stderr_at=time.time())

    def _set_status(self, **updates: object) -> None:
        with self._status_lock:
            self._status.update(updates)


def detect_browser_path(explicit_path: str | None) -> str:
    if explicit_path:
        return explicit_path

    candidates = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return candidate
    raise RuntimeError("No Chrome/Chromium binary found. Pass --browser-path explicitly.")


def create_app(
    config: RendererConfig,
    browser: BrowserProcess,
    ffmpeg_capture: FFmpegCapture,
) -> Flask:
    app = Flask(__name__)
    started_at = time.time()
    hls_dir = Path(config.hls_directory).resolve()

    def hls_status() -> dict[str, object]:
        playlist = hls_dir / PLAYLIST_FILENAME
        segments = sorted(hls_dir.glob("segment_*.*"))
        latest_segment = segments[-1] if segments else None
        playlist_mtime = playlist.stat().st_mtime if playlist.exists() else None
        latest_segment_mtime = latest_segment.stat().st_mtime if latest_segment else None
        ready = playlist.exists() and bool(segments)
        return {
            "mode": "hls_only",
            "directory": str(hls_dir),
            "playlist_path": str(playlist),
            "playlist_url": f"/hls/{PLAYLIST_FILENAME}",
            "playlist_exists": playlist.exists(),
            "playlist_updated_at": playlist_mtime,
            "segment_count": len(segments),
            "ready": ready,
            "latest_segment": latest_segment.name if latest_segment else None,
            "latest_segment_updated_at": latest_segment_mtime,
            "recent_activity_at": max(
                value for value in (playlist_mtime, latest_segment_mtime) if value is not None
            ) if playlist_mtime is not None or latest_segment_mtime is not None else None,
            "sample_segments": [segment.name for segment in segments[-3:]],
            "encoder": config.encoder,
            "hardware_encoding": config.encoder.endswith("_videotoolbox"),
            "bitrate": config.video_bitrate,
            "maxrate": config.maxrate,
            "bufsize": config.bufsize,
            "hls_time": config.hls_time,
            "hls_list_size": config.hls_list_size,
        }

    @app.get("/health")
    def health() -> Response:
        payload = {
            "status": "ok",
            "display_url": config.display_url,
            "uptime_seconds": round(time.time() - started_at, 1),
            "browser_running": browser.running(),
            "browser_pid": browser.pid(),
            "ffmpeg": ffmpeg_capture.status(),
            "preferred_output": hls_status(),
            "capture_region": {
                "x": config.capture_x,
                "y": config.capture_y,
                "width": config.width,
                "height": config.height,
            },
        }
        return jsonify(payload)

    @app.get("/snapshot.jpg")
    def snapshot() -> Response:
        return Response(
            "Snapshot is disabled in HLS-only mode.",
            status=HTTPStatus.NOT_IMPLEMENTED,
            mimetype="text/plain",
        )

    @app.get("/preview")
    def preview() -> Response:
        hls = hls_status()
        hls_ready = bool(hls["ready"])
        status_copy = (
            f'HLS output ready: <code>/hls/{PLAYLIST_FILENAME}</code>'
            if hls_ready
            else "HLS output not ready yet. Waiting for playlist and segments."
        )
        html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>RAVEBERG Remote Full Display Renderer (HLS)</title>
    <style>
      body {{
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #06080d;
        color: #f3f7fd;
        font-family: Helvetica, Arial, sans-serif;
      }}
      main {{
        width: min(94vw, 1280px);
      }}
      video,
      img {{
        width: 100%;
        display: block;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 22px 72px rgba(0,0,0,0.46);
        background: #04060a;
      }}
      code {{
        color: #8fdcff;
      }}
      .meta {{
        display: grid;
        gap: 0.6rem;
        margin-bottom: 1rem;
      }}
      .fallback {{
        margin-top: 1rem;
        color: rgba(255,255,255,0.7);
      }}
      .status {{
        margin-bottom: 1rem;
        padding: 0.85rem 1rem;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
      }}
      .status--waiting {{
        color: #ffd9a8;
        border-color: rgba(255, 180, 90, 0.28);
        background: rgba(255, 180, 90, 0.08);
      }}
      a {{
        color: #8fdcff;
      }}
    </style>
    <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
  </head>
  <body>
    <main>
      <h1>Remote Full Display Renderer</h1>
      <div class="meta">
        <div>Source: <code>{config.display_url}</code></div>
        <div>Preferred output: <code>/hls/{PLAYLIST_FILENAME}</code> via <code>{config.encoder}</code></div>
        <div>Output mode: <code>HLS-only</code></div>
      </div>
      <div class="status {'status--waiting' if not hls_ready else ''}">{status_copy}</div>
      <video id="player" controls autoplay muted playsinline></video>
      <div class="fallback">
        If HLS playback is unavailable in this browser, inspect
        <a href="/health">/health</a>
        and the generated files under <code>{hls_dir}</code>.
      </div>
      <script>
        const video = document.getElementById('player');
        const source = '/hls/{PLAYLIST_FILENAME}';
        const statusBox = document.querySelector('.status');
        let playerAttached = false;
        function attachPlayer() {{
          if (playerAttached) {{
            return;
          }}
          playerAttached = true;
          if (video.canPlayType('application/vnd.apple.mpegurl')) {{
            video.src = source;
            return;
          }}
          if (window.Hls && window.Hls.isSupported()) {{
            const hls = new Hls({{
              lowLatencyMode: true,
              liveSyncDurationCount: 2,
            }});
            hls.loadSource(source);
            hls.attachMedia(video);
            return;
          }}
          const fallback = document.createElement('p');
          fallback.textContent = 'HLS playback is not supported here. Inspect /health and the HLS files on disk.';
          document.body.appendChild(fallback);
        }}
        async function refreshStatus() {{
          try {{
            const response = await fetch('/health', {{ cache: 'no-store' }});
            const health = await response.json();
            const preferred = health.preferred_output || {{}};
            if (preferred.ready) {{
              statusBox.classList.remove('status--waiting');
              statusBox.innerHTML = 'HLS output ready: <code>/hls/{PLAYLIST_FILENAME}</code>';
              attachPlayer();
            }} else {{
              statusBox.classList.add('status--waiting');
              statusBox.textContent = 'HLS output not ready yet. Waiting for playlist and segments.';
            }}
          }} catch (_error) {{
            statusBox.classList.add('status--waiting');
            statusBox.textContent = 'Unable to read /health while waiting for HLS output.';
          }}
        }}
        refreshStatus();
        window.setInterval(refreshStatus, 2000);
      </script>
    </main>
  </body>
</html>
"""
        return Response(html, mimetype="text/html")

    @app.get("/video")
    def video_redirect() -> Response:
        return redirect(f"/hls/{PLAYLIST_FILENAME}", code=302)

    @app.get("/hls/<path:filename>")
    def hls_file(filename: str) -> Response:
        response = send_from_directory(hls_dir, filename, conditional=True, max_age=0)
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
        return response

    @app.get("/stream")
    def stream() -> Response:
        return Response(
            "MJPEG debug stream is disabled in HLS-only mode.",
            status=HTTPStatus.NOT_IMPLEMENTED,
            mimetype="text/plain",
        )

    return app


def list_screen_devices(ffmpeg_path: str) -> int:
    logging.info("Listing macOS avfoundation devices")
    result = subprocess.run(
        [
            ffmpeg_path,
            "-f",
            "avfoundation",
            "-list_devices",
            "true",
            "-i",
            "",
        ],
        capture_output=True,
        text=True,
    )
    output = (result.stdout or "") + (result.stderr or "")
    print(output)
    return result.returncode


def resolve_hls_directory(explicit_directory: str | None) -> str:
    if explicit_directory:
        return str(Path(explicit_directory).expanduser().resolve())
    return str(DEFAULT_HLS_DIRECTORY.resolve())


def parse_args() -> tuple[RendererConfig | None, bool]:
    parser = argparse.ArgumentParser(
        description="Remote full display renderer using a real browser window and ffmpeg screen capture.",
    )
    parser.add_argument("--display-url", default=DEFAULT_DISPLAY_URL, help=f"Display URL (default: {DEFAULT_DISPLAY_URL})")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH, help=f"Capture width (default: {DEFAULT_WIDTH})")
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT, help=f"Capture height (default: {DEFAULT_HEIGHT})")
    parser.add_argument("--fps", type=int, default=DEFAULT_FPS, help=f"Capture FPS (default: {DEFAULT_FPS})")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Bind host (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Bind port (default: {DEFAULT_PORT})")
    parser.add_argument("--browser-path", default=None, help="Path to Chrome/Chromium binary")
    parser.add_argument("--ffmpeg-path", default="ffmpeg", help="Path to ffmpeg binary")
    parser.add_argument("--browser-x", type=int, default=0, help="Browser window X position (default: 0)")
    parser.add_argument("--browser-y", type=int, default=0, help="Browser window Y position (default: 0)")
    parser.add_argument("--capture-x", type=int, default=0, help="Capture region X offset (default: 0)")
    parser.add_argument("--capture-y", type=int, default=0, help="Capture region Y offset (default: 0)")
    parser.add_argument("--screen-device", default=DEFAULT_SCREEN_DEVICE, help=f"avfoundation screen device (default: {DEFAULT_SCREEN_DEVICE})")
    parser.add_argument("--encoder", default=DEFAULT_ENCODER, help=f"H.264 encoder (default: {DEFAULT_ENCODER})")
    parser.add_argument("--video-bitrate", default=DEFAULT_VIDEO_BITRATE, help=f"Target video bitrate (default: {DEFAULT_VIDEO_BITRATE})")
    parser.add_argument("--maxrate", default=DEFAULT_MAXRATE, help=f"Encoder maxrate (default: {DEFAULT_MAXRATE})")
    parser.add_argument("--bufsize", default=DEFAULT_BUFSIZE, help=f"Encoder bufsize (default: {DEFAULT_BUFSIZE})")
    parser.add_argument("--hls-time", type=int, default=DEFAULT_HLS_TIME, help=f"HLS segment duration in seconds (default: {DEFAULT_HLS_TIME})")
    parser.add_argument("--hls-list-size", type=int, default=DEFAULT_HLS_LIST_SIZE, help=f"HLS playlist size (default: {DEFAULT_HLS_LIST_SIZE})")
    parser.add_argument("--hls-directory", default=None, help="Directory for generated HLS playlist and segments")
    parser.add_argument("--browser-profile-dir", default=None, help="User data dir for the dedicated renderer browser profile")
    parser.add_argument("--list-screen-devices", action="store_true", help="List macOS avfoundation screen devices and exit")
    args = parser.parse_args()

    if args.list_screen_devices:
        config = RendererConfig(
            display_url=args.display_url,
            width=args.width,
            height=args.height,
            fps=args.fps,
            host=args.host,
            port=args.port,
            browser_path=args.browser_path or "",
            ffmpeg_path=args.ffmpeg_path,
            browser_x=args.browser_x,
            browser_y=args.browser_y,
            capture_x=args.capture_x,
            capture_y=args.capture_y,
            screen_device=args.screen_device,
            pixel_format=DEFAULT_PIXEL_FORMAT,
            encoder=args.encoder,
            video_bitrate=args.video_bitrate,
            maxrate=args.maxrate,
            bufsize=args.bufsize,
            hls_time=args.hls_time,
            hls_list_size=args.hls_list_size,
            hls_directory=resolve_hls_directory(args.hls_directory),
            browser_profile_dir=args.browser_profile_dir or "",
        )
        return config, True

    if sys.platform != "darwin":
        parser.error("This prototype currently targets macOS because it relies on ffmpeg avfoundation screen capture.")
    if args.width < 320 or args.height < 180:
        parser.error("Resolution is too small.")
    if args.fps <= 0 or args.fps > 60:
        parser.error("FPS must be between 1 and 60.")
    if args.hls_time <= 0:
        parser.error("HLS segment duration must be at least 1 second.")
    if args.hls_list_size < 2:
        parser.error("HLS playlist size must be at least 2.")

    profile_dir = args.browser_profile_dir or tempfile.mkdtemp(prefix="raveberg-renderer-browser-")
    hls_directory = resolve_hls_directory(args.hls_directory)

    return (
        RendererConfig(
            display_url=args.display_url,
            width=args.width,
            height=args.height,
            fps=args.fps,
            host=args.host,
            port=args.port,
            browser_path=detect_browser_path(args.browser_path),
            ffmpeg_path=args.ffmpeg_path,
            browser_x=args.browser_x,
            browser_y=args.browser_y,
            capture_x=args.capture_x,
            capture_y=args.capture_y,
            screen_device=args.screen_device,
            pixel_format=DEFAULT_PIXEL_FORMAT,
            encoder=args.encoder,
            video_bitrate=args.video_bitrate,
            maxrate=args.maxrate,
            bufsize=args.bufsize,
            hls_time=args.hls_time,
            hls_list_size=args.hls_list_size,
            hls_directory=hls_directory,
            browser_profile_dir=profile_dir,
        ),
        False,
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    config, list_only = parse_args()
    if config is None:
        raise RuntimeError("Renderer config could not be created")

    if list_only:
        raise SystemExit(list_screen_devices(config.ffmpeg_path))

    logging.info(
        "Starting renderer for %s with capture region %sx%s at (%s,%s)",
        config.display_url,
        config.width,
        config.height,
        config.capture_x,
        config.capture_y,
    )
    logging.info("Browser profile dir: %s", config.browser_profile_dir)
    logging.info("HLS output dir: %s", config.hls_directory)
    logging.info("HLS playlist path: %s", (Path(config.hls_directory) / PLAYLIST_FILENAME).resolve())
    logging.info(
        "Preferred output is HLS/H.264 via %s (%s)",
        config.encoder,
        "hardware" if config.encoder.endswith("_videotoolbox") else "software",
    )
    logging.info("HLS-only mode active. MJPEG debug path is disabled.")

    stop_event = threading.Event()
    browser = BrowserProcess(config)
    ffmpeg_capture = FFmpegCapture(config, stop_event)
    app = create_app(config, browser, ffmpeg_capture)

    def request_shutdown(signum: int, _frame: object) -> None:
        logging.info("Signal %s received, shutting down.", signum)
        stop_event.set()
        ffmpeg_capture.stop()
        browser.stop()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    browser.start()
    time.sleep(2.5)
    ffmpeg_capture.start()

    def warn_if_hls_missing() -> None:
        playlist_path = Path(config.hls_directory) / PLAYLIST_FILENAME
        if stop_event.wait(max(4, config.hls_time * 3)):
            return
        segments = list(Path(config.hls_directory).glob("segment_*.*"))
        if not playlist_path.exists() or not segments:
            logging.warning(
                "HLS output not ready yet. playlist_exists=%s segment_count=%s directory=%s",
                playlist_path.exists(),
                len(segments),
                Path(config.hls_directory).resolve(),
            )

    threading.Thread(target=warn_if_hls_missing, daemon=True).start()

    logging.info("Preview available on http://%s:%s/preview", config.host, config.port)
    logging.info("HLS playlist available on http://%s:%s/hls/%s", config.host, config.port, PLAYLIST_FILENAME)

    try:
        app.run(host=config.host, port=config.port, threaded=True, debug=False, use_reloader=False)
    finally:
        stop_event.set()
        ffmpeg_capture.stop()
        browser.stop()
        ffmpeg_capture.join(timeout=5)


if __name__ == "__main__":
    main()
