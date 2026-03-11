from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


VideoPlaybackOrder = Literal["upload_order", "random"]
VideoObjectFit = Literal["contain", "cover"]
VideoTransition = Literal["none", "fade"]
OverlayMode = Literal["logo", "qr", "off"]


class VideoStateRead(BaseModel):
    playlist_enabled: bool
    loop_enabled: bool
    playback_order: VideoPlaybackOrder
    vintage_filter_enabled: bool
    overlay_mode: OverlayMode
    object_fit: VideoObjectFit
    transition: VideoTransition
    active_video_id: int | None
    updated_at: datetime | None


class VideoStateUpdate(BaseModel):
    playlist_enabled: bool
    loop_enabled: bool
    playback_order: VideoPlaybackOrder
    vintage_filter_enabled: bool
    overlay_mode: OverlayMode
    object_fit: VideoObjectFit
    transition: VideoTransition
    active_video_id: int | None = None


class VideoAssetRead(BaseModel):
    id: int
    filename_original: str
    mime_type: str
    size: int
    position: int
    created_at: datetime
    stream_url: str


class VideoLibraryOrderUpdate(BaseModel):
    ids: list[int] = Field(default_factory=list)
