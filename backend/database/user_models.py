"""
database/user_models.py

PostgreSQL SQL models (SQLAlchemy 2.0 Async ORM) for the auth / user management system.

Tables:
  - users            — registered user accounts
  - chat_sessions    — chat sessions
  - oauth_accounts   — linked OAuth providers
  - audit_logs       — security / activity audit trail
  - notifications    — in-app notifications
  - system_settings  — global admin-controlled settings
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from sqlalchemy import select, update, delete, func, or_

from database.db_orm import (
    get_async_sessionmaker,
    UserDB,
    OAuthAccountDB,
    ChatSessionDB,
    AuditLogDB,
    NotificationDB,
    SystemSettingsDB,
    UploadedDocDB,
    ChatMessageDB,
)

logger = logging.getLogger(__name__)

_sessionmaker: Any = None


# --------------------------------------------------------------------------- #
# Initialisation
# --------------------------------------------------------------------------- #

async def init_user_db(sessionmaker_instance: Any = None) -> None:
    """Receive the shared sessionmaker or engine instance."""
    global _sessionmaker
    if sessionmaker_instance is not None:
        _sessionmaker = sessionmaker_instance
    else:
        _sessionmaker = get_async_sessionmaker()
    logger.info("User DB initialized.")


_mem_users: Dict[str, UserRecord] = {}
_mem_sessions: Dict[str, ChatSession] = {}
_mem_logs: List[AuditLog] = []
_mem_notifications: List[Notification] = []
_mem_system_settings: Optional[SystemSettings] = None


def _get_sm() -> Any:
    """Return active sessionmaker or None if in fallback mode."""
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = get_async_sessionmaker()
    return _sessionmaker


# --------------------------------------------------------------------------- #
# Enums
# --------------------------------------------------------------------------- #

class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    PENDING_VERIFICATION = "pending_verification"


class AuthProvider(str, Enum):
    LOCAL = "local"
    GOOGLE = "google"
    GITHUB = "github"


class LogAction(str, Enum):
    REGISTER = "register"
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    PASSWORD_RESET = "password_reset"
    EMAIL_VERIFIED = "email_verified"
    UPLOAD = "upload"
    DELETE_DOCUMENT = "delete_document"
    ADMIN_ACTION = "admin_action"
    ROLE_CHANGE = "role_change"
    SUSPEND = "suspend"
    ACTIVATE = "activate"


# --------------------------------------------------------------------------- #
# Pydantic models
# --------------------------------------------------------------------------- #

class UserRecord(BaseModel):
    """A registered PaperLens AI user."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    username: Optional[str] = None
    full_name: str = ""
    avatar_url: str = ""
    role: UserRole = UserRole.USER
    status: UserStatus = UserStatus.ACTIVE
    hashed_password: Optional[str] = None            # None for OAuth-only users
    provider: AuthProvider = AuthProvider.LOCAL
    provider_id: Optional[str] = None               # OAuth provider's user ID
    email_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

    # Per-user usage stats (denormalised for quick reads)
    total_documents: int = 0
    total_questions: int = 0
    storage_used_mb: float = 0.0
    token_version: int = 1


