from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.runtime import RemoteVisualizerConfigRead, RemoteVisualizerConfigUpdate
from app.schemas.system import PublicRuntimeInfoResponse, SystemActionResponse, SystemInfoResponse
from app.services.event_service import event_service
from app.services.runtime_config_service import RuntimeConfigService
from app.services.system_service import SystemService

router = APIRouter()


@router.get("/system", response_model=SystemInfoResponse)
def system_info(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> SystemInfoResponse:
    return SystemService(db).get_info()


@router.get("/public-info", response_model=PublicRuntimeInfoResponse)
def public_runtime_info(
    db: Session = Depends(get_db),
) -> PublicRuntimeInfoResponse:
    return SystemService(db).get_public_info()


@router.get("/system/runtime-config", response_model=RemoteVisualizerConfigRead)
def read_runtime_config(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> RemoteVisualizerConfigRead:
    return RuntimeConfigService(db).get_remote_visualizer_config()


@router.put("/system/runtime-config", response_model=RemoteVisualizerConfigRead)
async def update_runtime_config(
    payload: RemoteVisualizerConfigUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> RemoteVisualizerConfigRead:
    result = RuntimeConfigService(db).update_remote_visualizer_config(payload)
    await event_service.publish_public_runtime_info(SystemService(db).get_public_info())
    return result


@router.post("/system/shutdown", response_model=SystemActionResponse, status_code=status.HTTP_202_ACCEPTED)
def shutdown_system(
    background_tasks: BackgroundTasks,
    _: SessionUser = Depends(require_admin_user),
) -> SystemActionResponse:
    try:
        SystemService._resolve_shutdown_command()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    background_tasks.add_task(SystemService.schedule_shutdown)
    return SystemService.shutdown_response()
