from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.display_status import DisplayStatus
from app.schemas.display import DisplayHeartbeatUpdate, DisplayStatusRead


class DisplayStatusService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_status(self) -> DisplayStatus:
        status = self.db.get(DisplayStatus, 1)
        if status is None:
            status = DisplayStatus(id=1)
            self.db.add(status)
            self.db.commit()
            self.db.refresh(status)
        return status

    def get_status(self) -> DisplayStatusRead:
        status = self.ensure_status()
        return DisplayStatusRead.model_validate(status, from_attributes=True)

    def record_heartbeat(self, payload: DisplayHeartbeatUpdate) -> DisplayStatusRead:
        status = self.ensure_status()
        status.last_heartbeat_at = datetime.now(timezone.utc)
        status.last_state_sync_at = payload.last_state_sync_at
        status.renderer_label = payload.renderer_label
        status.current_mode = payload.current_mode
        status.sse_connected = payload.sse_connected
        self.db.add(status)
        self.db.commit()
        self.db.refresh(status)
        return DisplayStatusRead.model_validate(status, from_attributes=True)
