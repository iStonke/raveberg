from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.display import DisplayHeartbeatUpdate, DisplayStatusRead
from app.services.display_status_service import DisplayStatusService
from app.services.event_service import event_service

router = APIRouter(prefix="/display")


@router.post("/heartbeat", response_model=DisplayStatusRead)
async def display_heartbeat(
    payload: DisplayHeartbeatUpdate,
    db: Session = Depends(get_db),
) -> DisplayStatusRead:
    status = DisplayStatusService(db).record_heartbeat(payload)
    await event_service.publish_heartbeat_updated(status)
    return status
