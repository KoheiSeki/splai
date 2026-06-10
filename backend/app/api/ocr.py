from __future__ import annotations

import asyncio
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import require_member
from app.db.session import get_session
from app.exceptions.domain import OcrJobNotFound
from app.models.member import Member
from app.models.ocr_job import OcrProvider
from app.schemas.ocr import OcrJobResponse, OcrResultDTO, OcrUploadResponse
from app.services import ocr_jobs, storage

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ocr"])

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB(設計書 §9.1)


@router.post(
    "/groups/{group_id}/ocr/upload",
    status_code=201,
    response_model=OcrUploadResponse,
)
async def upload_receipt(
    group_id: UUID,
    file: UploadFile = File(...),
    _requester: Member = Depends(require_member),
    db: AsyncSession = Depends(get_session),
) -> OcrUploadResponse:
    """レシート画像を受け取り OCR ジョブを起動する。

    認可は `Depends(require_member)` が path の `group_id` と `X-Member-Id` を
    照合して完了させる(`MemberMismatch` を内部で投げる)。本ハンドラでは
    content-type / size 検証 → Storage upload → DB INSERT → background OCR 起動のみ。
    """

    if file.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"unsupported content type: {file.content_type}",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="image exceeds 10MB limit")

    # UUID 先行採番:Storage path と DB 行で同一 UUID を共有する。
    job_id = uuid4()
    storage_path = await storage.upload_receipt_image(
        group_id=group_id,
        job_id=job_id,
        content_type=file.content_type,
        data=data,
    )

    job = await ocr_jobs.create_job(
        db,
        job_id=job_id,
        group_id=group_id,
        image_path=storage_path,
        provider=OcrProvider.GCP_VISION,
    )
    await db.commit()

    asyncio.create_task(ocr_jobs.run_job(job.id))
    logger.info("ocr_job %s created (group=%s)", job_id, group_id)

    return OcrUploadResponse(job_id=job.id)


@router.get("/ocr-jobs/{job_id}", response_model=OcrJobResponse)
async def get_ocr_job(job_id: UUID, db: AsyncSession = Depends(get_session)) -> OcrJobResponse:
    """ジョブ状態 + 結果(あれば)/ エラー(あれば)を返す。認証不要(read op)。"""

    job = await ocr_jobs.get_job(db, job_id)
    if job is None:
        raise OcrJobNotFound(f"ocr_job {job_id} not found")

    result = OcrResultDTO(**job.result_json) if job.result_json else None

    return OcrJobResponse(
        id=job.id,
        group_id=job.group_id,
        status=job.status,
        result=result,
        error_message=job.error_message,
    )
