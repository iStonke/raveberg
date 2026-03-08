from __future__ import annotations

from datetime import datetime, timezone
import random
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.visualizer_state import VisualizerState
from app.schemas.visualizer import (
    ColorScheme,
    VisualizerOptionsResponse,
    VisualizerPreset,
    VisualizerStateRead,
    VisualizerStateUpdate,
)

PRESETS: list[VisualizerPreset] = ["tunnel", "particles", "waves", "kaleidoscope"]
COLOR_SCHEMES: list[ColorScheme] = ["mono", "acid", "ultraviolet", "redline"]


@dataclass
class VisualizerUpdateResult:
    state: VisualizerStateRead
    preset_changed: bool
    auto_cycle_changed: bool


class VisualizerService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_state(self) -> VisualizerState:
        state = self.db.get(VisualizerState, 1)
        if state is None:
            state = VisualizerState(
                id=1,
                active_preset="tunnel",
                intensity=65,
                speed=55,
                brightness=70,
                color_scheme="acid",
                auto_cycle_enabled=settings.default_visualizer_auto_cycle_enabled,
                auto_cycle_interval_seconds=settings.default_visualizer_auto_cycle_interval_seconds,
            )
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
        state.auto_cycle_enabled = payload.auto_cycle_enabled
        state.auto_cycle_interval_seconds = payload.auto_cycle_interval_seconds
        state.updated_at = datetime.now(timezone.utc)

        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return VisualizerUpdateResult(
            state=VisualizerStateRead.model_validate(state, from_attributes=True),
            preset_changed=preset_changed,
            auto_cycle_changed=auto_cycle_changed,
        )

    def cycle_if_due(self) -> VisualizerStateRead | None:
        state = self.ensure_state()
        if not state.auto_cycle_enabled:
            return None

        now = datetime.now(timezone.utc)
        if state.updated_at is not None:
            elapsed = (now - state.updated_at).total_seconds()
            if elapsed < state.auto_cycle_interval_seconds:
                return None

        next_preset = self._pick_next_preset(state.active_preset)
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
        )

    @staticmethod
    def _pick_next_preset(current_preset: VisualizerPreset) -> VisualizerPreset:
        candidates = [preset for preset in PRESETS if preset != current_preset]
        return random.choice(candidates or PRESETS)
