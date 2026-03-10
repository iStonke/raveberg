from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.system import PublicRuntimeInfoResponse, SystemActionResponse, SystemInfoResponse
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
