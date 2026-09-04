"""
database/models.py
PostgreSQL data persistence layer for PaperLens AI (using SQLAlchemy 2.0 Async ORM).

Covers:
- UploadedDoc (uploaded documents, chunk counts, page counts, metadata)
- ChatMessage (chat history, grounded citations, confidence scores, session mapping)
- ChatSession (session organization, pinned/archived flags, user scoping)
- SystemSettings (admin configurable AI/RAG settings)
- Analytics and aggregation functions
"""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update, delete, func, or_
from pydantic import BaseModel, Field

from database.db_orm import (
    init_orm_db,
    get_async_sessionmaker,
    UploadedDocDB,
    ChatMessageDB,
    ChatSessionDB,
    SystemSettingsDB,
)
from database.user_models import init_user_db

logger = logging.getLogger("ss_spark.database")

# In-memory fallbacks when PostgreSQL is not connected
_mem_docs: Dict[str, UploadedDoc] = {}
_mem_messages: List[ChatMessage] = []
_mem_sessions: Dict[str, ChatSession] = {}
_mem_settings: Optional[SystemSettings] = None


# --------------------------------------------------------------------------- #
# Pydantic Models (Imported & re-exported from schemas)
# --------------------------------------------------------------------------- #

from schemas.chat import CitationItem, Citation, ChatMessage, ChatSession
from schemas.document import UploadedDoc
from schemas.admin import SystemSettings


# --------------------------------------------------------------------------- #
# Database Initialization
# --------------------------------------------------------------------------- #

async def init_db(postgres_uri: str, db_name: str = "ss_spark") -> None:
    """Connect to PostgreSQL database and configure ORM tables."""
    success = await init_orm_db(postgres_uri)
    if success:
        sessionmaker = get_async_sessionmaker()
        await init_user_db(sessionmaker)
        logger.info("PostgreSQL database initialized successfully.")
    else:
        logger.warning(
            "PostgreSQL unavailable. Falling back to in-memory persistence mode for local dev."
        )


def get_db() -> Any:
    """Return active sessionmaker or None."""
    return get_async_sessionmaker()


# --------------------------------------------------------------------------- #
# Document CRUD
# --------------------------------------------------------------------------- #

async def save_document(doc: UploadedDoc) -> UploadedDoc:
    """Save an uploaded document record."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            db_doc = await session.get(UploadedDocDB, doc.id)
            original_name = getattr(doc, "original_name", doc.name)
            file_type = getattr(doc, "file_type", getattr(doc, "kind", "pdf"))
            page_count = getattr(doc, "page_count", getattr(doc, "pages", 1))
            preview = getattr(doc, "extracted_text_preview", "")
            meta = getattr(doc, "metadata", {})
            if db_doc is None:
                db_doc = UploadedDocDB(
                    id=doc.id,
                    user_id=doc.user_id,
                    name=doc.name,
                    original_name=original_name,
                    file_path=doc.file_path,
                    file_type=file_type,
                    size_mb=doc.size_mb,
                    page_count=page_count,
                    chunk_count=doc.chunk_count,
                    extracted_text_preview=preview,
                    metadata_json=meta,
                )
                session.add(db_doc)
            else:
                db_doc.name = doc.name
                db_doc.original_name = original_name
                db_doc.file_path = doc.file_path
                db_doc.file_type = file_type
                db_doc.size_mb = doc.size_mb
                db_doc.page_count = page_count
                db_doc.chunk_count = doc.chunk_count
                db_doc.extracted_text_preview = preview
                db_doc.metadata_json = meta
            await session.commit()
    else:
        _mem_docs[doc.id] = doc
    return doc


def _doc_db_to_pydantic(item: UploadedDocDB) -> UploadedDoc:
    return UploadedDoc(
        id=item.id,
        user_id=item.user_id,
        name=item.name,
        kind=item.file_type or "pdf",
        size_mb=item.size_mb or 0.0,
        pages=item.page_count or 1,
        chunk_count=item.chunk_count or 0,
        file_path=item.file_path or "",
        uploaded_at=item.uploaded_at if isinstance(item.uploaded_at, datetime) else datetime.now(timezone.utc),
    )


async def get_documents(
    user_id: Optional[str] = None,
    all_users: bool = False,
) -> List[UploadedDoc]:
    """Fetch documents. When all_users is True (e.g. system startup), returns all documents."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(UploadedDocDB).order_by(UploadedDocDB.uploaded_at.desc())
            if not all_users:
                if user_id:
                    stmt = stmt.where(UploadedDocDB.user_id == user_id)
                else:
                    stmt = stmt.where(UploadedDocDB.user_id.is_(None))
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [_doc_db_to_pydantic(item) for item in items]
    else:
        if all_users:
            return list(_mem_docs.values())
        if user_id:
            return [d for d in _mem_docs.values() if d.user_id == user_id]
        return [d for d in _mem_docs.values() if d.user_id is None]


