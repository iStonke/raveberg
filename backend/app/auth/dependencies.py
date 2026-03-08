from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.auth import SessionUser
from app.services.auth_service import AuthService


def require_bearer_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    return authorization


def require_admin_user(
    authorization: str = Depends(require_bearer_token),
    db: Session = Depends(get_db),
) -> SessionUser:
    return AuthService(db).require_admin(authorization)
