"""Overlay mode for display states."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260311_0011"
down_revision = "20260311_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    for table_name in ("visualizer_state", "selfie_state", "video_state"):
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        if "overlay_mode" not in columns:
            op.add_column(
                table_name,
                sa.Column("overlay_mode", sa.String(length=32), nullable=False, server_default="logo"),
            )
        op.execute(
            f"UPDATE {table_name} "
            "SET overlay_mode = CASE WHEN logo_overlay_enabled THEN 'logo' ELSE 'off' END "
            "WHERE overlay_mode IS NULL OR overlay_mode = '' OR overlay_mode = 'logo'"
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    for table_name in ("video_state", "selfie_state", "visualizer_state"):
        columns = {column["name"] for column in inspector.get_columns(table_name)}
        if "overlay_mode" in columns:
            op.drop_column(table_name, "overlay_mode")
