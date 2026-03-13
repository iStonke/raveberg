from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VisualizerState(Base):
    __tablename__ = "visualizer_state"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    active_preset: Mapped[str] = mapped_column(String(64), default="warehouse")
    intensity: Mapped[int] = mapped_column(Integer, default=65)
    speed: Mapped[int] = mapped_column(Integer, default=55)
    brightness: Mapped[int] = mapped_column(Integer, default=70)
    color_scheme: Mapped[str] = mapped_column(String(64), default="acid")
    hydra_colorfulness: Mapped[int] = mapped_column(Integer, default=78)
    hydra_scene_change_rate: Mapped[int] = mapped_column(Integer, default=46)
    hydra_symmetry_amount: Mapped[int] = mapped_column(Integer, default=38)
    hydra_feedback_amount: Mapped[int] = mapped_column(Integer, default=24)
    hydra_quality: Mapped[str] = mapped_column(String(32), default="medium")
    hydra_audio_reactivity_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    hydra_palette_mode: Mapped[str] = mapped_column(String(32), default="auto")
    logo_overlay_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    overlay_mode: Mapped[str] = mapped_column(String(32), default="logo")
    auto_cycle_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_cycle_interval_seconds: Mapped[int] = mapped_column(Integer, default=600)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
