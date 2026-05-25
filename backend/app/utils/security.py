from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, status, Cookie
from fastapi.security import OAuth2PasswordBearer

from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# ─── Password hashing ────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ─── JWT tokens ──────────────────────────────────────────────────────────────

def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + expires_delta
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(user_id: str, role: str) -> str:
    return _create_token(
        {"sub": user_id, "role": role, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(user_id: str) -> str:
    return _create_token(
        {"sub": user_id, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


async def get_current_user_id(
    bearer: str | None = Depends(oauth2_scheme),
    refresh_cookie: str | None = Cookie(default=None, alias="refresh_token"),
) -> str:
    token = bearer
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return user_id


async def get_current_role(bearer: str | None = Depends(oauth2_scheme)) -> str:
    if not bearer:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(bearer)
    return payload.get("role", "")


def require_roles(*roles: str):
    async def _check(bearer: str | None = Depends(oauth2_scheme)) -> str:
        if not bearer:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
        payload = decode_token(bearer)
        if payload.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return payload["sub"]
    return _check


require_superadmin = require_roles("superadmin")
require_superadmin_or_engineer = require_roles("superadmin", "admin", "technical_support", "noc", "engineer")


# ─── Fernet symmetric encryption (for SSH passwords at rest) ─────────────────

def _get_fernet() -> Fernet | None:
    key = settings.SSH_ENCRYPTION_KEY
    if not key:
        return None
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        return None


def encrypt_secret(plain: str) -> str:
    """Encrypt a secret string. Returns base64 ciphertext."""
    f = _get_fernet()
    if not f:
        return plain  # No-op if key not configured (dev mode)
    return f.encrypt(plain.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a Fernet-encrypted string."""
    f = _get_fernet()
    if not f:
        return ciphertext
    try:
        return f.decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Failed to decrypt stored credential")
