from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.user import (
    UserCreate, UserResponse, TokenResponse,
    LoginRequest, RefreshRequest, UserPasswordChange, UserUpdate,
    UserInvite, UserList, NotificationSettingsUpdate, NotificationSettingsResponse,
)
from app.services import auth_service
from app.utils.security import (
    get_current_user_id, require_superadmin, require_superadmin_or_engineer,
    hash_password, verify_password, decode_token,
)
from app.models.audit_log import AuditLog
from app.models.notification_settings import NotificationSettings
from app.utils.logger import get_logger
from app.utils.limiter import limiter
from sqlalchemy import select

router = APIRouter()
logger = get_logger(__name__)

REFRESH_COOKIE = "refresh_token"
COOKIE_KWARGS = {
    "httponly": True,
    "secure": settings.ENVIRONMENT == "production",
    "samesite": "lax",
    "max_age": settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    "path": "/api/auth",
}


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(require_superadmin),
):
    """Superadmin: register a new user."""
    return await auth_service.register_user(db, payload)


@router.post("/invite", response_model=UserResponse, status_code=201)
async def invite_user(
    payload: UserInvite,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(require_superadmin),
):
    """Superadmin: invite a new engineer or client user."""
    from app.schemas.user import UserCreate
    create_payload = UserCreate(
        email=payload.email,
        full_name=payload.full_name,
        role=payload.role,
        password=payload.temporary_password,
    )
    return await auth_service.register_user(db, create_payload, force_password_change=True)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.authenticate_user(db, payload.email, payload.password)
    access_token, refresh_token = auth_service.issue_tokens(user)

    # Set refresh token in httpOnly cookie
    response.set_cookie(REFRESH_COOKIE, refresh_token, **COOKIE_KWARGS)

    log = AuditLog(
        user_id=user.id,
        action="login",
        resource_type="auth",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.add(log)

    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    # Prefer body, fall back to cookie
    token = payload.refresh_token or request.cookies.get(REFRESH_COOKIE)
    if not token:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")

    access_token, new_refresh = await auth_service.refresh_tokens(db, token)
    response.set_cookie(REFRESH_COOKIE, new_refresh, **COOKIE_KWARGS)
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/logout", status_code=204)
async def logout(response: Response):
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


@router.get("/me", response_model=UserResponse)
async def me(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    return await auth_service.get_user_by_id(db, user_id)


@router.put("/me", response_model=UserResponse)
async def update_me(
    payload: UserUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.get_user_by_id(db, user_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        if field != "role":  # cannot change own role
            setattr(user, field, value)
    return user


@router.post("/change-password", status_code=204)
async def change_password(
    payload: UserPasswordChange,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user = await auth_service.get_user_by_id(db, user_id)
    if not verify_password(payload.current_password, user.password_hash):
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password incorrect")
    user.password_hash = hash_password(payload.new_password)
    user.force_password_change = False


# ─── Team management (superadmin) ────────────────────────────────────────────

@router.get("/users", response_model=UserList)
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(require_superadmin),
):
    from app.models.user import User
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = list(result.scalars().all())
    return UserList(total=len(users), items=users)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: str = Depends(require_superadmin),
):
    user = await auth_service.get_user_by_id(db, user_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    return user


# ─── Notification settings ────────────────────────────────────────────────────

@router.get("/me/notifications", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    ns = await db.scalar(select(NotificationSettings).where(NotificationSettings.user_id == user_id))
    if not ns:
        ns = NotificationSettings(user_id=user_id)
        db.add(ns)
        await db.flush()
    return ns


@router.put("/me/notifications", response_model=NotificationSettingsResponse)
async def update_notification_settings(
    payload: NotificationSettingsUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    ns = await db.scalar(select(NotificationSettings).where(NotificationSettings.user_id == user_id))
    if not ns:
        ns = NotificationSettings(user_id=user_id)
        db.add(ns)
        await db.flush()
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ns, field, value)
    return ns
