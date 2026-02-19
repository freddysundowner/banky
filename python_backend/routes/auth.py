import os
from datetime import datetime, time, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from models.database import get_db
from schemas.auth import UserRegister, UserLogin, UserResponse
from services.auth import (
    get_user_by_email, create_user, verify_password, 
    create_session, get_user_by_session, delete_session
)

router = APIRouter()

def check_working_hours(organization, role: str) -> dict:
    """Check if current time is within organization's working hours.
    Returns dict with 'allowed' bool and 'message' string."""
    if role in ["owner", "admin"]:
        return {"allowed": True, "message": "", "debug": f"Admin/owner exempt, role={role}"}
    
    if not organization or not organization.enforce_working_hours:
        return {"allowed": True, "message": "", "debug": f"Working hours not enforced, enforce={getattr(organization, 'enforce_working_hours', None)}"}
    
    now = datetime.now()
    current_time = now.time()
    current_day = now.strftime("%A").lower()
    
    working_days = organization.working_days or ["monday", "tuesday", "wednesday", "thursday", "friday"]
    if current_day not in working_days:
        return {
            "allowed": False,
            "message": f"Access is restricted. The system is only available on {', '.join(d.capitalize() for d in working_days)}.",
            "debug": f"Day {current_day} not in working_days {working_days}"
        }
    
    start_time = organization.working_hours_start or time(8, 0)
    end_time = organization.working_hours_end or time(17, 0)
    
    if not (start_time <= current_time <= end_time):
        start_str = start_time.strftime("%I:%M %p")
        end_str = end_time.strftime("%I:%M %p")
        return {
            "allowed": False,
            "message": f"Access is restricted outside working hours ({start_str} - {end_str}).",
            "debug": f"Time {current_time} not in {start_time}-{end_time}"
        }
    
    return {"allowed": True, "message": "", "debug": f"Within working hours: {current_time} in {start_time}-{end_time}"}

SESSION_COOKIE_NAME = "session_token"
# Always use secure=False in development to ensure cookies work
IS_PRODUCTION = False

class AuthContext:
    """Unified auth context for both master users and tenant staff"""
    def __init__(self, user=None, staff=None, organization_id=None, is_staff=False, branch_id=None, branch_name=None, branch_code=None):
        self.user = user
        self.staff = staff
        self.organization_id = organization_id
        self.is_staff = is_staff
        self.branch_id = branch_id
        self.branch_name = branch_name
        self.branch_code = branch_code
    
    @property
    def id(self):
        return self.staff.id if self.is_staff else self.user.id
    
    @property
    def email(self):
        return self.staff.email if self.is_staff else self.user.email
    
    @property
    def name(self):
        if self.is_staff:
            return f"{self.staff.first_name} {self.staff.last_name}"
        return self.user.name

