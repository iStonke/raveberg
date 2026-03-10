"""Visualizer logo overlay toggle."""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0009"
down_revision = "20260309_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "visualizer_state",
        sa.Column("logo_overlay_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )


def downgrade() -> None:
    op.drop_column("visualizer_state", "logo_overlay_enabled")
