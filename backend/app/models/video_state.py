from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class VideoState(Base):
    __tablename__ = "video_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    playlist_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    loop_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    playback_order: Mapped[str] = mapped_column(String(32), default="upload_order")
    vintage_filter_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    logo_overlay_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    overlay_mode: Mapped[str] = mapped_column(String(32), default="logo")
    object_fit: Mapped[str] = mapped_column(String(32), default="contain")
    transition: Mapped[str] = mapped_column(String(32), default="none")
    active_video_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("video_assets.id", ondelete="SET NULL"),
        nullable=True,
    )
    loop_video_id: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
