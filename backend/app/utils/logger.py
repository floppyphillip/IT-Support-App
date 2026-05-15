import sys
import logging
from pathlib import Path
from loguru import logger as _loguru_logger

from app.config import settings


def setup_logging() -> None:
    log_dir = Path(settings.LOG_DIR)
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        log_dir = Path("logs")
        log_dir.mkdir(exist_ok=True)

    _loguru_logger.remove()

    # Console handler
    _loguru_logger.add(
        sys.stdout,
        level=settings.LOG_LEVEL,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{line}</cyan> — <level>{message}</level>",
        colorize=True,
    )

    # Rotating file handler
    _loguru_logger.add(
        str(log_dir / "app.log"),
        level=settings.LOG_LEVEL,
        rotation="50 MB",
        retention=f"{settings.LOG_RETENTION_DAYS} days",
        compression="gz",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{line} — {message}",
        enqueue=True,
    )

    # Error-only log
    _loguru_logger.add(
        str(log_dir / "error.log"),
        level="ERROR",
        rotation="10 MB",
        retention=f"{settings.LOG_RETENTION_DAYS} days",
        compression="gz",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{line} — {message}\n{exception}",
        enqueue=True,
    )


class _InterceptHandler(logging.Handler):
    """Route standard library logging through loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = _loguru_logger.level(record.levelname).name
        except ValueError:
            level = record.levelno  # type: ignore[assignment]
        frame, depth = sys._getframe(6), 6
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back  # type: ignore[assignment]
            depth += 1
        _loguru_logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def get_logger(name: str):
    logging.basicConfig(handlers=[_InterceptHandler()], level=0, force=True)
    return _loguru_logger.bind(name=name)


setup_logging()
