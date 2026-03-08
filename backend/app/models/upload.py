from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Upload(Base):
    __tablename__ = "uploads"

    id: Mapped[int] = mapped_column(primary_key=True)
    filename_original: Mapped[str] = mapped_column(String(255))
    filename_display: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(128))
    size: Mapped[int] = mapped_column(BigInteger())
    status: Mapped[str] = mapped_column(String(32), default="uploaded")
    moderation_status: Mapped[str] = mapped_column(String(32), default="pending")
    approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
