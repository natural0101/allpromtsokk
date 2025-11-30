from typing import List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from .models import Prompt, PromptVersion
from .schemas import PromptCreate, PromptUpdate
from .utils import slugify


def get_prompt_by_slug(db: Session, slug: str) -> Optional[Prompt]:
    return db.query(Prompt).filter(Prompt.slug == slug).first()


def list_prompts(
    db: Session, folder: Optional[str] = None, search: Optional[str] = None
) -> List[Prompt]:
    query = db.query(Prompt)

    if folder:
        query = query.filter(Prompt.folder == folder)

    if search:
        like_pattern = f"%{search}%"
        query = query.filter(
            or_(Prompt.name.ilike(like_pattern), Prompt.text.ilike(like_pattern))
        )

    return query.order_by(Prompt.name.asc()).all()


def _generate_unique_slug(db: Session, base_slug: str) -> str:
    """
    Generate a unique slug by appending -2, -3, ... if needed.
    """
    slug = base_slug
    index = 2
    while get_prompt_by_slug(db, slug) is not None:
        slug = f"{base_slug}-{index}"
        index += 1
    return slug


def create_prompt(db: Session, data: PromptCreate, user_id: int | None = None) -> Prompt:
    base_slug = slugify(data.slug) if data.slug else slugify(data.name)
    unique_slug = _generate_unique_slug(db, base_slug)

    db_prompt = Prompt(
        slug=unique_slug,
        name=data.name,
        text=data.text,
        folder=data.folder,
        tags=data.tags,
        importance=data.importance or "normal",
    )
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    
    # Создаем первую версию
    create_prompt_version(db, db_prompt, user_id)
    
    return db_prompt


def update_prompt(db: Session, slug: str, data: PromptUpdate, user_id: int | None = None) -> Optional[Prompt]:
    db_prompt = get_prompt_by_slug(db, slug)
    if not db_prompt:
        return None

    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_prompt, field, value)

    db.commit()
    db.refresh(db_prompt)
    
    # Создаем новую версию после обновления
    create_prompt_version(db, db_prompt, user_id)
    
    return db_prompt


def delete_prompt(db: Session, slug: str) -> bool:
    db_prompt = get_prompt_by_slug(db, slug)
    if not db_prompt:
        return False

    db.delete(db_prompt)
    db.commit()
    return True


def create_prompt_version(db: Session, prompt: Prompt, user_id: int | None) -> PromptVersion:
    """
    Создает новую версию промпта.
    """
    last_version = (
        db.query(PromptVersion)
        .filter(PromptVersion.prompt_id == prompt.id)
        .order_by(PromptVersion.version.desc())
        .first()
    )
    next_version = (last_version.version + 1) if last_version else 1

    version = PromptVersion(
        prompt_id=prompt.id,
        version=next_version,
        title=prompt.name,
        content=prompt.text,
        updated_by_user_id=user_id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


