import os
import subprocess
import sys
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from routes.auth import router as auth_router
from routes.organization import router as org_router
from routes.branches import router as branches_router
from routes.staff import router as staff_router
from routes.members import router as members_router
from routes.loan_products import router as loan_products_router
from routes.loans import router as loans_router
from routes.dashboard import router as dashboard_router
from routes.transactions import router as transactions_router
from routes.repayments import router as repayments_router
from routes.guarantors import router as guarantors_router
from routes.restructure import router as restructure_router
from routes.defaults import router as defaults_router
from routes.sms import router as sms_router
from routes.reports import router as reports_router
from routes.analytics import router as analytics_router
from routes.hr import router as hr_router
from routes.audit import router as audit_router
from routes.settings import router as settings_router
from routes.mpesa import router as mpesa_router
from routes.sunpay import router as sunpay_router
from routes.documents import router as documents_router
from routes.roles import router as roles_router
from routes.float_management import router as float_router
from routes.teller_services import router as teller_services_router
from routes.fixed_deposits import router as fixed_deposits_router
from routes.dividends import router as dividends_router
from routes.expenses import router as expenses_router
from accounting.routes import router as accounting_router
from routes.admin import router as admin_router
from routes.features import router as features_router
from routes.notifications import router as notifications_router
from routes.exports import router as exports_router
from routes.subscription_payments import router as subscription_payments_router
from sqlalchemy import text
from models.database import engine, Base
from middleware.audit import AuditMiddleware

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
DIST_PATH = BASE_DIR / "dist" / "public"

def build_frontend():
    print("Building frontend...")
    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"Frontend build failed: {result.stderr}")
        return False
    print("Frontend build complete")
    return True

DEFAULT_PLAN_FEATURES = {
    "starter": ["core_banking", "members", "savings", "shares", "loans", "audit_logs", "mpesa_integration"],
    "growth": ["core_banking", "members", "savings", "shares", "loans", "teller_station", "float_management", "analytics", "sms_notifications", "expenses", "leave_management", "multiple_branches", "audit_logs", "accounting", "mpesa_integration"],
    "professional": ["core_banking", "members", "savings", "shares", "loans", "teller_station", "float_management", "fixed_deposits", "dividends", "analytics", "analytics_export", "sms_notifications", "bulk_sms", "expenses", "leave_management", "payroll", "accounting", "multiple_branches", "api_access", "white_label", "custom_reports", "mpesa_integration", "audit_logs"],
    "basic": ["core_banking", "members", "savings", "shares", "loans", "audit_logs", "mpesa_integration"],
    "standard": ["core_banking", "members", "savings", "shares", "loans", "teller_station", "float_management", "analytics", "sms_notifications", "expenses", "leave_management", "multiple_branches", "audit_logs", "accounting", "mpesa_integration"],
    "premium": ["core_banking", "members", "savings", "shares", "loans", "teller_station", "float_management", "fixed_deposits", "dividends", "analytics", "analytics_export", "sms_notifications", "bulk_sms", "expenses", "leave_management", "payroll", "accounting", "multiple_branches", "mpesa_integration", "bank_integration", "audit_logs"],
    "enterprise": ["core_banking", "members", "savings", "shares", "loans", "teller_station", "float_management", "fixed_deposits", "dividends", "analytics", "analytics_export", "sms_notifications", "bulk_sms", "expenses", "leave_management", "payroll", "accounting", "multiple_branches", "api_access", "white_label", "custom_reports", "mpesa_integration", "bank_integration", "audit_logs"],
}

