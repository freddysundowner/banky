from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models.master import Organization, OrganizationMember
from models.tenant import TenantBase

_migrated_tenants = set()
_migration_version = 33  # Increment to force re-migration

def _get_db_migration_version(engine):
    """Check the migration version stored in the tenant database"""
    try:
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = '_migration_meta'
                )
            """))
            if not result.scalar():
                return -1
            result = conn.execute(text("SELECT version FROM _migration_meta LIMIT 1"))
            row = result.fetchone()
            return row[0] if row else -1
    except Exception:
        return -1

def _set_db_migration_version(engine, version):
    """Store the migration version in the tenant database"""
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS _migration_meta (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    version INTEGER NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("DELETE FROM _migration_meta"))
            conn.execute(text(f"INSERT INTO _migration_meta (id, version) VALUES (1, {version})"))
    except Exception as e:
        print(f"Error storing migration version: {e}")

def table_exists(conn, table_name):
    """Check if a table exists"""
    result = conn.execute(text(f"""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = '{table_name}'
        )
    """))
    return result.scalar()

def add_column_if_not_exists(conn, table_name, col_name, col_type):
    """Helper to add a column if it doesn't exist"""
    if not table_exists(conn, table_name):
        return
    result = conn.execute(text(f"""
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = '{table_name}' AND column_name = '{col_name}'
    """))
    if not result.fetchone():
        try:
            conn.execute(text("SAVEPOINT add_col_sp"))
            conn.execute(text("SET LOCAL statement_timeout = '30s'"))
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col_name} {col_type}"))
            conn.execute(text("RELEASE SAVEPOINT add_col_sp"))
        except Exception as e:
            try:
                conn.execute(text("ROLLBACK TO SAVEPOINT add_col_sp"))
            except:
                pass
            print(f"Migration warning: Could not add {table_name}.{col_name}: {e}")

