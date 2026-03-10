from datetime import datetime, timezone

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.selfie_state import SelfieState
from app.schemas.selfie import SelfieStateRead, SelfieStateUpdate


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
                slideshow_shuffle=settings.default_slideshow_shuffle,
                vintage_look_enabled=settings.default_vintage_look_enabled,
                moderation_mode=settings.default_moderation_mode,
            )
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        return state

    def get_state(self) -> SelfieStateRead:
        state = self.ensure_state()
        return SelfieStateRead.model_validate(state, from_attributes=True)

    def update_state(self, payload: SelfieStateUpdate) -> SelfieStateRead:
        state = self.ensure_state()
        state.slideshow_enabled = payload.slideshow_enabled
        state.slideshow_interval_seconds = payload.slideshow_interval_seconds
        state.slideshow_max_visible_photos = payload.slideshow_max_visible_photos
        state.slideshow_shuffle = payload.slideshow_shuffle
        state.vintage_look_enabled = payload.vintage_look_enabled
        state.moderation_mode = payload.moderation_mode
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
        if "vintage_look_enabled" in columns:
            return
        self.db.execute(
            text(
                "ALTER TABLE selfie_state "
                "ADD COLUMN vintage_look_enabled BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        self.db.commit()
