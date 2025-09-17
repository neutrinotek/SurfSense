"""Add MCPO connector enums."""

from alembic import op

# revision identifiers, used by Alembic.
revision = "21"
down_revision = "20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Upgrade schema - add MCPO_CONNECTOR to enums."""
    op.execute(
        """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'searchsourceconnectortype' AND e.enumlabel = 'MCPO_CONNECTOR'
        ) THEN
            ALTER TYPE searchsourceconnectortype ADD VALUE 'MCPO_CONNECTOR';
        END IF;
    END
    $$;
    """
    )

    op.execute(
        """
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = 'documenttype' AND e.enumlabel = 'MCPO_CONNECTOR'
        ) THEN
            ALTER TYPE documenttype ADD VALUE 'MCPO_CONNECTOR';
        END IF;
    END
    $$;
    """
    )


def downgrade() -> None:
    """Downgrade schema - no-op for enum removals."""
    pass
