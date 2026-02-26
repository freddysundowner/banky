import os
from urllib.parse import urlparse, urlunparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from models.tenant import TenantBase

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")


def normalize_pg_url(url: str) -> str:
    """
    Ensure a PostgreSQL connection string uses 127.0.0.1 (TCP) instead of
    'localhost' or the Unix socket path. This prevents 'no password supplied'
    errors when pg_hba.conf uses scram-sha-256 (peer auth removed).

    Rules:
      - Neon / external hosts are left untouched.
      - URLs already using 127.0.0.1 are left untouched.
      - Socket URLs (postgresql:///dbname), localhost URLs, and localhost:port
        URLs are rewritten to postgresql://user:pass@127.0.0.1:5432/dbname,
        borrowing credentials from DATABASE_URL when not present in the URL.
    """
    if not url:
        return url

    parsed = urlparse(url)
    host = parsed.hostname or ""

    # Leave Neon and any non-local host alone
    if host and host not in ("localhost", "127.0.0.1"):
        return url

    # Already correct
    if host == "127.0.0.1" and parsed.username and parsed.password:
        return url

    # Extract just the database name
    db_name = parsed.path.lstrip("/")

    # Borrow credentials from DATABASE_URL when missing
    master = urlparse(os.environ.get("DATABASE_URL", ""))
    user = parsed.username or master.username or "postgres"
    password = parsed.password or master.password or ""

    if password:
        netloc = f"{user}:{password}@127.0.0.1:5432"
    else:
        netloc = f"{user}@127.0.0.1:5432"

    return urlunparse(("postgresql", netloc, f"/{db_name}", "", "", ""))


engine = create_engine(
    normalize_pg_url(DATABASE_URL),
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
    pool_pre_ping=True,
    pool_timeout=30,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

_migrated_tenants = set()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_tenant_engine(connection_string: str):
    from services.tenant_context import _get_cached_engine
    return _get_cached_engine(normalize_pg_url(connection_string))


def run_tenant_schema_migration(engine):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'staff' AND column_name = 'employee_number'
        """))
        if result.fetchone():
            conn.execute(text("ALTER TABLE staff RENAME COLUMN employee_number TO staff_number"))

        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'branches' AND column_name = 'location'
        """))
        if result.fetchone():
            conn.execute(text("ALTER TABLE branches RENAME COLUMN location TO address"))

        conn.commit()


def get_tenant_session(connection_string: str):
    normalized = normalize_pg_url(connection_string)
    tenant_engine = get_tenant_engine(normalized)

    if normalized not in _migrated_tenants:
        from services.tenant_context import _get_db_migration_version, _set_db_migration_version, _migration_version
        db_version = _get_db_migration_version(tenant_engine)
        if db_version >= _migration_version:
            _migrated_tenants.add(normalized)
        else:
            try:
                from services.tenant_context import run_tenant_schema_migration as full_migration
                TenantBase.metadata.create_all(bind=tenant_engine)
                full_migration(tenant_engine)
                _set_db_migration_version(tenant_engine, _migration_version)
                _migrated_tenants.add(normalized)
            except Exception as e:
                print(f"Tenant migration error: {e}")

    TenantSession = sessionmaker(autocommit=False, autoflush=False, bind=tenant_engine)
    return TenantSession()
