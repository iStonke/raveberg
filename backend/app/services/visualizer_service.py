from __future__ import annotations

from datetime import datetime, timezone
import logging
from dataclasses import dataclass

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.visualizer_state import VisualizerState
from app.services.mode_service import ModeService
from app.schemas.visualizer import (
    ColorScheme,
    HydraPaletteMode,
    HydraQuality,
    VisualizerOptionsResponse,
    VisualizerPreset,
    VisualizerStateRead,
    VisualizerStateUpdate,
)

PRESETS: list[VisualizerPreset] = [
    "particles",
    "kaleidoscope",
    "warehouse",
    "nebel",
    "vanta_halo",
    "hydra_rave",
    "hydra_chromaflow",
    "particle_swarm",
]
COLOR_SCHEMES: list[ColorScheme] = ["mono", "acid", "ultraviolet", "redline"]
HYDRA_QUALITIES: list[HydraQuality] = ["low", "medium", "high"]
HYDRA_PALETTE_MODES: list[HydraPaletteMode] = ["auto", "neon", "warm", "cold", "acid"]

logger = logging.getLogger(__name__)


@dataclass
class VisualizerUpdateResult:
    state: VisualizerStateRead
    preset_changed: bool
    auto_cycle_changed: bool


class VisualizerService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_state(self) -> VisualizerState:
        self._ensure_schema()
        state = self.db.get(VisualizerState, 1)
        if state is None:
            state = VisualizerState(
                id=1,
                active_preset="warehouse",
                intensity=65,
                speed=55,
                brightness=70,
                color_scheme="acid",
                hydra_colorfulness=78,
                hydra_scene_change_rate=46,
                hydra_symmetry_amount=38,
                hydra_feedback_amount=24,
                hydra_quality="medium",
                hydra_audio_reactivity_enabled=True,
                hydra_palette_mode="auto",
                logo_overlay_enabled=True,
                overlay_mode="logo",
                auto_cycle_enabled=settings.default_visualizer_auto_cycle_enabled,
                auto_cycle_interval_seconds=settings.default_visualizer_auto_cycle_interval_seconds,
            )
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        else:
            changed = False
            if state.active_preset == "vanta_fog":
                state.active_preset = "nebel"
                changed = True
            if state.active_preset not in PRESETS:
                state.active_preset = "warehouse"
                changed = True
            if state.hydra_quality not in HYDRA_QUALITIES:
                state.hydra_quality = "medium"
                changed = True
            if state.hydra_palette_mode not in HYDRA_PALETTE_MODES:
                state.hydra_palette_mode = "auto"
                changed = True
            if state.auto_cycle_interval_seconds < 300 or state.auto_cycle_interval_seconds > 1800:
                state.auto_cycle_interval_seconds = settings.default_visualizer_auto_cycle_interval_seconds
                changed = True
            if not changed:
                return state
            state.updated_at = datetime.now(timezone.utc)
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        return state

    def get_state(self) -> VisualizerStateRead:
        state = self.ensure_state()
        return VisualizerStateRead.model_validate(state, from_attributes=True)

    def update_state(self, payload: VisualizerStateUpdate) -> VisualizerUpdateResult:
        state = self.ensure_state()
        preset_changed = state.active_preset != payload.active_preset
        auto_cycle_changed = (
            state.auto_cycle_enabled != payload.auto_cycle_enabled
            or state.auto_cycle_interval_seconds != payload.auto_cycle_interval_seconds
        )

        state.active_preset = payload.active_preset
        state.intensity = payload.intensity
        state.speed = payload.speed
        state.brightness = payload.brightness
        state.color_scheme = payload.color_scheme
        state.hydra_colorfulness = payload.hydra_colorfulness
        state.hydra_scene_change_rate = payload.hydra_scene_change_rate
        state.hydra_symmetry_amount = payload.hydra_symmetry_amount
        state.hydra_feedback_amount = payload.hydra_feedback_amount
        state.hydra_quality = payload.hydra_quality
        state.hydra_audio_reactivity_enabled = payload.hydra_audio_reactivity_enabled
        state.hydra_palette_mode = payload.hydra_palette_mode
        state.overlay_mode = payload.overlay_mode
        state.logo_overlay_enabled = payload.overlay_mode == "logo"
        state.auto_cycle_enabled = payload.auto_cycle_enabled
        state.auto_cycle_interval_seconds = payload.auto_cycle_interval_seconds
        state.updated_at = datetime.now(timezone.utc)

        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        if auto_cycle_changed:
            if state.auto_cycle_enabled:
                logger.info(
                    "[VisualizerAutoSwitch] started current=%s interval_seconds=%s sequence=%s",
                    state.active_preset,
                    state.auto_cycle_interval_seconds,
                    ",".join(self._get_rotation_presets()),
                )
            else:
                logger.info("[VisualizerAutoSwitch] stopped current=%s", state.active_preset)
        return VisualizerUpdateResult(
            state=VisualizerStateRead.model_validate(state, from_attributes=True),
            preset_changed=preset_changed,
            auto_cycle_changed=auto_cycle_changed,
        )

    def cycle_if_due(self) -> VisualizerStateRead | None:
        state = self.ensure_state()
        if not state.auto_cycle_enabled:
            return None
        if ModeService(self.db).get_mode().mode != "visualizer":
            return None

        rotation_presets = self._get_rotation_presets()
        if len(rotation_presets) < 2:
            return None

        now = datetime.now(timezone.utc)
        if state.updated_at is not None:
            elapsed = (now - state.updated_at).total_seconds()
            if elapsed < state.auto_cycle_interval_seconds:
                return None

        next_preset = self._pick_next_preset(state.active_preset, rotation_presets)
        state.active_preset = next_preset
        state.updated_at = now
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return VisualizerStateRead.model_validate(state, from_attributes=True)

    @staticmethod
    def get_options() -> VisualizerOptionsResponse:
        return VisualizerOptionsResponse(
            presets=PRESETS,
            color_schemes=COLOR_SCHEMES,
            hydra_qualities=HYDRA_QUALITIES,
            hydra_palette_modes=HYDRA_PALETTE_MODES,
        )

    @staticmethod
    def _get_rotation_presets() -> list[VisualizerPreset]:
        return PRESETS

    @staticmethod
    def _pick_next_preset(
        current_preset: VisualizerPreset,
        rotation_presets: list[VisualizerPreset],
    ) -> VisualizerPreset:
        if not rotation_presets:
            return current_preset

        try:
            current_index = rotation_presets.index(current_preset)
        except ValueError:
            next_preset = rotation_presets[0]
            logger.info(
                "[VisualizerAutoSwitch] current=%s missing_from_sequence fallback=%s",
                current_preset,
                next_preset,
            )
            return next_preset

        next_index = (current_index + 1) % len(rotation_presets)
        next_preset = rotation_presets[next_index]
        if next_index == 0 and len(rotation_presets) > 1:
            logger.info(
                "[VisualizerAutoSwitch] wrapped_to_start current=%s next=%s",
                current_preset,
                next_preset,
            )
        else:
            logger.info(
                "[VisualizerAutoSwitch] current=%s next=%s index=%s/%s",
                current_preset,
                next_preset,
                current_index,
                len(rotation_presets),
            )
        return next_preset

    def _ensure_schema(self) -> None:
        bind = self.db.get_bind()
        if bind is None:
            return
        columns = {column["name"] for column in inspect(bind).get_columns(VisualizerState.__tablename__)}
        changed = False
        if "logo_overlay_enabled" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN logo_overlay_enabled BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            changed = True
        if "overlay_mode" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN overlay_mode VARCHAR(32) NOT NULL DEFAULT 'logo'"
                )
            )
            self.db.execute(
                text(
                    "UPDATE visualizer_state "
                    "SET overlay_mode = CASE WHEN logo_overlay_enabled THEN 'logo' ELSE 'off' END"
                )
            )
            changed = True
        if "hydra_colorfulness" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN hydra_colorfulness INTEGER NOT NULL DEFAULT 78"
                )
            )
            changed = True
        if "hydra_scene_change_rate" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN hydra_scene_change_rate INTEGER NOT NULL DEFAULT 46"
                )
            )
            changed = True
        if "hydra_symmetry_amount" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN hydra_symmetry_amount INTEGER NOT NULL DEFAULT 38"
                )
            )
            changed = True
        if "hydra_feedback_amount" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN hydra_feedback_amount INTEGER NOT NULL DEFAULT 24"
                )
            )
            changed = True
        if "hydra_quality" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN hydra_quality VARCHAR(32) NOT NULL DEFAULT 'medium'"
                )
            )
            changed = True
        if "hydra_audio_reactivity_enabled" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN hydra_audio_reactivity_enabled BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            changed = True
        if "hydra_palette_mode" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE visualizer_state "
                    "ADD COLUMN hydra_palette_mode VARCHAR(32) NOT NULL DEFAULT 'auto'"
                )
            )
            changed = True
        if changed:
            self.db.commit()
