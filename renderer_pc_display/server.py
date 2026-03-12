#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import logging
import os
import signal
import threading
import time
from dataclasses import dataclass
from http import HTTPStatus
from typing import Optional

import mss
import numpy as np
from flask import Flask, Response, jsonify
from PIL import Image, ImageDraw
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


DEFAULT_DISPLAY_URL = "http://192.168.178.38:8085/display"
DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 9002
DEFAULT_WIDTH = 1920
DEFAULT_HEIGHT = 1080
DEFAULT_FPS = 20.0
DEFAULT_JPEG_QUALITY = 80
BOUNDARY = "frame"


@dataclass(frozen=True)
class RendererConfig:
    display_url: str
    width: int
    height: int
    fps: float
    jpeg_quality: int
    host: str
    port: int


class FrameStore:
    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._frame: Optional[bytes] = None
        self._frame_id = 0
        self._updated_at = 0.0

    def publish(self, frame: bytes) -> None:
        with self._condition:
            self._frame = frame
            self._frame_id += 1
            self._updated_at = time.time()
            self._condition.notify_all()

    def latest(self) -> tuple[int, Optional[bytes], float]:
        with self._condition:
            return self._frame_id, self._frame, self._updated_at

    def wait_for_next(self, last_frame_id: int, timeout: float = 2.0) -> tuple[int, Optional[bytes], float]:
        with self._condition:
            if self._frame_id == last_frame_id:
                self._condition.wait(timeout=timeout)
            return self._frame_id, self._frame, self._updated_at


