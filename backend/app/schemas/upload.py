from datetime import datetime
from typing import Literal

from pydantic import BaseModel


UploadStatus = Literal["uploaded", "processed", "error"]
UploadModerationStatus = Literal["pending", "approved", "rejected"]


class UploadRead(BaseModel):
    id: int
    filename_original: str
    filename_display: str | None
    mime_type: str
    size: int
    comment: str | None
    created_at: datetime
    status: UploadStatus
    moderation_status: UploadModerationStatus
    approved: bool
    display_url: str | None
    admin_display_url: str | None


class UploadEvent(BaseModel):
    id: int
    comment: str | None
    status: UploadStatus
    moderation_status: UploadModerationStatus
    approved: bool
    created_at: datetime


class UploadDeletedEvent(BaseModel):
    id: int


class AdminUploadListSummary(BaseModel):
    total: int
    pending: int
    rejected: int


class AdminUploadListResponse(BaseModel):
    items: list[UploadRead]
    total: int
    has_more: bool
    offset: int
    limit: int
    summary: AdminUploadListSummary
