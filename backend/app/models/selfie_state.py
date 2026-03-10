from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SelfieState(Base):
    __tablename__ = "selfie_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    slideshow_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    slideshow_interval_seconds: Mapped[int] = mapped_column(Integer, default=6)
    slideshow_max_visible_photos: Mapped[int] = mapped_column(Integer, default=4)
    slideshow_shuffle: Mapped[bool] = mapped_column(Boolean, default=True)
    vintage_look_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    moderation_mode: Mapped[str] = mapped_column(String(32), default="auto_approve")
    slideshow_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
