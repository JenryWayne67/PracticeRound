"""Example CRUD resource, scoped to the logged-in user. Copy this file for new resources."""

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ..deps import CurrentUser, SessionDep
from ..models import Item, ItemCreate, ItemRead, ItemUpdate

router = APIRouter(prefix="/items", tags=["items"])


def _get_owned(item_id: int, user_id: int, session: SessionDep) -> Item:
    item = session.get(Item, item_id)
    if not item or item.owner_id != user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found")
    return item


@router.get("", response_model=list[ItemRead])
def list_items(user: CurrentUser, session: SessionDep):
    query = select(Item).where(Item.owner_id == user.id).order_by(Item.created_at.desc())
    return session.exec(query).all()


@router.post("", response_model=ItemRead, status_code=status.HTTP_201_CREATED)
def create_item(data: ItemCreate, user: CurrentUser, session: SessionDep):
    item = Item(**data.model_dump(), owner_id=user.id)
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.get("/{item_id}", response_model=ItemRead)
def get_item(item_id: int, user: CurrentUser, session: SessionDep):
    return _get_owned(item_id, user.id, session)


@router.patch("/{item_id}", response_model=ItemRead)
def update_item(item_id: int, data: ItemUpdate, user: CurrentUser, session: SessionDep):
    item = _get_owned(item_id, user.id, session)
    item.sqlmodel_update(data.model_dump(exclude_unset=True))
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(item_id: int, user: CurrentUser, session: SessionDep):
    session.delete(_get_owned(item_id, user.id, session))
    session.commit()
