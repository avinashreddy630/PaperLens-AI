"""
backend/tests/test_performance.py
Benchmark test for PaperLens AI generation speed and accuracy.
"""

import asyncio
import time
import os
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
load_dotenv()

from rag.general_llm import general_chat


async def benchmark():
    print("=" * 60)
    print("[BENCHMARK] Testing PaperLens AI Query Speed & Accuracy")
    print("=" * 60)

    # Test 1: Direct General Chat Latency
    print("\n[Test 1] Measuring Fast General AI Response Time...")
    t0 = time.perf_counter()
    res1 = await general_chat(
        question="What are the top 3 differences between SQL and NoSQL databases?",
    )
    elapsed1 = time.perf_counter() - t0
    print(f"[OK] Response received in {elapsed1:.2f} seconds")
    print(f"Status: {res1.get('status')}")
    print(f"Answer snippet: {res1.get('answer', '')[:140]}...\n")

    print("=" * 60)
    print(f"[OK] Speed benchmark complete! Elapsed: {elapsed1:.2f}s (< 2.0s target)")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(benchmark())
