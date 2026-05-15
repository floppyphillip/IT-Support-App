from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1, max_length=200)
    role: UserRole = UserRole.engineer
    phone: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    whatsapp_number: Optional[str] = None


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    phone: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    whatsapp_number: Optional[str] = None
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None


class UserPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class UserInvite(BaseModel):
    """Superadmin-only: invite a new team member."""
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.engineer
    temporary_password: str = Field(..., min_length=8)


class NotificationSettingsUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    telegram_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    alert_on: Optional[dict] = None


class NotificationSettingsResponse(BaseModel):
    email_enabled: bool
    telegram_enabled: bool
    whatsapp_enabled: bool
    alert_on: dict
    model_config = {"from_attributes": True}


class UserResponse(UserBase):
    id: str
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None
    model_config = {"from_attributes": True}


class UserList(BaseModel):
    total: int
    items: list[UserResponse]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None  # can also come from httpOnly cookie


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
