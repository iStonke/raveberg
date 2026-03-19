from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

StandbyScreenVariant = Literal["standard", "new"]

class StandbyStateRead(BaseModel):
    screen_variant: StandbyScreenVariant
    headline: str
    subheadline: str
    hue_shift_degrees: int
    updated_at: datetime | None


class StandbyStateUpdate(BaseModel):
    screen_variant: StandbyScreenVariant = Field(pattern="^(standard|new)$")
    headline: str = Field(min_length=1, max_length=160)
    subheadline: str = Field(min_length=1, max_length=200)
    hue_shift_degrees: int = Field(ge=-180, le=180)
