from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserBase(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "user"


class UserOut(UserBase):
    id: int
    created_at: datetime
    last_login_at: Optional[datetime] = None

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
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


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



