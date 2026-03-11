"""Add optional upload comment for selfie captions."""

from alembic import op
import sqlalchemy as sa


revision = "20260311_0010"
down_revision = "20260309_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "uploads",
        sa.Column("comment", sa.String(length=40), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("uploads", "comment")
