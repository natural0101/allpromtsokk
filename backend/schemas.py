from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserBase(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "user"  # Оставляем для обратной совместимости
    status: str = "pending"
    access_level: str = "user"


class UserOut(UserBase):
    id: int
    created_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    status: Optional[str] = None  # pending, active, blocked
    access_level: Optional[str] = None  # admin, tech, user

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: int
    user_id: int
    token: str
    created_at: datetime
    expires_at: datetime
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TelegramAuthData(BaseModel):
    id: int
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    auth_date: int
    hash: str


class AuthUser(BaseModel):
    id: int
    username: Optional[str] = None
    role: str
    status: str
    access_level: str


class AuthResponse(BaseModel):
    token: str
    user: AuthUser


class PasswordLoginRequest(BaseModel):
    login: str
    password: str


class PromptBase(BaseModel):
    name: str
    text: str
    folder: Optional[str] = None
    tags: Optional[str] = None
    importance: Optional[str] = "normal"


class PromptCreate(PromptBase):
    slug: Optional[str] = None


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    folder: Optional[str] = None
    tags: Optional[str] = None
    importance: Optional[str] = None


class PromptOut(PromptBase):
    id: int
    slug: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PromptVersionBase(BaseModel):
    id: int
    version: int
    title: str
    created_at: datetime
    updated_by_user_id: int | None

    class Config:
        from_attributes = True


class PromptVersionDetail(PromptVersionBase):
    content: str

    class Config:
        from_attributes = True



