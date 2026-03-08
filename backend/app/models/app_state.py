from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.schemas.mode import ModeType


class AppState(Base):
    __tablename__ = "app_state"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    mode: Mapped[ModeType] = mapped_column(String(32), default="visualizer")
    source: Mapped[str] = mapped_column(String(32), default="backend")
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
