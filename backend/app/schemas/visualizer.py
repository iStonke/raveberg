from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


VisualizerPreset = Literal[
    "particles",
    "kaleidoscope",
    "warehouse",
    "storm_lightning",
    "retro_cube",
    "retro_pipes",
    "dvd_bounce",
    "matrix_screen",
    "nebel",
    "vanta_halo",
    "hydra_rave",
    "hydra_chromaflow",
]
ColorScheme = Literal["mono", "acid", "ultraviolet", "redline"]
OverlayMode = Literal["logo", "qr", "off"]
HydraQuality = Literal["low", "medium", "high"]
HydraPaletteMode = Literal["auto", "neon", "warm", "cold", "acid"]


class VisualizerStateRead(BaseModel):
    active_preset: VisualizerPreset
    intensity: int
    speed: int
    brightness: int
    color_scheme: ColorScheme
    hydra_colorfulness: int
    hydra_scene_change_rate: int
    hydra_symmetry_amount: int
    hydra_feedback_amount: int
    hydra_quality: HydraQuality
    hydra_audio_reactivity_enabled: bool
    hydra_palette_mode: HydraPaletteMode
    overlay_mode: OverlayMode
    auto_cycle_enabled: bool
    auto_cycle_interval_seconds: int
    updated_at: datetime | None


class VisualizerStateUpdate(BaseModel):
    active_preset: VisualizerPreset
    intensity: int = Field(ge=0, le=100)
    speed: int = Field(ge=0, le=100)
    brightness: int = Field(ge=0, le=100)
    color_scheme: ColorScheme
    hydra_colorfulness: int = Field(ge=0, le=100)
    hydra_scene_change_rate: int = Field(ge=0, le=100)
    hydra_symmetry_amount: int = Field(ge=0, le=100)
    hydra_feedback_amount: int = Field(ge=0, le=100)
    hydra_quality: HydraQuality
    hydra_audio_reactivity_enabled: bool
    hydra_palette_mode: HydraPaletteMode
    overlay_mode: OverlayMode
    auto_cycle_enabled: bool
    auto_cycle_interval_seconds: int = Field(ge=300, le=1800)


class VisualizerOptionsResponse(BaseModel):
    presets: list[VisualizerPreset]
    color_schemes: list[ColorScheme]
    hydra_qualities: list[HydraQuality]
    hydra_palette_modes: list[HydraPaletteMode]


class VisualizerPresetOrderRead(BaseModel):
    presets: list[VisualizerPreset]
    skipped_presets: list[VisualizerPreset]


class VisualizerPresetOrderUpdate(BaseModel):
    presets: list[VisualizerPreset] = Field(min_length=1)
    skipped_presets: list[VisualizerPreset] = Field(default_factory=list)
