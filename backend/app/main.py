from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import init_db
from .routers import ai, auth, items, uploads, ws

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Every route lives under /api. Register new routers here.
api = APIRouter(prefix="/api")
api.include_router(auth.router)
api.include_router(items.router)
api.include_router(ai.router)
api.include_router(uploads.router)
api.include_router(ws.router)


@api.get("/health", tags=["health"])
def health():
    return {"status": "ok", "app": settings.app_name}


app.include_router(api)

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Production: after `npm run build`, this one server also serves the frontend (single deploy).
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        file = (FRONTEND_DIST / path).resolve()
        if path and file.is_file() and file.is_relative_to(FRONTEND_DIST):
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
