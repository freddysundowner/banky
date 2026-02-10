import os
import uuid
import base64
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from models.database import get_db
from models.tenant import Member, MemberDocument, Staff, StaffDocument
from routes.auth import get_current_user
from routes.common import get_tenant_session_context, require_permission

router = APIRouter()

UPLOAD_DIR = "uploads"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".pdf", ".doc", ".docx"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

DOCUMENT_TYPES = {
    "passport_photo": "Passport Photo",
    "id_front": "ID Card (Front)",
    "id_back": "ID Card (Back)",
    "signature": "Signature",
    "proof_of_address": "Proof of Address",
    "payslip": "Payslip",
    "bank_statement": "Bank Statement",
    "other": "Other Document"
}

def ensure_upload_dir(org_id: str, member_id: str):
    path = os.path.join(UPLOAD_DIR, org_id, member_id)
    os.makedirs(path, exist_ok=True)
    return path

@router.get("/{org_id}/members/{member_id}/documents")
async def get_member_documents(org_id: str, member_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        documents = tenant_session.query(MemberDocument).filter(MemberDocument.member_id == member_id).all()
        return [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "document_type_label": DOCUMENT_TYPES.get(doc.document_type, doc.document_type),
                "file_name": doc.file_name,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
                "description": doc.description,
                "is_verified": doc.is_verified,
                "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
                "created_at": doc.created_at.isoformat() if doc.created_at else None
            }
            for doc in documents
        ]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/members/{member_id}/documents")