def get_current_user(request: Request, db: Session = Depends(get_db)):
    from services.tenant_context import get_tenant_context_simple
    
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    parts = cookie.split(":", 2)
    
    if parts[0] == "master" and len(parts) >= 2:
        # Master user session
        token = parts[1]
        user = get_user_by_session(db, token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return AuthContext(user=user, is_staff=False)
    
    elif parts[0] == "tenant" and len(parts) >= 3:
        # Tenant staff session
        org_id = parts[1]
        token = parts[2]
        
        tenant_ctx = get_tenant_context_simple(org_id, db)
        if not tenant_ctx:
            raise HTTPException(status_code=401, detail="Organization not found")
        
        tenant_session = tenant_ctx.create_session()
        try:
            from models.tenant import Branch
            staff = get_staff_by_session(tenant_session, token)
            if not staff:
                raise HTTPException(status_code=401, detail="Invalid or expired session")
            
            # Get branch info
            branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first() if staff.branch_id else None
            
            # Store tenant_session in request state for later use
            request.state.tenant_session = tenant_session
            request.state.tenant_ctx = tenant_ctx
            
            return AuthContext(
                staff=staff, 
                organization_id=org_id, 
                is_staff=True,
                branch_id=staff.branch_id,
                branch_name=branch.name if branch else None,
                branch_code=branch.code if branch else None
            )
        except HTTPException:
            tenant_session.close()
            tenant_ctx.close()
            raise
    
    # Legacy token format (for backward compatibility)
    user = get_user_by_session(db, cookie)
    if user:
        return AuthContext(user=user, is_staff=False)
    
    raise HTTPException(status_code=401, detail="Invalid session format")

def get_optional_user(request: Request, db: Session = Depends(get_db)):
    from services.tenant_context import get_tenant_context_simple
    
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie:
        return None
    
    parts = cookie.split(":", 2)
    
    if parts[0] == "master" and len(parts) >= 2:
        token = parts[1]
        user = get_user_by_session(db, token)
        if user:
            return AuthContext(user=user, is_staff=False)
        return None
    
    elif parts[0] == "tenant" and len(parts) >= 3:
        org_id = parts[1]
        token = parts[2]
        
        tenant_ctx = get_tenant_context_simple(org_id, db)
        if not tenant_ctx:
            return None
        
        tenant_session = tenant_ctx.create_session()
        try:
            from models.tenant import Branch
            staff = get_staff_by_session(tenant_session, token)
            if staff:
                branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first() if staff.branch_id else None
                request.state.tenant_session = tenant_session
                request.state.tenant_ctx = tenant_ctx
                return AuthContext(
                    staff=staff, 
                    organization_id=org_id, 
                    is_staff=True,
                    branch_id=staff.branch_id,
                    branch_name=branch.name if branch else None,
                    branch_code=branch.code if branch else None
                )
        except:
            pass
        finally:
            if not hasattr(request.state, 'tenant_session'):
                tenant_session.close()
                tenant_ctx.close()
        return None
    
    # Legacy token format
    user = get_user_by_session(db, cookie)
    if user:
        return AuthContext(user=user, is_staff=False)
    return None

@router.post("/register", response_model=UserResponse)
async def register(data: UserRegister, request: Request, response: Response, db: Session = Depends(get_db)):
    from middleware.rate_limit import check_register_rate_limit
    check_register_rate_limit(request)
    from models.master import Organization, OrganizationMember, OrganizationSubscription, SubscriptionPlan
    
    existing = get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = create_user(
        db,
        email=data.email,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone
    )
    
    if data.organization_name:
        import re
        org_name = data.organization_name.strip()
        code = re.sub(r'[^A-Z0-9]', '', org_name.upper())[:20] or 'ORG'
        
        existing_code = db.query(Organization).filter(Organization.code == code).first()
        if existing_code:
            import secrets
            code = f"{code[:15]}_{secrets.token_hex(2).upper()}"
        
        org = Organization(
            name=org_name,
            code=code,
            email=data.email,
            staff_email_domain=data.staff_email_domain.lstrip('@') if data.staff_email_domain else None,
            is_active=True
        )
        db.add(org)
        db.flush()
        
        membership = OrganizationMember(
            organization_id=org.id,
            user_id=user.id,
            is_owner=True,
            role="owner"
        )
        db.add(membership)
        
        from routes.admin import get_default_plan_id, get_trial_days
        default_plan_id = get_default_plan_id(db)
        trial_days = get_trial_days(db)
        
        if default_plan_id:
            from datetime import timedelta
            subscription = OrganizationSubscription(
                organization_id=org.id,
                plan_id=default_plan_id,
                status="trial",
                trial_ends_at=datetime.utcnow() + timedelta(days=trial_days)
            )
            db.add(subscription)
        
        db.commit()
    
    token = create_session(db, user.id)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=f"master:{token}",
        httponly=True,
        secure=IS_PRODUCTION,
        samesite="lax",
        max_age=7 * 24 * 60 * 60
    )
    
    import asyncio
    asyncio.create_task(_send_welcome_email(user.first_name, user.email, data.organization_name))
    
    import secrets as secrets_mod
    from models.master import EmailVerificationToken
    verify_token = secrets_mod.token_urlsafe(32)
    verification_token = EmailVerificationToken(
        user_id=user.id,
        token=verify_token,
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(verification_token)
    db.commit()
    
    origin = request.headers.get("origin", "")
    dev_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
    if dev_domain:
        reg_app_url = f"https://{dev_domain}"
    elif origin:
        reg_app_url = origin
    else:
        reg_app_url = ""
    asyncio.create_task(_send_verification_email(user.first_name or "User", user.email, verify_token, reg_app_url))
    
    return user


async def _send_welcome_email(first_name: str, email: str, org_name: str = None):
    """Send welcome email to newly registered user (fire-and-forget)"""
    try:
        import httpx
        from models.database import SessionLocal
        from models.master import PlatformSettings
        
        db = SessionLocal()
        try:
            brevo_key_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "brevo_api_key"
            ).first()
            from_email_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "platform_email"
            ).first()
            platform_name_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "platform_name"
            ).first()
        finally:
            db.close()
        
        api_key = brevo_key_setting.value if brevo_key_setting else None
        from_email = from_email_setting.value if from_email_setting else None
        platform_name = platform_name_setting.value if platform_name_setting else "BANKY"
        
        if not api_key or not from_email:
            return
        
        org_line = f"<p>Your organization <strong>{org_name}</strong> has been set up with a free trial.</p>" if org_name else ""
        
        html = f"""
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #4338ca); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">Welcome to {platform_name}</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi <strong>{first_name}</strong>,</p>
            <p>Thank you for signing up! We're excited to have you on board.</p>
            {org_line}
            <p>Here's what you can do next:</p>
            <ul style="line-height: 2;">
                <li>Set up your branches and staff accounts</li>
                <li>Configure your loan products</li>
                <li>Start registering members</li>
                <li>Explore the dashboard and analytics</li>
            </ul>
            <p>If you need any help getting started, check out our documentation or reach out to our support team.</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
                - The {platform_name} Team
            </p>
        </div>
        </body></html>
        """
        
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={"api-key": api_key, "Content-Type": "application/json"},
                json={
                    "sender": {"name": platform_name, "email": from_email},
                    "to": [{"email": email, "name": first_name}],
                    "subject": f"Welcome to {platform_name}!",
                    "htmlContent": html
                },
                timeout=15.0
            )
    except Exception:
        pass


def create_staff_session(tenant_session, staff_id: str) -> str:
    """Create a session in the tenant database for staff"""
    import secrets
    from datetime import timedelta
    from models.tenant import StaffSession
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=7)
    
    session = StaffSession(
        staff_id=staff_id,
        token=token,
        expires_at=expires_at
    )
    tenant_session.add(session)
    tenant_session.commit()
    return token

def get_staff_by_session(tenant_session, token: str):
    """Get staff from tenant session token"""
    from models.tenant import StaffSession, Staff
    
    session = tenant_session.query(StaffSession).filter(
        StaffSession.token == token,
        StaffSession.expires_at > datetime.utcnow()
    ).first()
    
    if not session:
        return None
    
    return tenant_session.query(Staff).filter(Staff.id == session.staff_id).first()

