import json
import re
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from sqlalchemy.orm import Session
from models.database import get_db, SessionLocal
from models.master import Organization, Session as UserSession
from models.tenant import AuditLog, Staff
from services.tenant_context import TenantContext

class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware to automatically log all mutating API operations"""
    
    # Methods that modify data
    AUDIT_METHODS = ["POST", "PUT", "PATCH", "DELETE"]
    
    # Paths to skip auditing
    SKIP_PATHS = [
        "/api/auth/login",
        "/api/auth/register", 
        "/api/auth/logout",
        "/api/auth/user",
        "/api/health",
        "/api/mpesa/c2b",  # M-Pesa callbacks handled separately
    ]
    
    async def dispatch(self, request: Request, call_next):
        # Only audit mutating methods
        if request.method not in self.AUDIT_METHODS:
            return await call_next(request)
        
        # Skip certain paths
        path = request.url.path
        for skip_path in self.SKIP_PATHS:
            if path.startswith(skip_path):
                return await call_next(request)
        
        # Only audit organization-scoped endpoints
        if not path.startswith("/api/organizations/"):
            return await call_next(request)
        
        # Get request body before processing
        body = None
        try:
            body_bytes = await request.body()
            if body_bytes:
                body = json.loads(body_bytes.decode())
        except:
            pass
        
        # Process the request
        response = await call_next(request)
        
        # Only log successful operations
        if response.status_code >= 400:
            return response
        
        # Extract org_id from path
        org_id = self._extract_org_id(path)
        if not org_id:
            return response
        
        # Get user from session cookie
        user_email = None
        session_token = request.cookies.get("session")
        if session_token:
            db = SessionLocal()
            try:
                user_session = db.query(UserSession).filter(
                    UserSession.token == session_token
                ).first()
                if user_session and user_session.user:
                    user_email = user_session.user.email
            finally:
                db.close()
        
        # Create audit log in tenant database
        try:
            await self._create_audit_log(
                org_id=org_id,
                user_email=user_email,
                method=request.method,
                path=path,
                body=body,
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent")
            )
        except Exception as e:
            print(f"Audit log error: {e}")
        
        return response
    
    def _extract_org_id(self, path: str) -> str | None:
        """Extract organization ID from path like /api/organizations/{org_id}/..."""
        match = re.match(r"/api/organizations/([a-f0-9-]+)/", path)
        if match:
            return match.group(1)
        return None
    
    def _extract_entity_info(self, path: str, method: str) -> tuple[str, str | None]:
        """Extract entity type and ID from path"""
        # Pattern: /api/organizations/{org_id}/{entity_type}/{entity_id}
        parts = path.split("/")
        # ['', 'api', 'organizations', 'org_id', 'entity_type', 'entity_id', ...]
        
        entity_type = None
        entity_id = None
        
        if len(parts) >= 5:
            entity_type = parts[4]  # e.g., 'members', 'loans', 'transactions'
        
        if len(parts) >= 6 and parts[5]:
            # Check if it's a UUID or action (like 'activate', 'suspend')
            if self._is_uuid(parts[5]):
                entity_id = parts[5]
            elif len(parts) >= 7:
                entity_id = parts[5]  # ID before action
        
        return entity_type or "unknown", entity_id
    
    def _is_uuid(self, value: str) -> bool:
        """Check if value looks like a UUID"""
        uuid_pattern = r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        return bool(re.match(uuid_pattern, value, re.IGNORECASE))
    
    def _get_action(self, method: str, path: str) -> str:
        """Determine action from method and path"""
        parts = path.rstrip("/").split("/")
        last_part = parts[-1] if parts else ""
        
        # Check for specific actions in path
        if last_part in ["activate", "suspend", "approve", "reject", "disburse", "lock", "unlock"]:
            return last_part
        
        # Default actions based on method
        action_map = {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete"
        }
        return action_map.get(method, "unknown")
    
    async def _create_audit_log(
        self,
        org_id: str,
        user_email: str | None,
        method: str,
        path: str,
        body: dict | None,
        ip_address: str | None,
        user_agent: str | None
    ):
        """Create audit log entry in tenant database"""
        db = SessionLocal()
        try:
            org = db.query(Organization).filter(Organization.id == org_id).first()
            if not org or not org.connection_string:
                return
            
            tenant_ctx = TenantContext(org.connection_string)
            tenant_session = tenant_ctx.create_session()
            
            try:
                # Get staff ID from email
                staff_id = None
                if user_email:
                    staff = tenant_session.query(Staff).filter(Staff.email == user_email).first()
                    if staff:
                        staff_id = staff.id
                
                entity_type, entity_id = self._extract_entity_info(path, method)
                action = self._get_action(method, path)
                
                # Sanitize body - remove sensitive fields
                sanitized_body = None
                if body:
                    sanitized_body = {k: v for k, v in body.items() 
                                     if k not in ["password", "token", "secret", "api_key"]}
                
                audit_log = AuditLog(
                    staff_id=staff_id,
                    action=f"{action}_{entity_type}",
                    entity_type=entity_type,
                    entity_id=entity_id,
                    new_values=sanitized_body,
                    ip_address=ip_address,
                    user_agent=user_agent[:500] if user_agent else None
                )
                tenant_session.add(audit_log)
                tenant_session.commit()
            finally:
                tenant_session.close()
                tenant_ctx.close()
        finally:
            db.close()
