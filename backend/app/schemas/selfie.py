from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


ModerationMode = Literal["auto_approve", "manual_approve"]
OverlayMode = Literal["logo", "qr", "off"]


class SelfieStateRead(BaseModel):
    slideshow_enabled: bool
    slideshow_interval_seconds: int
    slideshow_max_visible_photos: int
    slideshow_min_uploads_to_start: int
    slideshow_shuffle: bool
    overlay_mode: OverlayMode
    vintage_look_enabled: bool
    moderation_mode: ModerationMode
    slideshow_updated_at: datetime | None


class SelfieStateUpdate(BaseModel):
    slideshow_enabled: bool
    slideshow_interval_seconds: int = Field(ge=2, le=20)
    slideshow_max_visible_photos: int = Field(ge=1, le=10)
    slideshow_min_uploads_to_start: int = Field(ge=1, le=50)
    slideshow_shuffle: bool
    overlay_mode: OverlayMode
    vintage_look_enabled: bool
    moderation_mode: ModerationMode