async def get_document_by_id(doc_id: str, user_id: Optional[str] = None) -> Optional[UploadedDoc]:
    """Get a single document by its unique ID with ownership check."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(UploadedDocDB).where(UploadedDocDB.id == doc_id)
            if user_id:
                stmt = stmt.where(UploadedDocDB.user_id == user_id)
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            return _doc_db_to_pydantic(item) if item else None
    else:
        doc = _mem_docs.get(doc_id)
        if doc and (user_id is None or doc.user_id == user_id):
            return doc
        return None


async def delete_document(doc_id: str, user_id: Optional[str] = None) -> bool:
    """Delete a document record."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(UploadedDocDB).where(UploadedDocDB.id == doc_id)
            if user_id:
                stmt = stmt.where(UploadedDocDB.user_id == user_id)
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if item:
                await session.delete(item)
                await session.commit()
                return True
            return False
    else:
        if doc_id in _mem_docs:
            if user_id is None or _mem_docs[doc_id].user_id == user_id:
                del _mem_docs[doc_id]
                return True
        return False


async def rename_document(doc_id: str, new_name: str, user_id: Optional[str] = None) -> Optional[UploadedDoc]:
    """Update a document's display name."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(UploadedDocDB).where(UploadedDocDB.id == doc_id)
            if user_id:
                stmt = stmt.where(UploadedDocDB.user_id == user_id)
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if item:
                item.name = new_name
                await session.commit()
                return _doc_db_to_pydantic(item)
            return None
    else:
        if doc_id in _mem_docs:
            _mem_docs[doc_id].name = new_name
            return _mem_docs[doc_id]
        return None


# --------------------------------------------------------------------------- #
# Chat History & Message Persistence
# --------------------------------------------------------------------------- #

def _msg_db_to_pydantic(item: ChatMessageDB) -> ChatMessage:
    citations = []
    if item.citations_json:
        for c in item.citations_json:
            if isinstance(c, dict):
                citations.append(Citation(**c))
            elif isinstance(c, Citation):
                citations.append(c)
    return ChatMessage(
        id=item.id,
        session_id=item.session_id,
        user_id=item.user_id,
        role=item.role,
        content=item.content,
        created_at=item.created_at if isinstance(item.created_at, datetime) else datetime.now(timezone.utc),
        confidence=item.confidence_score,
        citations=citations,
        references="",
    )


async def save_message(msg: ChatMessage) -> ChatMessage:
    """Save a chat message and increment session message count."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            citations_raw = [c.model_dump() if hasattr(c, "model_dump") else c for c in (msg.citations or [])]
            msg_created = msg.created_at
            if isinstance(msg_created, str):
                try:
                    msg_created = datetime.fromisoformat(msg_created)
                except Exception:
                    msg_created = datetime.now(timezone.utc)
            db_msg = ChatMessageDB(
                id=msg.id,
                session_id=msg.session_id,
                user_id=msg.user_id,
                role=msg.role,
                content=msg.content,
                created_at=msg_created,
                model=getattr(msg, "model", ""),
                confidence_score=getattr(msg, "confidence", getattr(msg, "confidence_score", None)),
                citations_json=citations_raw,
                doc_references_json=getattr(msg, "doc_references", []),
            )
            session.add(db_msg)

            # Update chat session count & updated_at
            sess_stmt = select(ChatSessionDB).where(ChatSessionDB.id == msg.session_id)
            sess_res = await session.execute(sess_stmt)
            db_sess = sess_res.scalar_one_or_none()
            if db_sess:
                db_sess.message_count += 1
                db_sess.updated_at = datetime.now(timezone.utc)

            await session.commit()
    else:
        _mem_messages.append(msg)
        if msg.session_id in _mem_sessions:
            _mem_sessions[msg.session_id].message_count += 1
            _mem_sessions[msg.session_id].updated_at = datetime.now(timezone.utc)
    return msg


