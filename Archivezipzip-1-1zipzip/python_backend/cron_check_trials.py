#!/usr/bin/env python3
"""
Cron job script to check and update trial subscription statuses.
Run this script daily to:
1. Expire trials that have passed their trial_ends_at date
2. Mark subscriptions as past_due if payment is overdue
3. Log status changes

Usage: python cron_check_trials.py
"""

import os
import sys
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.master import Organization, OrganizationSubscription

def main():
    print(f"=== Trial Status Check - {date.today()} ===")
    
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set")
        sys.exit(1)
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    now = datetime.utcnow()
    expired_count = 0
    past_due_count = 0
    
    try:
        trial_subscriptions = session.query(OrganizationSubscription).filter(
            OrganizationSubscription.status == "trial",
            OrganizationSubscription.trial_ends_at.isnot(None),
            OrganizationSubscription.trial_ends_at < now
        ).all()
        
        for sub in trial_subscriptions:
            org = session.query(Organization).filter(Organization.id == sub.organization_id).first()
            org_name = org.name if org else "Unknown"
            
            old_status = sub.status
            sub.status = "expired"
            sub.updated_at = now
            
            print(f"  [EXPIRED] {org_name}: trial ended {sub.trial_ends_at.date()}")
            expired_count += 1
        
        active_subscriptions = session.query(OrganizationSubscription).filter(
            OrganizationSubscription.status == "active",
            OrganizationSubscription.current_period_end.isnot(None),
            OrganizationSubscription.current_period_end < now
        ).all()
        
        for sub in active_subscriptions:
            org = session.query(Organization).filter(Organization.id == sub.organization_id).first()
            org_name = org.name if org else "Unknown"
            
            sub.status = "past_due"
            sub.updated_at = now
            
            print(f"  [PAST DUE] {org_name}: payment due since {sub.current_period_end.date()}")
            past_due_count += 1
        
        session.commit()
        
        print(f"\n=== SUMMARY ===")
        print(f"Trials expired: {expired_count}")
        print(f"Subscriptions past due: {past_due_count}")
        
    except Exception as e:
        print(f"ERROR: {e}")
        session.rollback()
        sys.exit(1)
    finally:
        session.close()

if __name__ == "__main__":
    main()
