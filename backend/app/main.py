from contextlib import asynccontextmanager, suppress
import asyncio
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.services.auth_service import AuthService
from app.services.display_status_service import DisplayStatusService
from app.services.event_service import event_service
from app.services.mode_service import ModeService
from app.services.network_setup_service import NetworkSetupService
from app.services.selfie_service import SelfieService
from app.services.standby_service import StandbyService
from app.services.video_service import VideoService
from app.services.visualizer_service import VisualizerService

logger = logging.getLogger(__name__)


async def visualizer_auto_cycle_loop() -> None:
    logger.info("[VisualizerAutoSwitch] loop_started")
    while True:
        await asyncio.sleep(1)
        with SessionLocal() as session:
            state = VisualizerService(session).cycle_if_due()
        if state is not None:
            await event_service.publish_visualizer(state)
            await event_service.publish_visualizer_preset_changed(state)


async def network_setup_monitor_loop() -> None:
    if not settings.auto_setup_mode_enabled:
        return

    logger.info("[NetworkSetupMonitor] loop_started")
    await asyncio.sleep(max(settings.auto_setup_mode_initial_delay_seconds, 1))
    service = NetworkSetupService()
    while True:
        try:
            service.auto_start_if_needed()
        except Exception:
            logger.exception("[NetworkSetupMonitor] auto-check failed")
        await asyncio.sleep(max(settings.auto_setup_mode_check_interval_seconds, 5))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Path(settings.app_data_path).mkdir(parents=True, exist_ok=True)
    Path(settings.uploads_path).mkdir(parents=True, exist_ok=True)
    Path(settings.uploads_original_path).mkdir(parents=True, exist_ok=True)
    Path(settings.uploads_display_path).mkdir(parents=True, exist_ok=True)
    Path(settings.videos_path).mkdir(parents=True, exist_ok=True)
    Path(settings.display_cache_path).mkdir(parents=True, exist_ok=True)
    Path(settings.setup_mode_runtime_dir).mkdir(parents=True, exist_ok=True)

    with SessionLocal() as session:
        AuthService(session).ensure_initial_admin()
        ModeService(session).ensure_state()
        SelfieService(session).ensure_state()
        StandbyService(session).ensure_state()
        VideoService(session).ensure_state()
        VisualizerService(session).ensure_state()
        DisplayStatusService(session).ensure_status()
    auto_cycle_task = asyncio.create_task(visualizer_auto_cycle_loop())
    network_setup_task = asyncio.create_task(network_setup_monitor_loop())
    try:
        yield
    finally:
        logger.info("[VisualizerAutoSwitch] loop_stopping")
        auto_cycle_task.cancel()
        network_setup_task.cancel()
        with suppress(asyncio.CancelledError):
            await auto_cycle_task
        with suppress(asyncio.CancelledError):
            await network_setup_task


app = FastAPI(
    title="RAVEBERG API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "status": "ok",
    }
