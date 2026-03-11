from fastapi import APIRouter

from app.api.routes import auth, display, events, health, mode, selfie, standby, system, uploads, video, visualizer

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(mode.router, tags=["mode"])
api_router.include_router(events.router, tags=["events"])
api_router.include_router(display.router, tags=["display"])
api_router.include_router(uploads.router, tags=["uploads"])
api_router.include_router(selfie.router, tags=["selfie"])
api_router.include_router(standby.router, tags=["standby"])
api_router.include_router(video.router, tags=["video"])
api_router.include_router(visualizer.router, tags=["visualizer"])
api_router.include_router(system.router, tags=["system"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
