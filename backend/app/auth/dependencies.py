from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.auth import SessionUser
from app.services.auth_service import AuthService
from app.services.network_setup_service import NetworkSetupService


def require_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    return authorization


def require_admin_user(
    authorization: str = Depends(require_bearer_token),
    db: Session = Depends(get_db),
) -> SessionUser:
    return AuthService(db).require_admin(authorization)


def require_admin_or_local_setup_access(
    request: Request,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> SessionUser | None:
    if authorization:
        return AuthService(db).require_admin(authorization)

    if NetworkSetupService().is_local_request_allowed(request):
        return None

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Lokaler Zugriff oder Admin-Session erforderlich",
    )
