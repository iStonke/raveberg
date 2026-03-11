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
    logo_overlay_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    overlay_mode: Mapped[str] = mapped_column(String(32), default="logo")
    auto_cycle_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    auto_cycle_interval_seconds: Mapped[int] = mapped_column(Integer, default=45)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
