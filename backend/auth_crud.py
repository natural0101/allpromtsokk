import secrets
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from .models import User, Session as SessionModel


def get_user_by_telegram_id(db: Session, telegram_id: int) -> Optional[User]:
    return db.query(User).filter(User.telegram_id == telegram_id).first()


def create_user(
    db: Session,
    telegram_id: int,
    username: Optional[str] = None,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
) -> User:
    db_user = User(
        telegram_id=telegram_id,
        username=username,
        first_name=first_name,
        last_name=last_name,
        role="user",
        last_login_at=datetime.utcnow(),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def update_user_login_time(db: Session, user: User) -> User:
    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def create_session(db: Session, user_id: int, expires_in_days: int = 30) -> SessionModel:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=expires_in_days)
    
    db_session = SessionModel(
        user_id=user_id,
        token=token,
        expires_at=expires_at,
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session


def get_session_by_token(db: Session, token: str) -> Optional[SessionModel]:
    return (
        db.query(SessionModel)
        .filter(
            SessionModel.token == token,
            SessionModel.revoked_at.is_(None),
            SessionModel.expires_at > datetime.utcnow(),
        )
        .first()
    )


def revoke_session(db: Session, token: str) -> bool:
    session = db.query(SessionModel).filter(SessionModel.token == token).first()
    if not session:
        return False
    
    session.revoked_at = datetime.utcnow()
    db.commit()
    return True

