"""Add configurable selfie max visible photo count."""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0007"
down_revision = "20260309_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "selfie_state",
        sa.Column(
            "slideshow_max_visible_photos",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("4"),
        ),
    )


def downgrade() -> None:
    op.drop_column("selfie_state", "slideshow_max_visible_photos")