def seed_default_plans():
    """Seed default subscription plans if none exist"""
    from models.database import SessionLocal
    from models.master import SubscriptionPlan
    
    db = SessionLocal()
    try:
        existing = db.query(SubscriptionPlan).count()
        if existing > 0:
            print(f"Found {existing} existing plans, skipping seed")
            return
        
        print("Seeding default subscription plans...")
        
        default_plans = [
            {
                "name": "Starter",
                "plan_type": "starter",
                "pricing_model": "saas",
                "monthly_price": 50,
                "annual_price": 500,
                "max_members": 500,
                "max_staff": 3,
                "max_branches": 1,
                "sms_credits_monthly": 50,
                "sort_order": 1,
                "features": {"enabled": DEFAULT_PLAN_FEATURES["starter"]}
            },
            {
                "name": "Growth",
                "plan_type": "growth",
                "pricing_model": "saas",
                "monthly_price": 150,
                "annual_price": 1500,
                "max_members": 2000,
                "max_staff": 10,
                "max_branches": 5,
                "sms_credits_monthly": 200,
                "sort_order": 2,
                "features": {"enabled": DEFAULT_PLAN_FEATURES["growth"]}
            },
            {
                "name": "Professional",
                "plan_type": "professional",
                "pricing_model": "saas",
                "monthly_price": 400,
                "annual_price": 4000,
                "max_members": 10000,
                "max_staff": 50,
                "max_branches": 20,
                "sms_credits_monthly": 1000,
                "sort_order": 3,
                "features": {"enabled": DEFAULT_PLAN_FEATURES["professional"]}
            },
            {
                "name": "Basic",
                "plan_type": "basic",
                "pricing_model": "enterprise",
                "one_time_price": 10000,
                "support_years": 1,
                "max_members": None,
                "max_staff": None,
                "max_branches": None,
                "sort_order": 1,
                "features": {"enabled": DEFAULT_PLAN_FEATURES["basic"]}
            },
            {
                "name": "Standard",
                "plan_type": "standard",
                "pricing_model": "enterprise",
                "one_time_price": 20000,
                "support_years": 2,
                "max_members": None,
                "max_staff": None,
                "max_branches": None,
                "sort_order": 2,
                "features": {"enabled": DEFAULT_PLAN_FEATURES["standard"]}
            },
            {
                "name": "Premium",
                "plan_type": "premium",
                "pricing_model": "enterprise",
                "one_time_price": 35000,
                "support_years": 3,
                "max_members": None,
                "max_staff": None,
                "max_branches": None,
                "sort_order": 3,
                "features": {"enabled": DEFAULT_PLAN_FEATURES["premium"]}
            },
            {
                "name": "Enterprise",
                "plan_type": "enterprise",
                "pricing_model": "enterprise",
                "one_time_price": 50000,
                "support_years": 5,
                "max_members": None,
                "max_staff": None,
                "max_branches": None,
                "sort_order": 4,
                "features": {"enabled": DEFAULT_PLAN_FEATURES["enterprise"]}
            }
        ]
        
        for plan_data in default_plans:
            plan = SubscriptionPlan(**plan_data)
            db.add(plan)
        
        db.commit()
        print(f"Seeded {len(default_plans)} default subscription plans")
    except Exception as e:
        print(f"Error seeding plans: {e}")
        db.rollback()
    finally:
        db.close()

def run_pending_migrations_sync():
    """Run migrations on all existing tenant databases using cached engines (background thread)"""
    from models.database import get_db
    from models.master import Organization
    from services.tenant_context import TenantContext
    
    db = next(get_db())
    try:
        orgs = db.query(Organization).filter(Organization.connection_string.isnot(None)).all()
        for org in orgs:
            try:
                print(f"Running migrations for tenant: {org.name}")
                TenantContext(org.connection_string)
                print(f"Migration complete for tenant: {org.name}")
            except Exception as e:
                print(f"Error migrating tenant {org.name}: {e}")
    finally:
        db.close()
    print("All tenant migrations complete")

_MASTER_SCHEMA_VERSION = 2

def _get_master_migration_version():
    """Check the migration version stored in the master database"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '_master_migration_meta'
                )
            """))
            if not result.scalar():
                return -1
            result = conn.execute(text("SELECT version FROM _master_migration_meta LIMIT 1"))
            row = result.fetchone()
            return row[0] if row else -1
    except Exception:
        return -1

def _set_master_migration_version(version):
    """Store the migration version in the master database"""
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS _master_migration_meta (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    version INTEGER NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("DELETE FROM _master_migration_meta"))
            conn.execute(text(f"INSERT INTO _master_migration_meta (id, version) VALUES (1, {version})"))
    except Exception as e:
        print(f"Error storing master migration version: {e}")

