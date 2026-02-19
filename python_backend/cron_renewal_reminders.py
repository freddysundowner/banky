#!/usr/bin/env python3
"""
Cron job to send subscription renewal reminders.
Checks for:
1. Trials expiring within 3 days - remind to upgrade
2. Active subscriptions expiring within 7 days - remind to renew
3. Past-due subscriptions - urgent renewal notice

Usage: python cron_renewal_reminders.py
"""

import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.master import Organization, OrganizationSubscription, OrganizationMember, User


def find_owner_email(session, org_id):
    membership = session.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.is_owner == True
    ).first()
    if membership:
        user = session.query(User).filter(User.id == membership.user_id).first()
        if user:
            return user.email
    return None


def main():
    print(f"=== Renewal Reminders - {datetime.utcnow().date()} ===")
    
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    now = datetime.utcnow()
    trial_reminder_count = 0
    renewal_reminder_count = 0
    pastdue_reminder_count = 0
    
    try:
        trial_cutoff = now + timedelta(days=3)
        expiring_trials = session.query(OrganizationSubscription).filter(
            OrganizationSubscription.status == "trial",
            OrganizationSubscription.trial_ends_at.isnot(None),
            OrganizationSubscription.trial_ends_at > now,
            OrganizationSubscription.trial_ends_at <= trial_cutoff
        ).all()
        
        for sub in expiring_trials:
            org = session.query(Organization).filter(Organization.id == sub.organization_id).first()
            if not org:
                continue
            
            owner_email = find_owner_email(session, org.id)
            days_left = (sub.trial_ends_at - now).days
            days_text = f"{days_left} day{'s' if days_left != 1 else ''}"
            
            print(f"  [TRIAL EXPIRING] {org.name}: {days_text} left, owner: {owner_email or 'unknown'}")
            trial_reminder_count += 1
        
        renewal_cutoff = now + timedelta(days=7)
        expiring_subs = session.query(OrganizationSubscription).filter(
            OrganizationSubscription.status == "active",
            OrganizationSubscription.current_period_end.isnot(None),
            OrganizationSubscription.current_period_end > now,
            OrganizationSubscription.current_period_end <= renewal_cutoff
        ).all()
        
        for sub in expiring_subs:
            org = session.query(Organization).filter(Organization.id == sub.organization_id).first()
            if not org:
                continue
            
            owner_email = find_owner_email(session, org.id)
            days_left = (sub.current_period_end - now).days
            days_text = f"{days_left} day{'s' if days_left != 1 else ''}"
            
            print(f"  [RENEWAL DUE] {org.name}: expires in {days_text}, owner: {owner_email or 'unknown'}")
            renewal_reminder_count += 1
        
        pastdue_subs = session.query(OrganizationSubscription).filter(
            OrganizationSubscription.status == "past_due"
        ).all()
        
        for sub in pastdue_subs:
            org = session.query(Organization).filter(Organization.id == sub.organization_id).first()
            if not org:
                continue
            
            owner_email = find_owner_email(session, org.id)
            days_overdue = (now - sub.current_period_end).days if sub.current_period_end else 0
            
            print(f"  [PAST DUE] {org.name}: {days_overdue} days overdue, owner: {owner_email or 'unknown'}")
            pastdue_reminder_count += 1
        
        print(f"\n=== SUMMARY ===")
        print(f"Trial expiry reminders: {trial_reminder_count}")
        print(f"Renewal reminders: {renewal_reminder_count}")
        print(f"Past-due notices: {pastdue_reminder_count}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        session.rollback()
    finally:
        session.close()


if __name__ == "__main__":
    main()
