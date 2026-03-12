#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import logging
import math
import signal
import threading
import time
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Optional
from urllib.parse import urlsplit

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


DEFAULT_HOST = "0.0.0.0"
DEFAULT_PORT = 9001
DEFAULT_WIDTH = 1920
DEFAULT_HEIGHT = 1080
DEFAULT_FPS = 20.0
DEFAULT_JPEG_QUALITY = 82

BOUNDARY = "frame"


@dataclass(frozen=True)
class StreamConfig:
    host: str
    port: int
    width: int
    height: int
    fps: float
    jpeg_quality: int


class FrameStore:
    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._frame: Optional[bytes] = None
        self._frame_id = 0

    def publish(self, frame: bytes) -> None:
        with self._condition:
            self._frame = frame
            self._frame_id += 1
            self._condition.notify_all()

    def wait_for_next(self, last_frame_id: int, timeout: float = 2.0) -> tuple[int, Optional[bytes]]:
        with self._condition:
            if self._frame_id == last_frame_id:
                self._condition.wait(timeout=timeout)
            return self._frame_id, self._frame

    def latest(self) -> Optional[bytes]:
        with self._condition:
            return self._frame


class VisualizerRenderer:
    def __init__(self, width: int, height: int) -> None:
        self.width = width
        self.height = height
        self.aspect = width / height
        self._jpeg_quality = DEFAULT_JPEG_QUALITY

        x = np.linspace(-1.0, 1.0, width, dtype=np.float32)
        y = np.linspace(-1.0, 1.0, height, dtype=np.float32)
        self.grid_x, self.grid_y = np.meshgrid(x, y)

        warped_x = self.grid_x * self.aspect
        self.radial = np.sqrt((warped_x**2) + (self.grid_y**2))
        self.angle = np.arctan2(self.grid_y, warped_x)
        self.vignette = np.clip(1.12 - self.radial * 0.55, 0.35, 1.0)
        self.noise_seed = np.sin((self.grid_x * 19.0) + (self.grid_y * 13.0))

    def render_frame(self, timestamp: float) -> bytes:
        pulse = 0.5 + 0.5 * math.sin(timestamp * 0.55)

        nebula = 0.5 + 0.5 * np.sin(
            (self.radial * 13.5)
            - (timestamp * 2.1)
            + np.sin((self.angle * 3.0) + (timestamp * 0.7)) * 1.8
        )
        tunnel = 0.5 + 0.5 * np.cos((self.angle * 6.0) - (self.radial * 11.0) + (timestamp * 1.4))
        drift = 0.5 + 0.5 * np.sin(
            (self.grid_x * 6.5) + (self.grid_y * 4.5) + (timestamp * 0.85) + (self.noise_seed * 0.7)
        )

        field = np.clip((nebula * 0.55) + (tunnel * 0.3) + (drift * 0.22), 0.0, 1.0)

        glow = np.zeros_like(field)
        centers = (
            (-0.55 + math.sin(timestamp * 0.42) * 0.18, 0.25 + math.cos(timestamp * 0.73) * 0.15, 0.11),
            (0.35 + math.cos(timestamp * 0.51) * 0.22, -0.18 + math.sin(timestamp * 0.61) * 0.20, 0.09),
            (math.sin(timestamp * 0.32) * 0.35, math.cos(timestamp * 0.27) * 0.28, 0.14),
        )
        for cx, cy, sigma in centers:
            dist2 = ((self.grid_x - cx) ** 2) + ((self.grid_y - cy) ** 2)
            glow += np.exp(-dist2 / sigma)
        glow = np.clip(glow, 0.0, 1.35)

        ring = np.exp(-((self.radial - (0.34 + 0.08 * math.sin(timestamp * 0.9))) ** 2) / 0.0018)
        spark = np.clip(np.sin((self.angle * 14.0) + (timestamp * 5.5)), 0.0, 1.0) * ring

        red = np.clip((field * 95.0) + (glow * 150.0) + (spark * 120.0) + (pulse * 18.0), 0, 255)
        green = np.clip((field * 150.0) + (glow * 110.0) + (tunnel * 35.0) + (spark * 40.0), 0, 255)
        blue = np.clip((field * 225.0) + (drift * 60.0) + (glow * 80.0) + (spark * 28.0), 0, 255)

        frame = np.stack((red, green, blue), axis=-1)
        frame *= self.vignette[..., None]
        rgb = frame.astype(np.uint8, copy=False)

        image = Image.fromarray(rgb, mode="RGB")

        overlay = Image.new("RGBA", (self.width, self.height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay, "RGBA")
        phase = timestamp * 0.9

        for index in range(5):
            orbit = phase + (index * 1.2)
            cx = int(self.width * (0.5 + math.sin(orbit * 0.7) * 0.22))
            cy = int(self.height * (0.5 + math.cos(orbit * 0.9) * 0.18))
            radius = int(min(self.width, self.height) * (0.07 + 0.03 * math.sin(phase + index)))
            color = (
                int(60 + index * 28),
                int(130 + pulse * 50),
                int(255 - index * 26),
                32,
            )
            draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), outline=color, width=4)

        for index in range(24):
            track = phase * (0.55 + index * 0.015)
            px = int(self.width * (0.5 + math.sin(track + index * 0.7) * (0.18 + index * 0.008)))
            py = int(self.height * (0.5 + math.cos(track * 1.3 + index) * (0.1 + index * 0.006)))
            radius = 4 + (index % 5)
            color = (
                120 + (index * 5),
                210,
                255,
                74,
            )
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=color)

        overlay = overlay.filter(ImageFilter.GaussianBlur(radius=9))
        composite = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")

        buffer = io.BytesIO()
        composite.save(buffer, format="JPEG", quality=self.jpeg_quality, optimize=False)
        return buffer.getvalue()

    @property
    def jpeg_quality(self) -> int:
        return self._jpeg_quality

    @jpeg_quality.setter
    def jpeg_quality(self, quality: int) -> None:
        self._jpeg_quality = quality


