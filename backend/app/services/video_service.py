from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.video_asset import VideoAsset
from app.models.video_state import VideoState
from app.schemas.video import VideoAssetRead, VideoLibraryOrderUpdate, VideoStateRead, VideoStateUpdate

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm"}
ALLOWED_VIDEO_MIME_TYPES = {"video/mp4", "video/webm", "application/octet-stream"}


class VideoService:
    def __init__(self, db: Session):
        self.db = db
        self.video_dir = Path(settings.videos_path)

    def ensure_state(self) -> VideoState:
        state = self.db.get(VideoState, 1)
        if state is None:
            state = VideoState(
                id=1,
                playlist_enabled=True,
                loop_enabled=True,
                playback_order="upload_order",
                vintage_filter_enabled=False,
                object_fit="contain",
                transition="none",
                active_video_id=None,
            )
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)

        normalized = self._normalize_active_video(state)
        if normalized:
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        return state

    def get_state(self) -> VideoStateRead:
        state = self.ensure_state()
        return VideoStateRead.model_validate(state, from_attributes=True)

    def update_state(self, payload: VideoStateUpdate) -> VideoStateRead:
        state = self.ensure_state()
        if payload.active_video_id is not None:
            self._get_asset(payload.active_video_id)

        state.playlist_enabled = payload.playlist_enabled
        state.loop_enabled = payload.loop_enabled
        state.playback_order = payload.playback_order
        state.vintage_filter_enabled = payload.vintage_filter_enabled
        state.object_fit = payload.object_fit
        state.transition = payload.transition
        state.active_video_id = payload.active_video_id
        self._normalize_active_video(state, payload_requested=True)
        state.updated_at = datetime.now(timezone.utc)
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return VideoStateRead.model_validate(state, from_attributes=True)

    def list_assets(self) -> list[VideoAssetRead]:
        assets = self._list_asset_models()
        return [self._to_asset_read(asset) for asset in assets]

    async def create_asset(self, file: UploadFile) -> VideoAssetRead:
        filename = (file.filename or "video").strip() or "video"
        suffix = Path(filename).suffix.lower()
        content_type = file.content_type or "application/octet-stream"

        if suffix not in ALLOWED_VIDEO_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nur MP4- und WebM-Dateien sind erlaubt.",
            )
        if content_type not in ALLOWED_VIDEO_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ungueltiger Videotyp. Bitte MP4 oder WebM hochladen.",
            )

        stored_name = f"{uuid4().hex}{suffix}"
        stored_path = self.video_dir / stored_name
        size = 0

        try:
            with stored_path.open("wb") as handle:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > settings.video_upload_max_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=(
                                "Datei zu gross. "
                                f"Maximal erlaubt sind {settings.video_upload_max_bytes // (1024 * 1024)} MB."
                            ),
                        )
                    handle.write(chunk)
        except HTTPException:
            stored_path.unlink(missing_ok=True)
            raise
        except Exception as exc:
            stored_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Video konnte nicht gespeichert werden.",
            ) from exc
        finally:
            await file.close()

        if size <= 0:
            stored_path.unlink(missing_ok=True)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Leere Videodatei.")

        next_position = int(self.db.scalar(select(func.max(VideoAsset.position))) or 0) + 1
        asset = VideoAsset(
            filename_original=filename[:255],
            filename_stored=stored_name,
            mime_type="video/mp4" if suffix == ".mp4" else "video/webm",
            size=size,
            position=next_position,
        )
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)

        state = self.ensure_state()
        if state.active_video_id is None:
            state.active_video_id = asset.id
            state.updated_at = datetime.now(timezone.utc)
            self.db.add(state)
            self.db.commit()

        return self._to_asset_read(asset)

    def delete_asset(self, asset_id: int) -> None:
        state = self.db.get(VideoState, 1)
        deleted_was_active = state is not None and state.active_video_id == asset_id
        asset = self._get_asset(asset_id)
        path = self.video_dir / asset.filename_stored
        path.unlink(missing_ok=True)
        self.db.delete(asset)
        self.db.commit()
        self._reindex_positions()

        state = self.ensure_state()
        if deleted_was_active:
            self._normalize_active_video(state)
            state.updated_at = datetime.now(timezone.utc)
            self.db.add(state)
            self.db.commit()

    def reorder_assets(self, payload: VideoLibraryOrderUpdate) -> list[VideoAssetRead]:
        assets = self._list_asset_models()
        current_ids = [asset.id for asset in assets]
        if sorted(payload.ids) != sorted(current_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Die neue Reihenfolge passt nicht zur vorhandenen Videoliste.",
            )

        asset_by_id = {asset.id: asset for asset in assets}
        for index, asset_id in enumerate(payload.ids, start=1):
            asset_by_id[asset_id].position = index
            self.db.add(asset_by_id[asset_id])
        self.db.commit()
        return self.list_assets()

    def get_stream_path(self, asset_id: int) -> Path:
        asset = self._get_asset(asset_id)
        path = self.video_dir / asset.filename_stored
        if not path.exists():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
        return path

    def _normalize_active_video(self, state: VideoState, payload_requested: bool = False) -> bool:
        existing_ids = [asset.id for asset in self._list_asset_models()]
        if not existing_ids:
            if state.active_video_id is not None:
                state.active_video_id = None
                return True
            return False

        if state.active_video_id in existing_ids:
            return False

        if payload_requested and state.active_video_id is None:
            state.active_video_id = existing_ids[0]
            return True

        state.active_video_id = existing_ids[0]
        return True

    def _reindex_positions(self) -> None:
        assets = self._list_asset_models()
        for index, asset in enumerate(assets, start=1):
            asset.position = index
            self.db.add(asset)
        self.db.commit()

    def _list_asset_models(self) -> list[VideoAsset]:
        return self.db.scalars(
            select(VideoAsset).order_by(VideoAsset.position.asc(), VideoAsset.created_at.asc()),
        ).all()

    def _get_asset(self, asset_id: int) -> VideoAsset:
        asset = self.db.get(VideoAsset, asset_id)
        if asset is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Video not found")
        return asset

    @staticmethod
    def _to_asset_read(asset: VideoAsset) -> VideoAssetRead:
        return VideoAssetRead(
            id=asset.id,
            filename_original=asset.filename_original,
            mime_type=asset.mime_type,
            size=asset.size,
            position=asset.position,
            created_at=asset.created_at,
            stream_url=f"/api/videos/{asset.id}/stream",
        )
