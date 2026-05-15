from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "NetSupportAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"  # development | production
    SECRET_KEY: str = "change-me-to-a-64-char-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://netsupport:secret@localhost:5432/netsupportai"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # Anthropic / Claude
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-20250514"
    CLAUDE_MAX_TOKENS: int = 4096

    # SMTP / Email
    SMTP_HOST: str = "smtp.fastmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@netsupportai.com"
    SMTP_TLS: bool = True

    # Twilio (WhatsApp)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = "whatsapp:+14155238886"

    # Telegram Bot
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_DEFAULT_CHAT_ID: str = ""

    # SSH — Fernet key for encrypting stored SSH passwords
    # Generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    SSH_ENCRYPTION_KEY: str = ""
    SSH_KEY_PATH: str = "/home/netsupportai/.ssh/id_rsa"
    SSH_TIMEOUT: int = 30

    # SNMP
    SNMP_DEFAULT_COMMUNITY: str = "public"
    SNMP_PORT: int = 161
    SNMP_TIMEOUT: int = 5

    # Monitoring
    MONITOR_INTERVAL_SECONDS: int = 60
    PING_TIMEOUT_SECONDS: float = 5.0

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_DIR: str = "/var/log/netsupportai"
    LOG_RETENTION_DAYS: int = 30

    # Ticket numbering
    TICKET_PREFIX: str = "NSA"

    # SLA hours by priority
    SLA_CRITICAL_HOURS: int = 1
    SLA_HIGH_HOURS: int = 4
    SLA_MEDIUM_HOURS: int = 8
    SLA_LOW_HOURS: int = 24

    # AI triage threshold — tickets with confidence >= this are auto-resolved
    AI_AUTO_RESOLVE_CONFIDENCE: float = 0.85

    @property
    def CORS_ORIGINS(self) -> List[str]:
        return self.ALLOWED_ORIGINS


settings = Settings()
