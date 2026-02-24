from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class OrganizationCreate(BaseModel):
    name: str
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    staffEmailDomain: Optional[str] = None
    currency: Optional[str] = "KES"

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    staff_email_domain: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    code: str
    logo: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    currency: Optional[str] = "KES"
    is_active: Optional[bool] = True
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrganizationMemberResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: str
    is_owner: bool
    created_at: datetime
    organization: Optional[OrganizationResponse] = None
    
    class Config:
        from_attributes = True
