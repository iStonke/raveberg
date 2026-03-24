"""Add loop_video_id to video state."""

from alembic import op
import sqlalchemy as sa


revision = "20260324_0014"
down_revision = "20260313_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("video_state", sa.Column("loop_video_id", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("video_state", "loop_video_id")
