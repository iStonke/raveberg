from datetime import datetime
from typing import Literal

from pydantic import BaseModel


SelfiePlaybackAction = Literal["next", "reload_pool"]


class SelfiePlaybackEvent(BaseModel):
    action: SelfiePlaybackAction
    sequence: int
    issued_at: datetime


class CleanupCompletedEvent(BaseModel):
    removed_ids: list[int]
    removed_count: int
    completed_at: datetime


class RateLimitTriggeredEvent(BaseModel):
    ip_address: str
    retry_after_seconds: int
    triggered_at: datetime
