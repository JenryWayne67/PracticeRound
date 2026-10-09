# InevitableCges

Climate-trend web app built on NASA POWER and GRACE data: analysis for scientists (`/science`), a 12-month
outlook and crop planner for farmers (`/farmers`, English and Burmese) and a knowledge hub with plain-language
findings, open data and community field notes (`/knowledge`).

- Source data lives in `data/HeatWatch_full_data/` (daily station CSVs, monthly regional CSVs, GRACE).
- `node scripts/build-data.mjs` converts it to the JSON in `frontend/src/heatwatch/data/`. Re-run after changing the CSVs.
- All analysis runs in the browser: `frontend/src/heatwatch/engine.ts`. Places, indicators, crops and periods are plain tables at the top of that file.
- The dataset has a step change in 2008, so trends default to 2008-2025. See the data-quality panel on the scientists page.
- Community notes use the API in `backend/app/routers/notes.py` (public read, login to post).

Built on the starter described below.

# Hackathon Starter

Full-stack starter: **React + Vite + TypeScript + Tailwind** frontend, **FastAPI + SQLite** backend,
with auth, a CRUD example, AI chat (Claude), file uploads and realtime rooms already wired up.

## Run it

Needs Node 20+ and Python 3.10+.

```bash
npm install
npm run setup
npm run dev
```

- App: http://localhost:5173
- API docs (try every endpoint in the browser): http://localhost:8000/docs
- For AI chat, put `ANTHROPIC_API_KEY=...` in `backend/.env` and restart.

| Command | What it does |
| --- | --- |
| `npm run dev` | Backend (:8000) and frontend (:5173) together, both hot-reloading |
| `npm test` | Backend API tests |
| `npm run build` | Production frontend build into `frontend/dist` |
| `npm start` | One server on :8000 serving the API **and** the built frontend |

## Architecture

```
Browser ──> Vite dev server :5173 ──/api, /uploads proxy──> FastAPI :8000 ──> SQLite (backend/app.db)
                                                              └──> Claude API (services/llm.py)
```

The frontend only ever calls relative `/api/...` paths, so dev and production behave the same and
there are no CORS problems.

```
backend/
  app/
    main.py          app setup, registers routers under /api, serves built frontend
    config.py        settings, loaded from backend/.env
    db.py            database engine + session
    models.py        tables and request/response schemas
    security.py      password hashing, JWT
    deps.py          SessionDep, CurrentUser (add to a route to require login)
    routers/
      auth.py        POST /auth/register, /auth/login, GET /auth/me
      items.py       example CRUD resource  <- copy for your own
      ai.py          POST /ai/chat (streaming)
      uploads.py     POST /uploads
      ws.py          WS /ws/{room} (broadcast rooms)
    services/
      llm.py         Claude wrapper: stream_chat(), complete()
  tests/test_api.py
frontend/
  src/
    lib/api.ts       api.get/post/patch/delete/upload, streamText, openRoom
    lib/types.ts     TypeScript mirror of backend schemas
    context/AuthContext.tsx   useAuth(): user, login, register, logout
    components/      Layout (nav + RequireAuth), ui (Button, Input, Card)
    pages/           Home, Login, Items (CRUD example), Chat (AI example)
    App.tsx          routes
scripts/             cross-platform setup + venv runner
```

## Recipes

**Add a new resource (e.g. "posts")**

1. `backend/app/models.py` — copy the `Item` block, rename.
2. `backend/app/routers/` — copy `items.py` to `posts.py`, rename.
3. `backend/app/main.py` — `api.include_router(posts.router)`.
4. Delete `backend/app.db` (there are no migrations; tables are recreated on start).
5. `frontend/src/lib/types.ts` — add the type; copy `pages/Items.tsx`; add a `<Route>` in `App.tsx`
   and a link in `components/Layout.tsx`.

**Use AI inside a backend feature**

```python
from ..services import llm
summary = await llm.complete(f"Summarize this:\n{text}")
```

**Push a realtime event from the server**

```python
from .ws import manager
await manager.broadcast("room-name", {"type": "updated", "id": item.id})
```

Frontend: `openRoom('room-name', (msg) => ...)` from `lib/api.ts`.

**Rebrand** — app name in `components/Layout.tsx` and `index.html`, colors in `src/index.css`.

## Deploy (single service)

Any host that runs Python and Node at build time (Render, Railway, Fly):

- Build: `npm install && npm run setup && npm run build`
- Start: `npm start`
- Env: `SECRET_KEY` (long random string), `ANTHROPIC_API_KEY`

SQLite and `uploads/` live on local disk, so they reset on redeploy unless the host gives you a
persistent volume. For a real database set `DATABASE_URL` to Postgres and `pip install psycopg2-binary`.

## Hackathon checklist

- [ ] Rename the app, rewrite `pages/Home.tsx` with the pitch
- [ ] `git init`, push, give teammates access; each runs `npm install && npm run setup`
- [ ] Build the one core feature end to end before polishing anything
- [ ] Seed demo data and a demo account so the live demo never starts empty
- [ ] Deploy early (hour 2, not hour 22) and keep it deployed
- [ ] Record a backup video of the demo
