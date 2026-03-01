"""
Tenant provisioner — selects the right database backend at runtime.

Selection logic (checked in order):

  TENANT_BACKEND=neon   → always use Neon (requires NEON_API_KEY)
  TENANT_BACKEND=local  → always use local Postgres
  TENANT_BACKEND not set → auto-detect:
      1. NEON_API_KEY present → neon
      2. Otherwise            → local  (DATABASE_URL is always set by install.sh,
                                        so local provisioning works out of the box)

Every organisation always gets its own dedicated database — there is no shared
database mode. Enterprise and SaaS both use isolated databases.
"""

import os


def get_tenant_backend() -> str:
    explicit = os.environ.get("TENANT_BACKEND", "").lower().strip()
    if explicit in ("neon", "local"):
        return explicit

    if os.environ.get("NEON_API_KEY"):
        return "neon"
    return "local"


async def provision_tenant_database(org_id: str, org_name: str) -> dict:
    """
    Create a dedicated database for the org and return provisioning info.
    Always provisions a dedicated database — never shared.
    """
    backend = get_tenant_backend()

    if backend == "neon":
        from services.neon_tenant import neon_tenant_service
        result = await neon_tenant_service.create_tenant_database(org_id, org_name)
        result["backend"] = "neon"
        return result

    from services.local_tenant import local_tenant_service
    result = await local_tenant_service.create_tenant_database(org_id, org_name)
    result["backend"] = "local"
    return result


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

    from services.local_tenant import local_tenant_service
    return await local_tenant_service.delete_tenant_database(org_id)
