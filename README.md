# CV Maker (ATS-first)

Starter monorepo for an ATS-friendly CV builder:
- **Web:** React + TypeScript + Vite
- **API:** FastAPI + SQLite
- **Output:** PDF generation (v1)
- **Features:** split editor/preview layout, CV version manager (multiple versions, duplicate, default), dark mode, dummy-data generation, programmer-focused form fields, certifications, and auto-sorted experience (newest to oldest)
- **AI:** import text-based PDF/DOCX/TXT CVs into editable fields and create evidence-bound job-tailored versions with Groq

## Project structure

```text
apps/
  web/                  # form + style picker + PDF trigger
  api/                  # FastAPI + SQLite + PDF generation
packages/
  shared-schema/        # CV JSON schema
  ats-rules/            # ATS rule placeholders
  template-engine/      # template metadata
```

## Run locally

1. Install API dependencies:
   ```powershell
   npm run setup:api
   ```
2. Start API:
   ```powershell
   npm run dev:api
   ```
3. Start web app in another terminal:
   ```powershell
   npm run dev:web
   ```

Web runs at `http://localhost:5173` and API at `http://localhost:8000`.

## Run with Docker Compose

1. Copy `.env.example` to `.env` and set your Groq key.
2. Build and start both images:
   ```bash
   docker compose up --build -d
   ```
3. Open `http://localhost:5173`. API documentation remains available at `http://localhost:8000/docs`.

Compose creates `my-cv-maker-web:latest` and `my-cv-maker-api:latest`. Saved CVs persist in the `cv_data` Docker volume when containers are recreated.

Useful commands:

```bash
docker compose ps
docker compose logs -f
docker compose down
```

Use `docker compose down -v` only when you intentionally want to delete all CV data stored in Docker.

## Configure AI features

1. Copy `.env.example` to `.env`.
2. Create a new Groq API key and set `GROQ_API_KEY` in `.env`.
3. Keep `.env` local. It is ignored by Git and the API key must never be exposed to the browser.
4. Restart the API after changing `.env`.

The default model is `openai/gpt-oss-20b`, which supports strict structured outputs. Override it with `GROQ_MODEL` only when the replacement supports Groq JSON-schema structured output.

AI endpoints:

- `GET /ai/status` reports configuration without exposing the key.
- `POST /ai/import-cv` accepts a PDF, DOCX, or TXT file up to 8 MB.
- `POST /ai/tailor` rewrites the summary and every experience for a job, then returns reviewable, confirmation-gated suggestions for missing experience.
- `POST /ai/enhance-section` rewrites a summary or experience block using only the facts supplied, then returns a reviewable suggestion.
- `DELETE /cvs/{cv_id}` permanently deletes a saved CV and assigns a new default when needed.

The importer currently supports text-based documents. Image-only or scanned PDFs return a clear OCR-required message instead of guessing. Tailoring preserves factual identity, employment, date, skills, link, and certification fields in server code; AI is limited to summary and bullet wording.
