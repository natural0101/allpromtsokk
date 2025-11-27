from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy.orm import Session

from . import crud
from .db import Base, engine, get_db
from .schemas import PromptCreate, PromptOut, PromptUpdate

app = FastAPI(title="autookk backend", version="1.0.0")


@app.on_event("startup")
def on_startup() -> None:
    # Ensure all tables are created
    Base.metadata.create_all(bind=engine)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/prompts", response_model=List[PromptOut])
def list_prompts(
    folder: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    return crud.list_prompts(db=db, folder=folder, search=search)


@app.get("/api/prompts/{slug}", response_model=PromptOut)
def get_prompt(slug: str, db: Session = Depends(get_db)):
    prompt = crud.get_prompt_by_slug(db, slug=slug)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@app.post("/api/prompts", response_model=PromptOut, status_code=status.HTTP_201_CREATED)
def create_prompt(payload: PromptCreate, db: Session = Depends(get_db)):
    prompt = crud.create_prompt(db=db, data=payload)
    return prompt


@app.put("/api/prompts/{slug}", response_model=PromptOut)
def update_prompt(slug: str, payload: PromptUpdate, db: Session = Depends(get_db)):
    prompt = crud.update_prompt(db=db, slug=slug, data=payload)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return prompt


@app.delete("/api/prompts/{slug}", status_code=status.HTTP_204_NO_CONTENT)
def delete_prompt(slug: str, db: Session = Depends(get_db)):
    deleted = crud.delete_prompt(db=db, slug=slug)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return None



