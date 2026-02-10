import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from models.tenant import TenantBase

DATABASE_URL = os.environ.get("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

engine = create_engine(
    DATABASE_URL,
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
    return _get_cached_engine(connection_string)

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
    tenant_engine = get_tenant_engine(connection_string)
    
    if connection_string not in _migrated_tenants:
        from services.tenant_context import _get_db_migration_version, _set_db_migration_version, _migration_version
        db_version = _get_db_migration_version(tenant_engine)
        if db_version >= _migration_version:
            _migrated_tenants.add(connection_string)
        else:
            try:
                TenantBase.metadata.create_all(bind=tenant_engine)
                run_tenant_schema_migration(tenant_engine)
                _set_db_migration_version(tenant_engine, _migration_version)
                _migrated_tenants.add(connection_string)
            except Exception as e:
                print(f"Tenant migration error: {e}")
    
    TenantSession = sessionmaker(autocommit=False, autoflush=False, bind=tenant_engine)
    return TenantSession()
