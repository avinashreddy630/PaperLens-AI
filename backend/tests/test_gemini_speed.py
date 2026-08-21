"""
backend/tests/test_gemini_speed.py
Compare Native google-generativeai vs LiteLLM speed.
"""

import time
import os
import asyncio
from dotenv import load_dotenv
load_dotenv()

key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

async def test_native():
    import google.generativeai as genai
    genai.configure(api_key=key)
    
    for model_name in ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-flash-8b"]:
        try:
            model = genai.GenerativeModel(model_name)
            t0 = time.perf_counter()
            res = await asyncio.to_thread(model.generate_content, "Explain DBMS in 1 sentence.")
            elapsed = time.perf_counter() - t0
            print(f"[NATIVE SDK] {model_name}: {elapsed:.2f}s -> {res.text.strip()[:80]}")
        except Exception as e:
            print(f"[NATIVE SDK] {model_name} FAIL: {e}")

async def test_litellm():
    import litellm
    for model_name in [
        "gemini/gemini-3.6-flash",
        "gemini/gemini-3.5-flash",
        "gemini/gemini-3.7-flash",
        "gemini/gemini-flash-lite-latest",
    ]:
        try:
            t0 = time.perf_counter()
            res = await litellm.acompletion(
                model=model_name,
                messages=[{"role": "user", "content": "Explain DBMS in 1 sentence."}],
                timeout=10.0,
            )
            elapsed = time.perf_counter() - t0
            ans = res.choices[0].message.content.strip()
            print(f"[LITELLM] {model_name}: {elapsed:.2f}s -> {ans[:80]}")
        except Exception as e:
            print(f"[LITELLM] {model_name} FAIL: {e}")

async def main():
    print("Testing LiteLLM model latency...")
    await test_litellm()

if __name__ == "__main__":
    asyncio.run(main())
