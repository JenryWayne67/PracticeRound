"""Knowledge-hub notes: anyone can read, logged-in users can post and delete their own."""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ..deps import CurrentUser, SessionDep
from ..models import Note, NoteCreate, NoteRead

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=list[NoteRead])
def list_notes(session: SessionDep, category: str | None = None, limit: int = 100):
    query = select(Note).order_by(Note.created_at.desc()).limit(min(limit, 200))
    if category:
        query = query.where(Note.category == category)
    return session.exec(query).all()


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_note(data: NoteCreate, user: CurrentUser, session: SessionDep):
    note = Note(**data.model_dump(), author_id=user.id, author_name=user.name or user.email.split("@")[0])
    session.add(note)
    session.commit()
    session.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: int, user: CurrentUser, session: SessionDep):
    note = session.get(Note, note_id)
    if not note or note.author_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    session.delete(note)
    session.commit()
