from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import UserOut, UserUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


def get_admin_user(request: Request) -> User:
    """Получить admin пользователя из request.state"""
    if not hasattr(request.state, "user") or request.state.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    user = request.state.user
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="access_denied",
            headers={"X-Reason": "status_not_active"}
        )
    if user.access_level != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


@router.get("/users", response_model=List[UserOut])
def list_users(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Получить список всех пользователей. Только для администраторов.
    """
    admin_user = get_admin_user(request)
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Обновить статус или уровень доступа пользователя. Только для администраторов.
    """
    admin_user = get_admin_user(request)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Валидация значений
    if user_update.status is not None:
        if user_update.status not in ["pending", "active", "blocked"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status value. Must be one of: pending, active, blocked"
            )
        user.status = user_update.status
    
    if user_update.access_level is not None:
        if user_update.access_level not in ["admin", "tech", "user"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid access_level value. Must be one of: admin, tech, user"
            )
        user.access_level = user_update.access_level
        # Также обновляем role для обратной совместимости
        if user_update.access_level == "admin":
            user.role = "admin"
        else:
            user.role = "user"
    
    db.commit()
    db.refresh(user)
    return user
