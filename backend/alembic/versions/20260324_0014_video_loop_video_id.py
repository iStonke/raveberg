"""Add loop_video_id to video state."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260324_0014"
down_revision = "20260313_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("video_state")}
    if "loop_video_id" not in columns:
        op.add_column("video_state", sa.Column("loop_video_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in inspect(bind).get_columns("video_state")}
    if "loop_video_id" in columns:
        op.drop_column("video_state", "loop_video_id")
