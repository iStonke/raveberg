"""Add video mode state and asset library."""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0008"
down_revision = "20260309_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "video_assets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("filename_original", sa.String(length=255), nullable=False),
        sa.Column("filename_stored", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column("size", sa.BigInteger(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("filename_stored"),
    )
    op.create_table(
        "video_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("playlist_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("loop_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("playback_order", sa.String(length=32), nullable=False, server_default=sa.text("'upload_order'")),
        sa.Column("vintage_filter_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("object_fit", sa.String(length=32), nullable=False, server_default=sa.text("'contain'")),
        sa.Column("transition", sa.String(length=32), nullable=False, server_default=sa.text("'none'")),
        sa.Column("active_video_id", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["active_video_id"], ["video_assets.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("video_state")
    op.drop_table("video_assets")
