# CEO Dashboard

A personal productivity and life management system. Combines journaling, habit tracking, goal setting, financial tracking, AI-assisted reflection, and more in a single dashboard.

## Stack

| | Technology |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2.0 (async), asyncpg |
| Auth | Supabase (frontend auth + session management) |
| Database | PostgreSQL (via Supabase) |
| AI | OpenAI API |
| Payments | Stripe |
| Frontend deploy | Vercel |
| Backend deploy | Fly.io / Railway |

## Modules

- **Journaling** — daily journal with templates, questions, and AI-assisted reflection
- **AI Journal** — conversational AI journaling with emotion tracking
- **Habit Tracker** — streaks, buddies, and habit entries
- **Todo** — lists, tabs, and tasks
- **Weekly Rhythms** — weekly review and planning system
- **Weekly Design System** — structured weekly design
- **Annual Calendar Plans** — year-level planning
- **Dreamboard** — vision board with images and goals
- **Manifestation** — manifestation tracking
- **Ikigai** — purpose/ikigai mapping
- **Bucket List** — life goals tracker
- **Future Me** — future letters to yourself
- **Five Percent Reviews** — periodic self-review system
- **Mindmap** — visual mind mapping
- **Personal Finance** — cashflow, net worth, credit cards, payment reminders
- **Travel Planner** — travel transactions and planning
- **Freelance Projects** — project and income tracking
- **Map** — location/travel map
- **OPPP** — one-page personal plan
- **Calendar** — Google Calendar integration
- **Settings** — user preferences and module management

## Getting Started

### Prerequisites

- Node.js 18+, Yarn
- Python 3.12+
- PostgreSQL database (Supabase project)

### Setup

```bash
# 1. Copy env files
make dev-env

# 2. Fill in values
#    apps/frontend/.env.local  — Supabase URL/key, backend URL, Google API key
#    apps/backend/.env         — DATABASE_URL (postgresql+asyncpg://...), OpenAI key, etc.

# 3. Install dependencies
make install

# 4. Run both services
make dev
```

Frontend: http://localhost:3000  
Backend API + docs: http://localhost:8000/docs *(development only)*

### Backend venv

If you need to manage the Python venv manually:

```bash
cd apps/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Deployment

**Frontend** → Vercel. Set Root Directory to `apps/frontend` in project settings.

**Backend** → Fly.io (primary). Config at `apps/backend/fly.toml`. Railway is an alternative (`apps/backend/railway.json`).

## Project Structure

```
apps/
  frontend/
    app/              # Next.js App Router — one directory per module
    components/       # Feature components + shared UI primitives (components/ui/)
    lib/              # supabase client, hooks, utils, encryption
  backend/
    app/
      models/         # SQLAlchemy ORM models
      schemas/        # Pydantic request/response schemas
      api/            # Business logic
      routers/        # FastAPI route handlers
      scheduler.py    # APScheduler background jobs
      rag/            # RAG / vector search
      mcp/            # MCP server integration
```

See [CLAUDE.md](./CLAUDE.md) for development commands and architecture details.