@router.post("/login")
async def login(data: UserLogin, request: Request, response: Response, db: Session = Depends(get_db)):
    from middleware.rate_limit import check_login_rate_limit
    check_login_rate_limit(request)
    from services.tenant_context import get_tenant_context_simple
    from models.tenant import Staff
    from models.master import Organization
    from routes.audit import create_audit_log
    
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    
    # First try master User table (for owners/admins)
    user = get_user_by_email(db, data.email)
    if user and verify_password(data.password, user.password):
        token = create_session(db, user.id)
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=f"master:{token}",
            httponly=True,
            secure=IS_PRODUCTION,
            samesite="lax",
            max_age=7 * 24 * 60 * 60
        )
        return UserResponse.model_validate(user)
    
    # If not found in master, search across tenant databases for staff
    organizations = db.query(Organization).filter(Organization.connection_string.isnot(None)).all()
    
    for org in organizations:
        tenant_ctx = get_tenant_context_simple(org.id, db)
        if not tenant_ctx:
            continue
        
        tenant_session = tenant_ctx.create_session()
        try:
            staff = tenant_session.query(Staff).filter(Staff.email == data.email).first()
            if not staff:
                continue
            
            # Check if locked
            if staff.is_locked:
                raise HTTPException(status_code=403, detail="Account is locked. Contact administrator.")
            
            # Check if active
            if not staff.is_active:
                raise HTTPException(status_code=403, detail="Account is deactivated. Contact administrator.")
            
            # Verify password against tenant Staff table
            if not staff.password_hash or not verify_password(data.password, staff.password_hash):
                continue
            
            # Check working hours
            working_hours_check = check_working_hours(org, staff.role)
            if not working_hours_check["allowed"]:
                raise HTTPException(status_code=403, detail=working_hours_check["message"])
            
            # Update last login
            staff.last_login = datetime.now()
            
            # Create session in tenant database (no master database involvement)
            token = create_staff_session(tenant_session, staff.id)
            
            response.set_cookie(
                key=SESSION_COOKIE_NAME,
                value=f"tenant:{org.id}:{token}",
                httponly=True,
                secure=IS_PRODUCTION,
                samesite="lax",
                max_age=7 * 24 * 60 * 60
            )
            
            # Get branch info
            from models.tenant import Branch
            branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first() if staff.branch_id else None
            
            # Create audit log for login
            create_audit_log(
                tenant_session,
                staff_id=staff.id,
                action="LOGIN",
                entity_type="staff",
                entity_id=staff.id,
                new_values={
                    "email": staff.email,
                    "name": f"{staff.first_name} {staff.last_name}",
                    "branch": branch.name if branch else None
                },
                ip_address=client_ip,
                user_agent=user_agent
            )
            
            # Return staff info as user response
            return {
                "id": staff.id,
                "email": staff.email,
                "name": f"{staff.first_name} {staff.last_name}",
                "first_name": staff.first_name,
                "last_name": staff.last_name,
                "role": staff.role,
                "isStaff": True,
                "organizationId": org.id,
                "branchId": staff.branch_id,
                "branchName": branch.name if branch else None,
                "branchCode": branch.code if branch else None
            }
        finally:
            tenant_session.close()
            tenant_ctx.close()
    
    raise HTTPException(status_code=401, detail="Invalid email or password")

class StaffLogin(BaseModel):
    organization_id: str
    email: str
    password: str

