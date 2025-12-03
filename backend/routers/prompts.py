from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud
from ..db import get_db
from ..dependencies import get_active_user, get_prompt_editor_user
from ..models import PromptVersion, User
from ..schemas import (
    PromptCreate,
    PromptOut,
    PromptUpdate,
    PromptVersionBase,
    PromptVersionDetail,
)

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("", response_model=List[PromptOut])
def list_prompts(
    folder: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    """Получить список промптов с фильтрацией по папке и поиском."""
    return crud.list_prompts(db=db, folder=folder, search=search)


@router.get("/{slug}", response_model=PromptOut)
def get_prompt(
    slug: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    """Получить промпт по slug."""
    prompt = crud.get_prompt_by_slug(db, slug=slug)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@router.post("", response_model=PromptOut, status_code=status.HTTP_201_CREATED)
def create_prompt(
    payload: PromptCreate,
    db: Session = Depends(get_db),
    editor_user: User = Depends(get_prompt_editor_user),
):
    """Создать новый промпт. Требует editor access (admin или tech)."""
    prompt = crud.create_prompt(db=db, data=payload, user_id=editor_user.id)
    return prompt


@router.put("/{slug}", response_model=PromptOut)
def update_prompt(
    slug: str,
    payload: PromptUpdate,
    db: Session = Depends(get_db),
    editor_user: User = Depends(get_prompt_editor_user),
):
    """Обновить промпт. Требует editor access (admin или tech)."""
    prompt = crud.update_prompt(db=db, slug=slug, data=payload, user_id=editor_user.id)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@router.delete("/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(
    slug: str,
    db: Session = Depends(get_db),
    editor_user: User = Depends(get_prompt_editor_user),
):
    """Удалить промпт. Требует editor access (admin или tech)."""
    deleted = crud.delete_prompt(db=db, slug=slug)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None


@router.get("/{prompt_id}/versions", response_model=List[PromptVersionBase])
def get_prompt_versions(
    prompt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    """Получить список версий промпта."""
    versions = (
        db.query(PromptVersion)
        .filter(PromptVersion.prompt_id == prompt_id)
        .order_by(PromptVersion.version.desc())
        .all()
    )
    return versions


@router.get("/{prompt_id}/versions/{version_id}", response_model=PromptVersionDetail)
def get_prompt_version(
    prompt_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_active_user),
):
    """Получить конкретную версию промпта."""
    version = (
        db.query(PromptVersion)
        .filter(PromptVersion.prompt_id == prompt_id, PromptVersion.id == version_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version




