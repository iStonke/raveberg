from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StandbyState(Base):
    __tablename__ = "standby_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    headline: Mapped[str] = mapped_column(String(160), default="Unterm Berg beginnt die Nacht")
    subheadline: Mapped[str] = mapped_column(String(200), default="Willkommen im Auberg-Keller")
    hue_shift_degrees: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
