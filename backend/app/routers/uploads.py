import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status

from ..config import settings
from ..deps import CurrentUser

router = APIRouter(prefix="/uploads", tags=["uploads"])

MAX_BYTES = 10 * 1024 * 1024
ALLOWED_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".pdf", ".txt", ".csv", ".json"}


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload(file: UploadFile, user: CurrentUser):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"File type {suffix or '?'} not allowed")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 10 MB)")

    folder = Path(settings.upload_dir)
    folder.mkdir(parents=True, exist_ok=True)
    # Random name: never trust the client's filename as a path.
    name = f"{uuid.uuid4().hex}{suffix}"
    (folder / name).write_bytes(data)
    return {"filename": file.filename, "url": f"/uploads/{name}", "size": len(data)}
