"""initial empty migration

Revision ID: f7ca2b02bdcb
Revises:
Create Date: 2026-05-27 23:54:32.855520

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "f7ca2b02bdcb"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
