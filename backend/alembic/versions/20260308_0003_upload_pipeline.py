"""AP2 upload pipeline schema."""

from alembic import op
import sqlalchemy as sa


revision = "20260308_0003"
down_revision = "20260308_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("uploads", sa.Column("filename_original", sa.String(length=255), nullable=True))
    op.add_column("uploads", sa.Column("filename_display", sa.String(length=255), nullable=True))
    op.add_column("uploads", sa.Column("mime_type", sa.String(length=128), nullable=True))
    op.add_column("uploads", sa.Column("size", sa.BigInteger(), nullable=True))
    op.add_column(
        "uploads",
        sa.Column("approved", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.execute("UPDATE uploads SET filename_original = filename")
    op.execute("UPDATE uploads SET filename_display = NULL")
    op.execute("UPDATE uploads SET mime_type = 'image/jpeg'")
    op.execute("UPDATE uploads SET size = 0")
    op.execute("UPDATE uploads SET status = CASE WHEN status = 'pending' THEN 'uploaded' ELSE status END")

    op.alter_column("uploads", "filename_original", nullable=False)
    op.alter_column("uploads", "mime_type", nullable=False)
    op.alter_column("uploads", "size", nullable=False)

    op.drop_column("uploads", "storage_path")
    op.drop_column("uploads", "filename")


def downgrade() -> None:
    op.add_column("uploads", sa.Column("filename", sa.String(length=255), nullable=True))
    op.add_column("uploads", sa.Column("storage_path", sa.String(length=255), nullable=True))

    op.execute("UPDATE uploads SET filename = filename_original")
    op.execute("UPDATE uploads SET storage_path = filename_display")

    op.alter_column("uploads", "filename", nullable=False)

    op.drop_column("uploads", "approved")
    op.drop_column("uploads", "size")
    op.drop_column("uploads", "mime_type")
    op.drop_column("uploads", "filename_display")
    op.drop_column("uploads", "filename_original")
