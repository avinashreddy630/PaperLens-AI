"""
services/chat_service.py

Hybrid RAG + General-Chat orchestration for the /api/chat endpoint.

Decision logic
──────────────
                    User sends message
                           │
              Are documents indexed?
                    /         \\
                  NO          YES
                  │             │
                  ▼             ▼
            General AI    is_question_relevant_to_docs()?
              answer        /              \\
                       Relevant          Not relevant
                          │                   │
                          ▼                   ▼
                    RAG (PaperQA          General AI
                    + Qdrant)              answer
                          │                   │
                          └────────┬──────────┘
                                   ▼
                    Persist + return structured JSON

Flow (RAG path):
    1. Persist user message to MongoDB
    2. Call PaperQA connector (agent_query internally)
    3. Map PaperQA AnswerResponse → API response format
    4. Enrich citations with Qdrant vector search (additive — safe if offline)
    5. Persist assistant message to MongoDB
    6. Return structured JSON matching the frontend contract

Flow (General path):
    1. Persist user message to MongoDB
    2. Call general_llm.general_chat() via litellm directly
    3. Return same JSON shape (citations=[], status="general")
    4. Persist assistant message
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


async def ask_question(
    question: str,
    session_id: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Hybrid RAG + General-Chat pipeline with full multi-turn conversational memory.

    Returns the standard API contract::

        {
            "success": True,
            "data": {
                "answer":     str,
                "source":     str,      # primary source filename ("N/A" for general)
                "page":       int,      # primary source page (0 for general)
                "confidence": float | None,
                "citations":  [{id, source, page, snippet, relevance}],
                "references": str,      # formatted bibliography (empty for general)
                "session_id": str,
                "cost":       float,
                "status":     str,      # "success"|"partial"|"unsure"|"general"|"error"
            },
            "message": str,
        }
    """
    from rag.paperqa_connector import query as pqa_query, get_indexed_count, get_indexed_paths
    from rag.general_llm import general_chat, is_question_relevant_to_docs, contextualize_query
    from rag.retriever import retrieve as qdrant_retrieve
    from database import models
    from core.config import get_settings

    sid = session_id or str(uuid.uuid4())
    sess_user_id = user_id or "anonymous"
    clean_title = question.strip().replace("\n", " ")
    if len(clean_title) > 48:
        last_space = clean_title[:45].rfind(" ")
        clean_title = (clean_title[:last_space] if last_space > 15 else clean_title[:42]).strip() + "…"

    # ------------------------------------------------------------------ #
    # 0a. Ensure ChatSession exists upfront so it appears in recent chats
    # ------------------------------------------------------------------ #
    try:
        existing_sess = await models.get_session_by_id(sid, user_id=sess_user_id)
        if not existing_sess:
            new_sess = models.ChatSession(
                id=sid,
                user_id=sess_user_id,
                title=clean_title or "New Chat",
                message_count=1,
            )
            await models.create_session(new_sess)
        elif existing_sess.title in ("New Chat", "", None):
            await models.update_session(
                sid,
                {"title": clean_title or "New Chat"},
                user_id=sess_user_id,
            )
    except Exception as sess_err:
        logger.warning("Failed upfront chat session creation (non-fatal): %s", sess_err)

    # ------------------------------------------------------------------ #
    # 0b. Retrieve conversation history for multi-turn context memory
    # ------------------------------------------------------------------ #
    prior_messages = await models.get_history(session_id=sid, limit=16, user_id=user_id)
    chat_history: List[Dict[str, str]] = [
        {"role": msg.role, "content": msg.content}
        for msg in prior_messages
        if msg.role in ("user", "assistant") and msg.content
    ]

    # ------------------------------------------------------------------ #
    # 1. Persist user message
    # ------------------------------------------------------------------ #
    user_msg = models.ChatMessage(
        session_id=sid,
        role="user",
        content=question,
        user_id=user_id,
    )
    await models.save_message(user_msg)

    # ------------------------------------------------------------------ #
    # 2. Document count & Instant Vector Retrieval
    # ------------------------------------------------------------------ #
    docs_count = get_indexed_count(user_id=user_id)
    retrieved_chunks = []
    
    if docs_count > 0:
        try:
            cfg = get_settings()
            # Instant parallel vector search (typically < 20ms)
            retrieval_res = await qdrant_retrieve(
                question,
                n_results=cfg.TOP_K_RESULTS or 6,
                user_id=user_id,
            )
            retrieved_chunks = retrieval_res.chunks
        except Exception as exc:
            logger.warning("Vector retrieval encountered an exception: %s", exc)

    # ------------------------------------------------------------------ #
    # 3. Grounded Synthesis vs Fast General Chat Decision
    # ------------------------------------------------------------------ #
    # Check if we have strong matching chunks from uploaded materials
    has_grounded_evidence = bool(
        retrieved_chunks and any(c.relevance >= 0.38 for c in retrieved_chunks)
    )

    if has_grounded_evidence:
        logger.info(
            "Found %d high-relevance document chunks for user %s (top score=%.3f) — generating grounded answer",
            len(retrieved_chunks),
            user_id,
            retrieved_chunks[0].relevance if retrieved_chunks else 0.0,
        )
        
        # Build clean structured context
        context_parts = []
        for i, c in enumerate(retrieved_chunks, 1):
            context_parts.append(
                f"[Source {i}: {c.source} | Page {c.page} | Relevance: {int(c.relevance * 100)}%]\n{c.text}"
            )
        context_text = "\n\n".join(context_parts)

        grounded_system_prompt = (
            "You are PaperLens AI — an expert academic exam analyzer and document intelligence assistant.\n"
            "Your task is to answer the user's question accurately and thoroughly based on the provided document excerpts.\n\n"
            "STRICT GUIDELINES:\n"
            "1. Base your answer directly on the provided context excerpts.\n"
            "2. Whenever mentioning key concepts, formulas, or answers, explicitly cite the document and page number (e.g. `[DBMS_2023.pdf, Page 4]`).\n"
            "3. If the user asks about repeating questions, exam weightage, or key topics, analyze the excerpts to highlight frequencies and patterns.\n"
            "4. Structure your response with clean Markdown: use headers, bold highlights, bullet points, and code blocks where applicable.\n"
            "5. If the context does not contain enough information to fully answer, state what is present in the document and supplement with clear explanation.\n\n"
            f"=== VERIFIED DOCUMENT CONTEXT ===\n{context_text}"
        )

        pqa_result = await general_chat(
            question=question,
            chat_history=chat_history,
            system_prompt=grounded_system_prompt,
        )

        if pqa_result.get("status") == "warning":
            context_summary = "\n\n".join(
                [f"**From {c.source} (Page {c.page}):**\n> {c.text.strip()}" for c in retrieved_chunks[:3]]
            )
            pqa_result["answer"] = (
                f"### 📄 Relevant Document Excerpts Found\n\n"
                f"{context_summary}\n\n"
                f"---\n\n"
                f"💡 *To generate full AI answers and step-by-step reasoning, add an API key in **Settings (⚙️) → AI Model Keys** or in `backend/.env`.*"
            )
            pqa_result["status"] = "partial"

        # Build precise citations
        citations: List[Dict[str, Any]] = [
            {
                "id": str(uuid.uuid4()),
                "source": c.source,
                "page": c.page,
                "snippet": c.text[:350],
                "relevance": round(c.relevance, 4),
            }
            for c in retrieved_chunks
        ]
        
        # Compute dynamic confidence score based on top chunk relevance
        top_rel = retrieved_chunks[0].relevance if retrieved_chunks else 0.8
        pqa_result["confidence"] = round(min(0.98, max(0.65, top_rel + 0.15)), 2)
        if pqa_result.get("status") != "partial":
            pqa_result["status"] = "success"

    else:
        logger.info(
            "Routing to fast general AI (docs=%d, history turns=%d): %s",
            docs_count,
            len(chat_history),
            question[:80],
        )
        pqa_result = await general_chat(
            question=question,
            chat_history=chat_history,
            system_prompt=(
                "You are PaperLens AI — an advanced, intelligent, and helpful conversational AI "
                "assistant like ChatGPT, Claude, and Gemini.\n"
                "- Maintain continuous context across the conversation and follow-up questions.\n"
                "- Answer thoroughly, accurately, and naturally based on the conversation so far.\n"
                "- Format code with syntax-highlighted Markdown code blocks.\n"
                "- Structure your answers with clear formatting, step-by-step reasoning, and examples."
            ),
        )
        citations = []
        pqa_result["status"] = "general"

    # ------------------------------------------------------------------ #
    # 4. Extract common fields
    # ------------------------------------------------------------------ #
    primary_source = citations[0]["source"] if citations else "N/A"
    primary_page = citations[0]["page"] if citations else 0
    confidence = pqa_result.get("confidence", None)
    answer_text = pqa_result.get("answer", "")

    # ------------------------------------------------------------------ #
    # 5. Persist assistant message
    # ------------------------------------------------------------------ #
    citation_models = [
        models.Citation(
            source=c["source"],
            page=c["page"],
            snippet=c["snippet"],
            relevance=c["relevance"],
        )
        for c in citations
    ]
    assistant_msg = models.ChatMessage(
        session_id=sid,
        role="assistant",
        content=answer_text,
        confidence=confidence,
        citations=citation_models,
        user_id=user_id,
    )
    await models.save_message(assistant_msg)

    # ------------------------------------------------------------------ #
    # 5b. Auto-create or update ChatSession so it appears in Recent Chats
    # ------------------------------------------------------------------ #
    try:
        existing_sess = await models.get_session_by_id(sid, user_id=sess_user_id)
        if existing_sess:
            await models.update_session(
                sid,
                {
                    "message_count": max((existing_sess.message_count or 0), 2),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                },
                user_id=sess_user_id,
            )
        else:
            new_sess = models.ChatSession(
                id=sid,
                user_id=sess_user_id,
                title=clean_title or "New Chat",
                message_count=2,
            )
            await models.create_session(new_sess)
    except Exception as sess_err:
        logger.warning("Failed to upsert chat session record (non-fatal): %s", sess_err)


    # ------------------------------------------------------------------ #
    # 6. Return structured response
    # ------------------------------------------------------------------ #
    return {
        "success": True,
        "data": {
            "answer": answer_text,
            "source": primary_source,
            "page": primary_page,
            "confidence": round(confidence, 4) if confidence is not None else None,
            "citations": citations,
            "references": pqa_result.get("references", ""),
            "session_id": sid,
            "cost": pqa_result.get("cost", 0.0),
            "status": pqa_result.get("status", "unknown"),
        },
        "message": "Answer generated successfully",
    }
