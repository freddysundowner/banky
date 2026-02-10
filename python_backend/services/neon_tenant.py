import os
import httpx
from typing import Optional
from sqlalchemy import create_engine, text
from models.tenant import TenantBase

NEON_API_KEY = os.environ.get("NEON_API_KEY")
NEON_API_BASE = "https://console.neon.tech/api/v2"

class NeonTenantService:
    def __init__(self):
        self.api_key = NEON_API_KEY
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def create_tenant_database(self, org_id: str, org_name: str) -> dict:
        if not self.api_key:
            raise ValueError("NEON_API_KEY environment variable is not set")
        
        async with httpx.AsyncClient() as client:
            project_name = f"banky-{org_id[:8]}"
            
            response = await client.post(
                f"{NEON_API_BASE}/projects",
                headers=self.headers,
                json={
                    "project": {
                        "name": project_name,
                        "pg_version": 16
                    }
                },
                timeout=60.0
            )
            
            if response.status_code != 201:
                raise Exception(f"Failed to create Neon project: {response.text}")
            
            data = response.json()
            project_id = data["project"]["id"]
            branch_id = data["branch"]["id"]
            
            connection_uri = None
            for endpoint in data.get("endpoints", []):
                if endpoint.get("type") == "read_write":
                    host = endpoint.get("host")
                    if host:
                        password = data.get("roles", [{}])[0].get("password", "")
                        connection_uri = f"postgresql://neondb_owner:{password}@{host}/neondb?sslmode=require"
                        break
            
            if not connection_uri:
                connection_uri = data.get("connection_uris", [{}])[0].get("connection_uri")
            
            if connection_uri:
                await self.run_tenant_migrations(connection_uri)
            
            return {
                "project_id": project_id,
                "branch_id": branch_id,
                "connection_string": connection_uri
            }
    
    async def run_tenant_migrations(self, connection_string: str):
        try:
            engine = create_engine(connection_string)
            TenantBase.metadata.create_all(bind=engine)
            
            with engine.connect() as conn:
                conn.execute(text("""
                    CREATE SEQUENCE IF NOT EXISTS member_number_seq START 1
                """))
                conn.execute(text("""
                    CREATE SEQUENCE IF NOT EXISTS loan_app_number_seq START 1
                """))
                
                result = conn.execute(text("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'staff' AND column_name = 'employee_number'
                """))
                if result.fetchone():
                    conn.execute(text("""
                        ALTER TABLE staff RENAME COLUMN employee_number TO staff_number
                    """))
                
                result = conn.execute(text("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'staff' AND column_name = 'password_hash'
                """))
                if not result.fetchone():
                    conn.execute(text("""
                        ALTER TABLE staff ADD COLUMN password_hash VARCHAR(255)
                    """))
                
                result = conn.execute(text("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'branches' AND column_name = 'location'
                """))
                if result.fetchone():
                    conn.execute(text("""
                        ALTER TABLE branches RENAME COLUMN location TO address
                    """))
                
                # Add recurring expense columns if they don't exist
                result = conn.execute(text("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'expenses' AND column_name = 'is_recurring'
                """))
                if not result.fetchone():
                    conn.execute(text("""
                        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE
                    """))
                    conn.execute(text("""
                        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recurrence_interval VARCHAR(50)
                    """))
                    conn.execute(text("""
                        ALTER TABLE expenses ADD COLUMN IF NOT EXISTS next_due_date DATE
                    """))
                
                conn.commit()
            
            with engine.connect() as conn:
                result = conn.execute(text("SELECT COUNT(*) FROM branches"))
                branch_count = result.scalar()
                if branch_count == 0:
                    import uuid
                    branch_id = str(uuid.uuid4())
                    conn.execute(text("""
                        INSERT INTO branches (id, name, code, is_active, created_at)
                        VALUES (:id, :name, :code, TRUE, NOW())
                    """), {"id": branch_id, "name": "Main Branch", "code": "BR0001"})
                    conn.commit()
            
            engine.dispose()
        except Exception as e:
            print(f"Error running tenant migrations: {e}")
            raise
    
    async def delete_tenant_database(self, project_id: str) -> bool:
        if not self.api_key or not project_id:
            return False
        
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{NEON_API_BASE}/projects/{project_id}",
                headers=self.headers,
                timeout=30.0
            )
            return response.status_code == 200

neon_tenant_service = NeonTenantService()
