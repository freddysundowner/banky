"""
Tenant provisioner — selects the right database backend at runtime.

Selection logic (checked in order):

  TENANT_BACKEND=neon   → always use Neon (requires NEON_API_KEY)
  TENANT_BACKEND=local  → always use local Postgres (no extra config needed —
                           derives superuser connection from DATABASE_URL which
                           install.sh already writes)
  TENANT_BACKEND=shared → skip per-org DB, use the shared master DB (enterprise-style)
  TENANT_BACKEND not set → auto-detect:
      1. NEON_API_KEY present → neon
      2. Otherwise            → local  (DATABASE_URL is always set by install.sh,
                                        so local provisioning works out of the box)
"""

import os


def get_tenant_backend() -> str:
    explicit = os.environ.get("TENANT_BACKEND", "").lower().strip()
    if explicit in ("neon", "local", "shared"):
        return explicit

    if os.environ.get("NEON_API_KEY"):
        return "neon"
    # DATABASE_URL is always present after install.sh, so local works by default
    return "local"


async def provision_tenant_database(org_id: str, org_name: str) -> dict | None:
    """
    Create a dedicated database for the org and return provisioning info.
    Returns None when using the shared-DB strategy (no dedicated DB needed).
    """
    backend = get_tenant_backend()

    if backend == "neon":
        from services.neon_tenant import neon_tenant_service
        result = await neon_tenant_service.create_tenant_database(org_id, org_name)
        result["backend"] = "neon"
        return result

    if backend == "local":
        from services.local_tenant import local_tenant_service
        result = await local_tenant_service.create_tenant_database(org_id, org_name)
        result["backend"] = "local"
        return result

    return None


async def delete_tenant_database(org_id: str, neon_project_id: str | None) -> bool:
    """
    Drop the per-org database. Infers the backend from the same env logic.
    """
    backend = get_tenant_backend()

    if backend == "neon":
        if not neon_project_id:
            return False
        from services.neon_tenant import neon_tenant_service
        return await neon_tenant_service.delete_tenant_database(neon_project_id)

    if backend == "local":
        from services.local_tenant import local_tenant_service
        return await local_tenant_service.delete_tenant_database(org_id)

    return True
