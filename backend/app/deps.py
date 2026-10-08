from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session

from .db import get_session
from .models import User
from .security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

SessionDep = Annotated[Session, Depends(get_session)]


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], session: SessionDep) -> User:
    user_id = decode_access_token(token)
    user = session.get(User, user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


# Add `user: CurrentUser` to any route to require login.
CurrentUser = Annotated[User, Depends(get_current_user)]
