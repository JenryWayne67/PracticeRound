"""Database tables and request/response schemas.

To add a resource: copy the Item block here, then copy routers/items.py.
"""

from datetime import datetime, timezone

from pydantic import EmailStr
from sqlmodel import Field, SQLModel


def now() -> datetime:
    return datetime.now(timezone.utc)


# --- Users ---------------------------------------------------------------


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    name: str = ""
    hashed_password: str
    created_at: datetime = Field(default_factory=now)


class UserCreate(SQLModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    name: str = ""


class UserRead(SQLModel):
    id: int
    email: str
    name: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


# --- Items (example resource) --------------------------------------------


class ItemBase(SQLModel):
    title: str
    description: str = ""
    done: bool = False


class Item(ItemBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=now)


class ItemCreate(ItemBase):
    pass


class ItemUpdate(SQLModel):
    title: str | None = None
    description: str | None = None
    done: bool | None = None


class ItemRead(ItemBase):
    id: int
    owner_id: int
    created_at: datetime
