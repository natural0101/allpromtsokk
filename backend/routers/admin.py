from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..db import get_db
from ..dependencies import get_admin_user
from ..models import User
from ..schemas import UserOut, UserUpdate

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """
    Получить список всех пользователей. Только для администраторов.
    """
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """
    Обновить статус или уровень доступа пользователя. Только для администраторов.
    """
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