def _add_master_column_if_not_exists(conn, table_name, col_name, col_type):
    """Helper to add a column to a master DB table if it doesn't exist"""
    result = conn.execute(text(f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = '{table_name}' AND column_name = '{col_name}'
    """))
    if not result.fetchone():
        try:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
        except Exception as e:
            print(f"Master migration warning: Could not add {table_name}.{col_name}: {e}")

def run_master_migrations():
    """Run incremental migrations on the master database"""
    current_version = _get_master_migration_version()
    if current_version >= _MASTER_SCHEMA_VERSION:
        return
    
    print(f"Running master DB migrations (v{current_version} -> v{_MASTER_SCHEMA_VERSION})...")
    
    with engine.begin() as conn:
        user_columns = [
            ("is_email_verified", "BOOLEAN DEFAULT FALSE"),
            ("approval_pin", "VARCHAR(255)"),
        ]
        for col_name, col_type in user_columns:
            _add_master_column_if_not_exists(conn, "users", col_name, col_type)
        
        org_columns = [
            ("logo", "TEXT"),
            ("email", "VARCHAR(255)"),
            ("phone", "VARCHAR(50)"),
            ("address", "TEXT"),
            ("staff_email_domain", "VARCHAR(255)"),
            ("deployment_mode", "VARCHAR(50) DEFAULT 'saas'"),
            ("working_hours_start", "TIME"),
            ("working_hours_end", "TIME"),
            ("working_days", "JSONB"),
            ("currency", "VARCHAR(10) DEFAULT 'KES'"),
            ("financial_year_start", "VARCHAR(10)"),
            ("enforce_working_hours", "BOOLEAN DEFAULT FALSE"),
            ("auto_logout_minutes", "VARCHAR(10)"),
            ("require_two_factor_auth", "BOOLEAN DEFAULT FALSE"),
            ("updated_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in org_columns:
            _add_master_column_if_not_exists(conn, "organizations", col_name, col_type)
        
        sub_columns = [
            ("trial_ends_at", "TIMESTAMP"),
            ("current_period_start", "TIMESTAMP"),
            ("current_period_end", "TIMESTAMP"),
            ("cancelled_at", "TIMESTAMP"),
            ("gateway", "VARCHAR(50)"),
            ("gateway_subscription_id", "VARCHAR(255)"),
            ("gateway_customer_id", "VARCHAR(255)"),
        ]
        for col_name, col_type in sub_columns:
            _add_master_column_if_not_exists(conn, "organization_subscriptions", col_name, col_type)
        
        platform_columns = [
            ("setting_type", "VARCHAR(50) DEFAULT 'string'"),
            ("description", "TEXT"),
            ("updated_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in platform_columns:
            _add_master_column_if_not_exists(conn, "platform_settings", col_name, col_type)
    
    _set_master_migration_version(_MASTER_SCHEMA_VERSION)
    print(f"Master DB migrations complete (now at v{_MASTER_SCHEMA_VERSION})")

@asynccontextmanager
async def lifespan(app: FastAPI):
    import threading
    
    Base.metadata.create_all(bind=engine)
    
    run_master_migrations()
    
    seed_default_plans()
    
    if os.environ.get("NODE_ENV") != "development" and not DIST_PATH.exists():
        build_frontend()
    
    migration_thread = threading.Thread(target=run_pending_migrations_sync, daemon=True)
    migration_thread.start()
    
    yield

app = FastAPI(title="BANKY - Bank & Sacco Management System", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://0.0.0.0:5000",
]

if os.environ.get("REPL_SLUG"):
    repl_slug = os.environ.get("REPL_SLUG", "")
    repl_owner = os.environ.get("REPL_OWNER", "")
    ALLOWED_ORIGINS.extend([
        f"https://{repl_slug}.{repl_owner}.repl.co",
        f"https://{repl_slug}-00-{repl_owner}.replit.dev",
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        start = time.time()
        try:
            response = await call_next(request)
            duration_ms = (time.time() - start) * 1000
            print(f"[TIMING] {request.method} {request.url.path} -> {response.status_code} in {duration_ms:.0f}ms")
            return response
        finally:
            if hasattr(request.state, 'tenant_session'):
                try:
                    request.state.tenant_session.close()
                except Exception:
                    pass
            if hasattr(request.state, 'tenant_ctx'):
                try:
                    request.state.tenant_ctx.close()
                except Exception:
                    pass
    return await call_next(request)

# Add audit logging middleware
app.add_middleware(AuditMiddleware)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(org_router, prefix="/api/organizations", tags=["Organizations"])
app.include_router(branches_router, prefix="/api/organizations", tags=["Branches"])
app.include_router(staff_router, prefix="/api/organizations", tags=["Staff"])
app.include_router(members_router, prefix="/api/organizations", tags=["Members"])
app.include_router(loan_products_router, prefix="/api/organizations", tags=["Loan Products"])
app.include_router(loans_router, prefix="/api/organizations", tags=["Loans"])
app.include_router(dashboard_router, prefix="/api/organizations", tags=["Dashboard"])
app.include_router(transactions_router, prefix="/api/organizations", tags=["Transactions"])
app.include_router(repayments_router, prefix="/api/organizations", tags=["Repayments"])
app.include_router(guarantors_router, prefix="/api/organizations", tags=["Guarantors"])
app.include_router(restructure_router, prefix="/api/organizations", tags=["Restructure"])
app.include_router(defaults_router, prefix="/api/organizations", tags=["Defaults"])
app.include_router(sms_router, prefix="/api/organizations", tags=["SMS"])
app.include_router(reports_router, prefix="/api/organizations", tags=["Reports"])
app.include_router(analytics_router, prefix="/api/organizations", tags=["Analytics"])
app.include_router(hr_router, prefix="/api/organizations", tags=["HR"])
app.include_router(audit_router, prefix="/api/organizations", tags=["Audit"])
app.include_router(settings_router, prefix="/api/organizations", tags=["Settings"])
app.include_router(mpesa_router, prefix="/api", tags=["M-Pesa"])
app.include_router(sunpay_router, prefix="/api", tags=["SunPay"])
app.include_router(documents_router, prefix="/api/organizations", tags=["Documents"])
app.include_router(roles_router, prefix="/api/organizations", tags=["Roles"])
app.include_router(float_router, prefix="/api", tags=["Float Management"])
app.include_router(teller_services_router, prefix="/api", tags=["Teller Services"])
app.include_router(fixed_deposits_router, prefix="/api/organizations", tags=["Fixed Deposits"])
app.include_router(dividends_router, prefix="/api/organizations", tags=["Dividends"])
app.include_router(expenses_router, prefix="/api", tags=["Expenses"])
app.include_router(accounting_router, prefix="/api/organizations", tags=["Accounting"])
app.include_router(admin_router, prefix="/api", tags=["Admin"])
app.include_router(features_router, prefix="/api/organizations", tags=["Features"])
app.include_router(notifications_router, prefix="/api/organizations", tags=["Notifications"])
app.include_router(exports_router, prefix="/api/organizations", tags=["Data Export"])
app.include_router(subscription_payments_router, prefix="/api/organizations", tags=["Subscription Payments"])

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "BANKY API", "backend": "python"}

@app.post("/api/webhooks/subscription-payment", tags=["Webhooks"])
async def subscription_payment_webhook(request: Request):
    from models.database import SessionLocal
    from models.master import SubscriptionPayment, OrganizationSubscription, SubscriptionPlan
    from datetime import datetime, timedelta

    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    print(f"[Subscription Webhook] Received: {payload}")

    external_ref = payload.get("externalRef", payload.get("ExternalRef", ""))
    result_code = str(payload.get("resultCode", payload.get("ResultCode", "")))
    receipt = payload.get("mpesaRef", payload.get("MpesaRef", payload.get("receipt", "")))

    if not external_ref or not external_ref.startswith("SUB:"):
        print(f"[Subscription Webhook] Not a subscription payment: {external_ref}")
        return {"status": "ignored"}

    payment_id = external_ref.replace("SUB:", "")

    db = SessionLocal()
    try:
        payment = db.query(SubscriptionPayment).filter(SubscriptionPayment.id == payment_id).first()
        if not payment:
            print(f"[Subscription Webhook] Payment not found: {payment_id}")
            return {"status": "error", "message": "Payment not found"}

        if result_code == "0":
            payment.status = "completed"
            payment.mpesa_receipt = receipt
            payment.payment_reference = receipt

            now = datetime.utcnow()
            if payment.billing_period == "annual":
                period_days = 365
            else:
                period_days = 30

            payment.period_start = now
            payment.period_end = now + timedelta(days=period_days)

            sub = db.query(OrganizationSubscription).filter(
                OrganizationSubscription.organization_id == payment.organization_id
            ).first()

            if sub:
                sub.plan_id = payment.plan_id
                sub.status = "active"
                if sub.current_period_end and sub.current_period_end > now:
                    sub.current_period_end = sub.current_period_end + timedelta(days=period_days)
                else:
                    sub.current_period_start = now
                    sub.current_period_end = now + timedelta(days=period_days)
                print(f"[Subscription Webhook] Activated subscription for org {payment.organization_id}, plan {payment.plan_id}, until {sub.current_period_end}")
            else:
                new_sub = OrganizationSubscription(
                    organization_id=payment.organization_id,
                    plan_id=payment.plan_id,
                    status="active",
                    current_period_start=now,
                    current_period_end=now + timedelta(days=period_days)
                )
                db.add(new_sub)
                print(f"[Subscription Webhook] Created new subscription for org {payment.organization_id}")

            db.commit()
            return {"status": "success", "message": "Subscription activated"}
        else:
            payment.status = "failed"
            db.commit()
            print(f"[Subscription Webhook] Payment failed: resultCode={result_code}")
            return {"status": "failed"}

    except Exception as e:
        db.rollback()
        print(f"[Subscription Webhook] Error: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@app.post("/api/webhooks/stripe-subscription", tags=["Webhooks"])
async def stripe_subscription_webhook(request: Request):
    from models.database import SessionLocal
    from models.master import SubscriptionPayment, OrganizationSubscription
    from routes.subscription_payments import activate_subscription
    from datetime import datetime, timedelta

    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    print(f"[Stripe Webhook] Received event type: {payload.get('type', 'unknown')}")

    event_type = payload.get("type", "")
    if event_type != "checkout.session.completed":
        return {"status": "ignored"}

    session_data = payload.get("data", {}).get("object", {})
    session_id = session_data.get("id", "")
    payment_status = session_data.get("payment_status", "")
    metadata = session_data.get("metadata", {})
    payment_id = metadata.get("payment_id", "")

    if not payment_id:
        print(f"[Stripe Webhook] No payment_id in metadata")
        return {"status": "ignored"}

    db = SessionLocal()
    try:
        payment = db.query(SubscriptionPayment).filter(SubscriptionPayment.id == payment_id).first()
        if not payment:
            print(f"[Stripe Webhook] Payment not found: {payment_id}")
            return {"status": "error", "message": "Payment not found"}

        if payment_status == "paid":
            payment_intent = session_data.get("payment_intent", session_id)
            payment.stripe_payment_intent_id = payment_intent
            activate_subscription(db, payment, str(payment_intent))
            print(f"[Stripe Webhook] Activated subscription for payment {payment_id}")
            return {"status": "success"}
        else:
            payment.status = "failed"
            db.commit()
            return {"status": "failed"}
    except Exception as e:
        db.rollback()
        print(f"[Stripe Webhook] Error: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@app.get("/api/stripe-return", tags=["Payments"])
async def stripe_return(request: Request, status: str = "", payment_id: str = ""):
    from models.database import SessionLocal
    from models.master import SubscriptionPayment
    from routes.subscription_payments import activate_subscription

    message = "Payment cancelled."
    if status == "success" and payment_id:
        db = SessionLocal()
        try:
            payment = db.query(SubscriptionPayment).filter(SubscriptionPayment.id == payment_id).first()
            if payment and payment.status == "awaiting_payment" and payment.stripe_session_id:
                try:
                    from services.stripe_service import retrieve_session
                    session = await retrieve_session(db, payment.stripe_session_id)
                    if session.payment_status == "paid":
                        receipt = session.payment_intent if hasattr(session, 'payment_intent') else session.id
                        activate_subscription(db, payment, str(receipt))
                        message = "Payment successful! Your subscription has been activated."
                        print(f"[Stripe Return] Activated subscription for payment {payment_id}")
                    else:
                        message = "Payment is being processed. Your subscription will be activated shortly."
                except Exception as e:
                    print(f"[Stripe Return] Error verifying: {e}")
                    message = "Payment received. Your subscription will be activated shortly."
            elif payment and payment.status == "completed":
                message = "Payment successful! Your subscription is already active."
            else:
                message = "Payment received. Processing..."
        finally:
            db.close()

    from fastapi.responses import HTMLResponse
    html = f"""<!DOCTYPE html>
<html><head><title>BANKY - Payment</title>
<style>body{{font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f8fafc;}}
.card{{background:white;border-radius:12px;padding:40px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:400px;}}
.icon{{font-size:48px;margin-bottom:16px;}}
h2{{color:#1e293b;margin:0 0 8px;}}
p{{color:#64748b;margin:0 0 24px;}}
a{{display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:500;}}
a:hover{{background:#1d4ed8;}}</style></head>
<body><div class="card">
<div class="icon">{"✅" if "successful" in message or "active" in message else "⏳" if "processing" in message.lower() or "shortly" in message.lower() else "❌"}</div>
<h2>{"Payment Successful" if "successful" in message or "active" in message else "Processing" if "processing" in message.lower() or "shortly" in message.lower() else "Payment Cancelled"}</h2>
<p>{message}</p>
<a href="/">Return to BANKY</a>
</div></body></html>"""
    return HTMLResponse(content=html)


@app.post("/api/webhooks/paystack-subscription", tags=["Webhooks"])
async def paystack_subscription_webhook(request: Request):
    from models.database import SessionLocal
    from models.master import SubscriptionPayment
    from routes.subscription_payments import activate_subscription

    try:
        payload = await request.json()
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    print(f"[Paystack Webhook] Received event: {payload.get('event', 'unknown')}")

    event = payload.get("event", "")
    if event != "charge.success":
        return {"status": "ignored"}

    tx_data = payload.get("data", {})
    reference = tx_data.get("reference", "")
    status = tx_data.get("status", "")

    if not reference.startswith("BANKY-SUB-"):
        print(f"[Paystack Webhook] Not a subscription payment: {reference}")
        return {"status": "ignored"}

    payment_id = reference.replace("BANKY-SUB-", "")

    db = SessionLocal()
    try:
        payment = db.query(SubscriptionPayment).filter(SubscriptionPayment.id == payment_id).first()
        if not payment:
            print(f"[Paystack Webhook] Payment not found: {payment_id}")
            return {"status": "error", "message": "Payment not found"}

        if status == "success":
            activate_subscription(db, payment, reference)
            print(f"[Paystack Webhook] Activated subscription for payment {payment_id}")
            return {"status": "success"}
        else:
            payment.status = "failed"
            db.commit()
            return {"status": "failed"}
    except Exception as e:
        db.rollback()
        print(f"[Paystack Webhook] Error: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        db.close()


@app.get("/api/public/plans", tags=["Public"])
async def get_public_plans():
    """
    Get available subscription plans (public endpoint for landing page).
    No authentication required. All content is fetched from the database.
    """
    from models.database import SessionLocal
    from models.master import SubscriptionPlan, PlatformSettings
    from sqlalchemy import or_
    
    db = SessionLocal()
    try:
        settings = {s.setting_key: s.setting_value for s in db.query(PlatformSettings).filter(
            PlatformSettings.setting_key.in_([
                'pricing_title', 'pricing_subtitle', 
                'pricing_saas_label', 'pricing_enterprise_label'
            ])
        ).all()}
        
        saas_plans = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.is_active == True,
            or_(SubscriptionPlan.pricing_model == 'saas', SubscriptionPlan.pricing_model == None)
        ).order_by(SubscriptionPlan.sort_order, SubscriptionPlan.monthly_price).all()
        
        enterprise_plans = db.query(SubscriptionPlan).filter(
            SubscriptionPlan.is_active == True,
            SubscriptionPlan.pricing_model == 'enterprise'
        ).order_by(SubscriptionPlan.sort_order).all()
        
        feature_display_names = {
            "core_banking": "Core Banking",
            "members": "Member Management",
            "savings": "Savings Accounts",
            "shares": "Share Capital",
            "loans": "Loan Management",
            "teller_station": "Teller Station",
            "float_management": "Float Management",
            "analytics": "Analytics Dashboard",
            "analytics_export": "Analytics Export",
            "sms_notifications": "SMS Notifications",
            "bulk_sms": "Bulk SMS",
            "expenses": "Expense Tracking",
            "leave_management": "Leave Management",
            "multiple_branches": "Multiple Branches",
            "audit_logs": "Audit Logs",
            "accounting": "Full Accounting",
            "fixed_deposits": "Fixed Deposits",
            "dividends": "Dividends",
            "hr": "HR Management",
            "payroll": "Payroll",
            "api_access": "API Access",
            "custom_reports": "Custom Reports",
            "white_label": "White Label",
            "mpesa_integration": "M-Pesa Integration",
            "bank_integration": "Bank Integration",
            "priority_support": "Priority Support"
        }
        
        def get_display_features(plan):
            enabled = plan.features.get("enabled", []) if plan.features else []
            custom = plan.features.get("custom", []) if plan.features else []
            return {"enabled": [feature_display_names.get(f, f.replace("_", " ").title()) for f in enabled], "custom": custom}
        
        return {
            "title": settings.get('pricing_title', 'Choose Your Plan'),
            "subtitle": settings.get('pricing_subtitle', 'Flexible options for Saccos of all sizes'),
            "saas_label": settings.get('pricing_saas_label', 'SaaS (Monthly)'),
            "enterprise_label": settings.get('pricing_enterprise_label', 'Enterprise (One-time)'),
            "saas": [{
                "name": p.name,
                "plan_type": p.plan_type,
                "monthly_price": float(p.monthly_price) if p.monthly_price else 0,
                "annual_price": float(p.annual_price) if p.annual_price else 0,
                "max_members": p.max_members,
                "max_staff": p.max_staff,
                "max_branches": p.max_branches,
                "features": get_display_features(p)
            } for p in saas_plans],
            "enterprise": [{
                "name": p.name,
                "price": float(p.one_time_price) if p.one_time_price else 0,
                "max_members": p.max_members,
                "max_staff": p.max_staff,
                "max_branches": p.max_branches,
                "support_years": p.support_years or 1,
                "features": get_display_features(p)
            } for p in enterprise_plans]
        }
    finally:
        db.close()

@app.get("/api/public/branding", tags=["Public"])
async def get_public_branding():
    """Get public platform branding settings (no auth required)."""
    from models.database import SessionLocal
    from models.master import PlatformSettings
    from routes.admin import initialize_platform_settings
    
    db = SessionLocal()
    try:
        initialize_platform_settings(db)
        
        branding_keys = [
            "platform_name", "support_email", "sales_email",
            "theme_primary_color", "theme_secondary_color", 
            "theme_accent_color", "theme_sidebar_color"
        ]
        
        settings = db.query(PlatformSettings).filter(
            PlatformSettings.setting_key.in_(branding_keys)
        ).all()
        
        result = {}
        for s in settings:
            result[s.setting_key] = s.setting_value or ""
        
        return result
    finally:
        db.close()


@app.get("/api/exchange-rates")
async def get_exchange_rates():
    """Get current USD exchange rates for subscription pricing."""
    from services.exchange_rate import fetch_exchange_rates
    from models.database import SessionLocal
    from models.master import PlatformSettings

    rates = await fetch_exchange_rates()

    db = SessionLocal()
    try:
        paystack_setting = db.query(PlatformSettings).filter(
            PlatformSettings.setting_key == "paystack_currency"
        ).first()
        paystack_currency = paystack_setting.setting_value if paystack_setting else "NGN"
    finally:
        db.close()

    return {
        "base": "USD",
        "rates": rates,
        "paystack_currency": paystack_currency
    }


from pydantic import BaseModel, EmailStr

class SalesInquiryRequest(BaseModel):
    name: str
    email: str
    organization: str = ""
    message: str

class ContactFormRequest(BaseModel):
    name: str
    email: str
    subject: str = "General Inquiry"
    message: str

@app.post("/api/public/contact", tags=["Public"])
async def submit_contact_form(request: ContactFormRequest):
    """Handle contact form submissions from the landing page."""
    from models.database import SessionLocal
    from models.master import PlatformSettings
    from services.email_service import BrevoEmailService
    import logging

    db = SessionLocal()
    try:
        settings_keys = ["platform_name", "support_email", "brevo_api_key"]
        settings = db.query(PlatformSettings).filter(
            PlatformSettings.setting_key.in_(settings_keys)
        ).all()
        config = {s.setting_key: s.setting_value for s in settings}

        platform_name = config.get("platform_name", "BANKY")
        support_email = config.get("support_email")
        brevo_api_key = config.get("brevo_api_key")

        if not support_email or not brevo_api_key:
            logging.warning("Contact form: email service not configured")
            return {"success": True, "message": "Thank you for reaching out! We'll get back to you soon."}

        service = BrevoEmailService(
            api_key=brevo_api_key,
            from_name=f"{platform_name} Contact",
            from_email=support_email
        )

        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">New Contact Form Submission</h1>
            </div>
            <div style="padding: 20px;">
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; font-weight: bold; width: 100px;">Name:</td><td>{request.name}</td></tr>
                    <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td><a href="mailto:{request.email}">{request.email}</a></td></tr>
                    <tr><td style="padding: 8px 0; font-weight: bold;">Subject:</td><td>{request.subject}</td></tr>
                </table>
                <h3 style="color: #1e40af; margin-top: 20px;">Message</h3>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #1e40af;">
                    {request.message.replace(chr(10), '<br>')}
                </div>
            </div>
        </body>
        </html>
        """

        try:
            await service.send_email(
                to_email=support_email,
                to_name=f"{platform_name} Support",
                subject=f"Contact Form: {request.subject} - from {request.name}",
                html_content=html_content,
                text_content=f"Name: {request.name}\nEmail: {request.email}\nSubject: {request.subject}\n\nMessage:\n{request.message}"
            )
        except Exception as e:
            logging.error(f"Failed to send contact email: {e}")

        return {"success": True, "message": "Thank you for reaching out! We'll get back to you soon."}
    except Exception as e:
        logging.error(f"Contact form error: {e}")
        return {"success": True, "message": "Thank you for reaching out! We'll get back to you soon."}
    finally:
        db.close()

@app.post("/api/public/sales-inquiry", tags=["Public"])
async def send_sales_inquiry(request: SalesInquiryRequest):
    """Send sales inquiry email via Brevo (public endpoint)."""
    from models.database import SessionLocal
    from models.master import PlatformSettings
    from services.email_service import BrevoEmailService
    
    db = SessionLocal()
    try:
        settings_keys = ["platform_name", "sales_email", "brevo_api_key", "support_email"]
        settings = db.query(PlatformSettings).filter(
            PlatformSettings.setting_key.in_(settings_keys)
        ).all()
        
        config = {s.setting_key: s.setting_value for s in settings}
        
        platform_name = config.get("platform_name", "BANKY")
        sales_email = config.get("sales_email") or config.get("support_email")
        brevo_api_key = config.get("brevo_api_key")
        
        if not sales_email:
            return {"success": False, "error": "Sales email not configured"}
        
        if not brevo_api_key:
            return {"success": False, "error": "Email service not configured"}
        
        service = BrevoEmailService(
            api_key=brevo_api_key,
            from_name=f"{platform_name} Sales",
            from_email=sales_email
        )
        
        html_content = f"""
        <html>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #1e40af; color: white; padding: 20px; text-align: center;">
                <h1 style="margin: 0;">New Sales Inquiry</h1>
            </div>
            
            <div style="padding: 20px;">
                <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">Contact Details</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px 0; font-weight: bold; width: 120px;">Name:</td><td>{request.name}</td></tr>
                    <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td><a href="mailto:{request.email}">{request.email}</a></td></tr>
                    <tr><td style="padding: 8px 0; font-weight: bold;">Organization:</td><td>{request.organization or 'Not specified'}</td></tr>
                </table>
                
                <h2 style="color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-top: 25px;">Message</h2>
                <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #1e40af;">
                    {request.message.replace(chr(10), '<br>')}
                </div>
                
                <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">
                    This inquiry was submitted via the {platform_name} application.
                </p>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
New Sales Inquiry from {platform_name}

Contact Details:
- Name: {request.name}
- Email: {request.email}
- Organization: {request.organization or 'Not specified'}

Message:
{request.message}

---
This inquiry was submitted via the {platform_name} application.
        """
        
        subject = f"Enterprise Inquiry from {request.organization or request.name}"
        
        result = await service.send_email(
            to_email=sales_email,
            to_name=f"{platform_name} Sales Team",
            subject=subject,
            html_content=html_content,
            text_content=text_content
        )
        
        return {"success": True, "message": "Your inquiry has been sent. We'll get back to you soon!"}
        
    except Exception as e:
        import logging
        logging.error(f"Failed to send sales inquiry: {e}")
        return {"success": False, "error": "Failed to send inquiry. Please try again later."}
    finally:
        db.close()

@app.get("/api/public/landing-settings", tags=["Public"])
async def get_public_landing_settings():
    """Get landing page settings (public endpoint for landing page)."""
    from models.database import SessionLocal
    from models.master import PlatformSettings
    from routes.admin import initialize_platform_settings
    
    db = SessionLocal()
    try:
        initialize_platform_settings(db)
        
        settings = db.query(PlatformSettings).filter(
            PlatformSettings.setting_key.like("landing_%")
        ).all()
        
        defaults = {
            "hero_title": "The Complete Banking Platform for Saccos",
            "hero_subtitle": "Manage members, loans, savings, fixed deposits, and dividends with a powerful, secure multi-tenant system. Available as SaaS or self-hosted.",
            "hero_badge": "Trusted by 500+ Saccos in East Africa",
            "cta_primary_text": "Start Free Trial",
            "cta_primary_url": "#pricing",
            "cta_secondary_text": "Watch Demo",
            "cta_secondary_url": "",
            "demo_video_url": "",
            "app_url": "https://app.banky.co.ke",
            "stats_saccos": "500+",
            "stats_transactions": "KES 2B+",
            "stats_members": "1M+",
            "stats_uptime": "99.9%"
        }
        
        for s in settings:
            key = s.setting_key.replace("landing_", "")
            defaults[key] = s.setting_value
        
        return defaults
    finally:
        db.close()

if DIST_PATH.exists():
    assets_path = DIST_PATH / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    file_path = DIST_PATH / full_path
    if file_path.is_file():
        return FileResponse(str(file_path), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    
    index_path = DIST_PATH / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path), headers={"Cache-Control": "no-cache, no-store, must-revalidate"})
    
    return HTMLResponse(
        content="""
        <!DOCTYPE html>
        <html>
        <head><title>BANKY</title></head>
        <body>
            <h1>BANKY - Bank & Sacco Management System</h1>
            <p>Frontend is being built. Please wait a moment and refresh.</p>
            <p>If this persists, run: <code>npm run build</code></p>
        </body>
        </html>
        """,
        status_code=200
    )
