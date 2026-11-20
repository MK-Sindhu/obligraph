"""dedupe the built-in returns catalogue; make (org_id, code) unique with NULLs

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-20
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Catalogue rows have org_id NULL, which the old constraint treated as distinct, so
    # re-seeding inserted copies. Keep the oldest row per code and merge the copies'
    # filings into it without losing any filed/waived status or evidence links.
    op.execute(
        """CREATE TEMP TABLE rt_map ON COMMIT DROP AS
           SELECT d.id AS dup_id, k.id AS keep_id
           FROM return_types d
           JOIN LATERAL (SELECT id FROM return_types k
                         WHERE k.org_id IS NULL AND k.code = d.code
                         ORDER BY k.created_at, k.id LIMIT 1) k ON true
           WHERE d.org_id IS NULL AND d.id <> k.id"""
    )
    op.execute(
        """UPDATE filings kf
           SET status = df.status, filed_on = df.filed_on, reference = df.reference,
               note = df.note, filed_by = df.filed_by
           FROM filings df JOIN rt_map m ON df.return_type_id = m.dup_id
           WHERE kf.return_type_id = m.keep_id AND kf.org_id = df.org_id
             AND kf.period_end = df.period_end
             AND kf.status = 'pending' AND df.status <> 'pending'"""
    )
    op.execute(
        """UPDATE evidence e SET filing_id = kf.id
           FROM filings df JOIN rt_map m ON df.return_type_id = m.dup_id
           JOIN filings kf ON kf.return_type_id = m.keep_id AND kf.org_id = df.org_id
                          AND kf.period_end = df.period_end
           WHERE e.filing_id = df.id"""
    )
    op.execute(
        """UPDATE filings df SET return_type_id = m.keep_id
           FROM rt_map m
           WHERE df.return_type_id = m.dup_id AND NOT EXISTS (
             SELECT 1 FROM filings kf WHERE kf.return_type_id = m.keep_id
               AND kf.org_id = df.org_id AND kf.period_end = df.period_end)"""
    )
    op.execute("DELETE FROM filings df USING rt_map m WHERE df.return_type_id = m.dup_id")
    op.execute("DELETE FROM return_types d USING rt_map m WHERE d.id = m.dup_id")
    op.execute("ALTER TABLE return_types DROP CONSTRAINT uq_return_types_org_code")
    op.execute(
        "ALTER TABLE return_types ADD CONSTRAINT uq_return_types_org_code "
        "UNIQUE NULLS NOT DISTINCT (org_id, code)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE return_types DROP CONSTRAINT uq_return_types_org_code")
    op.execute(
        "ALTER TABLE return_types ADD CONSTRAINT uq_return_types_org_code UNIQUE (org_id, code)"
    )
