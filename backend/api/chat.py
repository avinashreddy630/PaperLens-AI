"""
api/chat.py
Chat conversation and history endpoints for PaperLens AI.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from core.security import get_optional_user
from database.models import get_history
from database.user_models import UserRecord
from services.chat_service import ask_question

logger = logging.getLogger("ss_spark.chat_api")
router = APIRouter(tags=["Chat"])


class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = None


@router.post("/api/chat")
async def chat_endpoint(
    req: ChatRequest,
    current_user: Optional[UserRecord] = Depends(get_optional_user),
):
    """
    Submit a question for AI answering.
    Automatically routes between PaperQA RAG and general conversational AI.
    """
    if not req.question or not req.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    user_id = current_user.id if current_user else None
    try:
        result = await ask_question(
            question=req.question.strip(),
            session_id=req.session_id,
            user_id=user_id,
        )
        return result
    except Exception as exc:
        logger.exception("Error processing chat request: %s", exc)
        return {
            "success": True,
            "data": {
                "answer": (
                    f"⚠️ An unexpected error occurred: `{str(exc)}`\n\n"
                    "Please check your API key in **Settings (⚙️)** or try again."
                ),
                "source": "N/A",
                "page": 0,
                "confidence": None,
                "citations": [],
                "references": "",
                "session_id": req.session_id or "",
                "cost": 0.0,
                "status": "error",
            },
            "message": str(exc),
        }


@router.get("/api/history")
async def history_endpoint(
    session_id: str = Query(..., description="Chat session ID"),
    limit: int = Query(50, ge=1, le=200, description="Max messages to return"),
    current_user: Optional[UserRecord] = Depends(get_optional_user),
):
    """Fetch past chat messages for a session."""
    user_id = current_user.id if current_user else None
    messages = await get_history(session_id=session_id, limit=limit, user_id=user_id)

    formatted = [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "created_at": m.created_at,
            "confidence": m.confidence,
            "citations": [
                {
                    "id": c.id,
                    "source": c.source,
                    "page": c.page,
                    "snippet": c.snippet,
                    "relevance": c.relevance,
                }
                for c in m.citations
            ],
        }
        for m in messages
    ]

    return {
        "success": True,
        "data": formatted,
    }
