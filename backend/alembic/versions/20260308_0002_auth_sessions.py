"""AP1 auth and session schema."""

from alembic import op
import sqlalchemy as sa


revision = "20260308_0002"
down_revision = "20260308_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("admin_users", "hashed_password", new_column_name="password_hash")
    op.alter_column("admin_users", "is_active", new_column_name="active")

    op.create_table(
        "admin_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["admin_users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(op.f("ix_admin_sessions_expires_at"), "admin_sessions", ["expires_at"], unique=False)
    op.create_index(op.f("ix_admin_sessions_token_hash"), "admin_sessions", ["token_hash"], unique=True)
    op.create_index(op.f("ix_admin_sessions_user_id"), "admin_sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_admin_sessions_user_id"), table_name="admin_sessions")
    op.drop_index(op.f("ix_admin_sessions_token_hash"), table_name="admin_sessions")
    op.drop_index(op.f("ix_admin_sessions_expires_at"), table_name="admin_sessions")
    op.drop_table("admin_sessions")

    op.alter_column("admin_users", "active", new_column_name="is_active")
    op.alter_column("admin_users", "password_hash", new_column_name="hashed_password")
