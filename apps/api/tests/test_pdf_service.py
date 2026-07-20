import unittest

import pymupdf

from apps.api.app.models import CVPayload, PDFExportOptions
from apps.api.app.pdf_service import generate_cv_pdf


def sample_cv(style: str = "classic", *, long: bool = False) -> CVPayload:
    repeated = "Improved multilingual search for customers across regions while maintaining reliable delivery. "
    bullets = "\n".join(f"Delivered initiative {index}: {repeated * 3}" for index in range(16 if long else 2))
    return CVPayload.model_validate(
        {
            "version_name": "Unicode CV",
            "full_name": "José Müller",
            "title": "Ingénieur logiciel",
            "summary": "Développeur spécialisé in reliable products and measurable customer outcomes.",
            "style": style,
            "date_format": "MMM YYYY",
            "programmer_profile": {
                "programming_languages": "Python, TypeScript",
                "frameworks": "FastAPI, React",
                "databases": "PostgreSQL",
                "tools": "Docker, Git",
                "github_url": "https://github.com/jose",
                "portfolio_url": "https://example.com/portfolio",
            },
            "contact_profile": {
                "email": "jose@example.com",
                "phone": "+973 3900 0000",
                "location": "Manama, Bahrain",
                "linkedin_url": "https://linkedin.com/in/jose",
            },
            "experiences": [
                {
                    "company": "Société Exemple",
                    "role": "Senior Software Engineer",
                    "start_date": "2021-01-01",
                    "end_date": "Present",
                    "bullets": bullets,
                }
            ],
            "certifications": [
                {"name": "Cloud Engineering", "issuer": "Example Institute", "year": "2025", "credential_id": "CERT-123"}
            ],
            "education": [
                {
                    "institution": "University of Bahrain",
                    "degree": "Bachelor of Science",
                    "field_of_study": "Computer Science",
                    "start_date": "2016-09",
                    "end_date": "2020-06",
                    "details": "Focused on software engineering and distributed systems.",
                }
            ],
        }
    )


class PDFServiceTests(unittest.TestCase):
    def test_unicode_text_and_links_are_extractable(self) -> None:
        pdf_bytes = generate_cv_pdf(sample_cv("modern"))
        with pymupdf.open(stream=pdf_bytes, filetype="pdf") as document:
            text = "\n".join(page.get_text() for page in document)
            links = [link for page in document for link in page.get_links()]
        self.assertIn("José Müller", text)
        self.assertIn("Ingénieur logiciel", text)
        self.assertIn("University of Bahrain", text)
        self.assertLess(text.index("PROFESSIONAL SUMMARY"), text.index("EDUCATION"))
        self.assertLess(text.index("EDUCATION"), text.index("TECHNICAL PROFILE"))
        self.assertLess(text.index("TECHNICAL PROFILE"), text.index("EXPERIENCE"))
        self.assertEqual(
            {link.get("uri") for link in links},
            {"mailto:jose@example.com", "tel:+97339000000", "https://github.com/jose", "https://linkedin.com/in/jose", "https://example.com/portfolio"},
        )

    def test_a4_and_letter_page_sizes(self) -> None:
        cases = [("A4", 595.28, 841.89), ("LETTER", 612.0, 792.0)]
        for page_size, expected_width, expected_height in cases:
            with self.subTest(page_size=page_size):
                pdf_bytes = generate_cv_pdf(sample_cv(), PDFExportOptions(page_size=page_size))
                with pymupdf.open(stream=pdf_bytes, filetype="pdf") as document:
                    rect = document[0].rect
                self.assertAlmostEqual(rect.width, expected_width, delta=1)
                self.assertAlmostEqual(rect.height, expected_height, delta=1)

    def test_long_cv_paginates_and_remains_extractable_for_all_styles(self) -> None:
        for style in ("classic", "minimal", "modern"):
            with self.subTest(style=style):
                pdf_bytes = generate_cv_pdf(
                    sample_cv(style, long=True),
                    PDFExportOptions(page_size="LETTER", margin="wide", density="comfortable"),
                )
                with pymupdf.open(stream=pdf_bytes, filetype="pdf") as document:
                    text = "\n".join(page.get_text() for page in document)
                    self.assertGreater(len(document), 1)
                self.assertIn("Delivered initiative 15", text)
                self.assertIn("certifications", text.casefold())


if __name__ == "__main__":
    unittest.main()
