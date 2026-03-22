from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.auth.dependencies import require_admin_user
from app.schemas.auth import (
    AdminAccessUpdateRequest,
    AdminAccessUpdateResponse,
    LoginRequest,
    LoginResponse,
    SessionUser,
)
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    return AuthService(db).login(payload)


@router.get("/session", response_model=LoginResponse)
def session(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> LoginResponse:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")

    return AuthService(db).get_session(authorization)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def logout(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authorization header")

    AuthService(db).logout(authorization)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/account", response_model=AdminAccessUpdateResponse)
def update_account(
    payload: AdminAccessUpdateRequest,
    db: Session = Depends(get_db),
    current_user: SessionUser = Depends(require_admin_user),
) -> AdminAccessUpdateResponse:
    return AuthService(db).update_credentials(current_user.id, payload)
