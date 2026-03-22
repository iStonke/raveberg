from datetime import datetime, timezone

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.selfie_state import SelfieState
from app.schemas.selfie import SelfieStateRead, SelfieStateUpdate
from app.services.guest_upload_config_service import GuestUploadConfigService
from app.services.mode_service import ModeService


class SelfieService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_state(self) -> SelfieState:
        self._ensure_schema()
        state = self.db.get(SelfieState, 1)
        if state is None:
            state = SelfieState(
                id=1,
                slideshow_enabled=settings.default_slideshow_enabled,
                slideshow_interval_seconds=settings.default_slideshow_interval_seconds,
                slideshow_max_visible_photos=settings.default_slideshow_max_visible_photos,
                slideshow_min_uploads_to_start=settings.default_slideshow_min_uploads_to_start,
                slideshow_shuffle=settings.default_slideshow_shuffle,
                logo_overlay_enabled=True,
                overlay_mode="logo",
                vintage_look_enabled=settings.default_vintage_look_enabled,
                moderation_mode=GuestUploadConfigService(self.db).get_moderation_mode(),
            )
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        elif state.moderation_mode != GuestUploadConfigService(self.db).get_moderation_mode():
            state.moderation_mode = GuestUploadConfigService(self.db).get_moderation_mode()
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        return state

    def get_state(self) -> SelfieStateRead:
        state = self.ensure_state()
        if ModeService(self.db).get_mode().mode == "selfie":
            self.ensure_slideshow_running()
            state = self.ensure_state()
        return SelfieStateRead.model_validate(state, from_attributes=True)

    def update_state(self, payload: SelfieStateUpdate) -> SelfieStateRead:
        state = self.ensure_state()
        state.slideshow_enabled = payload.slideshow_enabled
        if ModeService(self.db).get_mode().mode == "selfie":
            state.slideshow_enabled = True
        state.slideshow_interval_seconds = payload.slideshow_interval_seconds
        state.slideshow_max_visible_photos = payload.slideshow_max_visible_photos
        state.slideshow_min_uploads_to_start = payload.slideshow_min_uploads_to_start
        state.slideshow_shuffle = payload.slideshow_shuffle
        state.overlay_mode = payload.overlay_mode
        state.logo_overlay_enabled = payload.overlay_mode == "logo"
        state.vintage_look_enabled = payload.vintage_look_enabled
        state.moderation_mode = GuestUploadConfigService(self.db).get_moderation_mode()
        state.slideshow_updated_at = datetime.now(timezone.utc)
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return SelfieStateRead.model_validate(state, from_attributes=True)

    def ensure_slideshow_running(self) -> SelfieStateRead | None:
        state = self.ensure_state()
        if state.slideshow_enabled:
            return None

        state.slideshow_enabled = True
        state.slideshow_updated_at = datetime.now(timezone.utc)
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return SelfieStateRead.model_validate(state, from_attributes=True)

    def _ensure_schema(self) -> None:
        bind = self.db.get_bind()
        if bind is None:
            return
        columns = {column["name"] for column in inspect(bind).get_columns(SelfieState.__tablename__)}
        changed = False
        if "vintage_look_enabled" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE selfie_state "
                    "ADD COLUMN vintage_look_enabled BOOLEAN NOT NULL DEFAULT FALSE"
                )
            )
            changed = True
        if "logo_overlay_enabled" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE selfie_state "
                    "ADD COLUMN logo_overlay_enabled BOOLEAN NOT NULL DEFAULT TRUE"
                )
            )
            changed = True
        if "overlay_mode" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE selfie_state "
                    "ADD COLUMN overlay_mode VARCHAR(32) NOT NULL DEFAULT 'logo'"
                )
            )
            self.db.execute(
                text(
                    "UPDATE selfie_state "
                    "SET overlay_mode = CASE WHEN logo_overlay_enabled THEN 'logo' ELSE 'off' END"
                )
            )
            changed = True
        if "slideshow_min_uploads_to_start" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE selfie_state "
                    "ADD COLUMN slideshow_min_uploads_to_start INTEGER NOT NULL DEFAULT 3"
                )
            )
            changed = True
        if changed:
            self.db.commit()
