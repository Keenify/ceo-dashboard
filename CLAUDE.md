# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Structure

```
apps/
  frontend/   Next.js 14 + React 18 + TypeScript (deployed on Vercel)
  backend/    FastAPI + Python 3.12 (deployed on Fly.io/Railway)
```

## Commands

### Initial setup
```bash
make dev-env          # copy .env.example files to .env.local / .env (fill in values after)
make install          # install all dependencies
```

### Development
```bash
make dev              # run both frontend and backend concurrently
make dev-frontend     # frontend only at http://localhost:3000
make dev-backend      # backend only at http://localhost:8000
```

### Frontend
```bash
cd apps/frontend
yarn lint             # ESLint via next lint
yarn build            # type-check + production build
```

### Backend
```bash
cd apps/backend
source .venv/bin/activate
pytest tests/test_habits.py          # run a single test file
pytest tests/test_habits.py::test_create_habit  # run a single test
pytest tests/                        # run all tests
uvicorn app.main:app --reload --port 8000  # dev server
```

Backend tests require `TEST_USER_ID` set in `apps/backend/.env`.

## Architecture

### Data layer split

Authentication lives entirely in **Supabase** (frontend uses `@supabase/supabase-js`). The `useUser` hook (`lib/hooks/useUser.ts`) exposes the current Supabase user. The authenticated `user.id` (UUID) is passed in every request to the backend as a path or query parameter — the backend does **not** issue its own JWTs; it trusts the `user_id` from the request.

Domain data (habits, todos, journal entries, etc.) lives in a **PostgreSQL database** accessed directly by the backend over SQLAlchemy async (`asyncpg`). This is separate from Supabase's own postgres — it is connected via `DATABASE_URL` in `apps/backend/.env`.

### Frontend

- **App Router** with one directory per feature under `apps/frontend/app/` (e.g. `habit-tracker/`, `journaling/`, `todo/`).
- **Components** are feature-scoped under `components/<feature>/` with shared UI primitives in `components/ui/` (shadcn/Radix-based).
- **State** is local React state or Zustand where cross-component sharing is needed.
- `lib/supabase.ts` — singleton Supabase client.
- `lib/utils.ts` — shared utilities, `cn()` helper for Tailwind class merging.
- `lib/encryption.ts` — client-side AES encryption (used for sensitive fields like email content).
- `NEXT_PUBLIC_BACKEND_API_DOMAIN` env var points at the FastAPI backend.

### Backend

Each domain feature follows a consistent four-layer pattern:

```
app/models/<feature>.py    — SQLAlchemy ORM model
app/schemas/<feature>.py   — Pydantic request/response schemas
app/api/<feature>.py       — business logic / service functions
app/routers/<feature>.py   — FastAPI route handlers
```

All routers are registered in `app/routers/api_router.py` and mounted in `app/main.py`.

`app/scheduler.py` runs APScheduler background jobs (e.g. reminders, recurring tasks).

`app/rag/` and `app/mcp/` handle AI/RAG features backed by OpenAI.

### Auth (backend side)

The backend has no auth middleware. `user_id` is passed as a path param or query param and used directly in DB queries. Route functions receive it as a plain `UUID` parameter — no JWT verification on the backend.

## Environment variables

**Frontend** (`apps/frontend/.env.local`):
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase project
- `NEXT_PUBLIC_BACKEND_API_DOMAIN` — FastAPI URL (default `http://localhost:8000`)
- `NEXT_PUBLIC_EMAIL_CONTENT_ENCRYPTION_KEY` — AES key for encrypted fields

**Backend** (`apps/backend/.env`):
- `DATABASE_URL` — must use `postgresql+asyncpg://` scheme
- `ENVIRONMENT` — `development` enables `/docs`, `/redoc`, `/openapi.json`
- `OPENAI_API_KEY` — used by RAG/AI journal features
- `TEST_USER_ID` — UUID used in pytest fixtures

## Deployment

- **Frontend**: Vercel — Root Directory: `apps/frontend`
- **Backend**: Fly.io (primary) or Railway fallback — Root Directory: `apps/backend`

## Archon task management

This project uses the **Archon MCP server** as the primary task tracking system.

**MANDATORY task cycle before coding:**
1. Check current tasks → `archon:manage_task(action="list", filter_by="status", filter_value="todo")`
2. Research → `archon:search_code_examples()` + `archon:perform_rag_query()`
3. Implement
4. Update status → `archon:manage_task(action="update", task_id="...", update_fields={"status": "review"})`

**Status progression:** `todo` → `doing` → `review` → `done`

Use `review` when implementation is complete but needs user validation. Use `archive` for tasks no longer relevant. Do not mark `done` until the user confirms the review.
