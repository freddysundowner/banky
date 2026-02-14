from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, time
from models.database import get_db
from models.tenant import OrganizationSettings, WorkingHours
from schemas.tenant import OrganizationSettingCreate, OrganizationSettingResponse, WorkingHoursCreate, WorkingHoursResponse
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_role
from models.master import Organization

router = APIRouter()

DEFAULT_SETTINGS = [
    {"key": "currency", "value": "KES", "type": "string", "description": "Default currency"},
    {"key": "currency_symbol", "value": "KSh", "type": "string", "description": "Currency symbol"},
    {"key": "timezone", "value": "Africa/Nairobi", "type": "string", "description": "Organization timezone"},
    {"key": "date_format", "value": "DD/MM/YYYY", "type": "string", "description": "Date format"},
    {"key": "fiscal_year_start", "value": "01-01", "type": "string", "description": "Fiscal year start (MM-DD)"},
    {"key": "min_savings_balance", "value": "0", "type": "number", "description": "Minimum savings balance"},
    {"key": "min_shares_balance", "value": "0", "type": "number", "description": "Minimum shares balance"},
    {"key": "share_value", "value": "100", "type": "number", "description": "Value per share"},
    {"key": "max_loan_multiplier", "value": "3", "type": "number", "description": "Max loan as multiple of savings"},
    {"key": "sms_enabled", "value": "false", "type": "boolean", "description": "Enable SMS notifications"},
    {"key": "sms_provider", "value": "", "type": "string", "description": "SMS provider name"},
    {"key": "sms_api_key", "value": "", "type": "string", "description": "SMS provider API key"},
    {"key": "sms_endpoint", "value": "", "type": "string", "description": "SMS API endpoint URL"},
    {"key": "sms_sender_id", "value": "", "type": "string", "description": "SMS sender ID/short code"},
    {"key": "auto_logout_minutes", "value": "30", "type": "number", "description": "Auto logout after inactivity"},
    {"key": "enforce_working_hours", "value": "false", "type": "boolean", "description": "Enforce working hours"},
    {"key": "require_clock_in", "value": "false", "type": "boolean", "description": "Require staff to clock in before using the system"},
    {"key": "allow_weekend_access", "value": "true", "type": "boolean", "description": "Allow access on weekends"},
    {"key": "require_guarantors", "value": "true", "type": "boolean", "description": "Require guarantors for loans"},
    {"key": "max_guarantor_exposure", "value": "3", "type": "number", "description": "Max loans a member can guarantee"},
    {"key": "require_opening_deposit", "value": "false", "type": "boolean", "description": "Require opening deposit to activate account"},
    {"key": "minimum_opening_deposit", "value": "0", "type": "number", "description": "Minimum opening deposit amount"},
    {"key": "auto_activate_on_deposit", "value": "true", "type": "boolean", "description": "Auto-activate member on first deposit"},
    {"key": "mpesa_enabled", "value": "false", "type": "boolean", "description": "Enable M-Pesa integration"},
    {"key": "mpesa_paybill", "value": "", "type": "string", "description": "M-Pesa paybill number"},
    {"key": "mpesa_consumer_key", "value": "", "type": "string", "description": "M-Pesa Daraja API consumer key"},
    {"key": "mpesa_consumer_secret", "value": "", "type": "string", "description": "M-Pesa Daraja API consumer secret"},
    {"key": "mpesa_passkey", "value": "", "type": "string", "description": "M-Pesa online passkey"},
    {"key": "mpesa_environment", "value": "sandbox", "type": "string", "description": "M-Pesa environment (sandbox/production)"},
    {"key": "email_enabled", "value": "false", "type": "boolean", "description": "Enable email notifications"},
    {"key": "email_provider", "value": "brevo", "type": "string", "description": "Email provider (brevo)"},
    {"key": "brevo_api_key", "value": "", "type": "string", "description": "Brevo API key"},
    {"key": "email_from_name", "value": "", "type": "string", "description": "Email sender name"},
    {"key": "email_from_address", "value": "", "type": "string", "description": "Email sender address"},
]

