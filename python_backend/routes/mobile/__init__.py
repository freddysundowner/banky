"""
Mobile Member API — /api/mobile/*

All member-facing routes for the Flutter mobile app.
Completely separate from staff/admin routes.
Registered in main.py as: app.include_router(mobile_router, prefix="/api/mobile")

Sub-modules:
  auth.py          — POST /auth/activate/init, /auth/activate/complete, /auth/login, /auth/login/verify, /auth/logout
  admin.py         — POST /admin/{org_id}/members/{id}/activate (staff-triggered)
                     GET  /admin/{org_id}/members/{id}/activity (staff view sessions)
                     DELETE /admin/{org_id}/members/{id}/deactivate-mobile
  profile.py       — GET/PATCH /me
  dashboard.py     — /me/dashboard, /me/balances, /me/savings, /me/shares, /me/fixed-deposits
  transactions.py  — /me/transactions, /me/mini-statement, /me/payments
  loans.py         — /me/loans, /me/loan-products, /me/loan-applications
  notifications.py — GET/PATCH/POST /me/notifications
  statements.py    — GET/POST /me/statements, GET /me/statements/{id}/download
"""

from fastapi import APIRouter
from .auth import router as auth_router
from .admin import router as admin_router
from .profile import router as profile_router
from .dashboard import router as dashboard_router
from .transactions import router as transactions_router
from .loans import router as loans_router
from .notifications import router as notifications_router
from .statements import router as statements_router

router = APIRouter()

router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(profile_router)
router.include_router(dashboard_router)
router.include_router(transactions_router)
router.include_router(loans_router)
router.include_router(notifications_router)
router.include_router(statements_router)