class BrowserCaptureLoop(threading.Thread):
    def __init__(self, config: RendererConfig, frames: FrameStore, stop_event: threading.Event) -> None:
        super().__init__(daemon=True)
        self.config = config
        self.frames = frames
        self.stop_event = stop_event
        self.capture_backend = self._resolve_capture_backend()
        self._status_lock = threading.Lock()
        self._status = {
            "browser_ready": False,
            "page_ready": False,
            "capture_backend": self.capture_backend,
            "last_error": "",
            "last_capture_at": 0.0,
        }

    def status(self) -> dict[str, object]:
        with self._status_lock:
            return dict(self._status)

    def run(self) -> None:
        self.frames.publish(self._boot_frame("Renderer startet Chromium"))
        while not self.stop_event.is_set():
            try:
                self._run_session()
            except Exception as exc:  # pragma: no cover - defensive recovery loop
                logging.exception("Renderer session failed")
                self._set_status(
                    browser_ready=False,
                    page_ready=False,
                    last_error=str(exc),
                )
                self.frames.publish(self._boot_frame(f"Renderer reconnecting: {exc}"))
                self.stop_event.wait(2.0)

    def _run_session(self) -> None:
        capture_backend = self.capture_backend
        headed = capture_backend == "mss"

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                headless=not headed,
                args=[
                    "--disable-background-timer-throttling",
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                    "--disable-features=Translate,BackForwardCache,AcceptCHFrame",
                    f"--window-size={self.config.width},{self.config.height}",
                    "--window-position=0,0",
                    "--autoplay-policy=no-user-gesture-required",
                ],
            )
            context = browser.new_context(
                viewport={"width": self.config.width, "height": self.config.height},
                device_scale_factor=1,
                ignore_https_errors=True,
                java_script_enabled=True,
            )
            page = context.new_page()
            page.set_default_navigation_timeout(30_000)
            page.set_default_timeout(15_000)

            self._set_status(browser_ready=True, last_error="")
            logging.info("Loading display URL: %s", self.config.display_url)
            page.goto(self.config.display_url, wait_until="domcontentloaded")
            page.wait_for_timeout(1500)
            page.bring_to_front()
            self._set_status(page_ready=True)

            interval = 1.0 / self.config.fps
            next_tick = time.perf_counter()
            screen_capture = mss.mss() if capture_backend == "mss" else None

            try:
                while not self.stop_event.is_set():
                    try:
                        frame = self._capture_frame(page, screen_capture)
                    except Exception as exc:
                        if capture_backend == "mss":
                            logging.warning("MSS capture failed, falling back to Playwright screenshots: %s", exc)
                            capture_backend = "playwright"
                            self._set_status(capture_backend=capture_backend, last_error=str(exc))
                            frame = self._capture_with_playwright(page)
                        else:
                            raise

                    self.frames.publish(frame)
                    self._set_status(last_capture_at=time.time(), last_error="")

                    next_tick += interval
                    sleep_for = next_tick - time.perf_counter()
                    if sleep_for > 0:
                        time.sleep(sleep_for)
                    else:
                        next_tick = time.perf_counter()
            finally:
                if screen_capture is not None:
                    screen_capture.close()
                context.close()
                browser.close()
                self._set_status(browser_ready=False, page_ready=False)

    def _capture_frame(self, page, screen_capture: mss.mss | None) -> bytes:
        if screen_capture is not None:
            return self._capture_with_mss(screen_capture)
        return self._capture_with_playwright(page)

    def _capture_with_playwright(self, page) -> bytes:
        try:
            return page.screenshot(
                type="jpeg",
                quality=self.config.jpeg_quality,
                animations="allow",
                scale="css",
                caret="hide",
            )
        except PlaywrightTimeoutError as exc:
            raise RuntimeError(f"Playwright screenshot timeout: {exc}") from exc
        except PlaywrightError as exc:
            raise RuntimeError(f"Playwright screenshot failed: {exc}") from exc

    def _capture_with_mss(self, screen_capture: mss.mss) -> bytes:
        region = {
            "left": 0,
            "top": 0,
            "width": self.config.width,
            "height": self.config.height,
        }
        shot = screen_capture.grab(region)
        array = np.asarray(shot, dtype=np.uint8)
        rgb = array[:, :, :3][:, :, ::-1]
        image = Image.fromarray(rgb, mode="RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=self.config.jpeg_quality, optimize=False)
        return buffer.getvalue()

    def _boot_frame(self, message: str) -> bytes:
        image = Image.new("RGB", (self.config.width, self.config.height), "#07101c")
        draw = ImageDraw.Draw(image)
        draw.rectangle((0, 0, self.config.width, self.config.height), fill="#050812")
        draw.rectangle((80, 80, self.config.width - 80, self.config.height - 80), outline="#3b79b5", width=4)
        draw.text((120, 140), "RAVEBERG Remote Full Display Renderer", fill="#f4f7fb")
        draw.text((120, 210), message, fill="#9bd6ff")
        draw.text((120, 270), self.config.display_url, fill="#8da8be")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=self.config.jpeg_quality, optimize=False)
        return buffer.getvalue()

    def _resolve_capture_backend(self) -> str:
        requested = os.environ.get("RAVEBERG_CAPTURE_BACKEND", "playwright").strip().lower()
        if requested == "mss":
            return "mss"
        return "playwright"

    def _set_status(self, **updates: object) -> None:
        with self._status_lock:
            self._status.update(updates)