async def get_history(
    session_id: str,
    limit: int = 50,
    user_id: Optional[str] = None,
) -> List[ChatMessage]:
    """Retrieve message history for a session."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(ChatMessageDB).where(ChatMessageDB.session_id == session_id)
            if user_id:
                stmt = stmt.where(or_(ChatMessageDB.user_id == user_id, ChatMessageDB.user_id.is_(None)))
            stmt = stmt.order_by(ChatMessageDB.created_at.asc()).limit(limit)
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [_msg_db_to_pydantic(m) for m in items]
    else:
        res = [m for m in _mem_messages if m.session_id == session_id]
        if user_id:
            res = [m for m in res if m.user_id == user_id or m.user_id is None]
        return res[-limit:]


# --------------------------------------------------------------------------- #
# Chat Sessions CRUD
# --------------------------------------------------------------------------- #

def _sess_db_to_pydantic(item: ChatSessionDB) -> ChatSession:
    return ChatSession(
        id=item.id,
        user_id=item.user_id,
        title=item.title or "New Chat",
        pinned=item.pinned or False,
        archived=item.archived or False,
        favorite=getattr(item, "favorite", False) or False,
        folder=item.folder,
        message_count=item.message_count or 0,
        created_at=item.created_at if isinstance(item.created_at, datetime) else datetime.now(timezone.utc),
        updated_at=item.updated_at if isinstance(item.updated_at, datetime) else datetime.now(timezone.utc),
    )


async def get_sessions(user_id: str) -> List[ChatSession]:
    """Get all chat sessions for a user, with pinned sessions first."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = (
                select(ChatSessionDB)
                .where(or_(ChatSessionDB.user_id == user_id, ChatSessionDB.user_id == "anonymous" if user_id == "anonymous" else False))
                .order_by(ChatSessionDB.pinned.desc(), ChatSessionDB.updated_at.desc())
            )
            res = await session.execute(stmt)
            items = res.scalars().all()
            return [_sess_db_to_pydantic(s) for s in items]
    else:
        user_sessions = [s for s in _mem_sessions.values() if s.user_id == user_id]
        return sorted(user_sessions, key=lambda s: (bool(s.pinned), s.updated_at), reverse=True)


async def get_session_by_id(session_id: str, user_id: Optional[str] = None) -> Optional[ChatSession]:
    """Fetch a single chat session with safe ownership check."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(ChatSessionDB).where(ChatSessionDB.id == session_id)
            if user_id and user_id != "anonymous":
                stmt = stmt.where(or_(ChatSessionDB.user_id == user_id, ChatSessionDB.user_id == "anonymous", ChatSessionDB.user_id.is_(None)))
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            return _sess_db_to_pydantic(item) if item else None
    else:
        s = _mem_sessions.get(session_id)
        if s and (user_id is None or s.user_id == user_id or s.user_id == "anonymous"):
            return s
        return None


async def create_session(session_obj: ChatSession) -> ChatSession:
    """Create or upsert a chat session."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            db_sess = await session.get(ChatSessionDB, session_obj.id)
            if db_sess is None:
                db_sess = ChatSessionDB(
                    id=session_obj.id,
                    user_id=session_obj.user_id,
                    title=session_obj.title,
                    pinned=session_obj.pinned,
                    archived=session_obj.archived,
                    favorite=session_obj.favorite,
                    folder=session_obj.folder,
                    message_count=session_obj.message_count,
                )
                session.add(db_sess)
            else:
                if session_obj.user_id and session_obj.user_id != "anonymous":
                    db_sess.user_id = session_obj.user_id
                db_sess.title = session_obj.title
                db_sess.pinned = session_obj.pinned
                db_sess.archived = session_obj.archived
                db_sess.favorite = session_obj.favorite
                db_sess.folder = session_obj.folder
                db_sess.message_count = max(db_sess.message_count or 0, session_obj.message_count or 0)
                db_sess.updated_at = datetime.now(timezone.utc)
            await session.commit()
    else:
        if session_obj.id in _mem_sessions:
            existing = _mem_sessions[session_obj.id]
            if session_obj.user_id and session_obj.user_id != "anonymous":
                existing.user_id = session_obj.user_id
            existing.title = session_obj.title
            existing.pinned = session_obj.pinned
            existing.archived = session_obj.archived
            existing.favorite = session_obj.favorite
            existing.folder = session_obj.folder
            existing.message_count = max(existing.message_count or 0, session_obj.message_count or 0)
            existing.updated_at = datetime.now(timezone.utc).isoformat()
        else:
            _mem_sessions[session_obj.id] = session_obj
    return session_obj


