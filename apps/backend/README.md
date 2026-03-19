# CEO Dashboard — Backend API

A personal productivity and life management backend built with FastAPI. Powers journaling, habit tracking, financial tools, AI-assisted reflection, and more.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115 |
| ASGI Server (prod) | Hypercorn |
| ASGI Server (dev) | Uvicorn |
| Database | PostgreSQL via Supabase |
| ORM | SQLAlchemy 2.0 (async) |
| Driver | asyncpg |
| AI | OpenAI API |
| Payments | Stripe |
| Email | Mailgun |
| Scheduler | APScheduler |
| PDF | ReportLab |

---

## Local Development

### Prerequisites

- Python 3.12+
- PostgreSQL database (Supabase recommended)

### Setup

```bash
# 1. Clone the repo and enter the backend directory
cd ceo-backend

# 2. Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy and fill in environment variables
cp .env.example .env
# Edit .env with your actual values
```

### Start the dev server

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The API will be available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

---

## Production Deployment

### Render

The project includes a `render.yaml` for one-click deployment.

**Start command:**
```bash
hypercorn app.main:app --bind 0.0.0.0:$PORT
```

**Steps:**
1. Push code to GitHub
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo
3. Render will auto-detect `render.yaml`
4. Set all environment variables in the Render dashboard (see below)
5. Deploy

### Railway

A `railway.json` is also included for Railway deployments. Start command is identical:
```bash
hypercorn app.main:app --bind "[::]:$PORT"
```

---

## Environment Variables

Set these in your deployment platform's dashboard. Never commit real values.

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string — format: `postgresql+asyncpg://user:pass@host:port/db` |
| `OPENAI_API_KEY` | OpenAI API key (for AI journaling features) |
| `MAILGUN_API_KEY` | Mailgun API key (email sending) |
| `MAILGUN_DOMAIN` | Mailgun domain |
| `EMAIL_CONTENT_ENCRYPTION_KEY` | Encryption key for stored email content |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Stripe secret key (payments) |
| `TAIGA_USERNAME` | Taiga project management username |
| `TAIGA_PASSWORD` | Taiga password |
| `TAIGA_PROJECT_SLUG` | Taiga project slug |
| `TAIGA_API_URL` | Taiga API URL (e.g. `https://api.taiga.io/api/v1`) |
| `PLANKA_DATABASE_URL` | Planka PostgreSQL URL |
| `PLANKA_ADMIN_EMAIL` | Planka admin email |
| `PLANKA_ADMIN_PASSWORD` | Planka admin password |
| `PLANKA_DEFAULT_USER_PASSWORD` | Default Planka user password |
| `TEST_USER_ID` | UUID of test user (local dev/testing only) |

---

## API Modules

All routes are prefixed under the base URL. Interactive docs available at `/docs`.

| Module | Prefix |
|---|---|
| Journal Entries | `/journal-entries` |
| Journal Templates | `/journal-templates` |
| Journal Questions | `/journal-questions` |
| AI Journaling | `/ai-journaling` |
| AI Journal Emotions | `/ai-journal-emotions` |
| AI Journal Emotion Stats | `/ai-journal-user-emotion-stats` |
| Todos | `/todos` |
| Todo Lists | `/todo-lists` |
| Todo Tabs | `/todo-tabs` |
| Habits | `/habits` |
| Weekly Rhythms | `/weekly-rhythms` |
| Weekly Design System | `/weekly-design-system` |
| Annual Calendar Plans | `/annual-calendar-plans` |
| User Notepads | `/user-notepads` |
| Manifestation | `/manifestation` |
| Flywheel | `/flywheels` |
| Bucket List | `/bucket-list-items` |
| Ikigai | `/ikigai` |
| Future Letters | `/future-letters` |
| Five Percent Reviews | `/five-percent-reviews` |
| Notable Events | `/notable-events` |
| Cashflow | `/cashflows` |
| Net Worth Entries | `/networth-entries` |
| Travel Transactions | `/travel-transactions` |
| Credit Card Instructions | `/credit-card-instructions` |
| Payment Reminders | `/payment-reminders` |
| Freelance Projects | `/freelance-projects` |
| Productivity Tracker | `/productivity` |
| Social Posts | `/social-posts` |
| Voice Recordings | `/voice-recordings` |
| Mindmaps | `/mindmaps` |
| User Settings | `/user-settings` |
| User Modules | `/user-modules` |
| Module Status | `/module-status` |
| Stripe | `/stripe` |
| Planka Onboarding | `/planka` |
| Google Tokens | `/user-google-tokens` |
| WhatsApp | `/whatsapp` |
| MCP Server | `/mcp` |
| Webhooks | `/webhooks` |
| Feedback | `/feedback` |
| RAG (Weekly Design) | `/rag/*` |

---

## Health Check

```bash
curl https://your-app.onrender.com/
# {"message": "CEO Dashboard API is running"}
```

---

## Running Tests

```bash
pytest
```

Requires `TEST_USER_ID` and `DATABASE_URL` to be set in `.env`.