def parse_args() -> RendererConfig:
    parser = argparse.ArgumentParser(
        description="Render the Raspberry Pi display page on a stronger PC and expose it as MJPEG.",
    )
    parser.add_argument("--display-url", default=DEFAULT_DISPLAY_URL, help=f"Display URL (default: {DEFAULT_DISPLAY_URL})")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH, help=f"Render width (default: {DEFAULT_WIDTH})")
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT, help=f"Render height (default: {DEFAULT_HEIGHT})")
    parser.add_argument("--fps", type=float, default=DEFAULT_FPS, help=f"Capture FPS (default: {DEFAULT_FPS})")
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=DEFAULT_JPEG_QUALITY,
        help=f"JPEG quality 1-95 (default: {DEFAULT_JPEG_QUALITY})",
    )
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Bind host (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Bind port (default: {DEFAULT_PORT})")
    args = parser.parse_args()

    if args.width < 320 or args.height < 180:
        parser.error("Resolution is too small.")
    if args.fps <= 0 or args.fps > 60:
        parser.error("FPS must be between 0 and 60.")
    if args.jpeg_quality < 1 or args.jpeg_quality > 95:
        parser.error("JPEG quality must be between 1 and 95.")

    return RendererConfig(
        display_url=args.display_url,
        width=args.width,
        height=args.height,
        fps=args.fps,
        jpeg_quality=args.jpeg_quality,
        host=args.host,
        port=args.port,
    )


def create_app(config: RendererConfig, frames: FrameStore, capture_loop: BrowserCaptureLoop) -> Flask:
    app = Flask(__name__)

    @app.get("/health")
    def health() -> Response:
        frame_id, frame, updated_at = frames.latest()
        payload = {
            "status": "ok",
            "display_url": config.display_url,
            "browser": capture_loop.status(),
            "frame_ready": frame is not None,
            "frame_id": frame_id,
            "last_frame_at": updated_at or None,
        }
        return jsonify(payload)

    @app.get("/snapshot.jpg")
    def snapshot() -> Response:
        _frame_id, frame, _updated_at = frames.latest()
        if frame is None:
            return Response("Frame not ready yet", status=HTTPStatus.SERVICE_UNAVAILABLE)
        return Response(frame, mimetype="image/jpeg", headers={"Cache-Control": "no-store"})

    @app.get("/preview")
    def preview() -> Response:
        html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>RAVEBERG Remote Display Renderer</title>
    <style>
      body {{
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #05070d;
        color: #eef5ff;
        font-family: Helvetica, Arial, sans-serif;
      }}
      main {{
        width: min(94vw, 1280px);
      }}
      img {{
        width: 100%;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.1);
        background: #03050a;
        box-shadow: 0 20px 70px rgba(0,0,0,0.45);
      }}
      code {{
        color: #8fd6ff;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>Remote Full Display Renderer</h1>
      <p>Source: <code>{config.display_url}</code></p>
      <p>Output: <code>{config.width}x{config.height}</code> at <code>{config.fps:.1f} FPS</code></p>
      <img src="/stream" alt="MJPEG preview">
    </main>
  </body>
</html>
"""
        return Response(html, mimetype="text/html")

    @app.get("/stream")
    def stream() -> Response:
        def generate():
            last_frame_id = -1
            while True:
                frame_id, frame, _updated_at = frames.wait_for_next(last_frame_id)
                if frame is None or frame_id == last_frame_id:
                    continue
                last_frame_id = frame_id
                yield (
                    b"--" + BOUNDARY.encode("ascii") + b"\r\n"
                    b"Content-Type: image/jpeg\r\n"
                    + f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii")
                    + frame
                    + b"\r\n"
                )

        headers = {
            "Age": "0",
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "Pragma": "no-cache",
            "Connection": "close",
        }
        return Response(
            generate(),
            mimetype=f"multipart/x-mixed-replace; boundary={BOUNDARY}",
            headers=headers,
        )

    return app


def main() -> None:
    config = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    stop_event = threading.Event()
    frames = FrameStore()
    capture_loop = BrowserCaptureLoop(config, frames, stop_event)
    app = create_app(config, frames, capture_loop)

    def request_shutdown(signum: int, _frame: object) -> None:
        logging.info("Signal %s received, shutting down.", signum)
        stop_event.set()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    capture_loop.start()
    logging.info(
        "Remote full display renderer listening on http://%s:%s/preview (stream: /stream)",
        config.host,
        config.port,
    )
    logging.info("Rendering source display: %s", config.display_url)

    try:
        app.run(host=config.host, port=config.port, threaded=True, debug=False, use_reloader=False)
    finally:
        stop_event.set()
        capture_loop.join(timeout=5)


if __name__ == "__main__":
    main()
