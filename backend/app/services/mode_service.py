from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_state import AppState
from app.schemas.mode import ModeRead, ModeType


class ModeService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_state(self) -> AppState:
        state = self.db.get(AppState, 1)
        if state is None:
            state = AppState(
                id=1,
                mode=settings.default_app_mode,
                source="backend",
            )
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        return state

    def get_mode(self) -> ModeRead:
        state = self.ensure_state()
        return ModeRead.model_validate(state, from_attributes=True)

    def set_mode(self, mode: ModeType) -> ModeRead:
        state = self.ensure_state()
        state.mode = mode
        state.source = "backend"
        state.updated_at = datetime.now(timezone.utc)
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return ModeRead.model_validate(state, from_attributes=True)
