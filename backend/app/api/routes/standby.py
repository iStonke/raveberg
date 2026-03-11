from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.standby import StandbyStateRead, StandbyStateUpdate
from app.services.event_service import event_service
from app.services.standby_service import StandbyService

router = APIRouter()


@router.get("/standby", response_model=StandbyStateRead)
def read_standby_state(db: Session = Depends(get_db)) -> StandbyStateRead:
    return StandbyService(db).get_state()


@router.put("/standby", response_model=StandbyStateRead)
async def update_standby_state(
    payload: StandbyStateUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> StandbyStateRead:
    standby_state = StandbyService(db).update_state(payload)
    await event_service.publish_standby_settings(standby_state)
    return standby_state
