# CV Maker (ATS-first)

Starter monorepo for an ATS-friendly CV builder:
- **Web:** React + TypeScript + Vite
- **API:** FastAPI + SQLite
- **Output:** PDF generation (v1)
- **Features:** split editor/preview layout, CV version manager (multiple versions, duplicate, default), dark mode, dummy-data generation, programmer-focused form fields, certifications, and auto-sorted experience (newest to oldest)

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
