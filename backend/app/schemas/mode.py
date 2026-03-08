from datetime import datetime
from typing import Literal

from pydantic import BaseModel


ModeType = Literal["visualizer", "selfie", "blackout", "idle"]


class ModeRead(BaseModel):
    mode: ModeType
    source: str
    updated_at: datetime | None


class ModeUpdate(BaseModel):
    mode: ModeType
