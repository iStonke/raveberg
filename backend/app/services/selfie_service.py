from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.selfie_state import SelfieState
from app.schemas.selfie import SelfieStateRead, SelfieStateUpdate


class SelfieService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_state(self) -> SelfieState:
        state = self.db.get(SelfieState, 1)
        if state is None:
            state = SelfieState(
                id=1,
                slideshow_enabled=settings.default_slideshow_enabled,
                slideshow_interval_seconds=settings.default_slideshow_interval_seconds,
                slideshow_shuffle=settings.default_slideshow_shuffle,
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
        state.slideshow_shuffle = payload.slideshow_shuffle
        state.moderation_mode = payload.moderation_mode
        state.slideshow_updated_at = datetime.now(timezone.utc)
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return SelfieStateRead.model_validate(state, from_attributes=True)