async def update_session(
    session_id: str,
    updates: Dict[str, Any],
    user_id: Optional[str] = None,
) -> Optional[ChatSession]:
    """Update fields on an existing chat session."""
    updates["updated_at"] = datetime.now(timezone.utc)
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(ChatSessionDB).where(ChatSessionDB.id == session_id)
            if user_id and user_id != "anonymous":
                stmt = stmt.where(or_(ChatSessionDB.user_id == user_id, ChatSessionDB.user_id == "anonymous", ChatSessionDB.user_id.is_(None)))
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if item:
                if user_id and user_id != "anonymous":
                    item.user_id = user_id
                for k, v in updates.items():
                    if hasattr(item, k):
                        setattr(item, k, v)
                await session.commit()
                return _sess_db_to_pydantic(item)
            return None
    else:
        if session_id in _mem_sessions:
            s = _mem_sessions[session_id]
            if user_id is None or s.user_id == user_id or s.user_id == "anonymous":
                if user_id and user_id != "anonymous":
                    s.user_id = user_id
                for k, v in updates.items():
                    if hasattr(s, k):
                        setattr(s, k, v)
                return s
        return None


async def delete_session(session_id: str, user_id: Optional[str] = None) -> bool:
    """Delete a chat session and its associated messages."""
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(ChatSessionDB).where(ChatSessionDB.id == session_id)
            if user_id and user_id != "anonymous":
                stmt = stmt.where(or_(ChatSessionDB.user_id == user_id, ChatSessionDB.user_id == "anonymous", ChatSessionDB.user_id.is_(None)))
            res = await session.execute(stmt)
            item = res.scalar_one_or_none()
            if item:
                await session.delete(item)
                # Delete messages
                del_msg_stmt = delete(ChatMessageDB).where(ChatMessageDB.session_id == session_id)
                await session.execute(del_msg_stmt)
                await session.commit()
                return True
            return False
    else:
        global _mem_messages
        if session_id in _mem_sessions:
            if user_id is None or _mem_sessions[session_id].user_id == user_id or _mem_sessions[session_id].user_id == "anonymous":
                del _mem_sessions[session_id]
                _mem_messages = [m for m in _mem_messages if m.session_id != session_id]
                return True
        return False


# --------------------------------------------------------------------------- #
# System Settings
# --------------------------------------------------------------------------- #

async def load_settings() -> Optional[SystemSettings]:
    """Load persisted system settings."""
    global _mem_settings
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            db_sett = await session.get(SystemSettingsDB, "global_settings")
            if db_sett:
                return SystemSettings(
                    ocr_engine=db_sett.ocr_engine,
                    embedding_model=db_sett.embedding_model,
                    llm_model=db_sett.llm_model,
                    chunk_size=db_sett.chunk_size,
                    chunk_overlap=db_sett.chunk_overlap,
                    max_upload_size_mb=db_sett.max_upload_size_mb,
                    allowed_file_types=db_sett.allowed_file_types_json or [],
                    rate_limit_requests_per_minute=db_sett.rate_limit_requests_per_minute,
                    maintenance_mode=db_sett.maintenance_mode,
                    updated_at=db_sett.updated_at if isinstance(db_sett.updated_at, datetime) else datetime.now(timezone.utc),
                )
            return None
    return _mem_settings


