from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_or_local_setup_access, require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.runtime import RemoteVisualizerConfigRead, RemoteVisualizerConfigUpdate
from app.schemas.system import (
    NetworkStatusRead,
    PublicRuntimeInfoResponse,
    SetupModeStatusRead,
    SystemActionResponse,
    SystemInfoResponse,
    WifiConnectRequest,
    WifiScanResult,
)
from app.services.event_service import event_service
from app.services.network_setup_service import NetworkSetupService
from app.services.network_status_service import NetworkStatusService
from app.services.runtime_config_service import RuntimeConfigService
from app.services.system_service import SystemService
from app.services.wifi_scan_service import WifiScanService

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
    _: SessionUser = Depends(require_admin_user),
) -> SystemActionResponse:
    try:
        SystemService.request_shutdown()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return SystemService.shutdown_response()


@router.post("/system/restart", response_model=SystemActionResponse, status_code=status.HTTP_202_ACCEPTED)
def restart_system(
    _: SessionUser = Depends(require_admin_user),
) -> SystemActionResponse:
    try:
        SystemService.request_restart()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return SystemService.restart_response()


@router.post("/system/wifi/connect", response_model=SystemActionResponse)
def connect_wifi(
    payload: WifiConnectRequest,
    _: SessionUser | None = Depends(require_admin_or_local_setup_access),
) -> SystemActionResponse:
    try:
        return NetworkSetupService().connect_wifi(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/system/setup-mode/start", response_model=SystemActionResponse)
def start_setup_mode(
    _: SessionUser = Depends(require_admin_user),
) -> SystemActionResponse:
    try:
        return NetworkSetupService().start_setup_mode()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.post("/system/setup-mode/stop", response_model=SystemActionResponse)
def stop_setup_mode(
    _: SessionUser | None = Depends(require_admin_or_local_setup_access),
) -> SystemActionResponse:
    try:
        return NetworkSetupService().stop_setup_mode()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/system/setup-mode/status", response_model=SetupModeStatusRead)
def read_setup_mode_status(
    _: SessionUser | None = Depends(require_admin_or_local_setup_access),
) -> SetupModeStatusRead:
    return NetworkSetupService().get_setup_mode_status()


@router.get("/system/wifi/scan", response_model=list[WifiScanResult])
def scan_wifi(
    _: SessionUser | None = Depends(require_admin_or_local_setup_access),
) -> list[WifiScanResult]:
    try:
        return WifiScanService().scan()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc


@router.get("/system/network-status", response_model=NetworkStatusRead)
def read_network_status(
    _: SessionUser | None = Depends(require_admin_or_local_setup_access),
) -> NetworkStatusRead:
    return NetworkStatusService().get_status()
