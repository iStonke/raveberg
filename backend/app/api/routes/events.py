from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.db.session import SessionLocal
from app.services.display_status_service import DisplayStatusService
from app.services.event_service import event_service
from app.services.mode_service import ModeService
from app.services.selfie_service import SelfieService
from app.services.visualizer_service import VisualizerService

router = APIRouter()


@router.get("/events/stream")
async def stream_events() -> StreamingResponse:
    with SessionLocal() as session:
        display_status = DisplayStatusService(session).get_status()
        mode = ModeService(session).get_mode()
        selfie = SelfieService(session).get_state()
        visualizer = VisualizerService(session).get_state()

    return StreamingResponse(
        event_service.stream(
            [
                ("heartbeat_updated", display_status.model_dump(mode="json")),
                ("mode_snapshot", mode.model_dump(mode="json")),
                ("selfie_snapshot", selfie.model_dump(mode="json")),
                ("visualizer_snapshot", visualizer.model_dump(mode="json")),
            ],
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
