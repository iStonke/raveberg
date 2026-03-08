"""AP6 runtime hardening."""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0006"
down_revision = "20260308_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "visualizer_state",
        sa.Column("auto_cycle_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "visualizer_state",
        sa.Column(
            "auto_cycle_interval_seconds",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("45"),
        ),
    )

    op.create_table(
        "display_status",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_state_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("renderer_label", sa.String(length=64), nullable=False, server_default="Idle Renderer"),
        sa.Column("current_mode", sa.String(length=32), nullable=False, server_default="idle"),
        sa.Column("sse_connected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO display_status (id, renderer_label, current_mode, sse_connected)
        VALUES (1, 'Idle Renderer', 'idle', false)
        """
    )


def downgrade() -> None:
    op.drop_table("display_status")
    op.drop_column("visualizer_state", "auto_cycle_interval_seconds")
    op.drop_column("visualizer_state", "auto_cycle_enabled")
