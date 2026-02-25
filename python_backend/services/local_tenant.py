import os
import re
from sqlalchemy import create_engine, text
from models.tenant import TenantBase


class LocalTenantService:
    """
    Provisions per-org databases on a locally accessible Postgres server.

    Required env var:
        LOCAL_PG_SUPERUSER_URL  — connection string for a superuser account that
                                   can CREATE / DROP databases, e.g.:
                                   postgresql://postgres:secret@localhost:5432/postgres

    The service will:
      1. Connect to the superuser database
      2. CREATE DATABASE bankykit_<org_id_short>
      3. Run tenant schema migrations on the new database
      4. Return the connection string for the new database
    """

    def _superuser_url(self) -> str:
        url = os.environ.get("LOCAL_PG_SUPERUSER_URL")
        if not url:
            raise ValueError(
                "LOCAL_PG_SUPERUSER_URL is not set. "
                "Set it to a Postgres superuser connection string, e.g. "
                "postgresql://postgres:secret@localhost:5432/postgres"
            )
        return url

    def _db_name(self, org_id: str) -> str:
        safe = re.sub(r"[^a-z0-9]", "_", org_id[:16].lower())
        return f"bankykit_{safe}"

    def _tenant_url(self, org_id: str) -> str:
        superuser_url = self._superuser_url()
        db_name = self._db_name(org_id)
        base = superuser_url.rsplit("/", 1)[0]
        return f"{base}/{db_name}"

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
