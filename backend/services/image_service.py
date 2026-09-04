"""
services/image_service.py
OCR and Image Processing service for PaperLens AI question paper images.

Supports:
- PNG, JPG, JPEG, WEBP question paper photos & scanned exam papers
- OCR text extraction with pytesseract & PIL
- Google Gemini Vision fallback for high-accuracy handwriting & exam paper OCR
- OCR sidecar text generation for caching
- Seamless chunking for vector store ingestion
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Tuple

from services.pdf_service import TextChunk, _split_into_chunks

import os
logger = logging.getLogger("paperlens_ai.image_service")


def extract_text_from_image(image_path: str) -> str:
    """
    Run OCR on an image file.
    Tries pytesseract first. If unavailable or empty, falls back to Google Gemini Vision
    for near-perfect handwriting and question paper text recognition.
    """
    extracted = ""
    # 1. Try local pytesseract
    try:
        from PIL import Image
        import pytesseract

        img = Image.open(image_path)
        if img.mode not in ("L", "RGB"):
            img = img.convert("RGB")

        extracted = pytesseract.image_to_string(img).strip()
        if len(extracted) > 20:
            return extracted
    except Exception as exc:
        logger.info("Local Tesseract OCR unavailable or skipped: %s", exc)

    # 2. Try Google Gemini Vision OCR (high accuracy, handles handwriting & diagrams)
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gemini_key:
        try:
            import google.generativeai as genai
            from PIL import Image

            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-3.6-flash")
            img = Image.open(image_path)
            
            prompt = (
                "You are an expert OCR transcription engine. Extract all text, numbers, "
                "mathematical equations, and questions from this image exactly as written. "
                "Do not summarize or explain. Output the exact transcribed text."
            )
            response = model.generate_content([img, prompt])
            if response and response.text:
                logger.info("Gemini Vision OCR extracted %d characters from %s", len(response.text), image_path)
                return response.text.strip()
        except Exception as exc:
            logger.warning("Gemini Vision OCR failed for %s: %s", image_path, exc)

    return extracted


def process_image_to_chunks(
    image_path: str,
    doc_id: str,
    upload_dir: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> Tuple[str, List[TextChunk]]:
    """
    Perform OCR on an image, write a `.ocr.txt` sidecar, and split into TextChunks.
    Returns (extracted_text, chunks).
    """
    img_path = Path(image_path)
    sidecar_path = img_path.parent / f"{img_path.stem}_ocr.txt"

    # Check if sidecar already exists
    if sidecar_path.exists():
        extracted_text = sidecar_path.read_text(encoding="utf-8", errors="ignore").strip()
    else:
        extracted_text = extract_text_from_image(image_path)
        if extracted_text:
            try:
                sidecar_path.write_text(extracted_text, encoding="utf-8")
            except Exception as exc:
                logger.warning("Could not write OCR sidecar file: %s", exc)

    if not extracted_text:
        extracted_text = f"[Image Document: {img_path.name} — OCR could not detect readable text]"

    chunks = _split_into_chunks(
        text=extracted_text,
        page=1,
        doc_id=doc_id,
        chunk_size=chunk_size,
        overlap=overlap,
    )

    return extracted_text, chunks