def run_tenant_schema_migration(engine):
    with engine.connect() as conn:
        # Rename old column names
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'staff' AND column_name = 'employee_number'
        """))
        if result.fetchone():
            try:
                conn.execute(text("SAVEPOINT rename_sp1"))
                conn.execute(text("ALTER TABLE staff RENAME COLUMN employee_number TO staff_number"))
                conn.execute(text("RELEASE SAVEPOINT rename_sp1"))
            except Exception:
                try:
                    conn.execute(text("ROLLBACK TO SAVEPOINT rename_sp1"))
                except:
                    pass
        
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'branches' AND column_name = 'location'
        """))
        if result.fetchone():
            try:
                conn.execute(text("SAVEPOINT rename_sp2"))
                conn.execute(text("ALTER TABLE branches RENAME COLUMN location TO address"))
                conn.execute(text("RELEASE SAVEPOINT rename_sp2"))
            except Exception:
                try:
                    conn.execute(text("ROLLBACK TO SAVEPOINT rename_sp2"))
                except:
                    pass
        
        # Staff table columns
        staff_columns = [
            ("staff_number", "VARCHAR(50)"),
            ("first_name", "VARCHAR(100)"),
            ("last_name", "VARCHAR(100)"),
            ("email", "VARCHAR(255)"),
            ("secondary_email", "VARCHAR(255)"),
            ("phone", "VARCHAR(50)"),
            ("role", "VARCHAR(50) DEFAULT 'loan_officer'"),
            ("branch_id", "VARCHAR(255)"),
            ("password_hash", "VARCHAR(255)"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("is_locked", "BOOLEAN DEFAULT FALSE"),
            ("approval_pin", "VARCHAR(255)"),
            ("linked_member_id", "VARCHAR(255)"),
            ("last_login", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in staff_columns:
            add_column_if_not_exists(conn, "staff", col_name, col_type)
        
        # Branch table columns
        branch_columns = [
            ("name", "VARCHAR(255)"),
            ("code", "VARCHAR(50)"),
            ("address", "TEXT"),
            ("phone", "VARCHAR(50)"),
            ("email", "VARCHAR(255)"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in branch_columns:
            add_column_if_not_exists(conn, "branches", col_name, col_type)
        
        # Member table columns - comprehensive banking fields
        member_columns = [
            ("member_number", "VARCHAR(50)"),
            ("first_name", "VARCHAR(100)"),
            ("middle_name", "VARCHAR(100)"),
            ("last_name", "VARCHAR(100)"),
            ("email", "VARCHAR(255)"),
            ("phone", "VARCHAR(50)"),
            ("phone_secondary", "VARCHAR(50)"),
            ("id_type", "VARCHAR(50)"),
            ("id_number", "VARCHAR(50)"),
            ("kra_pin", "VARCHAR(50)"),
            ("date_of_birth", "DATE"),
            ("gender", "VARCHAR(20)"),
            ("marital_status", "VARCHAR(50)"),
            ("nationality", "VARCHAR(100) DEFAULT 'Kenyan'"),
            ("address", "TEXT"),
            ("postal_code", "VARCHAR(20)"),
            ("city", "VARCHAR(100)"),
            ("county", "VARCHAR(100)"),
            ("country", "VARCHAR(100) DEFAULT 'Kenya'"),
            ("next_of_kin_name", "VARCHAR(255)"),
            ("next_of_kin_phone", "VARCHAR(50)"),
            ("next_of_kin_relationship", "VARCHAR(100)"),
            ("next_of_kin_id_number", "VARCHAR(50)"),
            ("next_of_kin_address", "TEXT"),
            ("next_of_kin_2_name", "VARCHAR(255)"),
            ("next_of_kin_2_phone", "VARCHAR(50)"),
            ("next_of_kin_2_relationship", "VARCHAR(100)"),
            ("employment_status", "VARCHAR(50)"),
            ("employer_name", "VARCHAR(255)"),
            ("employer_address", "TEXT"),
            ("employer_phone", "VARCHAR(50)"),
            ("occupation", "VARCHAR(255)"),
            ("monthly_income", "NUMERIC(15,2)"),
            ("employment_date", "DATE"),
            ("bank_name", "VARCHAR(255)"),
            ("bank_branch", "VARCHAR(255)"),
            ("bank_account_number", "VARCHAR(100)"),
            ("bank_account_name", "VARCHAR(255)"),
            ("branch_id", "VARCHAR(255)"),
            ("membership_type", "VARCHAR(50) DEFAULT 'ordinary'"),
            ("registration_fee_paid", "NUMERIC(15,2) DEFAULT 0"),
            ("share_capital", "NUMERIC(15,2) DEFAULT 0"),
            ("savings_balance", "NUMERIC(15,2) DEFAULT 0"),
            ("shares_balance", "NUMERIC(15,2) DEFAULT 0"),
            ("deposits_balance", "NUMERIC(15,2) DEFAULT 0"),
            ("status", "VARCHAR(50) DEFAULT 'active'"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("joined_at", "TIMESTAMP DEFAULT NOW()"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
            ("created_by_id", "VARCHAR(255)"),
            ("photo_url", "TEXT"),
            ("id_document_url", "TEXT"),
            ("signature_url", "TEXT"),
        ]
        for col_name, col_type in member_columns:
            add_column_if_not_exists(conn, "members", col_name, col_type)
        
        # Loan product columns
        loan_product_columns = [
            ("name", "VARCHAR(255)"),
            ("code", "VARCHAR(50)"),
            ("description", "TEXT"),
            ("interest_rate", "NUMERIC(10,4)"),
            ("interest_type", "VARCHAR(50) DEFAULT 'reducing_balance'"),
            ("repayment_frequency", "VARCHAR(50) DEFAULT 'monthly'"),
            ("min_amount", "NUMERIC(15,2)"),
            ("max_amount", "NUMERIC(15,2)"),
            ("min_term_months", "INTEGER DEFAULT 1"),
            ("max_term_months", "INTEGER DEFAULT 60"),
            ("processing_fee", "NUMERIC(10,4) DEFAULT 0"),
            ("insurance_fee", "NUMERIC(10,4) DEFAULT 0"),
            ("late_payment_penalty", "NUMERIC(10,4) DEFAULT 0"),
            ("grace_period_days", "INTEGER DEFAULT 0"),
            ("requires_guarantor", "BOOLEAN DEFAULT FALSE"),
            ("min_guarantors", "INTEGER DEFAULT 0"),
            ("max_guarantors", "INTEGER DEFAULT 3"),
            ("shares_multiplier", "NUMERIC(5,2) DEFAULT 3"),
            ("min_shares_required", "NUMERIC(15,2) DEFAULT 0"),
            ("interest_rate_period", "VARCHAR(20) DEFAULT 'monthly'"),
            ("deduct_interest_upfront", "BOOLEAN DEFAULT FALSE"),
            ("appraisal_fee", "NUMERIC(10,4) DEFAULT 0"),
            ("excise_duty_rate", "NUMERIC(10,4) DEFAULT 20"),
            ("credit_life_insurance_rate", "NUMERIC(10,4) DEFAULT 0"),
            ("credit_life_insurance_freq", "VARCHAR(20) DEFAULT 'annual'"),
            ("allow_multiple_loans", "BOOLEAN DEFAULT TRUE"),
            ("require_good_standing", "BOOLEAN DEFAULT FALSE"),
            ("requires_collateral", "BOOLEAN DEFAULT FALSE"),
            ("min_ltv_coverage", "NUMERIC(5,2) DEFAULT 0"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in loan_product_columns:
            add_column_if_not_exists(conn, "loan_products", col_name, col_type)
        
        # Loan application columns
        loan_app_columns = [
            ("application_number", "VARCHAR(50)"),
            ("member_id", "VARCHAR(255)"),
            ("loan_product_id", "VARCHAR(255)"),
            ("amount", "NUMERIC(15,2)"),
            ("term_months", "INTEGER"),
            ("interest_rate", "NUMERIC(10,4)"),
            ("total_interest", "NUMERIC(15,2)"),
            ("total_repayment", "NUMERIC(15,2)"),
            ("monthly_repayment", "NUMERIC(15,2)"),
            ("processing_fee", "NUMERIC(15,2) DEFAULT 0"),
            ("insurance_fee", "NUMERIC(15,2) DEFAULT 0"),
            ("appraisal_fee", "NUMERIC(15,2) DEFAULT 0"),
            ("excise_duty", "NUMERIC(15,2) DEFAULT 0"),
            ("total_fees", "NUMERIC(15,2) DEFAULT 0"),
            ("credit_life_insurance_rate", "NUMERIC(10,4) DEFAULT 0"),
            ("credit_life_insurance_freq", "VARCHAR(20) DEFAULT 'annual'"),
            ("total_insurance", "NUMERIC(15,2) DEFAULT 0"),
            ("status", "VARCHAR(50) DEFAULT 'pending'"),
            ("purpose", "TEXT"),
            ("rejection_reason", "TEXT"),
            ("disbursement_method", "VARCHAR(50)"),
            ("disbursement_account", "VARCHAR(255)"),
            ("disbursement_phone", "VARCHAR(50)"),
            ("amount_disbursed", "NUMERIC(15,2)"),
            ("amount_repaid", "NUMERIC(15,2) DEFAULT 0"),
            ("outstanding_balance", "NUMERIC(15,2)"),
            ("next_payment_date", "DATE"),
            ("last_payment_date", "DATE"),
            ("is_restructured", "BOOLEAN DEFAULT FALSE"),
            ("interest_deducted_upfront", "BOOLEAN DEFAULT FALSE"),
            ("original_loan_id", "VARCHAR(255)"),
            ("created_by_id", "VARCHAR(255)"),
            ("reviewed_by_id", "VARCHAR(255)"),
            ("applied_at", "TIMESTAMP DEFAULT NOW()"),
            ("approved_at", "TIMESTAMP"),
            ("rejected_at", "TIMESTAMP"),
            ("disbursed_at", "TIMESTAMP"),
            ("closed_at", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in loan_app_columns:
            add_column_if_not_exists(conn, "loan_applications", col_name, col_type)
        
        # Loan guarantor columns
        guarantor_columns = [
            ("loan_id", "VARCHAR(255)"),
            ("guarantor_id", "VARCHAR(255)"),
            ("amount_guaranteed", "NUMERIC(15,2)"),
            ("guarantee_percentage", "NUMERIC(5,2)"),
            ("relationship_to_borrower", "VARCHAR(100)"),
            ("guarantor_savings_at_guarantee", "NUMERIC(15,2)"),
            ("guarantor_shares_at_guarantee", "NUMERIC(15,2)"),
            ("guarantor_total_exposure_at_guarantee", "NUMERIC(15,2)"),
            ("available_guarantee_capacity", "NUMERIC(15,2)"),
            ("status", "VARCHAR(50) DEFAULT 'pending'"),
            ("rejection_reason", "TEXT"),
            ("accepted_at", "TIMESTAMP"),
            ("rejected_at", "TIMESTAMP"),
            ("released_at", "TIMESTAMP"),
            ("called_at", "TIMESTAMP"),
            ("amount_recovered", "NUMERIC(15,2) DEFAULT 0"),
            ("consent_given", "BOOLEAN DEFAULT FALSE"),
            ("consent_date", "TIMESTAMP"),
            ("consent_method", "VARCHAR(50)"),
            ("added_by_id", "VARCHAR(255)"),
            ("verified_by_id", "VARCHAR(255)"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
            ("updated_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in guarantor_columns:
            add_column_if_not_exists(conn, "loan_guarantors", col_name, col_type)
        
        # Loan repayment columns
        repayment_columns = [
            ("repayment_number", "VARCHAR(50)"),
            ("loan_id", "VARCHAR(255)"),
            ("amount", "NUMERIC(15,2)"),
            ("principal_amount", "NUMERIC(15,2) DEFAULT 0"),
            ("interest_amount", "NUMERIC(15,2) DEFAULT 0"),
            ("penalty_amount", "NUMERIC(15,2) DEFAULT 0"),
            ("payment_method", "VARCHAR(50)"),
            ("reference", "VARCHAR(255)"),
            ("notes", "TEXT"),
            ("received_by_id", "VARCHAR(255)"),
            ("payment_date", "TIMESTAMP DEFAULT NOW()"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in repayment_columns:
            add_column_if_not_exists(conn, "loan_repayments", col_name, col_type)
        
        # Loan restructure columns
        restructure_columns = [
            ("loan_id", "VARCHAR(255)"),
            ("restructure_type", "VARCHAR(50)"),
            ("old_term_months", "INTEGER"),
            ("new_term_months", "INTEGER"),
            ("old_interest_rate", "NUMERIC(10,4)"),
            ("new_interest_rate", "NUMERIC(10,4)"),
            ("old_monthly_repayment", "NUMERIC(15,2)"),
            ("new_monthly_repayment", "NUMERIC(15,2)"),
            ("penalty_waived", "NUMERIC(15,2) DEFAULT 0"),
            ("grace_period_days", "INTEGER DEFAULT 0"),
            ("reason", "TEXT"),
            ("approved_by_id", "VARCHAR(255)"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in restructure_columns:
            add_column_if_not_exists(conn, "loan_restructures", col_name, col_type)
        
        # Transaction columns
        transaction_columns = [
            ("transaction_number", "VARCHAR(50)"),
            ("member_id", "VARCHAR(255)"),
            ("transaction_type", "VARCHAR(50)"),
            ("account_type", "VARCHAR(50)"),
            ("amount", "NUMERIC(15,2)"),
            ("balance_before", "NUMERIC(15,2)"),
            ("balance_after", "NUMERIC(15,2)"),
            ("payment_method", "VARCHAR(50)"),
            ("reference", "VARCHAR(255)"),
            ("description", "TEXT"),
            ("processed_by_id", "VARCHAR(255)"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in transaction_columns:
            add_column_if_not_exists(conn, "transactions", col_name, col_type)
        
        # SMS notification columns
        sms_columns = [
            ("notification_type", "VARCHAR(50)"),
            ("recipient_phone", "VARCHAR(50)"),
            ("recipient_name", "VARCHAR(255)"),
            ("member_id", "VARCHAR(255)"),
            ("loan_id", "VARCHAR(255)"),
            ("message", "TEXT"),
            ("status", "VARCHAR(50) DEFAULT 'pending'"),
            ("sent_at", "TIMESTAMP"),
            ("delivered_at", "TIMESTAMP"),
            ("error_message", "TEXT"),
            ("is_read", "BOOLEAN DEFAULT FALSE"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in sms_columns:
            add_column_if_not_exists(conn, "sms_notifications", col_name, col_type)
        
        # SMS template columns
        template_columns = [
            ("name", "VARCHAR(255)"),
            ("template_type", "VARCHAR(50)"),
            ("message_template", "TEXT"),
            ("is_active", "BOOLEAN DEFAULT TRUE"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in template_columns:
            add_column_if_not_exists(conn, "sms_templates", col_name, col_type)
        
        # Audit log columns
        audit_columns = [
            ("staff_id", "VARCHAR(255)"),
            ("action", "VARCHAR(100)"),
            ("entity_type", "VARCHAR(100)"),
            ("entity_id", "VARCHAR(255)"),
            ("old_values", "JSONB"),
            ("new_values", "JSONB"),
            ("ip_address", "VARCHAR(50)"),
            ("user_agent", "TEXT"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in audit_columns:
            add_column_if_not_exists(conn, "audit_logs", col_name, col_type)
        
        # Performance review columns
        review_columns = [
            ("staff_id", "VARCHAR(255)"),
            ("review_period_start", "DATE"),
            ("review_period_end", "DATE"),
            ("loans_processed", "INTEGER DEFAULT 0"),
            ("loans_approved", "INTEGER DEFAULT 0"),
            ("loans_rejected", "INTEGER DEFAULT 0"),
            ("total_disbursed", "NUMERIC(15,2) DEFAULT 0"),
            ("total_collected", "NUMERIC(15,2) DEFAULT 0"),
            ("default_rate", "NUMERIC(10,4) DEFAULT 0"),
            ("rating", "INTEGER"),
            ("comments", "TEXT"),
            ("reviewed_by_id", "VARCHAR(255)"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in review_columns:
            add_column_if_not_exists(conn, "performance_reviews", col_name, col_type)
        
        # Organization settings columns
        settings_columns = [
            ("setting_key", "VARCHAR(100)"),
            ("setting_value", "TEXT"),
            ("setting_type", "VARCHAR(50) DEFAULT 'string'"),
            ("description", "TEXT"),
            ("updated_at", "TIMESTAMP DEFAULT NOW()"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in settings_columns:
            add_column_if_not_exists(conn, "organization_settings", col_name, col_type)
        
        # Working hours columns
        hours_columns = [
            ("day_of_week", "INTEGER"),
            ("start_time", "TIME"),
            ("end_time", "TIME"),
            ("is_working_day", "BOOLEAN DEFAULT TRUE"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in hours_columns:
            add_column_if_not_exists(conn, "working_hours", col_name, col_type)
        
        # Loan default columns
        default_columns = [
            ("loan_id", "VARCHAR(255)"),
            ("days_overdue", "INTEGER"),
            ("amount_overdue", "NUMERIC(15,2)"),
            ("penalty_amount", "NUMERIC(15,2) DEFAULT 0"),
            ("status", "VARCHAR(50) DEFAULT 'overdue'"),
            ("collection_notes", "TEXT"),
            ("last_contact_date", "TIMESTAMP"),
            ("next_action_date", "TIMESTAMP"),
            ("assigned_to_id", "VARCHAR(255)"),
            ("resolved_at", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in default_columns:
            add_column_if_not_exists(conn, "loan_defaults", col_name, col_type)
        
        # Fix NULL values for existing loan products
        conn.execute(text("UPDATE loan_products SET min_term_months = 1 WHERE min_term_months IS NULL"))
        conn.execute(text("UPDATE loan_products SET max_term_months = 60 WHERE max_term_months IS NULL"))
        
        # Teller float columns
        float_columns = [
            ("staff_id", "VARCHAR(255)"),
            ("branch_id", "VARCHAR(255)"),
            ("date", "DATE"),
            ("opening_balance", "NUMERIC(15,2) DEFAULT 0"),
            ("current_balance", "NUMERIC(15,2) DEFAULT 0"),
            ("deposits_in", "NUMERIC(15,2) DEFAULT 0"),
            ("withdrawals_out", "NUMERIC(15,2) DEFAULT 0"),
            ("replenishments", "NUMERIC(15,2) DEFAULT 0"),
            ("returns_to_vault", "NUMERIC(15,2) DEFAULT 0"),
            ("closing_balance", "NUMERIC(15,2)"),
            ("physical_count", "NUMERIC(15,2)"),
            ("variance", "NUMERIC(15,2)"),
            ("status", "VARCHAR(50) DEFAULT 'active'"),
            ("reconciled_at", "TIMESTAMP"),
            ("reconciled_by_id", "VARCHAR(255)"),
            ("notes", "TEXT"),
            ("returned_to_vault", "BOOLEAN DEFAULT FALSE"),
            ("counter_number", "VARCHAR(20)"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
            ("updated_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in float_columns:
            add_column_if_not_exists(conn, "teller_floats", col_name, col_type)
        
        # Float transaction columns
        float_tx_columns = [
            ("float_id", "VARCHAR(255)"),
            ("transaction_type", "VARCHAR(50)"),
            ("amount", "NUMERIC(15,2)"),
            ("balance_before", "NUMERIC(15,2)"),
            ("balance_after", "NUMERIC(15,2)"),
            ("reference", "VARCHAR(255)"),
            ("notes", "TEXT"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in float_tx_columns:
            add_column_if_not_exists(conn, "float_transactions", col_name, col_type)
        
        # Float replenishment request columns
        replenish_columns = [
            ("float_id", "VARCHAR(255)"),
            ("staff_id", "VARCHAR(255)"),
            ("amount", "NUMERIC(15,2)"),
            ("reason", "TEXT"),
            ("status", "VARCHAR(50) DEFAULT 'pending'"),
            ("reviewed_by_id", "VARCHAR(255)"),
            ("reviewed_at", "TIMESTAMP"),
            ("notes", "TEXT"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in replenish_columns:
            add_column_if_not_exists(conn, "float_replenishment_requests", col_name, col_type)
        
        # Branch vault columns
        vault_columns = [
            ("branch_id", "VARCHAR(255)"),
            ("current_balance", "NUMERIC(15,2) DEFAULT 0"),
            ("last_updated", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in vault_columns:
            add_column_if_not_exists(conn, "branch_vaults", col_name, col_type)
        
        # Vault transaction columns
        vault_tx_columns = [
            ("vault_id", "VARCHAR(255)"),
            ("transaction_type", "VARCHAR(50)"),
            ("amount", "NUMERIC(15,2)"),
            ("balance_before", "NUMERIC(15,2)"),
            ("balance_after", "NUMERIC(15,2)"),
            ("source", "VARCHAR(100)"),
            ("reference", "VARCHAR(255)"),
            ("notes", "TEXT"),
            ("processed_by_id", "VARCHAR(255)"),
            ("related_float_id", "VARCHAR(255)"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in vault_tx_columns:
            add_column_if_not_exists(conn, "vault_transactions", col_name, col_type)
        
        # Pending vault return columns
        pending_return_columns = [
            ("float_id", "VARCHAR(255)"),
            ("staff_id", "VARCHAR(255)"),
            ("branch_id", "VARCHAR(255)"),
            ("amount", "NUMERIC(15,2)"),
            ("status", "VARCHAR(50) DEFAULT 'pending'"),
            ("reviewed_by_id", "VARCHAR(255)"),
            ("reviewed_at", "TIMESTAMP"),
            ("notes", "TEXT"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in pending_return_columns:
            add_column_if_not_exists(conn, "pending_vault_returns", col_name, col_type)
        
        # Shortage record split distribution columns
        add_column_if_not_exists(conn, "shortage_records", "parent_shortage_id", "VARCHAR(255)")
        add_column_if_not_exists(conn, "shortage_records", "distributions", "TEXT")
        
        # Salary deduction columns
        add_column_if_not_exists(conn, "salary_deductions", "pay_period", "VARCHAR(20)")
        
        # Add unique constraint on teller_floats (staff_id, date) for existing databases
        try:
            conn.execute(text("SAVEPOINT uq_constraint_sp"))
            conn.execute(text("""
                DO $$ BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'uq_teller_float_staff_date'
                    ) THEN
                        ALTER TABLE teller_floats ADD CONSTRAINT uq_teller_float_staff_date UNIQUE (staff_id, date);
                    END IF;
                END $$;
            """))
            conn.execute(text("RELEASE SAVEPOINT uq_constraint_sp"))
        except Exception:
            try:
                conn.execute(text("ROLLBACK TO SAVEPOINT uq_constraint_sp"))
            except:
                pass
        
        # Shift handover columns
        handover_columns = [
            ("from_staff_id", "VARCHAR(255)"),
            ("to_staff_id", "VARCHAR(255)"),
            ("branch_id", "VARCHAR(255)"),
            ("from_float_id", "VARCHAR(255)"),
            ("to_float_id", "VARCHAR(255)"),
            ("amount", "NUMERIC(15,2)"),
            ("status", "VARCHAR(50) DEFAULT 'pending'"),
            ("notes", "TEXT"),
            ("acknowledged_at", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in handover_columns:
            add_column_if_not_exists(conn, "shift_handovers", col_name, col_type)
        
        # Member pending balance columns for cheques
        member_pending_columns = [
            ("savings_pending", "NUMERIC(15,2) DEFAULT 0"),
            ("shares_pending", "NUMERIC(15,2) DEFAULT 0"),
            ("deposits_pending", "NUMERIC(15,2) DEFAULT 0"),
        ]
        for col_name, col_type in member_pending_columns:
            add_column_if_not_exists(conn, "members", col_name, col_type)
        
        # M-Pesa payments table
        if not table_exists(conn, "mpesa_payments"):
            conn.execute(text("""
                CREATE TABLE mpesa_payments (
                    id VARCHAR(255) PRIMARY KEY,
                    trans_id VARCHAR(100) UNIQUE NOT NULL,
                    trans_time VARCHAR(50),
                    amount NUMERIC(15,2) NOT NULL,
                    phone_number VARCHAR(20),
                    bill_ref_number VARCHAR(100),
                    first_name VARCHAR(100),
                    middle_name VARCHAR(100),
                    last_name VARCHAR(100),
                    org_account_balance NUMERIC(15,2),
                    transaction_type VARCHAR(50),
                    member_id VARCHAR(255),
                    status VARCHAR(50) DEFAULT 'pending',
                    credited_by_id VARCHAR(255),
                    credited_at TIMESTAMP,
                    transaction_id VARCHAR(255),
                    notes TEXT,
                    raw_payload JSONB,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
        
        # Cheque deposits table
        if not table_exists(conn, "cheque_deposits"):
            conn.execute(text("""
                CREATE TABLE cheque_deposits (
                    id VARCHAR(255) PRIMARY KEY,
                    member_id VARCHAR(255) NOT NULL,
                    cheque_number VARCHAR(50) NOT NULL,
                    bank_name VARCHAR(100),
                    bank_branch VARCHAR(100),
                    drawer_name VARCHAR(200),
                    amount NUMERIC(15,2) NOT NULL,
                    account_type VARCHAR(50) DEFAULT 'savings',
                    status VARCHAR(50) DEFAULT 'pending',
                    deposit_date DATE NOT NULL,
                    expected_clearance_date DATE,
                    cleared_date DATE,
                    bounced_reason TEXT,
                    deposited_by_id VARCHAR(255),
                    cleared_by_id VARCHAR(255),
                    transaction_id VARCHAR(255),
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
        
        # Bank transfers table
        if not table_exists(conn, "bank_transfers"):
            conn.execute(text("""
                CREATE TABLE bank_transfers (
                    id VARCHAR(255) PRIMARY KEY,
                    member_id VARCHAR(255),
                    transfer_type VARCHAR(50) NOT NULL,
                    amount NUMERIC(15,2) NOT NULL,
                    bank_name VARCHAR(100),
                    bank_account VARCHAR(50),
                    bank_reference VARCHAR(100),
                    account_type VARCHAR(50) DEFAULT 'savings',
                    status VARCHAR(50) DEFAULT 'pending',
                    transfer_date DATE,
                    verified_by_id VARCHAR(255),
                    verified_at TIMESTAMP,
                    credited_by_id VARCHAR(255),
                    credited_at TIMESTAMP,
                    transaction_id VARCHAR(255),
                    notes TEXT,
                    rejection_reason TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
        
        # Queue tickets table
        if not table_exists(conn, "queue_tickets"):
            conn.execute(text("""
                CREATE TABLE queue_tickets (
                    id VARCHAR(255) PRIMARY KEY,
                    ticket_number VARCHAR(20) NOT NULL,
                    branch_id VARCHAR(255) NOT NULL,
                    service_category VARCHAR(50) NOT NULL,
                    member_id VARCHAR(255),
                    member_name VARCHAR(200),
                    member_phone VARCHAR(20),
                    status VARCHAR(50) DEFAULT 'waiting',
                    priority INTEGER DEFAULT 0,
                    teller_id VARCHAR(255),
                    counter_number VARCHAR(20),
                    called_at TIMESTAMP,
                    started_at TIMESTAMP,
                    completed_at TIMESTAMP,
                    wait_time_seconds INTEGER,
                    service_time_seconds INTEGER,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
        
        # Transaction receipts table
        if not table_exists(conn, "transaction_receipts"):
            conn.execute(text("""
                CREATE TABLE transaction_receipts (
                    id VARCHAR(255) PRIMARY KEY,
                    receipt_number VARCHAR(50) UNIQUE NOT NULL,
                    transaction_id VARCHAR(255) NOT NULL,
                    member_id VARCHAR(255) NOT NULL,
                    printed BOOLEAN DEFAULT FALSE,
                    printed_at TIMESTAMP,
                    printed_by_id VARCHAR(255),
                    sms_sent BOOLEAN DEFAULT FALSE,
                    sms_sent_at TIMESTAMP,
                    sms_phone VARCHAR(20),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
        
        # Member fixed deposits rollover columns
        fd_rollover_columns = [
            ("auto_rollover", "BOOLEAN DEFAULT FALSE"),
            ("rollover_count", "INTEGER DEFAULT 0"),
            ("parent_deposit_id", "VARCHAR(255)"),
        ]
        for col_name, col_type in fd_rollover_columns:
            add_column_if_not_exists(conn, "member_fixed_deposits", col_name, col_type)
        
        # Accounting Module Tables
        
        # Chart of Accounts
        if not table_exists(conn, "chart_of_accounts"):
            conn.execute(text("""
                CREATE TABLE chart_of_accounts (
                    id VARCHAR(255) PRIMARY KEY,
                    code VARCHAR(20) UNIQUE NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    account_type VARCHAR(20) NOT NULL,
                    parent_id VARCHAR(255) REFERENCES chart_of_accounts(id),
                    description TEXT,
                    normal_balance VARCHAR(10) DEFAULT 'debit',
                    is_system BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    is_header BOOLEAN DEFAULT FALSE,
                    current_balance NUMERIC(15,2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("CREATE INDEX idx_coa_code ON chart_of_accounts(code)"))
            conn.execute(text("CREATE INDEX idx_coa_type ON chart_of_accounts(account_type)"))
        
        # Fiscal Periods
        if not table_exists(conn, "fiscal_periods"):
            conn.execute(text("""
                CREATE TABLE fiscal_periods (
                    id VARCHAR(255) PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    period_type VARCHAR(20) DEFAULT 'month',
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    status VARCHAR(20) DEFAULT 'open',
                    closed_at TIMESTAMP,
                    closed_by_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("CREATE INDEX idx_fp_dates ON fiscal_periods(start_date, end_date)"))
        
        # Journal Entries
        if not table_exists(conn, "journal_entries"):
            conn.execute(text("""
                CREATE TABLE journal_entries (
                    id VARCHAR(255) PRIMARY KEY,
                    entry_number VARCHAR(50) UNIQUE NOT NULL,
                    entry_date DATE NOT NULL,
                    description TEXT NOT NULL,
                    reference VARCHAR(255),
                    source_type VARCHAR(50),
                    source_id VARCHAR(255),
                    is_reversed BOOLEAN DEFAULT FALSE,
                    reversed_by_id VARCHAR(255),
                    reversal_of_id VARCHAR(255),
                    status VARCHAR(20) DEFAULT 'posted',
                    total_debit NUMERIC(15,2) DEFAULT 0,
                    total_credit NUMERIC(15,2) DEFAULT 0,
                    fiscal_period_id VARCHAR(255) REFERENCES fiscal_periods(id),
                    created_by_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("CREATE INDEX idx_je_date ON journal_entries(entry_date)"))
            conn.execute(text("CREATE INDEX idx_je_source ON journal_entries(source_type, source_id)"))
            conn.execute(text("CREATE INDEX idx_je_number ON journal_entries(entry_number)"))
        
        # Journal Lines
        if not table_exists(conn, "journal_lines"):
            conn.execute(text("""
                CREATE TABLE journal_lines (
                    id VARCHAR(255) PRIMARY KEY,
                    journal_entry_id VARCHAR(255) NOT NULL REFERENCES journal_entries(id),
                    account_id VARCHAR(255) NOT NULL REFERENCES chart_of_accounts(id),
                    debit NUMERIC(15,2) DEFAULT 0,
                    credit NUMERIC(15,2) DEFAULT 0,
                    memo TEXT,
                    member_id VARCHAR(255),
                    loan_id VARCHAR(255),
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))
            conn.execute(text("CREATE INDEX idx_jl_account ON journal_lines(account_id)"))
            conn.execute(text("CREATE INDEX idx_jl_entry ON journal_lines(journal_entry_id)"))
        
        # Add emailed_at column to payslips if missing
        add_column_if_not_exists(conn, "payslips", "emailed_at", "TIMESTAMP")
        add_column_if_not_exists(conn, "payslips", "advance_deductions", "NUMERIC(15,2) DEFAULT 0")
        
        # Make issued_by_id nullable in disciplinary_records (for owners without staff record)
        if table_exists(conn, "disciplinary_records"):
            try:
                conn.execute(text("SAVEPOINT disc_sp"))
                conn.execute(text("ALTER TABLE disciplinary_records ALTER COLUMN issued_by_id DROP NOT NULL"))
                conn.execute(text("RELEASE SAVEPOINT disc_sp"))
            except Exception:
                try:
                    conn.execute(text("ROLLBACK TO SAVEPOINT disc_sp"))
                except:
                    pass
        
        # Loan instalment columns migration
        instalment_columns = [
            ("loan_id", "VARCHAR(255)"),
            ("instalment_number", "INTEGER"),
            ("due_date", "DATE"),
            ("expected_principal", "NUMERIC(15,2) DEFAULT 0"),
            ("expected_interest", "NUMERIC(15,2) DEFAULT 0"),
            ("expected_penalty", "NUMERIC(15,2) DEFAULT 0"),
            ("expected_insurance", "NUMERIC(15,2) DEFAULT 0"),
            ("paid_principal", "NUMERIC(15,2) DEFAULT 0"),
            ("paid_interest", "NUMERIC(15,2) DEFAULT 0"),
            ("paid_penalty", "NUMERIC(15,2) DEFAULT 0"),
            ("paid_insurance", "NUMERIC(15,2) DEFAULT 0"),
            ("status", "VARCHAR(20) DEFAULT 'pending'"),
            ("paid_at", "TIMESTAMP"),
            ("created_at", "TIMESTAMP DEFAULT NOW()"),
        ]
        for col_name, col_type in instalment_columns:
            add_column_if_not_exists(conn, "loan_instalments", col_name, col_type)
        
        add_column_if_not_exists(conn, "expenses", "created_by_admin_name", "VARCHAR(200)")
        if table_exists(conn, "expenses"):
            try:
                conn.execute(text("SAVEPOINT exp_sp"))
                conn.execute(text("ALTER TABLE expenses ALTER COLUMN created_by_id DROP NOT NULL"))
                conn.execute(text("RELEASE SAVEPOINT exp_sp"))
            except Exception:
                try:
                    conn.execute(text("ROLLBACK TO SAVEPOINT exp_sp"))
                except:
                    pass
        
        # Mobile Banking columns
        mobile_member_columns = [
            ("mobile_banking_active", "BOOLEAN DEFAULT FALSE"),
            ("mobile_activation_code", "VARCHAR(20)"),
            ("mobile_activation_expires_at", "TIMESTAMP"),
            ("mobile_device_id", "VARCHAR(255)"),
            # PIN hash (PBKDF2), OTP fields — added in later revision; must be here
            ("pin_hash", "VARCHAR(255)"),
            ("otp_code", "VARCHAR(10)"),
            ("otp_expires_at", "TIMESTAMP"),
        ]
        for col_name, col_type in mobile_member_columns:
            add_column_if_not_exists(conn, "members", col_name, col_type)

        # Mobile sessions table
        if not table_exists(conn, "mobile_sessions"):
            conn.execute(text("""
                CREATE TABLE mobile_sessions (
                    id VARCHAR(255) PRIMARY KEY,
                    member_id VARCHAR(255) NOT NULL,
                    device_id VARCHAR(255) NOT NULL,
                    device_name VARCHAR(255),
                    ip_address VARCHAR(100),
                    session_token VARCHAR(255),
                    login_at TIMESTAMP DEFAULT NOW(),
                    last_active TIMESTAMP DEFAULT NOW(),
                    is_active BOOLEAN DEFAULT TRUE,
                    logout_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            """))

        # Index for O(1) session token lookups (auth on every request and logout)
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mobile_sessions_token
            ON mobile_sessions(session_token)
        """))
        # Index for per-member session management (admin deactivate, activity view)
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_mobile_sessions_member
            ON mobile_sessions(member_id)
        """))

        # Collateral indexes (v29)
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_collateral_items_loan ON collateral_items(loan_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_collateral_items_status ON collateral_items(status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_collateral_items_type ON collateral_items(collateral_type_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_collateral_items_revaluation ON collateral_items(next_revaluation_date)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_collateral_insurance_item ON collateral_insurance(collateral_item_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_collateral_insurance_expiry ON collateral_insurance(expiry_date, status)"))

        # v31: Approved valuers registry + valuation document attachment
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS valuers (
                id VARCHAR PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                license_number VARCHAR(100),
                contact_phone VARCHAR(50),
                contact_email VARCHAR(200),
                physical_address TEXT,
                notes TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.execute(text("ALTER TABLE collateral_items ADD COLUMN IF NOT EXISTS valuer_id VARCHAR REFERENCES valuers(id)"))
        conn.execute(text("ALTER TABLE collateral_items ADD COLUMN IF NOT EXISTS valuation_document_path VARCHAR"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_collateral_items_valuer ON collateral_items(valuer_id)"))

        # v32: Location field on valuers
        conn.execute(text("ALTER TABLE valuers ADD COLUMN IF NOT EXISTS location VARCHAR(200)"))

        # v33: Collateral deficient flag on loan applications
        conn.execute(text("ALTER TABLE loan_applications ADD COLUMN IF NOT EXISTS collateral_deficient BOOLEAN DEFAULT FALSE"))

        conn.commit()
    
    try:
        from sqlalchemy.orm import Session as OrmSession
        from models.tenant import LoanApplication, LoanProduct, LoanInstalment
        session = OrmSession(bind=engine)
        
        disbursed_loans = session.query(LoanApplication).filter(
            LoanApplication.status.in_(["disbursed", "paid"])
        ).all()
        
        for loan in disbursed_loans:
            existing = session.query(LoanInstalment).filter(
                LoanInstalment.loan_id == str(loan.id)
            ).count()
            if existing == 0:
                product = session.query(LoanProduct).filter(
                    LoanProduct.id == loan.loan_product_id
                ).first()
                if product:
                    from services.instalment_service import backfill_instalments_for_loan
                    backfill_instalments_for_loan(session, loan, product)
        
        session.commit()
        session.close()
    except Exception as e:
        print(f"Instalment backfill error: {e}")

_engine_cache = {}
_session_factory_cache = {}

def _get_cached_engine(connection_string: str):
    if connection_string not in _engine_cache:
        connect_args = {}
        if "neon" in connection_string or "neon.tech" in connection_string:
            connect_args["connect_timeout"] = 10
            connect_args["options"] = "-c statement_timeout=30000"
        _engine_cache[connection_string] = create_engine(
            connection_string,
            pool_size=5,
            max_overflow=10,
            pool_recycle=600,
            pool_pre_ping=False,
            pool_timeout=30,
            pool_use_lifo=True,
            connect_args=connect_args,
        )
    return _engine_cache[connection_string]

def _get_cached_session_factory(connection_string: str):
    if connection_string not in _session_factory_cache:
        engine = _get_cached_engine(connection_string)
        _session_factory_cache[connection_string] = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return _session_factory_cache[connection_string]

class TenantContext:
    def __init__(self, connection_string: str):
        self.connection_string = connection_string
        self.engine = _get_cached_engine(connection_string)
        self.SessionLocal = _get_cached_session_factory(connection_string)
        
        if connection_string not in _migrated_tenants:
            db_version = _get_db_migration_version(self.engine)
            if db_version >= _migration_version:
                _migrated_tenants.add(connection_string)
            else:
                try:
                    print(f"  Migration needed: db version {db_version} < current {_migration_version}")
                    TenantBase.metadata.create_all(bind=self.engine)
                    run_tenant_schema_migration(self.engine)
                    self._seed_sms_templates()
                    _set_db_migration_version(self.engine, _migration_version)
                    _migrated_tenants.add(connection_string)
                except Exception as e:
                    print(f"Tenant migration error: {e}")
    
    def _seed_sms_templates(self):
        try:
            from models.tenant import SMSTemplate
            from routes.sms import DEFAULT_SMS_TEMPLATES
            session = self.SessionLocal()
            created = 0
            for tpl in DEFAULT_SMS_TEMPLATES:
                existing = session.query(SMSTemplate).filter(
                    SMSTemplate.template_type == tpl["template_type"],
                    SMSTemplate.is_active == True
                ).first()
                if not existing:
                    session.add(SMSTemplate(
                        name=tpl["name"],
                        template_type=tpl["template_type"],
                        message_template=tpl["message_template"]
                    ))
                    created += 1
            if created:
                session.commit()
            session.close()
        except Exception as e:
            print(f"SMS template seed error: {e}")

    def get_session(self):
        session = self.SessionLocal()
        try:
            yield session
        finally:
            session.close()
    
    def create_session(self):
        return self.SessionLocal()
    
    def close(self):
        pass

def get_tenant_context(org_id: str, user_id: str, db):
    membership = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user_id
    ).first()
    
    if not membership:
        return None, None
    
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not org.connection_string:
        return None, None
    
    return TenantContext(org.connection_string), membership

def get_tenant_context_simple(org_id: str, db):
    """Get tenant context without requiring user membership check."""
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org or not org.connection_string:
        return None
    
    return TenantContext(org.connection_string)
