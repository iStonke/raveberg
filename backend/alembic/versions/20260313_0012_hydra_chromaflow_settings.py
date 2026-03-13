"""Hydra chromaflow settings on visualizer state."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision = "20260313_0012"
down_revision = "20260311_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("visualizer_state")}

    if "hydra_colorfulness" not in columns:
        op.add_column(
            "visualizer_state",
            sa.Column("hydra_colorfulness", sa.Integer(), nullable=False, server_default="78"),
        )
    if "hydra_scene_change_rate" not in columns:
        op.add_column(
            "visualizer_state",
            sa.Column("hydra_scene_change_rate", sa.Integer(), nullable=False, server_default="46"),
        )
    if "hydra_symmetry_amount" not in columns:
        op.add_column(
            "visualizer_state",
            sa.Column("hydra_symmetry_amount", sa.Integer(), nullable=False, server_default="38"),
        )
    if "hydra_feedback_amount" not in columns:
        op.add_column(
            "visualizer_state",
            sa.Column("hydra_feedback_amount", sa.Integer(), nullable=False, server_default="24"),
        )
    if "hydra_quality" not in columns:
        op.add_column(
            "visualizer_state",
            sa.Column("hydra_quality", sa.String(length=32), nullable=False, server_default="medium"),
        )
    if "hydra_audio_reactivity_enabled" not in columns:
        op.add_column(
            "visualizer_state",
            sa.Column(
                "hydra_audio_reactivity_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.text("true"),
            ),
        )
    if "hydra_palette_mode" not in columns:
        op.add_column(
            "visualizer_state",
            sa.Column("hydra_palette_mode", sa.String(length=32), nullable=False, server_default="auto"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("visualizer_state")}

    for column_name in (
        "hydra_palette_mode",
        "hydra_audio_reactivity_enabled",
        "hydra_quality",
        "hydra_feedback_amount",
        "hydra_symmetry_amount",
        "hydra_scene_change_rate",
        "hydra_colorfulness",
    ):
        if column_name in columns:
            op.drop_column("visualizer_state", column_name)
