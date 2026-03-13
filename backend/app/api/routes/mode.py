from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.db.session import SessionLocal
from app.schemas.auth import SessionUser
from app.schemas.mode import ModeRead, ModeUpdate
from app.services.event_service import event_service
from app.services.mode_service import ModeService
from app.services.selfie_service import SelfieService

router = APIRouter()


@router.get("/mode", response_model=ModeRead)
def read_mode(db: Session = Depends(get_db)) -> ModeRead:
    return ModeService(db).get_mode()


@router.put("/mode", response_model=ModeRead)
async def set_mode(
    payload: ModeUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> ModeRead:
    previous_mode = ModeService(db).get_mode().mode
    mode_state = ModeService(db).set_mode(payload.mode)
    selfie_state = None
    if payload.mode == "selfie":
        selfie_state = SelfieService(db).ensure_slideshow_running()
    await event_service.publish_mode(mode_state)
    if selfie_state is not None:
        await event_service.publish_selfie_settings(selfie_state)
    if payload.mode == "blackout" and previous_mode != "blackout":
        await event_service.publish_blackout_activated(mode_state)
    if previous_mode == "blackout" and payload.mode != "blackout":
        await event_service.publish_blackout_cleared(mode_state)
    return mode_state


@router.get("/mode/stream")
async def stream_mode() -> StreamingResponse:
    with SessionLocal() as session:
        initial_state = ModeService(session).get_mode()
    return StreamingResponse(
        event_service.stream([("mode_snapshot", initial_state.model_dump(mode="json"))]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
