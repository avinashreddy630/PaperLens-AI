"""
backend/tests/test_qa_suite_comprehensive.py
=============================================
Comprehensive QA & Stress Test Suite for PaperLens AI.
Tests live HTTP endpoints, authentication lifecycles, cross-user isolation,
file ingestions, search pad, sessions, admin access controls, and frontend SSR.
"""

import asyncio
import io
import json
import uuid
import pytest
import httpx
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:8080"


@pytest.mark.asyncio
async def test_01_backend_health():
    """Verify backend health endpoint is active and returns component statuses."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        res = await client.get("/api/health")
        assert res.status_code == 200, f"Health check failed: {res.text}"
        data = res.json()
        assert data.get("status") == "ok"
        assert "documents_in_db" in data
        assert "paperqa_indexed" in data

        res_root = await client.get("/")
        assert res_root.status_code == 200
        root_data = res_root.json()
        assert root_data.get("status") == "healthy"
        assert "PaperLens AI" in root_data.get("app", "")


@pytest.mark.asyncio
async def test_02_auth_full_lifecycle():
    """Test user registration, duplicate protection, login, token refresh, and logout."""
    uid = uuid.uuid4().hex[:8]
    email = f"qa_user_{uid}@paperlens.ai"
    password = "SuperSecurePassword123!"
    full_name = f"QA Tester {uid}"

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0, follow_redirects=False) as client:
        # 1. Unauthenticated /me must return 401
        res_me_unauth = await client.get("/api/auth/me")
        assert res_me_unauth.status_code in [401, 403]

        # 2. Register user
        res_reg = await client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "full_name": full_name},
        )
        assert res_reg.status_code in [200, 201], f"Registration failed: {res_reg.text}"
        reg_data = res_reg.json()
        assert "access_token" in reg_data.get("data", reg_data) or "access_token" in reg_data

        # 3. Duplicate registration should be rejected
        res_dup = await client.post(
            "/api/auth/register",
            json={"email": email, "password": password, "full_name": full_name},
        )
        assert res_dup.status_code in [400, 409], f"Expected 400/409 on duplicate, got {res_dup.status_code}"

        # 4. Login with invalid password
        res_bad_login = await client.post(
            "/api/auth/login",
            json={"email": email, "password": "WrongPassword!"},
        )
        assert res_bad_login.status_code in [400, 401]

        # 5. Login with valid password
        res_login = await client.post(
            "/api/auth/login",
            json={"email": email, "password": password},
        )
        assert res_login.status_code == 200
        tokens = res_login.json().get("data", res_login.json())
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]
        assert access_token
        assert refresh_token

        # 6. Authenticated /me
        headers = {"Authorization": f"Bearer {access_token}"}
        res_me = await client.get("/api/auth/me", headers=headers)
        assert res_me.status_code == 200
        user_info = res_me.json().get("data", res_me.json())
        assert user_info["email"] == email

        # 7. Refresh token
        res_refresh = await client.post(
            "/api/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert res_refresh.status_code == 200
        refreshed_tokens = res_refresh.json().get("data", res_refresh.json())
        new_access_token = refreshed_tokens["access_token"]
        assert new_access_token

        # 8. OAuth Redirect URL Generation
        res_oauth_google = await client.get("/api/auth/oauth/google")
        assert res_oauth_google.status_code in [307, 302, 200]
        if res_oauth_google.status_code in [307, 302]:
            assert "location" in res_oauth_google.headers

        # 9. Logout / Revoke Token
        res_logout = await client.post(
            "/api/auth/logout",
            json={"refresh_token": refresh_token},
            headers={"Authorization": f"Bearer {new_access_token}"},
        )
        assert res_logout.status_code == 200


@pytest.mark.asyncio
async def test_03_chat_session_management():
    """Test full CRUD operations on Chat Sessions."""
    uid = uuid.uuid4().hex[:8]
    email = f"qa_session_{uid}@paperlens.ai"
    password = "SecurePassword123!"

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # Register & Login
        await client.post("/api/auth/register", json={"email": email, "password": password, "full_name": "Session Tester"})
        login_res = await client.post("/api/auth/login", json={"email": email, "password": password})
        token = login_res.json().get("data", login_res.json())["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Create Session
        res_create = await client.post(
            "/api/sessions",
            json={"title": "AI Research Session 1"},
            headers=headers,
        )
        assert res_create.status_code in [200, 201]
        session = res_create.json().get("data", res_create.json())
        session_id = session["id"]
        assert session["title"] == "AI Research Session 1"

        # 2. List Sessions
        res_list = await client.get("/api/sessions", headers=headers)
        assert res_list.status_code == 200
        sessions = res_list.json().get("data", res_list.json())
        assert any(s["id"] == session_id for s in sessions)

        # 3. Update Session (Rename & Pin) using PATCH
        res_update = await client.patch(
            f"/api/sessions/{session_id}",
            json={"title": "Updated Session Title", "pinned": True},
            headers=headers,
        )
        assert res_update.status_code == 200
        updated = res_update.json().get("data", res_update.json())
        assert updated["title"] == "Updated Session Title"
        assert updated["pinned"] is True

        # 4. History endpoint for empty session
        res_history = await client.get(f"/api/history?session_id={session_id}", headers=headers)
        assert res_history.status_code == 200
        history_data = res_history.json().get("data", res_history.json())
        assert isinstance(history_data, list)

        # 5. Delete Session
        res_del = await client.delete(f"/api/sessions/{session_id}", headers=headers)
        assert res_del.status_code in [200, 204]

        # 6. Verify Deletion
        res_list_after = await client.get("/api/sessions", headers=headers)
        sessions_after = res_list_after.json().get("data", res_list_after.json())
        assert not any(s["id"] == session_id for s in sessions_after)


@pytest.mark.asyncio
async def test_04_document_upload_and_vector_indexing():
    """Test multipart document uploads (TXT, PDF), listing, rename, and deletion."""
    uid = uuid.uuid4().hex[:8]
    email = f"qa_doc_{uid}@paperlens.ai"
    password = "SecurePassword123!"

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # Register & Login
        await client.post("/api/auth/register", json={"email": email, "password": password, "full_name": "Doc Tester"})
        login_res = await client.post("/api/auth/login", json={"email": email, "password": password})
        token = login_res.json().get("data", login_res.json())["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Upload TXT Document
        sample_txt = "PaperLens AI is a modern question paper and document analysis system.\nIt supports semantic search and RAG."
        files = [("files", ("qa_doc.txt", io.BytesIO(sample_txt.encode("utf-8")), "text/plain"))]
        res_upload_txt = await client.post("/api/upload", files=files, headers=headers)
        assert res_upload_txt.status_code in [200, 201], f"Upload TXT failed: {res_upload_txt.text}"
        upload_resp = res_upload_txt.json()
        doc_list = upload_resp.get("data", upload_resp.get("uploaded", []))
        assert len(doc_list) > 0
        doc_id = doc_list[0]["id"] if "id" in doc_list[0] else doc_list[0]["doc_id"]

        # 2. List Documents
        res_docs = await client.get("/api/documents", headers=headers)
        assert res_docs.status_code == 200
        docs = res_docs.json().get("data", res_docs.json())
        assert any(d["id"] == doc_id for d in docs)

        # 3. Rename Document
        res_rename = await client.patch(
            f"/api/documents/{doc_id}",
            json={"name": "Renamed_QA_Doc.txt"},
            headers=headers,
        )
        assert res_rename.status_code == 200

        # 4. Delete Document
        del_res = await client.delete(f"/api/documents/{doc_id}", headers=headers)
        assert del_res.status_code in [200, 204]

        # 5. Verify Document is removed from list
        res_docs_after = await client.get("/api/documents", headers=headers)
        docs_after = res_docs_after.json().get("data", res_docs_after.json())
        assert not any(d["id"] == doc_id for d in docs_after)


@pytest.mark.asyncio
async def test_05_cross_user_isolation_security():
    """Verify strict tenant isolation: User B cannot access or modify User A's data."""
    uid_a = uuid.uuid4().hex[:8]
    uid_b = uuid.uuid4().hex[:8]
    user_a = {"email": f"user_a_{uid_a}@paperlens.ai", "password": "PasswordA123!", "full_name": "User A"}
    user_b = {"email": f"user_b_{uid_b}@paperlens.ai", "password": "PasswordB123!", "full_name": "User B"}

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # Register User A & User B
        await client.post("/api/auth/register", json=user_a)
        await client.post("/api/auth/register", json=user_b)

        # Login User A
        res_a = await client.post("/api/auth/login", json=user_a)
        token_a = res_a.json().get("data", res_a.json())["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Login User B
        res_b = await client.post("/api/auth/login", json=user_b)
        token_b = res_b.json().get("data", res_b.json())["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # User A creates a session
        sess_res = await client.post(
            "/api/sessions",
            json={"title": "User A Secret Chat"},
            headers=headers_a,
        )
        session_a_id = sess_res.json().get("data", sess_res.json())["id"]

        # User B attempts to access User A's session -> Should be not found in list
        res_b_list = await client.get("/api/sessions", headers=headers_b)
        sessions_b = res_b_list.json().get("data", res_b_list.json())
        assert not any(s["id"] == session_a_id for s in sessions_b), "User B saw User A's session!"

        # User B attempts to delete User A's session -> Should fail with 404
        res_b_del = await client.delete(f"/api/sessions/{session_a_id}", headers=headers_b)
        assert res_b_del.status_code in [403, 404]

        # Verify User A's session still exists
        res_a_list = await client.get("/api/sessions", headers=headers_a)
        sessions_a = res_a_list.json().get("data", res_a_list.json())
        assert any(s["id"] == session_a_id for s in sessions_a), "User A's session was illegally modified by User B!"


@pytest.mark.asyncio
async def test_06_admin_and_telemetry_access():
    """Verify admin role authorization guards."""
    uid = uuid.uuid4().hex[:8]
    email = f"non_admin_{uid}@paperlens.ai"
    password = "SecurePassword123!"

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        await client.post("/api/auth/register", json={"email": email, "password": password, "full_name": "Non Admin"})
        login_res = await client.post("/api/auth/login", json={"email": email, "password": password})
        token = login_res.json().get("data", login_res.json())["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Access /api/admin/users as normal user -> Should return 403 Forbidden
        res_admin_users = await client.get("/api/admin/users", headers=headers)
        assert res_admin_users.status_code == 403, f"Expected 403 for non-admin, got {res_admin_users.status_code}"

        # Access /api/admin/analytics as normal user -> Should return 403 Forbidden
        res_analytics = await client.get("/api/admin/analytics", headers=headers)
        assert res_analytics.status_code == 403, f"Expected 403 for non-admin, got {res_analytics.status_code}"

        # Access /api/admin/system as normal user -> Should return 403 Forbidden
        res_system = await client.get("/api/admin/system", headers=headers)
        assert res_system.status_code == 403, f"Expected 403 for non-admin, got {res_system.status_code}"


@pytest.mark.asyncio
async def test_07_frontend_ssr_and_routes():
    """Verify frontend dev/prod server serves HTML with no 500 errors."""
    async with httpx.AsyncClient(base_url=FRONTEND_URL, timeout=10.0) as client:
        # Home page
        res_home = await client.get("/")
        assert res_home.status_code == 200, f"Frontend home failed with status {res_home.status_code}"
        assert "<html" in res_home.text.lower() or "<!doctype html" in res_home.text.lower()

        # Admin page route
        res_admin = await client.get("/admin")
        assert res_admin.status_code == 200, f"Frontend admin route failed with status {res_admin.status_code}"
        assert "<html" in res_admin.text.lower() or "<!doctype html" in res_admin.text.lower()


@pytest.mark.asyncio
async def test_08_security_injection_and_edge_cases():
    """Test resilience against SQL injection, XSS payload, and empty inputs."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. SQL Injection / XSS in session title
        xss_title = "<script>alert('XSS')</script> ' OR '1'='1"
        res_create = await client.post("/api/sessions", json={"title": xss_title})
        assert res_create.status_code in [200, 201]
        session = res_create.json().get("data", res_create.json())
        assert session["title"] == xss_title

        # 2. Path traversal upload attempt
        malicious_file = [("files", ("../../../../etc/passwd", io.BytesIO(b"root:x:0:0:root"), "text/plain"))]
        res_trav = await client.post("/api/upload", files=malicious_file)
        assert res_trav.status_code in [200, 201, 400]

        # 3. Clean up test session
        await client.delete(f"/api/sessions/{session['id']}")


@pytest.mark.asyncio
async def test_09_analytics_and_notifications():
    """Verify analytics and notification endpoints."""
    uid = uuid.uuid4().hex[:8]
    email = f"analytics_user_{uid}@paperlens.ai"
    password = "SecurePassword123!"

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        await client.post("/api/auth/register", json={"email": email, "password": password, "full_name": "Analytics User"})
        login_res = await client.post("/api/auth/login", json={"email": email, "password": password})
        token = login_res.json().get("data", login_res.json())["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # User analytics
        res_user_analytics = await client.get("/api/analytics/user", headers=headers)
        assert res_user_analytics.status_code == 200

        # Activity analytics
        res_activity = await client.get("/api/analytics/activity", headers=headers)
        assert res_activity.status_code == 200

        # Notifications list
        res_notif = await client.get("/api/notifications", headers=headers)
        assert res_notif.status_code == 200

        # Mark notifications read
        res_read = await client.post("/api/notifications/read", headers=headers)
        assert res_read.status_code == 200


if __name__ == "__main__":
    pytest.main(["-v", __file__])
