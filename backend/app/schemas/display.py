from datetime import datetime

from pydantic import BaseModel

from app.schemas.mode import ModeType


class DisplayHeartbeatUpdate(BaseModel):
    current_mode: ModeType
    renderer_label: str
    sse_connected: bool
    last_state_sync_at: datetime | None = None


class DisplayStatusRead(BaseModel):
    last_heartbeat_at: datetime | None
    last_state_sync_at: datetime | None
    renderer_label: str
    current_mode: ModeType
    sse_connected: bool
