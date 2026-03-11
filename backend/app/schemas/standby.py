from datetime import datetime

from pydantic import BaseModel, Field


class StandbyStateRead(BaseModel):
    headline: str
    subheadline: str
    hue_shift_degrees: int
    updated_at: datetime | None


class StandbyStateUpdate(BaseModel):
    headline: str = Field(min_length=1, max_length=160)
    subheadline: str = Field(min_length=1, max_length=200)
    hue_shift_degrees: int = Field(ge=-180, le=180)