class RenderLoop(threading.Thread):
    def __init__(self, renderer: VisualizerRenderer, frames: FrameStore, fps: float, stop_event: threading.Event) -> None:
        super().__init__(daemon=True)
        self.renderer = renderer
        self.frames = frames
        self.fps = fps
        self.stop_event = stop_event

    def run(self) -> None:
        interval = 1.0 / self.fps
        next_tick = time.perf_counter()

        while not self.stop_event.is_set():
            now = time.perf_counter()
            frame = self.renderer.render_frame(now)
            self.frames.publish(frame)

            next_tick += interval
            sleep_for = next_tick - time.perf_counter()
            if sleep_for > 0:
                time.sleep(sleep_for)
            else:
                next_tick = time.perf_counter()


class StreamHandler(BaseHTTPRequestHandler):
    server: "RendererHTTPServer"

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path in ("/", "/index.html"):
            self._serve_index()
            return
        if path == "/health":
            self._serve_health()
            return
        if path == "/snapshot.jpg":
            self._serve_snapshot()
            return
        if path == "/stream":
            self._serve_stream()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")

    def do_HEAD(self) -> None:
        path = urlsplit(self.path).path
        if path in ("/", "/index.html"):
            body = self._index_body().encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/health":
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(b'{"status":"ok"}')))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/snapshot.jpg":
            frame = self.server.frames.latest()
            if frame is None:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Frame not ready yet")
                return
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(frame)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        if path == "/stream":
            self.send_response(HTTPStatus.OK)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Connection", "close")
            self.send_header("Content-Type", f"multipart/x-mixed-replace; boundary={BOUNDARY}")
            self.end_headers()
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")

    def _index_body(self) -> str:
        cfg = self.server.config
        return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Renderer PC Stream</title>
    <style>
      body {{
        margin: 0;
        font-family: Helvetica, Arial, sans-serif;
        background: #070b14;
        color: #f4f7fb;
        display: grid;
        place-items: center;
        min-height: 100vh;
      }}
      main {{
        width: min(94vw, 1280px);
      }}
      img {{
        width: 100%;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,0.12);
        box-shadow: 0 24px 70px rgba(0,0,0,0.45);
        background: #02040a;
      }}
      code {{
        color: #8fe6ff;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>Renderer PC MJPEG Stream</h1>
      <p>Resolution: <code>{cfg.width}x{cfg.height}</code> | FPS: <code>{cfg.fps:.1f}</code> | JPEG quality: <code>{cfg.jpeg_quality}</code></p>
      <p>Stream endpoint: <code>/stream</code></p>
      <img src="/stream" alt="MJPEG stream preview">
    </main>
  </body>
</html>
"""

    def _serve_index(self) -> None:
        encoded = self._index_body().encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def _serve_health(self) -> None:
        payload = b'{"status":"ok"}'
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _serve_snapshot(self) -> None:
        frame = self.server.frames.latest()
        if frame is None:
            self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "Frame not ready yet")
            return

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "image/jpeg")
        self.send_header("Content-Length", str(len(frame)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(frame)

    def _serve_stream(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Age", "0")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, private")
        self.send_header("Pragma", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("Content-Type", f"multipart/x-mixed-replace; boundary={BOUNDARY}")
        self.end_headers()

        last_frame_id = -1
        try:
            while not self.server.stop_event.is_set():
                frame_id, frame = self.server.frames.wait_for_next(last_frame_id)
                if frame is None or frame_id == last_frame_id:
                    continue

                last_frame_id = frame_id
                self.wfile.write(f"--{BOUNDARY}\r\n".encode("ascii"))
                self.wfile.write(b"Content-Type: image/jpeg\r\n")
                self.wfile.write(f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii"))
                self.wfile.write(frame)
                self.wfile.write(b"\r\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, TimeoutError):
            logging.info("Stream client disconnected: %s", self.client_address[0])

    def log_message(self, format: str, *args: object) -> None:
        logging.info("%s - %s", self.client_address[0], format % args)


class RendererHTTPServer(ThreadingHTTPServer):
    def __init__(
        self,
        server_address: tuple[str, int],
        handler_class: type[BaseHTTPRequestHandler],
        config: StreamConfig,
        frames: FrameStore,
        stop_event: threading.Event,
    ) -> None:
        super().__init__(server_address, handler_class)
        self.config = config
        self.frames = frames
        self.stop_event = stop_event


def parse_args() -> StreamConfig:
    parser = argparse.ArgumentParser(description="Local visualizer renderer with MJPEG/HTTP output.")
    parser.add_argument("--host", default=DEFAULT_HOST, help=f"Bind host (default: {DEFAULT_HOST})")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"Bind port (default: {DEFAULT_PORT})")
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH, help=f"Output width (default: {DEFAULT_WIDTH})")
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT, help=f"Output height (default: {DEFAULT_HEIGHT})")
    parser.add_argument("--fps", type=float, default=DEFAULT_FPS, help=f"Frames per second (default: {DEFAULT_FPS})")
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=DEFAULT_JPEG_QUALITY,
        help=f"JPEG quality 1-95 (default: {DEFAULT_JPEG_QUALITY})",
    )
    args = parser.parse_args()

    if args.width < 320 or args.height < 180:
        parser.error("Resolution is too small for this visualizer.")
    if args.fps <= 0 or args.fps > 60:
        parser.error("FPS must be between 0 and 60.")
    if args.jpeg_quality < 1 or args.jpeg_quality > 95:
        parser.error("JPEG quality must be between 1 and 95.")

    return StreamConfig(
        host=args.host,
        port=args.port,
        width=args.width,
        height=args.height,
        fps=args.fps,
        jpeg_quality=args.jpeg_quality,
    )


def main() -> None:
    config = parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    stop_event = threading.Event()
    frames = FrameStore()
    renderer = VisualizerRenderer(config.width, config.height)
    renderer.jpeg_quality = config.jpeg_quality
    loop = RenderLoop(renderer, frames, config.fps, stop_event)

    server = RendererHTTPServer((config.host, config.port), StreamHandler, config, frames, stop_event)
    server.daemon_threads = True

    def request_shutdown(signum: int, _frame: object) -> None:
        logging.info("Signal %s received, shutting down.", signum)
        stop_event.set()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, request_shutdown)
    signal.signal(signal.SIGTERM, request_shutdown)

    loop.start()

    logging.info(
        "Renderer PC stream listening on http://%s:%s/stream (%sx%s @ %.1f FPS, JPEG %s)",
        config.host,
        config.port,
        config.width,
        config.height,
        config.fps,
        config.jpeg_quality,
    )
    logging.info("Open preview page on http://127.0.0.1:%s/", config.port)

    try:
        server.serve_forever(poll_interval=0.5)
    finally:
        stop_event.set()
        server.server_close()
        loop.join(timeout=2)


if __name__ == "__main__":
    main()