@router.post("/staff-login")
async def staff_login(data: StaffLogin, response: Response, db: Session = Depends(get_db)):
    """Login as staff using tenant database credentials"""
    from services.tenant_context import get_tenant_context_simple
    from models.tenant import Staff
    from models.master import Organization
    
    # Get organization to check it exists
    org = db.query(Organization).filter(Organization.id == data.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Get tenant context (no membership check needed for login)
    tenant_ctx = get_tenant_context_simple(data.organization_id, db)
    if not tenant_ctx:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    tenant_session = tenant_ctx.create_session()
    try:
        # Find staff by email in tenant database
        staff = tenant_session.query(Staff).filter(Staff.email == data.email).first()
        if not staff:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Check if locked
        if staff.is_locked:
            raise HTTPException(status_code=403, detail="Account is locked. Contact administrator.")
        
        # Check if active
        if not staff.is_active:
            raise HTTPException(status_code=403, detail="Account is deactivated. Contact administrator.")
        
        # Verify password
        if not staff.password_hash or not verify_password(data.password, staff.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Check working hours
        working_hours_check = check_working_hours(org, staff.role)
        if not working_hours_check["allowed"]:
            raise HTTPException(status_code=403, detail=working_hours_check["message"])
        
        # Update last login
        staff.last_login = datetime.now()
        tenant_session.commit()
        
        token = create_staff_session(tenant_session, staff.id)
        
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=f"tenant:{org.id}:{token}",
            httponly=True,
            secure=IS_PRODUCTION,
            samesite="lax",
            max_age=7 * 24 * 60 * 60
        )
        
        from models.tenant import Branch
        branch = tenant_session.query(Branch).filter(Branch.id == staff.branch_id).first() if staff.branch_id else None
        
        return {
            "id": staff.id,
            "email": staff.email,
            "name": f"{staff.first_name} {staff.last_name}",
            "first_name": staff.first_name,
            "last_name": staff.last_name,
            "staff_id": staff.id,
            "role": staff.role,
            "isStaff": True,
            "organizationId": data.organization_id,
            "branchId": staff.branch_id,
            "branchName": branch.name if branch else None,
            "branchCode": branch.code if branch else None
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/logout")
async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    from services.tenant_context import get_tenant_context_simple
    from models.tenant import StaffSession, Staff
    from routes.audit import create_audit_log
    
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")
    
    cookie = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie:
        parts = cookie.split(":", 2)
        
        if parts[0] == "master" and len(parts) >= 2:
            delete_session(db, parts[1])
        elif parts[0] == "tenant" and len(parts) >= 3:
            org_id = parts[1]
            token = parts[2]
            tenant_ctx = get_tenant_context_simple(org_id, db)
            if tenant_ctx:
                tenant_session = tenant_ctx.create_session()
                try:
                    # Get staff info before deleting session
                    session = tenant_session.query(StaffSession).filter(StaffSession.token == token).first()
                    if session:
                        staff = tenant_session.query(Staff).filter(Staff.id == session.staff_id).first()
                        
                        # Create audit log for logout
                        if staff:
                            create_audit_log(
                                tenant_session,
                                staff_id=staff.id,
                                action="LOGOUT",
                                entity_type="staff",
                                entity_id=staff.id,
                                new_values={
                                    "email": staff.email,
                                    "name": f"{staff.first_name} {staff.last_name}"
                                },
                                ip_address=client_ip,
                                user_agent=user_agent
                            )
                        
                        tenant_session.delete(session)
                        tenant_session.commit()
                finally:
                    tenant_session.close()
                    tenant_ctx.close()
        else:
            # Legacy token
            delete_session(db, cookie)
    
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"message": "Logged out successfully"}

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: str

@router.post("/forgot-password")
async def forgot_password(data: ForgotPasswordRequest, request: Request, db: Session = Depends(get_db)):
    from middleware.rate_limit import check_forgot_password_rate_limit
    check_forgot_password_rate_limit(request)
    import secrets
    from models.master import User, PasswordResetToken, PlatformSettings
    
    user = db.query(User).filter(User.email == data.email).first()
    
    if user:
        token = secrets.token_urlsafe(32)
        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        db.add(reset_token)
        db.commit()
        
        origin = request.headers.get("origin", "")
        dev_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
        if dev_domain:
            app_url = f"https://{dev_domain}"
        elif origin:
            app_url = origin
        else:
            app_url = ""
        
        import asyncio
        asyncio.create_task(_send_password_reset_email(user.first_name or "User", user.email, token, app_url))
    
    return {"message": "If an account exists with that email, we've sent a password reset link."}

@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    from models.master import PasswordResetToken, User
    from services.auth import hash_password
    
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == data.token,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    user = db.query(User).filter(User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.password = hash_password(data.password)
    db.delete(reset_token)
    db.commit()
    
    return {"message": "Password has been reset successfully"}

@router.get("/verify-reset-token/{token}")
async def verify_reset_token(token: str, db: Session = Depends(get_db)):
    from models.master import PasswordResetToken
    
    reset_token = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    
    return {"valid": True}

async def _send_password_reset_email(first_name: str, email: str, token: str, app_url: str):
    try:
        import httpx
        from models.database import SessionLocal
        from models.master import PlatformSettings
        
        db = SessionLocal()
        try:
            brevo_key_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "brevo_api_key"
            ).first()
            from_email_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "platform_email"
            ).first()
            platform_name_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "platform_name"
            ).first()
        finally:
            db.close()
        
        api_key = brevo_key_setting.value if brevo_key_setting else None
        from_email = from_email_setting.value if from_email_setting else None
        platform_name = platform_name_setting.value if platform_name_setting else "BANKY"
        
        if not api_key or not from_email:
            return
        
        reset_link = f"{app_url}/reset-password?token={token}"
        
        html = f"""
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #4338ca); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">{platform_name}</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi <strong>{first_name}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_link}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #6b7280; font-size: 13px;">This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.</p>
            <p style="color: #6b7280; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #6b7280; font-size: 12px; word-break: break-all;">{reset_link}</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
                - The {platform_name} Team
            </p>
        </div>
        </body></html>
        """
        
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={"api-key": api_key, "Content-Type": "application/json"},
                json={
                    "sender": {"name": platform_name, "email": from_email},
                    "to": [{"email": email, "name": first_name}],
                    "subject": f"Reset your {platform_name} password",
                    "htmlContent": html
                },
                timeout=15.0
            )
    except Exception:
        pass

async def _send_verification_email(first_name: str, email: str, token: str, app_url: str):
    try:
        import httpx
        from models.database import SessionLocal
        from models.master import PlatformSettings
        
        db = SessionLocal()
        try:
            brevo_key_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "brevo_api_key"
            ).first()
            from_email_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "platform_email"
            ).first()
            platform_name_setting = db.query(PlatformSettings).filter(
                PlatformSettings.key == "platform_name"
            ).first()
        finally:
            db.close()
        
        api_key = brevo_key_setting.value if brevo_key_setting else None
        from_email = from_email_setting.value if from_email_setting else None
        platform_name = platform_name_setting.value if platform_name_setting else "BANKY"
        
        if not api_key or not from_email:
            return
        
        verify_link = f"{app_url}/verify-email?token={token}"
        
        html = f"""
        <html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #4338ca); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">{platform_name}</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi <strong>{first_name}</strong>,</p>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{verify_link}" style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email</a>
            </div>
            <p style="color: #6b7280; font-size: 13px;">This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
            <p style="color: #6b7280; font-size: 13px;">If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="color: #6b7280; font-size: 12px; word-break: break-all;">{verify_link}</p>
            <p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
                - The {platform_name} Team
            </p>
        </div>
        </body></html>
        """
        
        async with httpx.AsyncClient() as client:
            await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={"api-key": api_key, "Content-Type": "application/json"},
                json={
                    "sender": {"name": platform_name, "email": from_email},
                    "to": [{"email": email, "name": first_name}],
                    "subject": f"Verify your {platform_name} email address",
                    "htmlContent": html
                },
                timeout=15.0
            )
    except Exception:
        pass

