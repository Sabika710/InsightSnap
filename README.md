# SnapSync Enterprise

A synchronized employee monitoring and productivity suite.

```
snapsync/
├── backend/          FastAPI + SQLAlchemy + JWT
├── frontend/         Next.js 14 + Tailwind CSS
└── client/           Python Windows background agent
```

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python seed.py          # creates DB + test users
uvicorn main:app --reload
# API running at http://localhost:8000
# Docs at   http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
# UI running at http://localhost:3000
```

### 3. Windows Client

```bash
cd client
pip install -r requirements.txt

# Run as an employee
python client.py --email bob@demo.com --password pass123 --server http://localhost:8000
```

---

## Test Credentials

| Role     | Email               | Password    |
|----------|---------------------|-------------|
| Manager  | alice@demo.com      | manager123  |
| Employee | bob@demo.com        | pass123     |
| Employee | carol@demo.com      | pass123     |
| Employee | david@demo.com      | pass123     |
| Employee | eva@demo.com        | pass123     |

---

## Key API Endpoints

| Method | Path                                  | Auth     | Description                        |
|--------|---------------------------------------|----------|------------------------------------|
| POST   | /api/login                            | —        | Returns JWT + user metadata        |
| GET    | /api/me                               | Employee | Current user + latest 3 screenshots|
| PATCH  | /api/me/monitoring                    | Employee | Toggle break/active                |
| GET    | /api/heartbeat                        | Employee | Client polls this every 60s        |
| POST   | /api/screenshot                       | Employee | Upload a captured screenshot       |
| GET    | /api/manager/team                     | Manager  | All employees + their screenshots  |
| PATCH  | /api/manager/users/{id}/monitoring    | Manager  | Manager override per-employee      |

---

## Architecture

```
[Windows Client]
    │  polls /api/heartbeat every 60s
    │  if is_active_monitoring == True → capture + POST /api/screenshot
    │  if False → skip, sleep 60s
    ▼
[FastAPI Backend]  ←→  [SQLite / Postgres]
    │  JWT auth, User model, Screenshot model
    │  serves screenshot files as static assets
    ▼
[Next.js Frontend]
    ├── /login        — shared login, routes by role
    ├── /employee     — minimal toggle UI (blue/cyan)
    └── /dashboard    — manager Team Pulse grid (dark green/cyan)
```

---

## Swap SQLite → Postgres

In `backend/database.py`, change:

```python
DATABASE_URL = "postgresql://user:pass@localhost/snapsync"
```

And add `psycopg2-binary` to `requirements.txt`.

---

## Production Notes

- Replace `SECRET_KEY` in `auth.py` with a proper env var
- Set `NEXT_PUBLIC_API_URL` in frontend `.env.local` for your deployed backend
- The client `--server` flag should point to your production URL
- Add `nginx` or a CDN in front for screenshot file serving at scale


## imp commands

- cd frontend
npm run dev
- uvicorn main:app --reload
- python client.py --email bob@demo.com --password pass123 --server http://localhost:8000
- python client.py --email bk@demo.com --password pass123
- python client.py --email carol@demo.com --password pass123
