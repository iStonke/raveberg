from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.setting import Setting
from app.schemas.guest_upload import GuestUploadConfigRead, GuestUploadConfigUpdate
from app.schemas.selfie import ModerationMode


class GuestUploadConfigService:
    _KEY_PREFIX = "guest_upload"
    _SETTING_KEYS = (
        "enabled",
        "requires_approval",
        "session_timeout_hours",
        "session_started_at",
        "session_token",
        "updated_at",
    )

    def __init__(self, db: Session):
        self.db = db

    def get_config(self) -> GuestUploadConfigRead:
        config = self._load_config()
        return self._build_read(config)

    def update_config(self, payload: GuestUploadConfigUpdate) -> GuestUploadConfigRead:
        current = self._load_config()
        now = datetime.now(timezone.utc)

        session_started_at = current["session_started_at"]
        session_token = current["session_token"]
        should_restart_session = (
            payload.restart_session
            or not isinstance(session_token, str)
            or not session_token.strip()
            or payload.guest_upload_session_timeout_hours != current["guest_upload_session_timeout_hours"]
            or current["session_is_expired"]
            or (not current["guest_upload_enabled"] and payload.guest_upload_enabled)
        )
        if should_restart_session:
            session_started_at = now
            session_token = self._generate_session_token()

        next_values = {
            "guest_upload_enabled": payload.guest_upload_enabled,
            "guest_upload_requires_approval": payload.guest_upload_requires_approval,
            "guest_upload_session_timeout_hours": payload.guest_upload_session_timeout_hours,
            "session_started_at": session_started_at,
            "session_token": session_token,
            "updated_at": now,
        }
        self._persist(next_values)
        return self._build_read(self._coerce_with_expiry(next_values))

    def ensure_upload_allowed(self, *, session_token: str | None = None) -> GuestUploadConfigRead:
        config = self.get_config()
        if config.session_is_expired:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Guest upload session has expired.",
            )
        if not config.guest_upload_enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Guest upload is currently disabled.",
            )
        if not self._tokens_match(config.session_token, session_token):
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="Guest upload session has expired.",
            )
        return config

    def build_public_guest_upload_url(self, config: GuestUploadConfigRead | None = None) -> str:
        resolved = config or self.get_config()
        return self._append_session_token(resolved.session_token)

    def get_moderation_mode(self) -> ModerationMode:
        return self.moderation_mode_from_requires_approval(self.get_config().guest_upload_requires_approval)

    @staticmethod
    def moderation_mode_from_requires_approval(requires_approval: bool) -> ModerationMode:
        return "manual_approve" if requires_approval else "auto_approve"

    def _load_config(self) -> dict[str, object]:
        defaults = {
            "guest_upload_enabled": True,
            "guest_upload_requires_approval": False,
            "guest_upload_session_timeout_hours": 24,
            "session_started_at": datetime.now(timezone.utc),
            "session_token": self._generate_session_token(),
            "updated_at": None,
        }
        existing = {
            row.key: row
            for row in self.db.execute(
                select(Setting).where(
                    Setting.key.in_([self._key(name) for name in self._SETTING_KEYS]),
                ),
            ).scalars()
        }

        changed = False
        for field_name, default_value in (
            ("guest_upload_enabled", defaults["guest_upload_enabled"]),
            ("guest_upload_requires_approval", defaults["guest_upload_requires_approval"]),
            ("guest_upload_session_timeout_hours", defaults["guest_upload_session_timeout_hours"]),
            ("session_started_at", defaults["session_started_at"]),
            ("session_token", defaults["session_token"]),
            ("updated_at", defaults["updated_at"]),
        ):
            setting_key = self._key(self._storage_name(field_name))
            row = existing.get(setting_key)
            if row is None:
                row = Setting(key=setting_key, value="")
                self.db.add(row)
                existing[setting_key] = row
                row.value = json.dumps(self._encode_value(default_value))
                changed = True
                defaults[field_name] = default_value
                continue

            try:
                defaults[field_name] = self._decode_value(field_name, json.loads(row.value))
            except (TypeError, ValueError, json.JSONDecodeError):
                row.value = json.dumps(self._encode_value(default_value))
                defaults[field_name] = default_value
                changed = True

        if changed:
            self.db.commit()

        return self._coerce_with_expiry(defaults)

    def _persist(self, values: dict[str, object]) -> None:
        existing = {
            row.key: row
            for row in self.db.execute(
                select(Setting).where(
                    Setting.key.in_([self._key(name) for name in self._SETTING_KEYS]),
                ),
            ).scalars()
        }

        for field_name in (
            "guest_upload_enabled",
            "guest_upload_requires_approval",
            "guest_upload_session_timeout_hours",
            "session_started_at",
            "session_token",
            "updated_at",
        ):
            setting_key = self._key(self._storage_name(field_name))
            row = existing.get(setting_key)
            if row is None:
                row = Setting(key=setting_key, value="")
                self.db.add(row)
            row.value = json.dumps(self._encode_value(values[field_name]))

        self.db.commit()

    def _coerce_with_expiry(self, values: dict[str, object]) -> dict[str, object]:
        started_at = values["session_started_at"]
        if not isinstance(started_at, datetime):
            started_at = datetime.now(timezone.utc)

        timeout_hours = int(values["guest_upload_session_timeout_hours"])
        expires_at = started_at + timedelta(hours=timeout_hours)
        now = datetime.now(timezone.utc)

        return {
            "guest_upload_enabled": bool(values["guest_upload_enabled"]),
            "guest_upload_requires_approval": bool(values["guest_upload_requires_approval"]),
            "guest_upload_session_timeout_hours": timeout_hours,
            "session_started_at": started_at,
            "session_token": str(values["session_token"]),
            "session_expires_at": expires_at,
            "session_is_expired": now >= expires_at,
            "updated_at": values["updated_at"] if isinstance(values["updated_at"], datetime) else None,
        }

    @staticmethod
    def _build_read(values: dict[str, object]) -> GuestUploadConfigRead:
        return GuestUploadConfigRead.model_validate(values)

    @classmethod
    def _key(cls, field_name: str) -> str:
        return f"{cls._KEY_PREFIX}.{field_name}"

    @staticmethod
    def _storage_name(field_name: str) -> str:
        mapping = {
            "guest_upload_enabled": "enabled",
            "guest_upload_requires_approval": "requires_approval",
            "guest_upload_session_timeout_hours": "session_timeout_hours",
            "session_started_at": "session_started_at",
            "session_token": "session_token",
            "updated_at": "updated_at",
        }
        return mapping[field_name]

    @staticmethod
    def _encode_value(value: object) -> object:
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).isoformat()
        return value

    @staticmethod
    def _decode_value(field_name: str, value: object) -> object:
        if field_name in {"guest_upload_enabled", "guest_upload_requires_approval"}:
            if isinstance(value, bool):
                return value
            raise ValueError(field_name)
        if field_name == "guest_upload_session_timeout_hours":
            if isinstance(value, int):
                return GuestUploadConfigUpdate(guest_upload_session_timeout_hours=value).guest_upload_session_timeout_hours
            raise ValueError(field_name)
        if field_name in {"session_started_at", "updated_at"}:
            if value is None:
                return None
            if isinstance(value, str):
                return datetime.fromisoformat(value)
            raise ValueError(field_name)
        if field_name == "session_token":
            if isinstance(value, str) and value.strip():
                return value.strip()
            raise ValueError(field_name)
        return value

    @staticmethod
    def _generate_session_token() -> str:
        return secrets.token_urlsafe(24)

    @staticmethod
    def _tokens_match(expected: str | None, provided: str | None) -> bool:
        if not expected or not provided:
            return False
        return secrets.compare_digest(expected, provided)

    @staticmethod
    def _append_session_token(session_token: str) -> str:
        parts = urlsplit(settings.guest_upload_url)
        query = dict(parse_qsl(parts.query, keep_blank_values=True))
        query["t"] = session_token
        return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))