@router.post("/send-verification-email")
async def send_verification_email(request: Request, auth: AuthContext = Depends(get_current_user), db: Session = Depends(get_db)):
    import secrets
    from models.master import EmailVerificationToken, User
    
    if auth.is_staff:
        raise HTTPException(status_code=400, detail="Email verification is only available for account owners")
    
    user = auth.user
    
    if user.is_email_verified:
        return {"message": "Email is already verified"}
    
    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete()
    
    token = secrets.token_urlsafe(32)
    verification_token = EmailVerificationToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.utcnow() + timedelta(hours=24)
    )
    db.add(verification_token)
    db.commit()
    
    origin = request.headers.get("origin", "")
    dev_domain = os.environ.get("REPLIT_DEV_DOMAIN", "")
    if dev_domain:
        app_url = f"https://{dev_domain}"
    elif origin:
        app_url = origin
    else:
        app_url = ""
    
    import asyncio
    asyncio.create_task(_send_verification_email(user.first_name or "User", user.email, token, app_url))
    
    return {"message": "Verification email sent successfully"}

@router.get("/verify-email/{token}")
async def verify_email(token: str, db: Session = Depends(get_db)):
    from models.master import EmailVerificationToken, User
    
    verification_token = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token,
        EmailVerificationToken.expires_at > datetime.utcnow()
    ).first()
    
    if not verification_token:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    user = db.query(User).filter(User.id == verification_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    
    user.is_email_verified = True
    db.delete(verification_token)
    db.commit()
    
    return {"message": "Email verified successfully", "verified": True}

@router.post("/skip-email-verification")
async def skip_email_verification(auth: AuthContext = Depends(get_current_user)):
    return {"message": "Email verification skipped"}

@router.get("/me")
async def get_me(auth: AuthContext = Depends(get_current_user)):
    if auth.is_staff:
        return {
            "id": auth.staff.id,
            "email": auth.staff.email,
            "name": f"{auth.staff.first_name} {auth.staff.last_name}",
            "first_name": auth.staff.first_name,
            "last_name": auth.staff.last_name,
            "role": auth.staff.role,
            "isStaff": True,
            "organizationId": auth.organization_id,
            "branchId": auth.branch_id,
            "branchName": auth.branch_name,
            "branchCode": auth.branch_code
        }
    return UserResponse.model_validate(auth.user)

@router.get("/user")
async def get_user_optional(auth = Depends(get_optional_user)):
    if not auth:
        return None
    
    if auth.is_staff:
        return {
            "id": auth.staff.id,
            "email": auth.staff.email,
            "name": f"{auth.staff.first_name} {auth.staff.last_name}",
            "first_name": auth.staff.first_name,
            "last_name": auth.staff.last_name,
            "role": auth.staff.role,
            "isStaff": True,
            "organizationId": auth.organization_id,
            "branchId": auth.branch_id,
            "branchName": auth.branch_name,
            "branchCode": auth.branch_code
        }
    return UserResponse.model_validate(auth.user)

@router.get("/permissions/{org_id}")
async def get_user_permissions(org_id: str, auth = Depends(get_current_user), db: Session = Depends(get_db)):
    from models.master import OrganizationMember, Organization
    from models.tenant import Role, RolePermission
    from services.tenant_context import get_tenant_context, get_tenant_context_simple
    from routes.roles import seed_default_roles
    
    organization = db.query(Organization).filter(Organization.id == org_id).first()
    
    # Handle staff users - they have roles directly in tenant database
    if hasattr(auth, 'is_staff') and auth.is_staff:
        if auth.organization_id != org_id:
            return {"role": None, "permissions": [], "working_hours_allowed": True, "working_hours_message": ""}
        
        role_name = auth.staff.role
        working_hours_check = check_working_hours(organization, role_name) if organization else {"allowed": True, "message": ""}
        
        tenant_ctx = get_tenant_context_simple(org_id, db)
        if not tenant_ctx:
            return {"role": role_name, "permissions": [], "working_hours_allowed": working_hours_check["allowed"], "working_hours_message": working_hours_check["message"]}
        
        tenant_session = tenant_ctx.create_session()
        try:
            seed_default_roles(tenant_session)
            
            role = tenant_session.query(Role).filter(Role.name == role_name, Role.is_active == True).first()
            if not role:
                return {"role": role_name, "permissions": [], "working_hours_allowed": working_hours_check["allowed"], "working_hours_message": working_hours_check["message"]}
            
            permissions = [p.permission for p in role.permissions]
            return {
                "role": role_name, 
                "permissions": permissions,
                "working_hours_allowed": working_hours_check["allowed"],
                "working_hours_message": working_hours_check["message"]
            }
        finally:
            tenant_session.close()
            tenant_ctx.close()
    
    # Handle master users
    user = auth.user if hasattr(auth, 'user') else auth
    
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id
    ).first()
    
    if not membership:
        return {"role": None, "permissions": [], "working_hours_allowed": True, "working_hours_message": ""}
    
    role_name = membership.role
    working_hours_check = check_working_hours(organization, role_name) if organization else {"allowed": True, "message": ""}
    
    if role_name in ("owner", "admin"):
        return {
            "role": role_name, 
            "permissions": ["*"],
            "working_hours_allowed": True,
            "working_hours_message": ""
        }
    
    tenant_ctx, _ = get_tenant_context(org_id, user.id, db)
    if not tenant_ctx:
        return {
            "role": role_name, 
            "permissions": [],
            "working_hours_allowed": working_hours_check["allowed"],
            "working_hours_message": working_hours_check["message"]
        }
    
    tenant_session = tenant_ctx.create_session()
    try:
        seed_default_roles(tenant_session)
        
        role = tenant_session.query(Role).filter(Role.name == role_name, Role.is_active == True).first()
        if not role:
            return {
                "role": role_name, 
                "permissions": [],
                "working_hours_allowed": working_hours_check["allowed"],
                "working_hours_message": working_hours_check["message"]
            }
        
        permissions = [p.permission for p in role.permissions]
        return {
            "role": role_name, 
            "permissions": permissions,
            "working_hours_allowed": working_hours_check["allowed"],
            "working_hours_message": working_hours_check["message"],
            "working_hours_debug": working_hours_check.get("debug", "")
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.get("/session/{org_id}")
async def get_session_bundle(org_id: str, auth = Depends(get_current_user), db: Session = Depends(get_db)):
    from models.master import OrganizationMember, Organization
    from models.tenant import Role, RolePermission
    from services.tenant_context import get_tenant_context, get_tenant_context_simple
    from routes.roles import seed_default_roles
    from services.feature_flags import get_deployment_mode, get_license_key, get_feature_access_for_saas, get_feature_access_for_enterprise
    from routes.features import get_subscription_status_info, OrganizationSubscription

    if auth.is_staff:
        if auth.organization_id != org_id:
            raise HTTPException(status_code=403, detail="Not authorized for this organization")
        user_data = {
            "id": auth.staff.id,
            "email": auth.staff.email,
            "name": f"{auth.staff.first_name} {auth.staff.last_name}",
            "first_name": auth.staff.first_name,
            "last_name": auth.staff.last_name,
            "role": auth.staff.role,
            "isStaff": True,
            "organizationId": auth.organization_id,
            "branchId": auth.branch_id,
            "branchName": auth.branch_name,
            "branchCode": auth.branch_code
        }
    else:
        user = auth.user if hasattr(auth, 'user') else auth
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == org_id,
            OrganizationMember.user_id == user.id
        ).first()
        if not membership:
            raise HTTPException(status_code=403, detail="Not a member of this organization")
        user_data = UserResponse.model_validate(user).model_dump()

    organization = db.query(Organization).filter(Organization.id == org_id).first()

    permissions_data = _get_permissions_for_user(auth, org_id, organization, db)

    features_data = _get_features_for_org(org_id, db)

    return {
        "user": user_data,
        "permissions": permissions_data,
        "features": features_data,
    }