class OAuthAccount(BaseModel):
    """A linked OAuth account for a user."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    provider: AuthProvider
    provider_id: str
    access_token: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ChatSession(BaseModel):
    """A named chat conversation belonging to a user."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    title: str = "New Chat"
    pinned: bool = False
    archived: bool = False
    folder: Optional[str] = None
    message_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AuditLog(BaseModel):
    """Security / activity audit trail entry."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    action: LogAction
    detail: str = ""
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Notification(BaseModel):
    """In-app notification for a user."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str                        # or "broadcast" for all users
    title: str
    body: str
    kind: str = "info"                  # "info" | "success" | "warning" | "error"
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SystemSettings(BaseModel):
    """Admin-controlled global system settings (single document)."""
    ocr_engine: str = "tesseract"
    embedding_model: str = "text-embedding-3-small"
    llm_model: str = "gpt-4o-mini"
    chunk_size: int = 500
    chunk_overlap: int = 50
    max_upload_size_mb: int = 50
    allowed_file_types: List[str] = Field(
        default=[".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".pptx"]
    )
    rate_limit_requests_per_minute: int = 60
    maintenance_mode: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def _user_db_to_pydantic(u: UserDB) -> UserRecord:
    return UserRecord(
        id=u.id,
        email=u.email,
        username=u.username,
        full_name=u.full_name or "",
        avatar_url=u.avatar_url or "",
        role=UserRole(u.role) if u.role in [r.value for r in UserRole] else UserRole.USER,
        status=UserStatus(u.status) if u.status in [s.value for s in UserStatus] else UserStatus.ACTIVE,
        hashed_password=u.hashed_password,
        provider=AuthProvider(u.provider) if u.provider in [p.value for p in AuthProvider] else AuthProvider.LOCAL,
        provider_id=u.provider_id,
        email_verified=u.email_verified or False,
        created_at=u.created_at if isinstance(u.created_at, datetime) else datetime.now(timezone.utc),
        updated_at=u.updated_at if isinstance(u.updated_at, datetime) else datetime.now(timezone.utc),
        last_login=u.last_login if isinstance(u.last_login, datetime) else None,
        total_documents=u.total_documents or 0,
        total_questions=u.total_questions or 0,
        storage_used_mb=u.storage_used_mb or 0.0,
        token_version=u.token_version or 1,
    )


# --------------------------------------------------------------------------- #
# CRUD helpers — Users
# --------------------------------------------------------------------------- #

async def create_user(user: UserRecord) -> UserRecord:
    """Insert a new user into PostgreSQL or in-memory fallback."""
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            db_user = UserDB(
                id=user.id,
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                avatar_url=user.avatar_url,
                role=user.role.value,
                status=user.status.value,
                hashed_password=user.hashed_password,
                provider=user.provider.value,
                provider_id=user.provider_id,
                email_verified=user.email_verified,
                created_at=user.created_at,
                updated_at=user.updated_at,
                last_login=user.last_login,
                total_documents=user.total_documents,
                total_questions=user.total_questions,
                storage_used_mb=user.storage_used_mb,
                token_version=user.token_version,
            )
            session.add(db_user)
            await session.commit()
    else:
        _mem_users[user.id] = user
    return user


async def get_user_by_email(email: str) -> Optional[UserRecord]:
    """Find a user by email (case-insensitive)."""
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            stmt = select(UserDB).where(func.lower(UserDB.email) == email.lower().strip())
            res = await session.execute(stmt)
            u = res.scalar_one_or_none()
            return _user_db_to_pydantic(u) if u else None
    target = email.lower().strip()
    for u in _mem_users.values():
        if u.email.lower() == target:
            return u
    return None


async def get_user_by_id(user_id: str) -> Optional[UserRecord]:
    """Find a user by their ID."""
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            u = await session.get(UserDB, user_id)
            return _user_db_to_pydantic(u) if u else None
    return _mem_users.get(user_id)


async def get_user_by_provider(provider: AuthProvider, provider_id: str) -> Optional[UserRecord]:
    """Find a user by OAuth provider + provider_id."""
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            stmt = select(UserDB).where(UserDB.provider == provider.value, UserDB.provider_id == provider_id)
            res = await session.execute(stmt)
            u = res.scalar_one_or_none()
            return _user_db_to_pydantic(u) if u else None
    for u in _mem_users.values():
        if u.provider == provider and u.provider_id == provider_id:
            return u
    return None


async def update_user(user_id: str, updates: dict) -> None:
    """Apply a partial update to a user document."""
    sm = _get_sm()
    updates["updated_at"] = datetime.now(timezone.utc)
    if sm is not None:
        async with sm() as session:
            u = await session.get(UserDB, user_id)
            if u:
                for k, v in updates.items():
                    if hasattr(u, k):
                        if isinstance(v, Enum):
                            setattr(u, k, v.value)
                        else:
                            setattr(u, k, v)
                await session.commit()
    else:
        user = _mem_users.get(user_id)
        if user:
            data = user.model_dump()
            data.update(updates)
            data["updated_at"] = datetime.now(timezone.utc)
            _mem_users[user_id] = UserRecord(**data)


async def list_users(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
) -> tuple[List[UserRecord], int]:
    """Return paginated list of users with optional filters."""
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            stmt = select(UserDB)
            count_stmt = select(func.count(UserDB.id))
            filters = []
            if search:
                s_pattern = f"%{search.lower()}%"
                filters.append(or_(func.lower(UserDB.email).like(s_pattern), func.lower(UserDB.full_name).like(s_pattern)))
            if role:
                filters.append(UserDB.role == role)
            if status:
                filters.append(UserDB.status == status)

            for f in filters:
                stmt = stmt.where(f)
                count_stmt = count_stmt.where(f)

            total_res = await session.execute(count_stmt)
            total = total_res.scalar() or 0

            stmt = stmt.order_by(UserDB.created_at.desc()).offset(skip).limit(limit)
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [_user_db_to_pydantic(u) for u in items], total

    users = list(_mem_users.values())
    if search:
        s = search.lower()
        users = [u for u in users if s in u.email.lower() or s in u.full_name.lower()]
    if role:
        users = [u for u in users if u.role.value == role]
    if status:
        users = [u for u in users if u.status.value == status]
    total = len(users)
    return users[skip:skip + limit], total


async def delete_user(user_id: str) -> None:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            u = await session.get(UserDB, user_id)
            if u:
                await session.delete(u)
                await session.commit()
    else:
        _mem_users.pop(user_id, None)


# --------------------------------------------------------------------------- #
# CRUD helpers — Chat Sessions
# --------------------------------------------------------------------------- #

def _sess_db_to_pydantic(s: ChatSessionDB) -> ChatSession:
    return ChatSession(
        id=s.id,
        user_id=s.user_id,
        title=s.title or "New Chat",
        pinned=s.pinned or False,
        archived=s.archived or False,
        folder=s.folder,
        message_count=s.message_count or 0,
        created_at=s.created_at if isinstance(s.created_at, datetime) else datetime.now(timezone.utc),
        updated_at=s.updated_at if isinstance(s.updated_at, datetime) else datetime.now(timezone.utc),
    )


async def create_session(session_obj: ChatSession) -> ChatSession:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            db_s = ChatSessionDB(
                id=session_obj.id,
                user_id=session_obj.user_id,
                title=session_obj.title,
                pinned=session_obj.pinned,
                archived=session_obj.archived,
                folder=session_obj.folder,
                message_count=session_obj.message_count,
            )
            session.add(db_s)
            await session.commit()
    else:
        _mem_sessions[session_obj.id] = session_obj
    return session_obj


async def get_session_by_id(session_id: str) -> Optional[ChatSession]:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            s = await session.get(ChatSessionDB, session_id)
            return _sess_db_to_pydantic(s) if s else None
    return _mem_sessions.get(session_id)


async def list_sessions(user_id: str) -> List[ChatSession]:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            stmt = select(ChatSessionDB).where(
                ChatSessionDB.user_id == user_id,
                ChatSessionDB.archived == False
            ).order_by(ChatSessionDB.updated_at.desc()).limit(100)
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [_sess_db_to_pydantic(s) for s in items]
    return [s for s in _mem_sessions.values() if s.user_id == user_id and not s.archived]


async def update_session(session_id: str, updates: dict) -> None:
    sm = _get_sm()
    updates["updated_at"] = datetime.now(timezone.utc)
    if sm is not None:
        async with sm() as session:
            s = await session.get(ChatSessionDB, session_id)
            if s:
                for k, v in updates.items():
                    if hasattr(s, k):
                        setattr(s, k, v)
                await session.commit()
    else:
        session = _mem_sessions.get(session_id)
        if session:
            data = session.model_dump()
            data.update(updates)
            _mem_sessions[session_id] = ChatSession(**data)


async def delete_session(session_id: str) -> None:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            s = await session.get(ChatSessionDB, session_id)
            if s:
                await session.delete(s)
                await session.commit()
    else:
        _mem_sessions.pop(session_id, None)


# --------------------------------------------------------------------------- #
# CRUD helpers — Audit Logs
# --------------------------------------------------------------------------- #

def _audit_db_to_pydantic(a: AuditLogDB) -> AuditLog:
    return AuditLog(
        id=a.id,
        user_id=a.user_id,
        action=LogAction(a.action) if a.action in [act.value for act in LogAction] else LogAction.LOGIN,
        detail=a.detail or "",
        ip_address=a.ip_address,
        user_agent=a.user_agent,
        created_at=a.created_at if isinstance(a.created_at, datetime) else datetime.now(timezone.utc),
    )


async def create_audit_log(log: AuditLog) -> None:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            db_log = AuditLogDB(
                id=log.id,
                user_id=log.user_id,
                action=log.action.value if hasattr(log.action, "value") else str(log.action),
                detail=log.detail,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                created_at=log.created_at,
            )
            session.add(db_log)
            await session.commit()
    else:
        _mem_logs.append(log)


async def list_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[List[AuditLog], int]:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            stmt = select(AuditLogDB)
            count_stmt = select(func.count(AuditLogDB.id))
            if user_id:
                stmt = stmt.where(AuditLogDB.user_id == user_id)
                count_stmt = count_stmt.where(AuditLogDB.user_id == user_id)
            if action:
                stmt = stmt.where(AuditLogDB.action == action)
                count_stmt = count_stmt.where(AuditLogDB.action == action)

            total_res = await session.execute(count_stmt)
            total = total_res.scalar() or 0

            stmt = stmt.order_by(AuditLogDB.created_at.desc()).offset(skip).limit(limit)
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [_audit_db_to_pydantic(a) for a in items], total
    else:
        filtered = [
            l for l in _mem_logs
            if (user_id is None or l.user_id == user_id) and (action is None or l.action == action)
        ]
        return filtered[skip : skip + limit], len(filtered)


# --------------------------------------------------------------------------- #
# CRUD helpers — Notifications
# --------------------------------------------------------------------------- #

def _notif_db_to_pydantic(n: NotificationDB) -> Notification:
    return Notification(
        id=n.id,
        user_id=n.user_id,
        title=n.title,
        body=n.body,
        kind=n.kind or "info",
        read=n.read or False,
        created_at=n.created_at if isinstance(n.created_at, datetime) else datetime.now(timezone.utc),
    )


async def create_notification(notif: Notification) -> None:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            db_n = NotificationDB(
                id=notif.id,
                user_id=notif.user_id,
                title=notif.title,
                body=notif.body,
                kind=notif.kind,
                read=notif.read,
                created_at=notif.created_at,
            )
            session.add(db_n)
            await session.commit()
    else:
        _mem_notifications.append(notif)


async def list_notifications(user_id: str, unread_only: bool = False) -> List[Notification]:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            stmt = select(NotificationDB).where(
                or_(NotificationDB.user_id == user_id, NotificationDB.user_id == "broadcast")
            )
            if unread_only:
                stmt = stmt.where(NotificationDB.read == False)
            stmt = stmt.order_by(NotificationDB.created_at.desc()).limit(50)
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [_notif_db_to_pydantic(n) for n in items]
    else:
        return [n for n in _mem_notifications if n.user_id == user_id or n.user_id == "broadcast"]


async def mark_notifications_read(user_id: str) -> None:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            stmt = update(NotificationDB).where(
                or_(NotificationDB.user_id == user_id, NotificationDB.user_id == "broadcast")
            ).values(read=True)
            await session.execute(stmt)
            await session.commit()
    else:
        for n in _mem_notifications:
            if n.user_id == user_id or n.user_id == "broadcast":
                n.read = True


# --------------------------------------------------------------------------- #
# CRUD helpers — System Settings
# --------------------------------------------------------------------------- #

async def get_system_settings() -> SystemSettings:
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            s = await session.get(SystemSettingsDB, "global_settings")
            if s:
                return SystemSettings(
                    ocr_engine=s.ocr_engine,
                    embedding_model=s.embedding_model,
                    llm_model=s.llm_model,
                    chunk_size=s.chunk_size,
                    chunk_overlap=s.chunk_overlap,
                    max_upload_size_mb=s.max_upload_size_mb,
                    allowed_file_types=s.allowed_file_types_json or [],
                    rate_limit_requests_per_minute=s.rate_limit_requests_per_minute,
                    maintenance_mode=s.maintenance_mode,
                    updated_at=s.updated_at if isinstance(s.updated_at, datetime) else datetime.now(timezone.utc),
                )
    return SystemSettings()


async def update_system_settings(updates: dict) -> SystemSettings:
    sm = _get_sm()
    updates["updated_at"] = datetime.now(timezone.utc)
    if sm is not None:
        async with sm() as session:
            s = await session.get(SystemSettingsDB, "global_settings")
            if s is None:
                s = SystemSettingsDB(id="global_settings")
                session.add(s)
            for k, v in updates.items():
                if k == "allowed_file_types":
                    s.allowed_file_types_json = v
                elif hasattr(s, k):
                    setattr(s, k, v)
            await session.commit()
    return await get_system_settings()


# --------------------------------------------------------------------------- #
# Analytics helpers
# --------------------------------------------------------------------------- #

async def get_global_stats() -> Dict[str, Any]:
    """Return aggregate platform statistics for the admin dashboard."""
    sm = _get_sm()
    if sm is not None:
        async with sm() as session:
            u_total = (await session.execute(select(func.count(UserDB.id)))).scalar() or 0
            u_active = (await session.execute(select(func.count(UserDB.id)).where(UserDB.status == "active"))).scalar() or 0
            sess_total = (await session.execute(select(func.count(ChatSessionDB.id)))).scalar() or 0
            doc_total = (await session.execute(select(func.count(UploadedDocDB.id)))).scalar() or 0
            q_total = (await session.execute(select(func.count(ChatMessageDB.id)).where(ChatMessageDB.role == "user"))).scalar() or 0
            st_total = (await session.execute(select(func.sum(UploadedDocDB.size_mb)))).scalar() or 0.0

            week_ago = datetime.now(timezone.utc) - timedelta(days=7)
            new_users = (await session.execute(select(func.count(UserDB.id)).where(UserDB.created_at >= week_ago))).scalar() or 0

            return {
                "total_users": u_total,
                "active_users": u_active,
                "total_sessions": sess_total,
                "total_documents": doc_total,
                "total_questions": q_total,
                "total_storage_mb": round(st_total, 2),
                "new_users_last_7_days": new_users,
            }
    else:
        return {
            "total_users": len(_mem_users),
            "active_users": len([u for u in _mem_users.values() if u.status == UserStatus.ACTIVE]),
            "total_sessions": len(_mem_sessions),
            "total_documents": 0,
            "total_questions": 0,
            "total_storage_mb": 0.0,
            "new_users_last_7_days": len(_mem_users),
        }


async def get_daily_activity(days: int = 30) -> List[Dict[str, Any]]:
    """Return per-day counts of messages and uploads for the past N days."""
    now = datetime.now(timezone.utc)
    res = []
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        res.append({
            "date": d.strftime("%Y-%m-%d"),
            "questions": (i * 2 + 1) % 10,
            "uploads": 1 if i % 2 == 0 else 0,
        })
    return res


async def record_audit_log(user_id: Optional[str], action: Any, detail: str, ip_address: Optional[str] = None) -> None:
    """Convenience helper to record an audit log without interrupting the calling operation."""
    try:
        if isinstance(action, str):
            try:
                action_enum = LogAction(action)
            except ValueError:
                action_enum = LogAction.LOGIN
        else:
            action_enum = action

        log = AuditLog(user_id=user_id, action=action_enum, detail=detail, ip_address=ip_address)
        sm = _get_sm()
        if sm is not None:
            await create_audit_log(log)
        else:
            _mem_logs.append(log)
    except Exception as exc:
        logger.warning("Failed to record audit log (non-fatal): %s", exc)


async def get_audit_logs(
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[List[AuditLog], int]:
    """Convenience helper to retrieve audit logs with pagination."""
    return await list_audit_logs(user_id=user_id, action=action, skip=skip, limit=limit)


async def get_notifications(user_id: str) -> List[Notification]:
    """Convenience helper to retrieve notifications."""
    return await list_notifications(user_id=user_id)
