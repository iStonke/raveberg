from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class DisplayStatus(Base):
    __tablename__ = "display_status"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_state_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    renderer_label: Mapped[str] = mapped_column(String(64), default="Idle Renderer")
    current_mode: Mapped[str] = mapped_column(String(32), default="idle")
    sse_connected: Mapped[bool] = mapped_column(Boolean, default=False)
