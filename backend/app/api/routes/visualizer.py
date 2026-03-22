from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.visualizer import (
    VisualizerOptionsResponse,
    VisualizerPresetOrderRead,
    VisualizerPresetOrderUpdate,
    VisualizerStateRead,
    VisualizerStateUpdate,
)
from app.services.event_service import event_service
from app.services.visualizer_service import VisualizerService

router = APIRouter(prefix="/visualizer")


@router.get("", response_model=VisualizerStateRead)
def read_visualizer(db: Session = Depends(get_db)) -> VisualizerStateRead:
    return VisualizerService(db).get_state()


@router.put("", response_model=VisualizerStateRead)
async def update_visualizer(
    payload: VisualizerStateUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> VisualizerStateRead:
    result = VisualizerService(db).update_state(payload)
    await event_service.publish_visualizer(result.state)
    if result.preset_changed:
        await event_service.publish_visualizer_preset_changed(result.state)
    if result.auto_cycle_changed:
        await event_service.publish_visualizer_auto_cycle(result.state)
    return result.state


@router.get("/presets", response_model=VisualizerOptionsResponse)
def read_visualizer_presets() -> VisualizerOptionsResponse:
    return VisualizerService.get_options()


@router.get("/order", response_model=VisualizerPresetOrderRead)
def read_visualizer_order(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> VisualizerPresetOrderRead:
    return VisualizerService(db).get_preset_order()


@router.put("/order", response_model=VisualizerPresetOrderRead)
def update_visualizer_order(
    payload: VisualizerPresetOrderUpdate,
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> VisualizerPresetOrderRead:
    return VisualizerService(db).update_preset_order(payload)
