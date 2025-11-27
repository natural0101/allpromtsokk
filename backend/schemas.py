from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class PromptBase(BaseModel):
    name: str
    text: str
    folder: Optional[str] = None
    tags: Optional[str] = None


class PromptCreate(PromptBase):
    slug: Optional[str] = None


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    folder: Optional[str] = None
    tags: Optional[str] = None


class PromptOut(PromptBase):
    id: int
    slug: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True



