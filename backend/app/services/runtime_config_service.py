from __future__ import annotations

import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.setting import Setting
from app.schemas.runtime import RemoteVisualizerConfigRead, RemoteVisualizerConfigUpdate


class RuntimeConfigService:
    _AMBIENT_PRESET_HUES = {
        "blue": 0,
        "cyan": -28,
        "violet": 48,
        "mint": -92,
        "custom": 0,
    }

    _REMOTE_KEYS = (
        "remote_visualizer_enabled",
        "remote_visualizer_url",
        "remote_visualizer_reconnect_ms",
        "remote_visualizer_fallback",
        "ambient_color_preset",
        "ambient_color_custom_hue_degrees",
        "display_render_mode",
        "remote_renderer_base_url",
        "remote_renderer_output_path",
        "remote_renderer_health_url",
        "remote_renderer_reconnect_ms",
        "remote_renderer_fallback",
    )

    def __init__(self, db: Session):
        self.db = db

    def get_remote_visualizer_config(self) -> RemoteVisualizerConfigRead:
        defaults = RemoteVisualizerConfigRead(
            remote_visualizer_enabled=settings.remote_visualizer_enabled,
            remote_visualizer_url=settings.remote_visualizer_url,
            remote_visualizer_reconnect_ms=settings.remote_visualizer_reconnect_ms,
            remote_visualizer_fallback=settings.remote_visualizer_fallback,
            ambient_color_preset="blue",
            ambient_color_custom_hue_degrees=0,
            display_render_mode=settings.display_render_mode,
            remote_renderer_base_url=settings.remote_renderer_base_url,
            remote_renderer_output_path=settings.remote_renderer_output_path,
            remote_renderer_health_url=settings.remote_renderer_health_url,
            remote_renderer_reconnect_ms=settings.remote_renderer_reconnect_ms,
            remote_renderer_fallback=settings.remote_renderer_fallback,
        )
        values = defaults.model_dump()
        loaded_fields: set[str] = set()
        rows = self.db.execute(
            select(Setting).where(Setting.key.in_([self._key(name) for name in self._REMOTE_KEYS])),
        ).scalars()

        for row in rows:
            field_name = row.key.removeprefix("runtime.")
            if field_name not in values:
                continue
            try:
                values[field_name] = json.loads(row.value)
                loaded_fields.add(field_name)
            except (TypeError, ValueError):
                continue

        legacy_preset = values.get("ambient_color_preset", "blue")
        if "ambient_color_custom_hue_degrees" not in loaded_fields:
            values["ambient_color_custom_hue_degrees"] = self._AMBIENT_PRESET_HUES.get(
                str(legacy_preset),
                0,
            )
        if legacy_preset == "mint":
            values["ambient_color_preset"] = "custom"

        return RemoteVisualizerConfigRead.model_validate(values)

    def update_remote_visualizer_config(
        self,
        payload: RemoteVisualizerConfigUpdate,
    ) -> RemoteVisualizerConfigRead:
        validated = RemoteVisualizerConfigRead.model_validate(payload.model_dump())
        encoded = validated.model_dump(mode="json")
        existing = {
            row.key: row
            for row in self.db.execute(
                select(Setting).where(Setting.key.in_([self._key(name) for name in self._REMOTE_KEYS])),
            ).scalars()
        }

        for field_name in self._REMOTE_KEYS:
            key = self._key(field_name)
            row = existing.get(key)
            if row is None:
                row = Setting(key=key, value="")
                self.db.add(row)
            row.value = json.dumps(encoded[field_name])

        self.db.commit()
        return validated

    @staticmethod
    def _key(field_name: str) -> str:
        return f"runtime.{field_name}"
