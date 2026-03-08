from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


VisualizerPreset = Literal["tunnel", "particles", "waves", "kaleidoscope"]
ColorScheme = Literal["mono", "acid", "ultraviolet", "redline"]


class VisualizerStateRead(BaseModel):
    active_preset: VisualizerPreset
    intensity: int
    speed: int
    brightness: int
    color_scheme: ColorScheme
    auto_cycle_enabled: bool
    auto_cycle_interval_seconds: int
    updated_at: datetime | None


class VisualizerStateUpdate(BaseModel):
    active_preset: VisualizerPreset
    intensity: int = Field(ge=0, le=100)
    speed: int = Field(ge=0, le=100)
    brightness: int = Field(ge=0, le=100)
    color_scheme: ColorScheme
    auto_cycle_enabled: bool
    auto_cycle_interval_seconds: int = Field(ge=15, le=600)


class VisualizerOptionsResponse(BaseModel):
    presets: list[VisualizerPreset]
    color_schemes: list[ColorScheme]
