from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import select

from ..deps import CurrentUser, SessionDep
from ..models import Token, User, UserCreate, UserRead
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_for(user: User) -> Token:
    return Token(access_token=create_access_token(user.id), user=UserRead.model_validate(user))


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, session: SessionDep):
    email = data.email.lower()
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")
    user = User(email=email, name=data.name, hashed_password=hash_password(data.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return _token_for(user)


# Form-encoded (username + password) so the "Authorize" button in /docs works.
@router.post("/login", response_model=Token)
def login(form: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep):
    user = session.exec(select(User).where(User.email == form.username.lower())).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return _token_for(user)


@router.get("/me", response_model=UserRead)
def me(user: CurrentUser):
    return user
