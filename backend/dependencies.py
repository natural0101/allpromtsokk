from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .models import User


def get_current_user(request: Request) -> User:
    """
    Dependency для получения текущего пользователя из request.state.
    Middleware уже проверил авторизацию и добавил user в request.state.
    """
    if not hasattr(request.state, "user") or request.state.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return request.state.user


def get_active_user(current_user: User = Depends(get_current_user)) -> User:
    """
    Dependency для проверки, что пользователь имеет статус "active".
    """
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="access_denied",
            headers={"X-Reason": "status_not_active"}
        )
    return current_user


def get_prompt_editor_user(current_user: User = Depends(get_active_user)) -> User:
    """
    Dependency для проверки, что пользователь может редактировать промпты.
    Разрешает доступ для access_level в ("admin", "tech").
    """
    if current_user.access_level not in ("admin", "tech"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor access required. Only admin and tech users can modify prompts."
        )
    return current_user


def get_admin_user(current_user: User = Depends(get_active_user)) -> User:
    """
    Dependency для проверки, что пользователь является администратором.
    """
    if current_user.access_level != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

