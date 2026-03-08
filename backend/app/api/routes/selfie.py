from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.runtime import SelfiePlaybackEvent
from app.schemas.selfie import SelfieStateRead, SelfieStateUpdate
from app.services.event_service import event_service
from app.services.runtime_service import runtime_service
from app.services.selfie_service import SelfieService

router = APIRouter()


@router.get("/selfie", response_model=SelfieStateRead)
def read_selfie_state(db: Session = Depends(get_db)) -> SelfieStateRead:
    return SelfieService(db).get_state()


@router.put("/selfie", response_model=SelfieStateRead)
async def update_selfie_state(
    payload: SelfieStateUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> SelfieStateRead:
    selfie_state = SelfieService(db).update_state(payload)
    await event_service.publish_selfie_settings(selfie_state)
    return selfie_state


@router.post("/selfie/actions/next", response_model=SelfiePlaybackEvent)
async def selfie_next(
    _: SessionUser = Depends(require_admin_user),
) -> SelfiePlaybackEvent:
    event = runtime_service.issue_selfie_action("next")
    await event_service.publish_selfie_playback(event)
    return event


@router.post("/selfie/actions/reload", response_model=SelfiePlaybackEvent)
async def selfie_reload(
    _: SessionUser = Depends(require_admin_user),
) -> SelfiePlaybackEvent:
    event = runtime_service.issue_selfie_action("reload_pool")
    await event_service.publish_selfie_playback(event)
    return event
