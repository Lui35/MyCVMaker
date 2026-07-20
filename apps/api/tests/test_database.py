import tempfile
import unittest
from pathlib import Path

from apps.api.app import database
from apps.api.tests.test_pdf_service import sample_cv


class DatabaseTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_data_dir = database.DATA_DIR
        self.original_db_path = database.DB_PATH
        database.DATA_DIR = Path(self.temp_dir.name)
        database.DB_PATH = database.DATA_DIR / "test.db"
        database.init_db()

    def tearDown(self) -> None:
        database.DATA_DIR = self.original_data_dir
        database.DB_PATH = self.original_db_path
        self.temp_dir.cleanup()

    def test_profile_and_education_survive_save_update_and_duplicate(self) -> None:
        payload = sample_cv()
        cv_id = database.save_cv(payload)

        saved = database.get_cv(cv_id)
        self.assertIsNotNone(saved)
        assert saved is not None
        self.assertEqual(saved["contact_profile"]["email"], "jose@example.com")
        self.assertEqual(saved["education"][0]["institution"], "University of Bahrain")

        payload.contact_profile.location = "Riffa, Bahrain"
        payload.education[0].degree = "BSc Computer Science"
        self.assertTrue(database.update_cv(cv_id, payload))
        updated = database.get_cv(cv_id)
        assert updated is not None
        self.assertEqual(updated["contact_profile"]["location"], "Riffa, Bahrain")
        self.assertEqual(updated["education"][0]["degree"], "BSc Computer Science")

        duplicate_id = database.duplicate_cv(cv_id)
        self.assertIsNotNone(duplicate_id)
        duplicated = database.get_cv(duplicate_id or "")
        assert duplicated is not None
        self.assertEqual(duplicated["contact_profile"], updated["contact_profile"])
        self.assertEqual(duplicated["education"], updated["education"])


if __name__ == "__main__":
    unittest.main()
