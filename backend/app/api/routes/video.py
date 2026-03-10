from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.video import VideoAssetRead, VideoLibraryOrderUpdate, VideoStateRead, VideoStateUpdate
from app.services.event_service import event_service
from app.services.video_service import VideoService

router = APIRouter()


@router.get("/video", response_model=VideoStateRead)
def read_video_state(db: Session = Depends(get_db)) -> VideoStateRead:
    return VideoService(db).get_state()


@router.put("/video", response_model=VideoStateRead)
async def update_video_state(
    payload: VideoStateUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> VideoStateRead:
    state = VideoService(db).update_state(payload)
    await event_service.publish_video_settings(state)
    return state


@router.get("/videos", response_model=list[VideoAssetRead])
def list_videos(db: Session = Depends(get_db)) -> list[VideoAssetRead]:
    return VideoService(db).list_assets()


@router.get("/videos/admin", response_model=list[VideoAssetRead])
def list_admin_videos(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> list[VideoAssetRead]:
    return VideoService(db).list_assets()


@router.post("/videos", response_model=VideoAssetRead, status_code=status.HTTP_201_CREATED)
async def create_video(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> VideoAssetRead:
    service = VideoService(db)
    asset = await service.create_asset(file)
    await event_service.publish_video_library(service.list_assets())
    await event_service.publish_video_settings(service.get_state())
    return asset


@router.post("/videos/reorder", response_model=list[VideoAssetRead])
async def reorder_videos(
    payload: VideoLibraryOrderUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> list[VideoAssetRead]:
    service = VideoService(db)
    library = service.reorder_assets(payload)
    await event_service.publish_video_library(library)
    await event_service.publish_video_settings(service.get_state())
    return library


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> None:
    service = VideoService(db)
    service.delete_asset(video_id)
    await event_service.publish_video_library(service.list_assets())
    await event_service.publish_video_settings(service.get_state())


@router.get("/videos/{video_id}/stream")
def stream_video(video_id: int, db: Session = Depends(get_db)) -> FileResponse:
    path = VideoService(db).get_stream_path(video_id)
    return FileResponse(path)