def initialize_settings(tenant_session):
    existing = tenant_session.query(OrganizationSettings).count()
    if existing == 0:
        for setting in DEFAULT_SETTINGS:
            s = OrganizationSettings(
                setting_key=setting["key"],
                setting_value=setting["value"],
                setting_type=setting["type"],
                description=setting["description"]
            )
            tenant_session.add(s)
        tenant_session.commit()
    else:
        existing_keys = {s.setting_key for s in tenant_session.query(OrganizationSettings.setting_key).all()}
        added = False
        for setting in DEFAULT_SETTINGS:
            if setting["key"] not in existing_keys:
                s = OrganizationSettings(
                    setting_key=setting["key"],
                    setting_value=setting["value"],
                    setting_type=setting["type"],
                    description=setting["description"]
                )
                tenant_session.add(s)
                added = True
        if added:
            tenant_session.commit()

def initialize_working_hours(tenant_session):
    existing = tenant_session.query(WorkingHours).count()
    if existing == 0:
        for day in range(7):
            is_working = day < 5
            wh = WorkingHours(
                day_of_week=day,
                start_time=time(8, 0) if is_working else None,
                end_time=time(17, 0) if is_working else None,
                is_working_day=is_working
            )
            tenant_session.add(wh)
        tenant_session.commit()

@router.get("/{org_id}/settings")
async def list_settings(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        initialize_settings(tenant_session)
        settings = tenant_session.query(OrganizationSettings).all()
        return [OrganizationSettingResponse.model_validate(s) for s in settings]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/settings")
async def update_settings_bulk(org_id: str, updates: dict, user=Depends(get_current_user), db: Session = Depends(get_db)):
    from models.master import Organization
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Organization not found")
        
        org_fields = ["working_hours_start", "working_hours_end", "working_days", "enforce_working_hours", 
                      "auto_logout_minutes", "require_two_factor_auth", "currency", "financial_year_start"]
        
        for key, value in updates.items():
            snake_key = key.replace("-", "_")
            
            if snake_key in org_fields:
                if snake_key == "enforce_working_hours" or snake_key == "require_two_factor_auth":
                    setattr(org, snake_key, value.lower() == "true" if isinstance(value, str) else value)
                elif snake_key == "working_hours_start" or snake_key == "working_hours_end":
                    if value:
                        from datetime import time as dt_time
                        parts = value.split(":")
                        setattr(org, snake_key, dt_time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0))
                    else:
                        setattr(org, snake_key, None)
                elif snake_key == "working_days":
                    if isinstance(value, str):
                        setattr(org, snake_key, value.split(",") if value else [])
                    else:
                        setattr(org, snake_key, value)
                else:
                    setattr(org, snake_key, value)
                    if snake_key == "currency":
                        for skey in ["currency", "currency_symbol"]:
                            sval = value if skey == "currency" else updates.get("currency_symbol", value)
                            existing = tenant_session.query(OrganizationSettings).filter(
                                OrganizationSettings.setting_key == skey
                            ).first()
                            if existing:
                                existing.setting_value = str(sval)
                                existing.updated_at = datetime.utcnow()
                            else:
                                tenant_session.add(OrganizationSettings(
                                    setting_key=skey,
                                    setting_value=str(sval),
                                    setting_type="string"
                                ))
            else:
                setting = tenant_session.query(OrganizationSettings).filter(
                    OrganizationSettings.setting_key == key
                ).first()
                
                if setting:
                    setting.setting_value = str(value)
                    setting.updated_at = datetime.utcnow()
                else:
                    setting = OrganizationSettings(
                        setting_key=key,
                        setting_value=str(value),
                        setting_type="string"
                    )
                    tenant_session.add(setting)
        
        db.commit()
        tenant_session.commit()
        
        return {"message": "Settings updated successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/settings/{key}")
