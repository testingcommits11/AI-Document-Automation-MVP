from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pwdlib import PasswordHash

from database import get_user_by_id


load_dotenv()


JWT_SECRET = os.getenv(
    "JWT_SECRET",
    "change-this-in-production",
)

JWT_ALGORITHM = os.getenv(
    "JWT_ALGORITHM",
    "HS256",
)

JWT_EXPIRE_MINUTES = int(
    os.getenv(
        "JWT_EXPIRE_MINUTES",
        "1440",
    )
)


password_hash = PasswordHash.recommended()

bearer_scheme = HTTPBearer(
    auto_error=False,
)


def hash_password(
    password: str,
) -> str:
    return password_hash.hash(
        password
    )


def verify_password(
    password: str,
    stored_hash: str,
) -> bool:
    return password_hash.verify(
        password,
        stored_hash,
    )


def create_access_token(
    user_id: int,
) -> str:
    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=JWT_EXPIRE_MINUTES
        )
    )

    payload = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        JWT_SECRET,
        algorithm=JWT_ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> int | None:
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[
                JWT_ALGORITHM
            ],
        )

        value = payload.get("sub")

        if value is None:
            return None

        return int(value)

    except (
        jwt.ExpiredSignatureError,
        jwt.InvalidTokenError,
        TypeError,
        ValueError,
    ):
        return None


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    if credentials is None:
        return None

    user_id = decode_access_token(
        credentials.credentials
    )

    if user_id is None:
        return None

    return get_user_by_id(
        user_id
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        bearer_scheme
    ),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    user_id = decode_access_token(
        credentials.credentials
    )

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    user = get_user_by_id(
        user_id
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account was not found.",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    return user