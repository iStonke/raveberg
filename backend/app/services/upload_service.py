from __future__ import annotations

from io import BytesIO
from pathlib import Path
from uuid import uuid4
from collections.abc import Callable
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import HTTPException, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.upload import Upload
from app.schemas.runtime import CleanupCompletedEvent
from app.schemas.upload import (
    AdminUploadListResponse,
    AdminUploadListSummary,
    UploadDeletedEvent,
    UploadEvent,
    UploadModerationStatus,
    UploadRead,
)
from app.services.guest_upload_config_service import GuestUploadConfigService
from app.services.runtime_service import runtime_service

register_heif_opener()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
ALLOWED_MIME_TYPES = {
    "image/jpg",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}


class UploadService:
    def __init__(self, db: Session):
        self.db = db
        self.original_dir = Path(settings.uploads_original_path)
        self.display_dir = Path(settings.uploads_display_path)

    async def create_upload(
        self,
        file: UploadFile,
        *,
        comment: str | None = None,
    ) -> tuple[UploadRead, UploadEvent, CleanupCompletedEvent | None]:
        filename = file.filename or "upload"
        extension = Path(filename).suffix.lower()
        mime_type = (file.content_type or "").lower()
        payload = await file.read()
        await file.close()
        normalized_comment = self._normalize_comment(comment)

        guest_upload_config = GuestUploadConfigService(self.db).ensure_upload_allowed()
        self._validate_basic(filename, extension, mime_type, payload)
        moderation_mode = GuestUploadConfigService.moderation_mode_from_requires_approval(
            guest_upload_config.guest_upload_requires_approval,
        )

        stored_original = self._build_original_name(filename, extension)
        original_path = self.original_dir / stored_original
        original_path.write_bytes(payload)

        upload = Upload(
            filename_original=stored_original,
            filename_display=None,
            mime_type=mime_type,
            size=len(payload),
            comment=normalized_comment,
            status="uploaded",
            moderation_status="pending",
            approved=False,
        )
        self.db.add(upload)
        self.db.commit()
        self.db.refresh(upload)

        try:
            stored_display = self._process_image(payload)
            upload.filename_display = stored_display
            upload.status = "processed"
            if moderation_mode == "auto_approve":
                upload.moderation_status = "approved"
                upload.approved = True
            else:
                upload.moderation_status = "pending"
                upload.approved = False
            self.db.add(upload)
            self.db.commit()
            self.db.refresh(upload)
        except HTTPException:
            upload.status = "error"
            upload.moderation_status = "rejected"
            upload.approved = False
            self.db.add(upload)
            self.db.commit()
            raise
        except Exception as exc:
            upload.status = "error"
            upload.moderation_status = "rejected"
            upload.approved = False
            self.db.add(upload)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image processing failed",
            ) from exc

        upload_read = self._to_read(upload)
        cleanup_event = self.cleanup_if_needed()
        return (
            upload_read,
            self._to_event(upload),
            cleanup_event,
        )

    def ensure_guest_upload_allowed(self) -> None:
        GuestUploadConfigService(self.db).ensure_upload_allowed()

    def list_public_uploads(self, limit: int = 100) -> list[UploadRead]:
        rows = self.db.scalars(
            select(Upload)
            .where(Upload.approved.is_(True), Upload.status == "processed")
            .order_by(Upload.created_at.desc())
            .limit(min(limit, 100)),
        ).all()
        return [self._to_read(row) for row in rows]

    def list_admin_uploads(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        moderation_status: UploadModerationStatus | None = None,
        upload_ids: list[int] | None = None,
    ) -> AdminUploadListResponse:
        normalized_limit = max(1, min(limit, 100))
        normalized_offset = max(0, offset)
        normalized_ids = [upload_id for upload_id in (upload_ids or []) if upload_id > 0]

        filters = []
        if moderation_status is not None:
            filters.append(Upload.moderation_status == moderation_status)
        if normalized_ids:
            filters.append(Upload.id.in_(normalized_ids))

        items_query = select(Upload)
        count_query = select(func.count(Upload.id))
        if filters:
            items_query = items_query.where(*filters)
            count_query = count_query.where(*filters)

        rows = self.db.scalars(
            items_query
            .order_by(Upload.created_at.desc())
            .offset(normalized_offset)
            .limit(normalized_limit),
        ).all()
        total = int(self.db.scalar(count_query) or 0)

        return AdminUploadListResponse(
            items=[self._to_read(row) for row in rows],
            total=total,
            has_more=normalized_offset + len(rows) < total,
            offset=normalized_offset,
            limit=normalized_limit,
            summary=AdminUploadListSummary(
                total=int(self.db.scalar(select(func.count(Upload.id))) or 0),
                pending=int(
                    self.db.scalar(
                        select(func.count(Upload.id)).where(Upload.moderation_status == "pending"),
                    )
                    or 0
                ),
                rejected=int(
                    self.db.scalar(
                        select(func.count(Upload.id)).where(Upload.moderation_status == "rejected"),
                    )
                    or 0
                ),
            ),
        )

    def get_display_path(self, upload_id: int) -> Path:
        upload = self.db.get(Upload, upload_id)
        if upload is None or upload.filename_display is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
        if not upload.approved or upload.status != "processed":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not available")

        path = self.display_dir / upload.filename_display
        if not path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display file missing")
        return path

    def get_admin_display_path(self, upload_id: int) -> Path:
        upload = self._get_upload(upload_id)
        if upload.filename_display is None or upload.status != "processed":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display file missing")
        path = self.display_dir / upload.filename_display
        if not path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Display file missing")
        return path

    def build_admin_archive(self, upload_ids: list[int]) -> bytes:
        ordered_ids: list[int] = []
        seen_ids: set[int] = set()
        for upload_id in upload_ids:
            if upload_id in seen_ids:
                continue
            seen_ids.add(upload_id)
            ordered_ids.append(upload_id)

        if not ordered_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No uploads selected")

        archive_buffer = BytesIO()
        written_entries = 0

        with ZipFile(archive_buffer, mode="w", compression=ZIP_DEFLATED) as archive:
            for index, upload_id in enumerate(ordered_ids, start=1):
                upload = self.db.get(Upload, upload_id)
                if upload is None:
                    continue

                source_path = self._get_archive_source_path(upload)
                if source_path is None:
                    continue

                archive.write(
                    source_path,
                    arcname=self._build_archive_entry_name(upload, index=index, suffix=source_path.suffix.lower()),
                )
                written_entries += 1

        if written_entries == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No upload files available for download",
            )

        archive_buffer.seek(0)
        return archive_buffer.getvalue()

    def approve_upload(self, upload_id: int) -> tuple[UploadRead, UploadEvent]:
        upload = self._get_upload(upload_id)
        if upload.status != "processed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only processed uploads can be approved",
            )
        upload.moderation_status = "approved"
        upload.approved = True
        self.db.add(upload)
        self.db.commit()
        self.db.refresh(upload)
        return self._to_read(upload), self._to_event(upload)

    def reject_upload(self, upload_id: int) -> tuple[UploadRead, UploadEvent]:
        upload = self._get_upload(upload_id)
        upload.moderation_status = "rejected"
        upload.approved = False
        self.db.add(upload)
        self.db.commit()
        self.db.refresh(upload)
        return self._to_read(upload), self._to_event(upload)

    def delete_upload(self, upload_id: int) -> UploadDeletedEvent:
        upload = self._get_upload(upload_id)
        self._remove_files(upload)

        deleted_event = UploadDeletedEvent(id=upload.id)
        self.db.delete(upload)
        self.db.commit()
        return deleted_event

    def enforce_rate_limit(
        self,
        ip_address: str,
        publish_callback: Callable | None = None,
    ) -> None:
        runtime_service.enforce_upload_rate_limit(ip_address, publish_callback=publish_callback)

    def cleanup_if_needed(self) -> CleanupCompletedEvent | None:
        total_count = int(self.db.scalar(select(func.count()).select_from(Upload)) or 0)
        if total_count <= settings.max_stored_uploads:
            return None

        uploads = self.db.scalars(select(Upload).order_by(Upload.created_at.desc())).all()
        protected_ids = {upload.id for upload in uploads[: settings.cleanup_preserve_latest_count]}

        low_priority = [
            upload
            for upload in reversed(uploads)
            if upload.id not in protected_ids
            and (upload.status != "processed" or upload.moderation_status != "approved")
        ]
        approved_archive = [
            upload
            for upload in reversed(uploads)
            if upload.id not in protected_ids
            and upload.status == "processed"
            and upload.moderation_status == "approved"
        ]

        excess = total_count - settings.max_stored_uploads
        candidates = (low_priority + approved_archive)[: min(excess, settings.cleanup_batch_size)]
        if not candidates:
            return None

        removed_ids: list[int] = []
        for upload in candidates:
            self._remove_files(upload)
            removed_ids.append(upload.id)
            self.db.delete(upload)

        self.db.commit()
        return runtime_service.record_cleanup(removed_ids)

    def _validate_basic(self, filename: str, extension: str, mime_type: str, payload: bytes) -> None:
        if not filename:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Filename missing")
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file extension")
        if mime_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported MIME type")
        if not payload:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
        if len(payload) > settings.upload_max_bytes:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    def _normalize_comment(self, comment: str | None) -> str | None:
        if comment is None:
            return None

        normalized = " ".join(comment.replace("\r", " ").replace("\n", " ").split()).strip()
        if not normalized:
            return None
        if len(normalized) > 40:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Comment too long",
            )
        return normalized

    def _build_original_name(self, filename: str, extension: str) -> str:
        safe_stem = Path(filename).stem.lower().replace(" ", "-")
        safe_stem = "".join(ch for ch in safe_stem if ch.isalnum() or ch in {"-", "_"})
        safe_stem = safe_stem[:40] or "upload"
        return f"{uuid4().hex}_{safe_stem}{extension}"

    def _get_archive_source_path(self, upload: Upload) -> Path | None:
        if upload.filename_display and upload.status == "processed":
            display_path = self.display_dir / upload.filename_display
            if display_path.exists():
                return display_path

        original_path = self.original_dir / upload.filename_original
        if original_path.exists():
            return original_path

        return None

    @staticmethod
    def _build_archive_entry_name(upload: Upload, *, index: int, suffix: str) -> str:
        created_stamp = upload.created_at.strftime("%Y%m%d_%H%M%S")
        safe_suffix = suffix if suffix.startswith(".") else f".{suffix}" if suffix else ""
        return f"{index:02d}_{created_stamp}_upload-{upload.id}{safe_suffix}"

    def _process_image(self, payload: bytes) -> str:
        try:
            with Image.open(BytesIO(payload)) as source_image:
                source_image.load()
                image = ImageOps.exif_transpose(source_image)
        except (UnidentifiedImageError, OSError) as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or damaged image") from exc

        if image.mode not in ("RGB", "L"):
            background = Image.new("RGB", image.size, (0, 0, 0))
            if "A" in image.getbands():
                background.paste(image, mask=image.getchannel("A"))
                image = background
            else:
                image = image.convert("RGB")
        elif image.mode == "L":
            image = image.convert("RGB")

        image.thumbnail((1920, 1080))
        display_name = f"{uuid4().hex}.jpg"
        display_path = self.display_dir / display_name
        image.save(display_path, format="JPEG", quality=88, optimize=True)
        image.close()
        return display_name

    @staticmethod
    def _to_read(upload: Upload) -> UploadRead:
        display_url = (
            f"/api/uploads/{upload.id}/display"
            if upload.filename_display and upload.status == "processed" and upload.approved
            else None
        )
        admin_display_url = (
            f"/api/uploads/{upload.id}/admin-display"
            if upload.filename_display and upload.status == "processed"
            else None
        )
        return UploadRead(
            id=upload.id,
            filename_original=upload.filename_original,
            filename_display=upload.filename_display,
            mime_type=upload.mime_type,
            size=upload.size,
            comment=upload.comment,
            created_at=upload.created_at,
            status=upload.status,
            moderation_status=upload.moderation_status,
            approved=upload.approved,
            display_url=display_url,
            admin_display_url=admin_display_url,
        )

    @staticmethod
    def _to_event(upload: Upload) -> UploadEvent:
        return UploadEvent(
            id=upload.id,
            comment=upload.comment,
            status=upload.status,
            moderation_status=upload.moderation_status,
            approved=upload.approved,
            created_at=upload.created_at,
        )

    def _get_upload(self, upload_id: int) -> Upload:
        upload = self.db.get(Upload, upload_id)
        if upload is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Upload not found")
        return upload

    def _remove_files(self, upload: Upload) -> None:
        for candidate in (
            self.original_dir / upload.filename_original,
            self.display_dir / upload.filename_display if upload.filename_display else None,
        ):
            if candidate and candidate.exists():
                candidate.unlink()
