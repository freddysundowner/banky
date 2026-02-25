import os
import re
from sqlalchemy import create_engine, text
from models.tenant import TenantBase


class LocalTenantService:
    """
    Provisions per-org databases on the local Postgres server that was already
    set up by install.sh.

    No extra env vars are required. The service derives the superuser connection
    from DATABASE_URL (which install.sh always writes) by swapping the database
    name to the Postgres maintenance database ('postgres').

    Optional override:
        LOCAL_PG_SUPERUSER_URL  — set only if you need a different superuser
                                   account than the one in DATABASE_URL.

    The service will:
      1. Connect to the Postgres maintenance database as superuser
      2. CREATE DATABASE bankykit_<org_id_short>
      3. Run tenant schema migrations on the new database
      4. Return the connection string for the new database
    """

    @staticmethod
    def _swap_db_name(url: str, new_db: str) -> str:
        """Replace the database name in a Postgres URL with new_db.

        Works for all three URL forms install.sh may write:
          postgresql:///bankykit              (peer auth, no host)
          postgresql://localhost:5432/bankykit (TCP with host)
          postgresql://user:pass@host/bankykit (with credentials)
        """
        without_query = url.split("?")[0]
        base = without_query.rsplit("/", 1)[0]
        return f"{base}/{new_db}"

    def _superuser_url(self) -> str:
        # Explicit override takes priority
        url = os.environ.get("LOCAL_PG_SUPERUSER_URL")
        if url:
            return url

        # Derive from DATABASE_URL — swap the DB name for the Postgres maintenance DB.
        # DATABASE_URL is always written by install.sh using the same superuser account,
        # so no extra credentials are needed.
        base_url = os.environ.get("DATABASE_URL", "")
        if not base_url:
            raise ValueError(
                "DATABASE_URL is not set. Run install.sh first, or set "
                "LOCAL_PG_SUPERUSER_URL manually."
            )
        return self._swap_db_name(base_url, "postgres")

    def _db_name(self, org_id: str) -> str:
        safe = re.sub(r"[^a-z0-9]", "_", org_id[:16].lower())
        return f"bankykit_{safe}"

    def _tenant_url(self, org_id: str) -> str:
        base_url = os.environ.get("LOCAL_PG_SUPERUSER_URL") or os.environ.get("DATABASE_URL", "")
        return self._swap_db_name(base_url, self._db_name(org_id))

    async def create_tenant_database(self, org_id: str, org_name: str) -> dict:
        superuser_url = self._superuser_url()
        db_name = self._db_name(org_id)
        tenant_url = self._tenant_url(org_id)

        engine = create_engine(superuser_url, isolation_level="AUTOCOMMIT")
        try:
            with engine.connect() as conn:
                exists = conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :name"),
                    {"name": db_name},
                ).fetchone()
                if not exists:
                    conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                    print(f"[LocalTenant] Created database: {db_name}")
                else:
                    print(f"[LocalTenant] Database already exists: {db_name}")
        finally:
            engine.dispose()

        await self.run_tenant_migrations(tenant_url)

        return {
            "project_id": None,
            "branch_id": None,
            "connection_string": tenant_url,
        }

    async def run_tenant_migrations(self, connection_string: str):
        try:
            engine = create_engine(connection_string)
            TenantBase.metadata.create_all(bind=engine)

            with engine.connect() as conn:
                conn.execute(text(
                    "CREATE SEQUENCE IF NOT EXISTS member_number_seq START 1"
                ))
                conn.execute(text(
                    "CREATE SEQUENCE IF NOT EXISTS loan_app_number_seq START 1"
                ))

                for check_col, table, old_col, new_col in [
                    ("employee_number", "staff", "employee_number", "staff_number"),
                    ("location", "branches", "location", "address"),
                ]:
                    row = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :t AND column_name = :c"
                    ), {"t": table, "c": check_col}).fetchone()
                    if row:
                        conn.execute(text(
                            f"ALTER TABLE {table} RENAME COLUMN {old_col} TO {new_col}"
                        ))

                for table, col, col_type, default in [
                    ("staff", "password_hash", "VARCHAR(255)", None),
                    ("expenses", "is_recurring", "BOOLEAN", "FALSE"),
                    ("expenses", "recurrence_interval", "VARCHAR(50)", None),
                    ("expenses", "next_due_date", "DATE", None),
                    ("sms_notifications", "is_read", "BOOLEAN", "FALSE"),
                ]:
                    row = conn.execute(text(
                        "SELECT column_name FROM information_schema.columns "
                        "WHERE table_name = :t AND column_name = :c"
                    ), {"t": table, "c": col}).fetchone()
                    if not row:
                        default_clause = f" DEFAULT {default}" if default else ""
                        conn.execute(text(
                            f"ALTER TABLE {table} "
                            f"ADD COLUMN IF NOT EXISTS {col} {col_type}{default_clause}"
                        ))

                conn.commit()
            engine.dispose()
        except Exception as e:
            print(f"[LocalTenant] Migration error: {e}")
            raise

    async def delete_tenant_database(self, org_id: str) -> bool:
        superuser_url = self._superuser_url()
        db_name = self._db_name(org_id)

        engine = create_engine(superuser_url, isolation_level="AUTOCOMMIT")
        try:
            with engine.connect() as conn:
                conn.execute(text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = :name AND pid <> pg_backend_pid()"
                ), {"name": db_name})
                conn.execute(text(f'DROP DATABASE IF EXISTS "{db_name}"'))
                print(f"[LocalTenant] Dropped database: {db_name}")
            return True
        except Exception as e:
            print(f"[LocalTenant] Failed to drop database {db_name}: {e}")
            return False
        finally:
            engine.dispose()


local_tenant_service = LocalTenantService()
