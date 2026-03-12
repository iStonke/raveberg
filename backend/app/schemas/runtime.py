from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


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


RemoteVisualizerFallback = Literal["local", "none"]
DisplayRenderMode = Literal["local", "remote_headless"]
RemoteRendererFallback = Literal["local", "notice"]


class RemoteVisualizerConfigBase(BaseModel):
    remote_visualizer_enabled: bool = False
    remote_visualizer_url: str = Field(default="", max_length=2048)
    remote_visualizer_reconnect_ms: int = Field(default=3000, ge=1000, le=60000)
    remote_visualizer_fallback: RemoteVisualizerFallback = "local"
    display_render_mode: DisplayRenderMode = "local"
    remote_renderer_base_url: str = Field(default="", max_length=2048)
    remote_renderer_output_path: str = Field(default="/preview", max_length=1024)
    remote_renderer_health_url: str = Field(default="", max_length=2048)
    remote_renderer_reconnect_ms: int = Field(default=3000, ge=1000, le=60000)
    remote_renderer_fallback: RemoteRendererFallback = "local"

    @field_validator("remote_visualizer_url", mode="before")
    @classmethod
    def normalize_url(cls, value: object) -> str:
        if value is None:
            return ""
        if not isinstance(value, str):
            return str(value)
        return value.strip()

    @field_validator(
        "remote_renderer_base_url",
        "remote_renderer_health_url",
        mode="before",
    )
    @classmethod
    def normalize_renderer_urls(cls, value: object) -> str:
        if value is None:
            return ""
        if not isinstance(value, str):
            return str(value)
        return value.strip()

    @field_validator("remote_renderer_output_path", mode="before")
    @classmethod
    def normalize_renderer_output_path(cls, value: object) -> str:
        if value is None:
            return "/preview"
        if not isinstance(value, str):
            value = str(value)
        normalized = value.strip() or "/preview"
        return normalized if normalized.startswith("/") else f"/{normalized}"


class RemoteVisualizerConfigRead(RemoteVisualizerConfigBase):
    pass


class RemoteVisualizerConfigUpdate(RemoteVisualizerConfigBase):
    pass
