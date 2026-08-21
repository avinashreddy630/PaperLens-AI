import asyncio
import os
import sys
import unittest
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv()

from database.models import (
    ChatSession,
    create_session,
    get_sessions,
    get_session_by_id,
    update_session,
    delete_session,
)


class TestSessionManagement(unittest.IsolatedAsyncioTestCase):
    async def test_session_lifecycle(self):
        user_id = "test_user_session_mgmt"

        # 1. Create Session
        s1 = ChatSession(
            user_id=user_id,
            title="Binary Search Practice",
            pinned=False,
            archived=False,
            favorite=False,
            folder="Programming",
        )
        created1 = await create_session(s1)
        self.assertEqual(created1.title, "Binary Search Practice")
        self.assertEqual(created1.folder, "Programming")
        self.assertFalse(created1.pinned)
        self.assertFalse(created1.favorite)
        self.assertFalse(created1.archived)

        # 2. Create Second Session
        s2 = ChatSession(
            user_id=user_id,
            title="Machine Learning Loss Functions",
            pinned=False,
            archived=False,
            favorite=True,
            folder="Machine Learning",
        )
        created2 = await create_session(s2)
        self.assertTrue(created2.favorite)

        # 3. Pin First Session
        updated1 = await update_session(s1.id, {"pinned": True}, user_id=user_id)
        self.assertIsNotNone(updated1)
        self.assertTrue(updated1.pinned)

        # 4. Rename Second Session
        updated2 = await update_session(s2.id, {"title": "ML - Loss & Backpropagation"}, user_id=user_id)
        self.assertIsNotNone(updated2)
        self.assertEqual(updated2.title, "ML - Loss & Backpropagation")

        # 5. Archive First Session
        updated1 = await update_session(s1.id, {"archived": True}, user_id=user_id)
        self.assertIsNotNone(updated1)
        self.assertTrue(updated1.archived)

        # 6. Unarchive First Session
        updated1 = await update_session(s1.id, {"archived": False}, user_id=user_id)
        self.assertIsNotNone(updated1)
        self.assertFalse(updated1.archived)

        # 7. Delete Sessions
        deleted1 = await delete_session(s1.id, user_id=user_id)
        deleted2 = await delete_session(s2.id, user_id=user_id)
        self.assertTrue(deleted1)
        self.assertTrue(deleted2)

        # Verify deletion
        fetched1 = await get_session_by_id(s1.id, user_id=user_id)
        self.assertIsNone(fetched1)


if __name__ == "__main__":
    unittest.main()
