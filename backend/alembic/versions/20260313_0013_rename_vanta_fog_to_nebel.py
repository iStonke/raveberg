"""Rename vanta_fog preset to nebel."""

from alembic import op


revision = "20260313_0013"
down_revision = "20260313_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE visualizer_state SET active_preset = 'nebel' WHERE active_preset = 'vanta_fog'")


def downgrade() -> None:
    op.execute("UPDATE visualizer_state SET active_preset = 'vanta_fog' WHERE active_preset = 'nebel'")
