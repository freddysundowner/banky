import os
import secrets
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from sqlalchemy.orm import Session
from models.master import User, Session as UserSession

SESSION_EXPIRY_DAYS = 7

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, stored_password: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), stored_password.encode('utf-8'))

def create_session(db: Session, user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=SESSION_EXPIRY_DAYS)
    
    session = UserSession(
        user_id=user_id,
        token=token,
        expires_at=expires_at
    )
    db.add(session)
    db.commit()
    
    return token

def get_user_by_session(db: Session, token: str) -> Optional[User]:
    session = db.query(UserSession).filter(
        UserSession.token == token,
        UserSession.expires_at > datetime.utcnow()
    ).first()
    
    if session:
        return db.query(User).filter(User.id == session.user_id).first()
    return None

def delete_session(db: Session, token: str) -> bool:
    result = db.query(UserSession).filter(UserSession.token == token).delete()
    db.commit()
    return result > 0

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def create_user(db: Session, email: str, password: str, first_name: str = None, last_name: str = None, phone: str = None) -> User:
    user = User(
        email=email,
        password=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        phone=phone
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