def _get_permissions_for_user(auth, org_id: str, organization, db: Session) -> dict:
    from models.master import OrganizationMember
    from models.tenant import Role, RolePermission
    from services.tenant_context import get_tenant_context, get_tenant_context_simple
    from routes.roles import seed_default_roles

    if hasattr(auth, 'is_staff') and auth.is_staff:
        if auth.organization_id != org_id:
            return {"role": None, "permissions": [], "working_hours_allowed": True, "working_hours_message": ""}

        role_name = auth.staff.role
        working_hours_check = check_working_hours(organization, role_name) if organization else {"allowed": True, "message": ""}

        tenant_ctx = get_tenant_context_simple(org_id, db)
        if not tenant_ctx:
            return {"role": role_name, "permissions": [], "working_hours_allowed": working_hours_check["allowed"], "working_hours_message": working_hours_check["message"]}

        tenant_session = tenant_ctx.create_session()
        try:
            seed_default_roles(tenant_session)
            role = tenant_session.query(Role).filter(Role.name == role_name, Role.is_active == True).first()
            if not role:
                return {"role": role_name, "permissions": [], "working_hours_allowed": working_hours_check["allowed"], "working_hours_message": working_hours_check["message"]}
            permissions = [p.permission for p in role.permissions]
            return {
                "role": role_name,
                "permissions": permissions,
                "working_hours_allowed": working_hours_check["allowed"],
                "working_hours_message": working_hours_check["message"]
            }
        finally:
            tenant_session.close()
            tenant_ctx.close()

    user = auth.user if hasattr(auth, 'user') else auth
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id
    ).first()

    if not membership:
        return {"role": None, "permissions": [], "working_hours_allowed": True, "working_hours_message": ""}

    role_name = membership.role
    working_hours_check = check_working_hours(organization, role_name) if organization else {"allowed": True, "message": ""}

    if role_name in ("owner", "admin"):
        return {"role": role_name, "permissions": ["*"], "working_hours_allowed": True, "working_hours_message": ""}

    tenant_ctx, _ = get_tenant_context(org_id, user.id, db)
    if not tenant_ctx:
        return {"role": role_name, "permissions": [], "working_hours_allowed": working_hours_check["allowed"], "working_hours_message": working_hours_check["message"]}

    tenant_session = tenant_ctx.create_session()
    try:
        seed_default_roles(tenant_session)
        role = tenant_session.query(Role).filter(Role.name == role_name, Role.is_active == True).first()
        if not role:
            return {"role": role_name, "permissions": [], "working_hours_allowed": working_hours_check["allowed"], "working_hours_message": working_hours_check["message"]}
        permissions = [p.permission for p in role.permissions]
        return {
            "role": role_name,
            "permissions": permissions,
            "working_hours_allowed": working_hours_check["allowed"],
            "working_hours_message": working_hours_check["message"]
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


def _get_features_for_org(org_id: str, db: Session) -> dict:
    from services.feature_flags import get_deployment_mode, get_license_key, get_feature_access_for_enterprise, get_org_features, PLAN_LIMITS
    from routes.features import get_subscription_status_info, OrganizationSubscription

    mode = get_deployment_mode()

    if mode == "enterprise":
        license_key = get_license_key()
        access = get_feature_access_for_enterprise(license_key, db)
        return {
            "mode": access.mode,
            "plan_or_edition": access.plan_or_edition,
            "features": list(access.enabled_features),
            "limits": access.limits,
            "subscription_status": {"status": "active", "is_active": True, "is_trial": False, "is_expired": False}
        }

    subscription = db.query(OrganizationSubscription).filter(
        OrganizationSubscription.organization_id == org_id
    ).first()

    status_info = get_subscription_status_info(subscription)

    if status_info["is_expired"]:
        return {
            "mode": "saas",
            "plan_or_edition": "expired",
            "features": [],
            "limits": {"max_members": 0, "max_staff": 0, "max_branches": 0, "sms_monthly": 0},
            "subscription_status": status_info
        }

    plan_type = "starter"
    limits = PLAN_LIMITS.get("starter", {})

    if subscription and subscription.plan:
        plan_type = subscription.plan.plan_type
        limits = {
            "max_members": subscription.plan.max_members,
            "max_staff": subscription.plan.max_staff,
            "max_branches": subscription.plan.max_branches,
            "sms_monthly": subscription.plan.sms_credits_monthly
        }

    features = list(get_org_features(org_id, db))

    return {
        "mode": "saas",
        "plan_or_edition": plan_type,
        "features": features,
        "limits": limits,
        "subscription_status": status_info
    }


def _find_member_across_tenants(account_number: str, db: Session):
    """Search for a member by account number across all tenant databases.
    Returns (member, org, tenant_session, tenant_ctx) or raises HTTPException."""
    from services.tenant_context import get_tenant_context_simple
    from models.tenant import Member
    from models.master import Organization
    
    organizations = db.query(Organization).filter(Organization.connection_string.isnot(None)).all()
    
    for org in organizations:
        tenant_ctx = get_tenant_context_simple(org.id, db)
        if not tenant_ctx:
            continue
        
        tenant_session = tenant_ctx.create_session()
        try:
            member = tenant_session.query(Member).filter(Member.member_number == account_number).first()
            if member:
                return member, org, tenant_session, tenant_ctx
            tenant_session.close()
            tenant_ctx.close()
        except Exception:
            tenant_session.close()
            tenant_ctx.close()
    
    return None, None, None, None

def _generate_otp() -> str:
    """Generate a 6-digit OTP"""
    import random
    return str(random.randint(100000, 999999))

def _send_otp_sms(phone: str, otp: str, tenant_session, org_name: str):
    """Send OTP via SMS using the org's configured SMS provider"""
    from routes.sms import send_sms
    message = f"Your {org_name} mobile banking OTP is: {otp}. Valid for 5 minutes. Do not share this code."
    result = send_sms(phone, message, tenant_session)
    return result


class MemberActivateRequest(BaseModel):
    account_number: str

@router.post("/member/activate")
async def member_activate(data: MemberActivateRequest, db: Session = Depends(get_db)):
    """Step 1: Member enters account number to start mobile banking activation.
    Validates account exists, has a phone number, and sends OTP."""
    
    member, org, tenant_session, tenant_ctx = _find_member_across_tenants(data.account_number, db)
    
    if not member:
        raise HTTPException(status_code=404, detail="Account number not found. Please check and try again.")
    
    try:
        if member.status != 'active':
            raise HTTPException(status_code=403, detail="Account is not active. Contact your Sacco administrator.")
        
        if member.mobile_banking_active:
            raise HTTPException(status_code=400, detail="Mobile banking is already activated for this account. Please login.")
        
        if not member.phone:
            raise HTTPException(status_code=400, detail="No phone number registered for this account. Contact your Sacco to update your phone number.")
        
        otp = _generate_otp()
        member.otp_code = otp
        member.otp_expires_at = datetime.utcnow() + timedelta(minutes=5)
        tenant_session.commit()
        
        _send_otp_sms(member.phone, otp, tenant_session, org.name)
        
        masked_phone = member.phone[:4] + "****" + member.phone[-2:] if len(member.phone) > 6 else "****"
        
        return {
            "success": True,
            "message": f"OTP sent to {masked_phone}",
            "member_name": f"{member.first_name} {member.last_name}",
            "masked_phone": masked_phone,
            "organization_id": org.id,
            "organization_name": org.name,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


class MemberVerifyOTPRequest(BaseModel):
    account_number: str
    otp: str
    pin: str
    pin_confirm: str

@router.post("/member/verify-otp")
async def member_verify_otp(data: MemberVerifyOTPRequest, db: Session = Depends(get_db)):
    """Step 2: Member verifies OTP and sets their PIN to complete activation."""
    from services.auth import hash_password
    
    if data.pin != data.pin_confirm:
        raise HTTPException(status_code=400, detail="PINs do not match.")
    
    if len(data.pin) != 4 or not data.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits.")
    
    member, org, tenant_session, tenant_ctx = _find_member_across_tenants(data.account_number, db)
    
    if not member:
        raise HTTPException(status_code=404, detail="Account not found.")
    
    try:
        if not member.otp_code or not member.otp_expires_at:
            raise HTTPException(status_code=400, detail="No OTP was requested. Please start activation again.")
        
        if datetime.utcnow() > member.otp_expires_at:
            member.otp_code = None
            member.otp_expires_at = None
            tenant_session.commit()
            raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")
        
        if member.otp_code != data.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")
        
        member.pin_hash = hash_password(data.pin)
        member.mobile_banking_active = True
        member.otp_code = None
        member.otp_expires_at = None
        tenant_session.commit()
        
        return {
            "success": True,
            "message": "Mobile banking activated successfully! You can now login with your PIN.",
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


class MemberLoginRequest(BaseModel):
    account_number: str
    pin: str

@router.post("/member/login")
async def member_login(data: MemberLoginRequest, db: Session = Depends(get_db)):
    """Step 1 of login: Member enters account number + PIN, receives OTP to phone."""
    
    member, org, tenant_session, tenant_ctx = _find_member_across_tenants(data.account_number, db)
    
    if not member:
        raise HTTPException(status_code=401, detail="Invalid account number or PIN.")
    
    try:
        if member.status != 'active':
            raise HTTPException(status_code=403, detail="Account is not active. Contact administrator.")
        
        if not member.mobile_banking_active:
            raise HTTPException(status_code=400, detail="Mobile banking is not activated. Please activate first.")
        
        if not member.pin_hash or not verify_password(data.pin, member.pin_hash):
            raise HTTPException(status_code=401, detail="Invalid account number or PIN.")
        
        otp = _generate_otp()
        member.otp_code = otp
        member.otp_expires_at = datetime.utcnow() + timedelta(minutes=5)
        tenant_session.commit()
        
        _send_otp_sms(member.phone, otp, tenant_session, org.name)
        
        masked_phone = member.phone[:4] + "****" + member.phone[-2:] if len(member.phone) > 6 else "****"
        
        return {
            "success": True,
            "message": f"OTP sent to {masked_phone}",
            "masked_phone": masked_phone,
            "organization_id": org.id,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


class MemberLoginVerifyRequest(BaseModel):
    account_number: str
    otp: str

@router.post("/member/login-verify")
async def member_login_verify(data: MemberLoginVerifyRequest, response: Response, db: Session = Depends(get_db)):
    """Step 2 of login: Member verifies OTP to complete login."""
    import secrets as secrets_mod
    
    member, org, tenant_session, tenant_ctx = _find_member_across_tenants(data.account_number, db)
    
    if not member:
        raise HTTPException(status_code=401, detail="Account not found.")
    
    try:
        if not member.otp_code or not member.otp_expires_at:
            raise HTTPException(status_code=400, detail="No OTP was requested. Please login again.")
        
        if datetime.utcnow() > member.otp_expires_at:
            member.otp_code = None
            member.otp_expires_at = None
            tenant_session.commit()
            raise HTTPException(status_code=400, detail="OTP has expired. Please login again.")
        
        if member.otp_code != data.otp:
            raise HTTPException(status_code=400, detail="Invalid OTP. Please try again.")
        
        member.otp_code = None
        member.otp_expires_at = None
        tenant_session.commit()
        
        token = secrets_mod.token_urlsafe(32)
        
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=f"member:{org.id}:{member.id}:{token}",
            httponly=True,
            secure=IS_PRODUCTION,
            samesite="lax",
            max_age=30 * 24 * 60 * 60
        )
        
        return {
            "success": True,
            "access_token": token,
            "member": {
                "id": member.id,
                "member_number": member.member_number,
                "first_name": member.first_name,
                "last_name": member.last_name,
                "email": member.email,
                "phone": member.phone,
                "status": member.status,
            },
            "organization": {
                "id": org.id,
                "name": org.name,
                "code": org.code,
            }
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


class MemberResendOTPRequest(BaseModel):
    account_number: str

@router.post("/member/resend-otp")
async def member_resend_otp(data: MemberResendOTPRequest, db: Session = Depends(get_db)):
    """Resend OTP to member's phone (for activation or login)."""
    
    member, org, tenant_session, tenant_ctx = _find_member_across_tenants(data.account_number, db)
    
    if not member:
        raise HTTPException(status_code=404, detail="Account not found.")
    
    try:
        if not member.phone:
            raise HTTPException(status_code=400, detail="No phone number on file.")
        
        otp = _generate_otp()
        member.otp_code = otp
        member.otp_expires_at = datetime.utcnow() + timedelta(minutes=5)
        tenant_session.commit()
        
        _send_otp_sms(member.phone, otp, tenant_session, org.name)
        
        masked_phone = member.phone[:4] + "****" + member.phone[-2:] if len(member.phone) > 6 else "****"
        
        return {
            "success": True,
            "message": f"OTP resent to {masked_phone}",
            "masked_phone": masked_phone,
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()