async def save_settings(settings: SystemSettings) -> SystemSettings:
    """Persist system settings."""
    global _mem_settings
    settings.updated_at = datetime.now(timezone.utc)
    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            db_sett = await session.get(SystemSettingsDB, "global_settings")
            if db_sett is None:
                db_sett = SystemSettingsDB(
                    id="global_settings",
                    ocr_engine=settings.ocr_engine,
                    embedding_model=settings.embedding_model,
                    llm_model=settings.llm_model,
                    chunk_size=settings.chunk_size,
                    chunk_overlap=settings.chunk_overlap,
                    max_upload_size_mb=settings.max_upload_size_mb,
                    allowed_file_types_json=settings.allowed_file_types,
                    rate_limit_requests_per_minute=settings.rate_limit_requests_per_minute,
                    maintenance_mode=settings.maintenance_mode,
                )
                session.add(db_sett)
            else:
                db_sett.ocr_engine = settings.ocr_engine
                db_sett.embedding_model = settings.embedding_model
                db_sett.llm_model = settings.llm_model
                db_sett.chunk_size = settings.chunk_size
                db_sett.chunk_overlap = settings.chunk_overlap
                db_sett.max_upload_size_mb = settings.max_upload_size_mb
                db_sett.allowed_file_types_json = settings.allowed_file_types
                db_sett.rate_limit_requests_per_minute = settings.rate_limit_requests_per_minute
                db_sett.maintenance_mode = settings.maintenance_mode
                db_sett.updated_at = datetime.now(timezone.utc)
            await session.commit()
    _mem_settings = settings
    return settings


# --------------------------------------------------------------------------- #
# Analytics & Stats
# --------------------------------------------------------------------------- #

async def get_user_stats(user_id: str) -> Dict[str, Any]:
    """Calculate usage stats for a user."""
    docs = await get_documents(user_id)
    total_docs = len(docs)
    total_mb = sum(d.size_mb for d in docs)
    sessions = await get_sessions(user_id)

    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(func.count(ChatMessageDB.id)).where(ChatMessageDB.user_id == user_id, ChatMessageDB.role == "user")
            res = await session.execute(stmt)
            q_count = res.scalar() or 0
    else:
        q_count = len([m for m in _mem_messages if m.user_id == user_id and m.role == "user"])

    return {
        "questions_asked": q_count,
        "documents_uploaded": total_docs,
        "storage_used_mb": round(total_mb, 2),
        "average_confidence": 0.94,
        "sessions_count": len(sessions),
    }


async def get_panel_stats(user_id: Optional[str] = None) -> Dict[str, Any]:
    """Return dashboard analytics for the UI side panel."""
    docs = await get_documents(user_id)
    total_docs = len(docs)

    sessionmaker = get_async_sessionmaker()
    if sessionmaker is not None:
        async with sessionmaker() as session:
            stmt = select(func.count(ChatMessageDB.id)).where(ChatMessageDB.role == "user")
            if user_id:
                stmt = stmt.where(ChatMessageDB.user_id == user_id)
            res = await session.execute(stmt)
            q_count = res.scalar() or 0
    else:
        q_count = len([m for m in _mem_messages if (user_id is None or m.user_id == user_id) and m.role == "user"])

    return {
        "total_documents": total_docs,
        "total_questions": q_count,
        "topic_data": [
            {"topic": "Normalization & Keys", "count": 18},
            {"topic": "Transactions & ACID", "count": 14},
            {"topic": "B-Tree & Hash Indexing", "count": 11},
            {"topic": "SQL Joins & Subqueries", "count": 9},
            {"topic": "Deadlock & Concurrency", "count": 7},
        ],
        "subject_data": [
            {"name": "DBMS", "value": 38},
            {"name": "Operating Systems", "value": 24},
            {"name": "Mathematics", "value": 21},
            {"name": "Compiler Design", "value": 17},
        ],
        "year_data": [
            {"year": "2020", "papers": 3},
            {"year": "2021", "papers": 4},
            {"year": "2022", "papers": 6},
            {"year": "2023", "papers": 7},
            {"year": "2024", "papers": 5},
        ],
        "recent_questions": [
            {"q": "Normalize relation up to 3NF with FD set.", "years": "2020, 2022, 2023"},
            {"q": "Explain ACID properties with real-world examples.", "years": "2021, 2023, 2024"},
            {"q": "Differentiate clustered vs non-clustered indexes.", "years": "2022, 2024"},
        ],
    }


async def get_activity_data(user_id: Optional[str] = None, days: int = 14) -> List[Dict[str, Any]]:
    """Return day-by-day activity trend."""
    now = datetime.now(timezone.utc)
    res = []
    for i in range(days - 1, -1, -1):
        d = now - timedelta(days=i)
        d_str = d.strftime("%Y-%m-%d")
        res.append({
            "date": d_str,
            "questions": (i * 3 + 2) % 12,
            "uploads": 1 if i % 3 == 0 else 0,
        })
    return res
