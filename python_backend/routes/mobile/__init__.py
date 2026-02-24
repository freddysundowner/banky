"""
Mobile Member API — /api/mobile/*

All member-facing routes for the Flutter mobile app.
Completely separate from staff/admin routes.
Registered in main.py as: app.include_router(mobile_router, prefix="/api/mobile")

Sub-modules:
  profile.py      — GET/PATCH /me
  dashboard.py    — /me/dashboard, /me/balances, /me/savings, /me/shares, /me/fixed-deposits
  transactions.py — /me/transactions, /me/mini-statement, /me/payments
  loans.py        — /me/loans, /me/loan-products, /me/loan-applications
  notifications.py — /me/notifications
"""

from fastapi import APIRouter
from .profile import router as profile_router
from .dashboard import router as dashboard_router
from .transactions import router as transactions_router
from .loans import router as loans_router
from .notifications import router as notifications_router

router = APIRouter()

router.include_router(profile_router)
router.include_router(dashboard_router)
router.include_router(transactions_router)
router.include_router(loans_router)
router.include_router(notifications_router)
