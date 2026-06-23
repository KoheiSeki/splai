from __future__ import annotations

from uuid import UUID

import httpx

from app.config import get_settings
from app.exceptions.domain import OCRFailed

BUCKET = "receipts"
MAX_BYTES = 10 * 1024 * 1024  # 10MB


async def upload_receipt_image(
    *, group_id: UUID, job_id: UUID, content_type: str, data: bytes
) -> str:
    """Supabase Storage にレシート画像をアップロードする。"""

    if len(data) > MAX_BYTES:
        raise OCRFailed("image exceeds 10MB limit")
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise OCRFailed(f"unsupported content type: {content_type}")

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise OCRFailed("Supabase storage is not configured")

    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[content_type]
    object_path = f"{group_id}/{job_id}.{ext}"
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{BUCKET}/{object_path}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(
            url,
            content=data,
            headers={
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
        )

    if res.status_code >= 400:
        raise OCRFailed(f"storage upload failed: {res.status_code} {res.text[:200]}")

    return f"{BUCKET}/{object_path}"


async def download_receipt_image(storage_path: str) -> bytes:
    """Supabase Storage からレシート画像をダウンロードする。"""

    settings = get_settings()
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{storage_path}"
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            url,
            headers={"Authorization": f"Bearer {settings.supabase_service_role_key}"},
        )
    if res.status_code >= 400:
        raise OCRFailed(f"storage download failed: {res.status_code}")

    return res.content
