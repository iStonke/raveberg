"""AP3 visualizer state."""

from alembic import op
import sqlalchemy as sa


revision = "20260308_0004"
down_revision = "20260308_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "visualizer_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("active_preset", sa.String(length=64), nullable=False),
        sa.Column("intensity", sa.Integer(), nullable=False),
        sa.Column("speed", sa.Integer(), nullable=False),
        sa.Column("brightness", sa.Integer(), nullable=False),
        sa.Column("color_scheme", sa.String(length=64), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute(
        """
        INSERT INTO visualizer_state (id, active_preset, intensity, speed, brightness, color_scheme, updated_at)
        VALUES (1, 'tunnel', 65, 55, 70, 'acid', now())
        """
    )


def downgrade() -> None:
    op.drop_table("visualizer_state")
