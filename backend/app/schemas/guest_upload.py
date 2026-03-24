from datetime import datetime

from pydantic import BaseModel, Field, field_validator


ALLOWED_GUEST_UPLOAD_SESSION_TIMEOUT_HOURS = (1, 6, 12, 24, 48, 72)


class GuestUploadConfigBase(BaseModel):
    guest_upload_enabled: bool = True
    guest_upload_requires_approval: bool = False
    guest_upload_session_timeout_hours: int = Field(default=24)

    @field_validator("guest_upload_session_timeout_hours")
    @classmethod
    def validate_timeout(cls, value: int) -> int:
        if value not in ALLOWED_GUEST_UPLOAD_SESSION_TIMEOUT_HOURS:
            allowed = ", ".join(str(entry) for entry in ALLOWED_GUEST_UPLOAD_SESSION_TIMEOUT_HOURS)
            raise ValueError(f"guest_upload_session_timeout_hours must be one of: {allowed}")
        return value


class GuestUploadConfigUpdate(GuestUploadConfigBase):
    restart_session: bool = False


class GuestUploadConfigRead(GuestUploadConfigBase):
    session_started_at: datetime
    session_token: str
    session_expires_at: datetime
    session_is_expired: bool
    updated_at: datetime | None = None