async def upload_member_document(
    org_id: str, 
    member_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: Optional[str] = Form(None),
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        member = tenant_session.query(Member).filter(Member.id == member_id).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        if document_type not in DOCUMENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {', '.join(DOCUMENT_TYPES.keys())}")
        
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
        
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB")
        
        upload_path = ensure_upload_dir(org_id, member_id)
        unique_filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(upload_path, unique_filename)
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        current_staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        document = MemberDocument(
            member_id=member_id,
            document_type=document_type,
            file_name=file.filename,
            file_path=file_path,
            file_size=len(contents),
            mime_type=file.content_type,
            description=description,
            uploaded_by_id=current_staff.id if current_staff else None
        )
        tenant_session.add(document)
        
        if document_type == "passport_photo":
            member.photo_url = f"/api/organizations/{org_id}/members/{member_id}/documents/{document.id}/file"
        elif document_type in ["id_front", "id_back"]:
            member.id_document_url = f"/api/organizations/{org_id}/members/{member_id}/documents/{document.id}/file"
        elif document_type == "signature":
            member.signature_url = f"/api/organizations/{org_id}/members/{member_id}/documents/{document.id}/file"
        
        tenant_session.commit()
        tenant_session.refresh(document)
        
        return {
            "id": document.id,
            "document_type": document.document_type,
            "document_type_label": DOCUMENT_TYPES.get(document.document_type, document.document_type),
            "file_name": document.file_name,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
            "description": document.description,
            "is_verified": document.is_verified,
            "created_at": document.created_at.isoformat() if document.created_at else None
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/members/{member_id}/documents/{document_id}/file")
async def get_document_file(org_id: str, member_id: str, document_id: str, download: int = 0, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        document = tenant_session.query(MemberDocument).filter(
            MemberDocument.id == document_id,
            MemberDocument.member_id == member_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        if not os.path.exists(document.file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        headers = {}
        if download:
            headers["Content-Disposition"] = f'attachment; filename="{document.file_name}"'
        
        return FileResponse(
            document.file_path,
            media_type=document.mime_type or "application/octet-stream",
            filename=document.file_name,
            headers=headers if download else None
        )
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/members/{member_id}/documents/{document_id}")
async def delete_member_document(org_id: str, member_id: str, document_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        document = tenant_session.query(MemberDocument).filter(
            MemberDocument.id == document_id,
            MemberDocument.member_id == member_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        tenant_session.delete(document)
        tenant_session.commit()
        
        return {"message": "Document deleted successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.put("/{org_id}/members/{member_id}/documents/{document_id}/verify")
async def verify_document(org_id: str, member_id: str, document_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "members:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        document = tenant_session.query(MemberDocument).filter(
            MemberDocument.id == document_id,
            MemberDocument.member_id == member_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        current_staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        document.is_verified = True
        document.verified_by_id = current_staff.id if current_staff else None
        document.verified_at = datetime.utcnow()
        
        tenant_session.commit()
        
        return {"message": "Document verified successfully", "is_verified": True}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/document-types")
async def get_document_types(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return [{"value": key, "label": value} for key, value in DOCUMENT_TYPES.items()]

STAFF_DOCUMENT_TYPES = {
    "passport_photo": "Passport Photo",
    "id_front": "ID Card (Front)",
    "id_back": "ID Card (Back)",
    "cv_resume": "CV / Resume",
    "academic_certificate": "Academic Certificate",
    "professional_certificate": "Professional Certificate",
    "appointment_letter": "Appointment Letter",
    "contract": "Employment Contract",
    "kra_pin": "KRA PIN Certificate",
    "good_conduct": "Good Conduct Certificate",
    "other": "Other Document"
}

def ensure_staff_upload_dir(org_id: str, staff_id: str):
    path = os.path.join(UPLOAD_DIR, org_id, "staff", staff_id)
    os.makedirs(path, exist_ok=True)
    return path

@router.get("/{org_id}/staff/{staff_id}/documents")
async def get_staff_documents(org_id: str, staff_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        documents = tenant_session.query(StaffDocument).filter(StaffDocument.staff_id == staff_id).all()
        return [
            {
                "id": doc.id,
                "document_type": doc.document_type,
                "document_type_label": STAFF_DOCUMENT_TYPES.get(doc.document_type, doc.document_type),
                "file_name": doc.file_name,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
                "description": doc.description,
                "is_verified": doc.is_verified,
                "verified_at": doc.verified_at.isoformat() if doc.verified_at else None,
                "created_at": doc.created_at.isoformat() if doc.created_at else None
            }
            for doc in documents
        ]
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.post("/{org_id}/staff/{staff_id}/documents")
async def upload_staff_document(
    org_id: str, 
    staff_id: str,
    file: UploadFile = File(...),
    document_type: str = Form(...),
    description: Optional[str] = Form(None),
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        staff = tenant_session.query(Staff).filter(Staff.id == staff_id).first()
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        
        if document_type not in STAFF_DOCUMENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid document type. Must be one of: {', '.join(STAFF_DOCUMENT_TYPES.keys())}")
        
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")
        
        contents = await file.read()
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File too large. Maximum size: {MAX_FILE_SIZE / 1024 / 1024}MB")
        
        upload_path = ensure_staff_upload_dir(org_id, staff_id)
        unique_filename = f"{uuid.uuid4()}{ext}"
        file_path = os.path.join(upload_path, unique_filename)
        
        with open(file_path, "wb") as f:
            f.write(contents)
        
        current_staff = tenant_session.query(Staff).filter(Staff.email == user.email).first()
        
        document = StaffDocument(
            staff_id=staff_id,
            document_type=document_type,
            file_name=file.filename,
            file_path=file_path,
            file_size=len(contents),
            mime_type=file.content_type,
            description=description,
            uploaded_by_id=current_staff.id if current_staff else None
        )
        tenant_session.add(document)
        tenant_session.commit()
        tenant_session.refresh(document)
        
        return {
            "id": document.id,
            "document_type": document.document_type,
            "document_type_label": STAFF_DOCUMENT_TYPES.get(document.document_type, document.document_type),
            "file_name": document.file_name,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
            "description": document.description,
            "is_verified": document.is_verified,
            "created_at": document.created_at.isoformat() if document.created_at else None
        }
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/staff/{staff_id}/documents/{document_id}/file")
async def get_staff_document_file(org_id: str, staff_id: str, document_id: str, download: int = 0, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:read", db)
    tenant_session = tenant_ctx.create_session()
    try:
        document = tenant_session.query(StaffDocument).filter(
            StaffDocument.id == document_id,
            StaffDocument.staff_id == staff_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        if not os.path.exists(document.file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        headers = {}
        if download:
            headers["Content-Disposition"] = f'attachment; filename="{document.file_name}"'
        
        return FileResponse(
            document.file_path,
            media_type=document.mime_type or "application/octet-stream",
            filename=document.file_name,
            headers=headers if download else None
        )
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.delete("/{org_id}/staff/{staff_id}/documents/{document_id}")
async def delete_staff_document(org_id: str, staff_id: str, document_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    tenant_ctx, membership = get_tenant_session_context(org_id, user, db)
    require_permission(membership, "staff:write", db)
    tenant_session = tenant_ctx.create_session()
    try:
        document = tenant_session.query(StaffDocument).filter(
            StaffDocument.id == document_id,
            StaffDocument.staff_id == staff_id
        ).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        if os.path.exists(document.file_path):
            os.remove(document.file_path)
        
        tenant_session.delete(document)
        tenant_session.commit()
        
        return {"message": "Document deleted successfully"}
    finally:
        tenant_session.close()
        tenant_ctx.close()

@router.get("/{org_id}/staff-document-types")
async def get_staff_document_types(org_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    return [{"value": key, "label": value} for key, value in STAFF_DOCUMENT_TYPES.items()]
