from datetime import datetime, timezone

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.models.standby_state import StandbyState
from app.schemas.standby import StandbyStateRead, StandbyStateUpdate


class StandbyService:
    def __init__(self, db: Session):
        self.db = db

    def ensure_state(self) -> StandbyState:
        self._ensure_schema()
        state = self.db.get(StandbyState, 1)
        if state is None:
            state = StandbyState(id=1)
            self.db.add(state)
            self.db.commit()
            self.db.refresh(state)
        return state

    def get_state(self) -> StandbyStateRead:
        state = self.ensure_state()
        return StandbyStateRead.model_validate(state, from_attributes=True)

    def update_state(self, payload: StandbyStateUpdate) -> StandbyStateRead:
        state = self.ensure_state()
        state.headline = payload.headline.strip()
        state.subheadline = payload.subheadline.strip()
        state.hue_shift_degrees = payload.hue_shift_degrees
        state.updated_at = datetime.now(timezone.utc)
        self.db.add(state)
        self.db.commit()
        self.db.refresh(state)
        return StandbyStateRead.model_validate(state, from_attributes=True)

    def _ensure_schema(self) -> None:
        bind = self.db.get_bind()
        if bind is None:
            return
        inspector = inspect(bind)
        if not inspector.has_table(StandbyState.__tablename__):
            StandbyState.__table__.create(bind, checkfirst=True)
            return
        columns = {column["name"] for column in inspector.get_columns(StandbyState.__tablename__)}
        if "hue_shift_degrees" not in columns:
            self.db.execute(
                text(
                    "ALTER TABLE standby_state "
                    "ADD COLUMN hue_shift_degrees INTEGER NOT NULL DEFAULT 0"
                )
            )
            self.db.commit()
