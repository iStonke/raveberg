from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import SessionUser
from app.schemas.system import SystemInfoResponse
from app.services.system_service import SystemService

router = APIRouter()


@router.get("/system", response_model=SystemInfoResponse)
def system_info(
    db: Session = Depends(get_db),
    _: SessionUser = Depends(require_admin_user),
) -> SystemInfoResponse:
    return SystemService(db).get_info()
