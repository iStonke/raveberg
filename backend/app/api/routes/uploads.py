import asyncio

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.upload import AdminUploadListResponse, UploadDeletedEvent, UploadModerationStatus, UploadRead
from app.services.event_service import event_service
from app.services.upload_service import UploadService

router = APIRouter()


@router.post("/uploads", response_model=UploadRead, status_code=201)
async def create_upload(
    request: Request,
    session_token: str | None = Query(default=None, alias="t"),
    file: UploadFile = File(...),
    comment: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> UploadRead:
    client_ip = _client_ip_from_request(request)
    upload_service = UploadService(db)
    guest_upload_config = upload_service.ensure_guest_upload_allowed(session_token=session_token)
    upload_service.enforce_rate_limit(
        client_ip,
        publish_callback=lambda event: asyncio.create_task(event_service.publish_rate_limit_triggered(event)),
    )
    upload, upload_event, cleanup_event = await upload_service.create_upload(
        file,
        comment=comment,
        guest_upload_config=guest_upload_config,
    )
    await event_service.publish_upload(upload_event)
    if cleanup_event is not None:
        for removed_id in cleanup_event.removed_ids:
            await event_service.publish_upload_deleted(UploadDeletedEvent(id=removed_id))
        await event_service.publish_cleanup_completed(cleanup_event)
    return upload


@router.get("/uploads", response_model=list[UploadRead])
def list_uploads(
    limit: int = Query(default=100, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[UploadRead]:
    return UploadService(db).list_public_uploads(limit=limit)


@router.get("/uploads/admin", response_model=AdminUploadListResponse)
def list_admin_uploads(
    limit: int = Query(default=12, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    moderation_status: UploadModerationStatus | None = Query(default=None),
    ids: list[int] = Query(default=[]),
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> AdminUploadListResponse:
    return UploadService(db).list_admin_uploads(
        limit=limit,
        offset=offset,
        moderation_status=moderation_status,
        upload_ids=ids,
    )


@router.get("/uploads/admin/archive")
def download_admin_upload_archive(
    ids: list[int] = Query(default=[]),
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> StreamingResponse:
    archive_bytes = UploadService(db).build_admin_archive(ids)
    return StreamingResponse(
        iter([archive_bytes]),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="uploads.zip"'},
    )


@router.get("/uploads/{upload_id}/display")
def get_upload_display(upload_id: int, db: Session = Depends(get_db)) -> FileResponse:
    path = UploadService(db).get_display_path(upload_id)
    return FileResponse(path, media_type="image/jpeg")


@router.get("/uploads/{upload_id}/admin-display")
def get_admin_upload_display(
    upload_id: int,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> FileResponse:
    path = UploadService(db).get_admin_display_path(upload_id)
    return FileResponse(path, media_type="image/jpeg")


@router.post("/uploads/{upload_id}/approve", response_model=UploadRead)
async def approve_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> UploadRead:
    upload, upload_event = UploadService(db).approve_upload(upload_id)
    await event_service.publish_upload_approved(upload_event)
    return upload


@router.post("/uploads/{upload_id}/reject", response_model=UploadRead)
async def reject_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> UploadRead:
    upload, upload_event = UploadService(db).reject_upload(upload_id)
    await event_service.publish_upload_rejected(upload_event)
    return upload


@router.delete("/uploads/{upload_id}", status_code=204)
async def delete_upload(
    upload_id: int,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> Response:
    upload_event = UploadService(db).delete_upload(upload_id)
    await event_service.publish_upload_deleted(upload_event)
    return Response(status_code=204)


def _client_ip_from_request(request: Request | None) -> str:
    if request is None:
        return "unknown"

    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"
