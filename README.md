# AI Document Automation — MVP

One reusable AI extraction engine across three industries (Insurance, Finance,
Healthcare). Select an industry, upload a PDF or use a preloaded demo PDF,
preview it, process it, and see structured fields + validation status.
Nothing is persisted — results live only in the browser tab for that session.

## Stack

- **Frontend:** Next.js 14 (App Router, TypeScript, Tailwind) → deploy to Vercel
- **Backend:** FastAPI (Python) → deploy separately (Render, Railway, Fly.io, etc.)
- **AI:** Google Gemini (`gemini-2.5-flash`, free tier, structured JSON output)
- **PDF text extraction:** pypdf (text-based PDFs only — OCR is out of scope)
- **Demo PDFs:** generated on the fly with reportlab (no binary assets in the repo)

## Why two separate deployments

Vercel's serverless functions aren't a great fit for a Python PDF/AI pipeline —
cold starts and package size add friction. The backend is a normal FastAPI app
you deploy anywhere that runs Python (Render/Railway are the easiest). The
frontend is pure Next.js and deploys to Vercel with zero config beyond one
environment variable pointing at the backend URL.

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then add your GEMINI_API_KEY
uvicorn main:app --reload --port 8000
```

Check it's alive: `curl http://localhost:8000/api/health`

#### Getting a free Gemini API key

1. Go to https://aistudio.google.com/apikey
2. Sign in with a Google account, click **Create API key** — no credit card needed
3. Paste it into `backend/.env` as `GEMINI_API_KEY`

Free tier as of writing: `gemini-2.5-flash` gets roughly 1,500 requests/day and
15 requests/minute, which is far more than an MVP demo needs. One caveat:
Google's terms say free-tier prompts/responses may be used to improve their
models — fine for demo data, worth knowing if you ever process real documents.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # points at http://localhost:8000 by default
npm run dev
```

Open http://localhost:3000.

## Deployment

### Backend (Render example)

1. Push this repo to GitHub.
2. On Render: **New → Web Service**, point at the repo, root directory `backend`.
3. Build command: `pip install -r requirements.txt`
   Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables:
   - `GEMINI_API_KEY` — your key (never exposed to the frontend)
   - `ALLOWED_ORIGINS` — your Vercel URL once you have it, e.g. `https://your-app.vercel.app`
5. Deploy. Note the resulting URL, e.g. `https://ai-doc-mvp-api.onrender.com`.

### Frontend (Vercel)

1. Import the repo into Vercel, root directory `frontend`.
2. Add environment variable `NEXT_PUBLIC_API_BASE_URL` = your backend URL from above.
3. Deploy. Vercel gives you the public HTTPS demo URL.

Once both are deployed, update the backend's `ALLOWED_ORIGINS` to the real
Vercel URL (tighten it from `*`) and redeploy the backend.

## API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/industries` | Industry labels + field schema (frontend renders off this — no duplicated config) |
| GET | `/api/demo/{industry}?negative=false` | Returns a generated demo PDF (or the missing-field negative test PDF) |
| POST | `/api/process` | multipart form: `industry`, `file` (PDF) → `{ extracted, validation, overall }` |
| GET | `/api/health` | liveness check |

## Adding a fourth industry

Add one entry to `backend/industries.py` (`INDUSTRIES` dict) with its fields,
demo values, and which field the negative test should omit. The frontend reads
this config from `/api/industries` at load time — no frontend code changes
needed.

## What's intentionally not built (per MVP scope)

No auth, no database, no email/OCR ingestion, no CRM/claims integrations, no
persistent storage of any processed data. Refreshing the page clears the
results list by design.
