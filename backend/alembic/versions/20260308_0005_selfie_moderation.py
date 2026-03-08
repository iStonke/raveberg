"""AP4 selfie moderation and slideshow state."""

from alembic import op
import sqlalchemy as sa


revision = "20260308_0005"
down_revision = "20260308_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "selfie_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slideshow_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "slideshow_interval_seconds",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("6"),
        ),
        sa.Column("slideshow_shuffle", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "moderation_mode",
            sa.String(length=32),
            nullable=False,
            server_default="auto_approve",
        ),
        sa.Column(
            "slideshow_updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO selfie_state (
            id,
            slideshow_enabled,
            slideshow_interval_seconds,
            slideshow_shuffle,
            moderation_mode
        )
        VALUES (1, true, 6, true, 'auto_approve')
        """
    )

    op.add_column(
        "uploads",
        sa.Column(
            "moderation_status",
            sa.String(length=32),
            nullable=True,
            server_default="approved",
        ),
    )
    op.execute(
        """
        UPDATE uploads
        SET moderation_status = CASE
            WHEN status = 'error' THEN 'rejected'
            WHEN approved IS TRUE THEN 'approved'
            ELSE 'pending'
        END
        """
    )
    op.alter_column("uploads", "moderation_status", nullable=False)


def downgrade() -> None:
    op.drop_column("uploads", "moderation_status")
    op.drop_table("selfie_state")
