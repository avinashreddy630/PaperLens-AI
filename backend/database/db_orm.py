"""
database/db_orm.py
SQLAlchemy 2.0 Async declarative ORM models for PostgreSQL SQL database layer.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    func,
    or_,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

logger = logging.getLogger("ss_spark.db_orm")


class Base(DeclarativeBase):
    pass


class UserDB(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(String(255), unique=True, index=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    avatar_url: Mapped[str] = mapped_column(Text, default="")
    role: Mapped[str] = mapped_column(String(50), default="user")
    status: Mapped[str] = mapped_column(String(50), default="active")
    hashed_password: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(50), default="local")
    provider_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_documents: Mapped[int] = mapped_column(Integer, default=0)
    total_questions: Mapped[int] = mapped_column(Integer, default=0)
    storage_used_mb: Mapped[float] = mapped_column(Float, default=0.0)
    token_version: Mapped[int] = mapped_column(Integer, default=1)


class UploadedDocDB(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), default="")
    file_path: Mapped[str] = mapped_column(Text, default="")
    file_type: Mapped[str] = mapped_column(String(50), default="")
    size_mb: Mapped[float] = mapped_column(Float, default=0.0)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    extracted_text_preview: Mapped[str] = mapped_column(Text, default="")
    metadata_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)


class ChatSessionDB(Base):
    __tablename__ = "chat_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), default="New Chat")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)
    favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    folder: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ChatMessageDB(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    model: Mapped[str] = mapped_column(String(100), default="")
    confidence_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    citations_json: Mapped[Optional[List[Any]]] = mapped_column(JSON, default=list)
    doc_references_json: Mapped[Optional[List[Any]]] = mapped_column(JSON, default=list)


class OAuthAccountDB(Base):
    __tablename__ = "oauth_accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_id: Mapped[str] = mapped_column(String(255), nullable=False)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AuditLogDB(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    detail: Mapped[str] = mapped_column(Text, default="")
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class NotificationDB(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    kind: Mapped[str] = mapped_column(String(50), default="info")
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SystemSettingsDB(Base):
    __tablename__ = "system_settings"

    id: Mapped[str] = mapped_column(String(50), primary_key=True, default="global_settings")
    ocr_engine: Mapped[str] = mapped_column(String(50), default="tesseract")
    embedding_model: Mapped[str] = mapped_column(String(100), default="text-embedding-3-small")
    llm_model: Mapped[str] = mapped_column(String(100), default="gpt-4o-mini")
    chunk_size: Mapped[int] = mapped_column(Integer, default=500)
    chunk_overlap: Mapped[int] = mapped_column(Integer, default=50)
    max_upload_size_mb: Mapped[int] = mapped_column(Integer, default=50)
    allowed_file_types_json: Mapped[Optional[List[str]]] = mapped_column(JSON, default=lambda: [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".pptx"])
    rate_limit_requests_per_minute: Mapped[int] = mapped_column(Integer, default=60)
    maintenance_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# Engine and sessionmaker singletons
_engine: Optional[AsyncEngine] = None
_async_sessionmaker: Optional[async_sessionmaker[AsyncSession]] = None


def normalize_postgres_uri(uri: str) -> str:
    """Normalize postgres/mongodb URIs to asyncpg format."""
    if not uri:
        return "postgresql+asyncpg://postgres:postgres@localhost:5432/ss_spark"
    if uri.startswith("postgres://"):
        uri = uri.replace("postgres://", "postgresql+asyncpg://", 1)
    elif uri.startswith("postgresql://") and not uri.startswith("postgresql+asyncpg://"):
        uri = uri.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif uri.startswith("mongodb://") or uri.startswith("mongodb+srv://"):
        # Default fallback URI if legacy MongoDB string was passed
        uri = "postgresql+asyncpg://postgres:postgres@localhost:5432/ss_spark"
    return uri


async def init_orm_db(postgres_uri: str) -> bool:
    """Initialize PostgreSQL database tables using SQLAlchemy 2.0 Async Engine."""
    global _engine, _async_sessionmaker
    norm_uri = normalize_postgres_uri(postgres_uri)
    try:
        logger.info("Initializing PostgreSQL database engine with URI: %s", norm_uri.split("@")[-1] if "@" in norm_uri else norm_uri)
        _engine = create_async_engine(norm_uri, echo=False, pool_pre_ping=True)
        async with _engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        _async_sessionmaker = async_sessionmaker(_engine, expire_on_commit=False)
        logger.info("PostgreSQL database tables initialized successfully.")
        return True
    except Exception as exc:
        logger.warning(
            "PostgreSQL database connection failed (%s). Active in-memory persistence fallback mode.",
            exc,
        )
        _engine = None
        _async_sessionmaker = None
        return False


def get_async_sessionmaker() -> Optional[async_sessionmaker[AsyncSession]]:
    return _async_sessionmaker
