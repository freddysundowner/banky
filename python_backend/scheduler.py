#!/usr/bin/env python3
"""
Unified scheduler for all background cron jobs.
Runs continuously and executes each job at its configured interval.

Jobs:
- Trial status checks: every 6 hours
- Fixed deposit maturity processing: every 6 hours
- Loan notifications (due today): daily at ~7 AM
- Loan notifications (overdue): daily at ~6 PM
- Recurring expenses: every 6 hours
"""

import os
import sys
import time
import signal
import traceback
from datetime import datetime, date

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

JOBS = {
    "check_trials": {
        "module": "cron_check_trials",
        "interval_hours": 6,
        "description": "Check trial subscription statuses",
    },
    "process_matured": {
        "module": "cron_process_matured",
        "interval_hours": 6,
        "description": "Process matured fixed deposits",
    },
    "loan_notifications_due": {
        "module": "cron_loan_notifications",
        "interval_hours": 12,
        "description": "Send loan due-today reminders",
        "args": ["due_today"],
    },
    "loan_notifications_overdue": {
        "module": "cron_loan_notifications",
        "interval_hours": 12,
        "description": "Send overdue loan notices",
        "args": ["overdue"],
    },
    "recurring_expenses": {
        "module": "cron_recurring_expenses",
        "interval_hours": 6,
        "description": "Process recurring expenses",
    },
    "auto_loan_deduction": {
        "module": "cron_auto_loan_deduction",
        "interval_hours": 1,
        "description": "Auto-deduct loan repayments from savings",
        "run_at_hour": True,
    },
}

shutdown_requested = False


def handle_signal(signum, frame):
    global shutdown_requested
    print(f"\n[Scheduler] Received signal {signum}, shutting down gracefully...")
    shutdown_requested = True


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def run_job(job_name: str, job_config: dict):
    module_name = job_config["module"]
    args = job_config.get("args", [])
    description = job_config["description"]

    print(f"\n{'='*60}")
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Running: {description}")
    print(f"{'='*60}")

    try:
        original_argv = sys.argv[:]
        if args:
            sys.argv = [module_name + ".py"] + args

        module = __import__(module_name)

        if hasattr(module, "main"):
            module.main()
        else:
            print(f"  [WARN] Module {module_name} has no main() function")

        sys.argv = original_argv

        print(f"[{datetime.now().strftime('%H:%M:%S')}] Completed: {description}")
        return True

    except SystemExit as e:
        if e.code and e.code != 0:
            print(f"[ERROR] {description} exited with code {e.code}")
            return False
        return True
    except Exception as e:
        print(f"[ERROR] {description} failed: {e}")
        traceback.print_exc()
        return False


def main():
    print(f"{'='*60}")
    print(f"  BANKY Unified Scheduler")
    print(f"  Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}")
    print(f"\nRegistered jobs:")
    for name, config in JOBS.items():
        print(f"  - {config['description']} (every {config['interval_hours']}h)")
    print()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set. Scheduler cannot start.")
        sys.exit(1)

    last_run = {}
    CHECK_INTERVAL = 60

    print("[Scheduler] Running all jobs on startup...")
    for job_name, job_config in JOBS.items():
        if shutdown_requested:
            break
        run_job(job_name, job_config)
        last_run[job_name] = time.time()

    print(f"\n[Scheduler] Initial run complete. Entering loop (checking every {CHECK_INTERVAL}s)...")

    while not shutdown_requested:
        now = time.time()

        for job_name, job_config in JOBS.items():
            if shutdown_requested:
                break

            interval_seconds = job_config["interval_hours"] * 3600
            last = last_run.get(job_name, 0)

            if (now - last) >= interval_seconds:
                success = run_job(job_name, job_config)
                last_run[job_name] = now

        for _ in range(CHECK_INTERVAL):
            if shutdown_requested:
                break
            time.sleep(1)

    print("[Scheduler] Shutdown complete.")


if __name__ == "__main__":
    main()
