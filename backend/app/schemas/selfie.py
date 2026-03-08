from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ModerationMode = Literal["auto_approve", "manual_approve"]


class SelfieStateRead(BaseModel):
    slideshow_enabled: bool
    slideshow_interval_seconds: int
    slideshow_shuffle: bool
    moderation_mode: ModerationMode
    slideshow_updated_at: datetime | None


class SelfieStateUpdate(BaseModel):
    slideshow_enabled: bool
    slideshow_interval_seconds: int = Field(ge=3, le=30)
    slideshow_shuffle: bool
    moderation_mode: ModerationMode
