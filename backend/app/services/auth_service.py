from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_session_token, hash_password, hash_session_token, verify_password
from app.models.admin_session import AdminSession
from app.models.admin_user import AdminUser
from app.schemas.auth import (
    AdminAccessUpdateRequest,
    AdminAccessUpdateResponse,
    LoginRequest,
    LoginResponse,
    SessionUser,
)


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_initial_admin(self) -> None:
        user = self.db.scalar(select(AdminUser).limit(1))
        if user is not None:
            return

        seeded_user = AdminUser(
            username=settings.default_admin_username,
            password_hash=hash_password(settings.default_admin_password),
            role="admin",
            active=True,
        )
        self.db.add(seeded_user)
        self.db.commit()

    def login(self, payload: LoginRequest) -> LoginResponse:
        user = self.db.scalar(select(AdminUser).where(AdminUser.username == payload.username))

        if user is None or not user.active or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid admin credentials",
            )

        token = generate_session_token()
        session = AdminSession(
            user_id=user.id,
            token_hash=hash_session_token(token),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.session_ttl_hours),
        )
        self.db.add(session)
        self.db.commit()

        return self._build_response(token, user)

    def get_session(self, authorization: str) -> LoginResponse:
        token = self._extract_bearer_token(authorization)
        user, _ = self._load_session(token)
        return self._build_response(token, user)

    def logout(self, authorization: str) -> None:
        token = self._extract_bearer_token(authorization)
        token_hash = hash_session_token(token)
        self.db.execute(delete(AdminSession).where(AdminSession.token_hash == token_hash))
        self.db.commit()

    def require_admin(self, authorization: str) -> SessionUser:
        token = self._extract_bearer_token(authorization)
        user, _ = self._load_session(token)
        if user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
        return SessionUser(id=user.id, username=user.username, role=user.role)

    def update_credentials(
        self,
        user_id: int,
        payload: AdminAccessUpdateRequest,
    ) -> AdminAccessUpdateResponse:
        user = self.db.get(AdminUser, user_id)
        if user is None or not user.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

        if not verify_password(payload.current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aktuelles Passwort ist nicht korrekt.",
            )

        normalized_username = payload.username.strip()
        new_password = payload.new_password.strip()
        username_changed = normalized_username != user.username
        password_changed = bool(new_password)

        if not normalized_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Benutzername darf nicht leer sein.",
            )

        if len(normalized_username) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Benutzername muss mindestens 3 Zeichen lang sein.",
            )

        if not username_changed and not password_changed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Es wurden keine Änderungen erkannt.",
            )

        if username_changed:
            username_taken = self.db.scalar(
                select(AdminUser).where(
                    AdminUser.username == normalized_username,
                    AdminUser.id != user.id,
                ),
            )
            if username_taken is not None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Dieser Benutzername ist bereits vergeben.",
                )
            user.username = normalized_username

        if password_changed:
            if len(new_password) < 8:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Das neue Passwort muss mindestens 8 Zeichen lang sein.",
                )
            user.password_hash = hash_password(new_password)

        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)

        if username_changed and password_changed:
            message = "Benutzername und Passwort wurden aktualisiert."
        elif username_changed:
            message = "Benutzername wurde aktualisiert."
        else:
            message = "Passwort wurde aktualisiert."

        return AdminAccessUpdateResponse(
            message=message,
            user=SessionUser(id=user.id, username=user.username, role=user.role),
        )

    def _load_session(self, token: str) -> tuple[AdminUser, AdminSession]:
        token_hash = hash_session_token(token)
        session = self.db.scalar(
            select(AdminSession).where(AdminSession.token_hash == token_hash),
        )
        if session is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session not found")

        if session.expires_at <= datetime.now(timezone.utc):
            self.db.delete(session)
            self.db.commit()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

        user = self.db.get(AdminUser, session.user_id)
        if user is None or not user.active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")

        return user, session

    @staticmethod
    def _extract_bearer_token(authorization: str) -> str:
        token_type, _, token = authorization.partition(" ")
        if token_type.lower() != "bearer" or not token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header",
            )
        return token

    @staticmethod
    def _build_response(token: str, user: AdminUser) -> LoginResponse:
        return LoginResponse(
            access_token=token,
            user=SessionUser(id=user.id, username=user.username, role=user.role),
        )