async def get_setting(org_id: str, key: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        setting = tenant_session.query(OrganizationSettings).filter(OrganizationSettings.setting_key == key).first()
        if not setting:
            raise HTTPException(status_code=404, detail="Setting not found")
        return OrganizationSettingResponse.model_validate(setting)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/settings/{key}")
async def update_setting(org_id: str, key: str, data: OrganizationSettingCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        setting = tenant_session.query(OrganizationSettings).filter(OrganizationSettings.setting_key == key).first()
        if not setting:
            setting = OrganizationSettings(
                setting_key=key,
                setting_value=data.setting_value,
                setting_type=data.setting_type or "string",
                description=data.description
            )
            tenant_session.add(setting)
        else:
            setting.setting_value = data.setting_value
            if data.setting_type:
                setting.setting_type = data.setting_type
            if data.description:
                setting.description = data.description
            setting.updated_at = datetime.utcnow()
        
        tenant_session.commit()
        tenant_session.refresh(setting)
        return OrganizationSettingResponse.model_validate(setting)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/settings/batch")
async def update_settings_batch(org_id: str, settings: List[OrganizationSettingCreate], user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        updated = []
        for data in settings:
            setting = tenant_session.query(OrganizationSettings).filter(
                OrganizationSettings.setting_key == data.setting_key
            ).first()
            
            if setting:
                setting.setting_value = data.setting_value
                setting.updated_at = datetime.utcnow()
            else:
                setting = OrganizationSettings(
                    setting_key=data.setting_key,
                    setting_value=data.setting_value,
                    setting_type=data.setting_type or "string",
                    description=data.description
                )
                tenant_session.add(setting)
            
            updated.append(data.setting_key)
        
        tenant_session.commit()
        return {"message": f"Updated {len(updated)} settings", "keys": updated}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/working-hours")
async def list_working_hours(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        initialize_working_hours(tenant_session)
        hours = tenant_session.query(WorkingHours).order_by(WorkingHours.day_of_week).all()
        return [WorkingHoursResponse.model_validate(h) for h in hours]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/working-hours/{day_of_week}")
async def update_working_hours(org_id: str, day_of_week: int, data: WorkingHoursCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        if day_of_week < 0 or day_of_week > 6:
            raise HTTPException(status_code=400, detail="Day must be 0-6 (Monday-Sunday)")
        
        wh = tenant_session.query(WorkingHours).filter(WorkingHours.day_of_week == day_of_week).first()
        if not wh:
            wh = WorkingHours(day_of_week=day_of_week)
            tenant_session.add(wh)
        
        wh.start_time = data.start_time
        wh.end_time = data.end_time
        wh.is_working_day = data.is_working_day
        
        tenant_session.commit()
        tenant_session.refresh(wh)
        return WorkingHoursResponse.model_validate(wh)
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/working-hours/check")
async def check_working_hours(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        enforce_setting = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "enforce_working_hours"
        ).first()
        
        if not enforce_setting or enforce_setting.setting_value != "true":
            return {"is_working_time": True, "message": "Working hours not enforced"}
        
        now = datetime.now()
        current_day = now.weekday()
        current_time = now.time()
        
        wh = tenant_session.query(WorkingHours).filter(WorkingHours.day_of_week == current_day).first()
        
        if not wh or not wh.is_working_day:
            return {
                "is_working_time": False,
                "message": "Today is not a working day",
                "current_day": current_day,
                "current_time": current_time.strftime("%H:%M")
            }
        
        if wh.start_time and wh.end_time:
            if wh.start_time <= current_time <= wh.end_time:
                return {
                    "is_working_time": True,
                    "message": "Within working hours",
                    "working_hours": f"{wh.start_time.strftime('%H:%M')} - {wh.end_time.strftime('%H:%M')}"
                }
            else:
                return {
                    "is_working_time": False,
                    "message": "Outside working hours",
                    "working_hours": f"{wh.start_time.strftime('%H:%M')} - {wh.end_time.strftime('%H:%M')}",
                    "current_time": current_time.strftime("%H:%M")
                }
        
        return {"is_working_time": True, "message": "No specific hours set"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/settings/auto-logout")
async def get_auto_logout_settings(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    tenant_session = tenant_ctx.create_session()
    try:
        setting = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "auto_logout_minutes"
        ).first()
        
        minutes = int(setting.setting_value) if setting else 30
        
        return {
            "auto_logout_enabled": True,
            "timeout_minutes": minutes
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()


@router.post("/{org_id}/trigger-auto-deduction")
async def trigger_auto_deduction(
    org_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_role(membership, ["owner", "admin"])
    tenant_session = tenant_ctx.create_session()
    try:
        enabled = tenant_session.query(OrganizationSettings).filter(
            OrganizationSettings.setting_key == "auto_loan_deduction"
        ).first()
        if not enabled or enabled.setting_value.lower() != "true":
            raise HTTPException(status_code=400, detail="Auto loan deduction is not enabled")

        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org or not org.connection_string:
            raise HTTPException(status_code=404, detail="Organization not found")

        tenant_session.close()
        tenant_ctx.close()

        import importlib
        cron_mod = importlib.import_module("cron_auto_loan_deduction")
        result = cron_mod.process_auto_deductions(org_id, org.name, org.connection_string, force=True)

        return {
            "message": "Auto loan deduction completed",
            "deducted": result.get("deducted", 0),
            "skipped": result.get("skipped", 0),
            "errors": result.get("errors", 0),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to run auto deduction: {str(e)}")
    finally:
        try:
            tenant_session.close()
            tenant_ctx.close()
        except Exception:
            pass
