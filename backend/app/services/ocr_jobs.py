from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import SessionLocal
from app.exceptions.domain import OCRFailed
from app.models.ocr_job import OcrJob, OcrJobStatus, OcrProvider
from app.services import ocr_gateway, storage

logger = logging.getLogger(__name__)

_ERROR_MESSAGE_MAX = 1000


async def create_job(
    db: AsyncSession,
    *,
    group_id: UUID,
    image_path: str,
    provider: OcrProvider = OcrProvider.GCP_VISION,
) -> OcrJob:
    """`pending` 状態の ocr_jobs 行を作成する。コミットは呼び出し側責務。"""

    job = OcrJob(
        group_id=group_id,
        image_path=image_path,
        provider=provider,
        status=OcrJobStatus.PENDING,
    )
    db.add(job)
    await db.flush()
    return job


async def get_job(db: AsyncSession, job_id: UUID) -> OcrJob | None:
    """ocr_jobs 行を取得する。存在しない場合は None を返す。"""

    return await db.get(OcrJob, job_id)


async def run_job(job_id: UUID) -> None:
    """バックグラウンド OCR パイプライン。

    `asyncio.create_task(run_job(...))` で起動される前提。
    リクエストスコープ session(`get_session` は async generator)は使えないため、
    `SessionLocal` を直接 context manager として開く。
    """

    if not await _transition_to_processing(job_id):
        return  # job が存在しない or すでに進行中

    try:
        image_path = await _load_image_path(job_id)
        if image_path is None:
            return
        image_bytes = await storage.download_receipt_image(image_path)

        parsed = await asyncio.to_thread(ocr_gateway.run_gcp_vision_ocr, image_bytes)

        await _mark_succeeded(
            job_id,
            result={
                "merchant_name": parsed.merchant_name,
                "total_amount": parsed.total_amount,
                "raw_text": parsed.raw_text,
            },
        )
        logger.info("ocr_job %s succeeded", job_id)
    except OCRFailed as exc:
        await _mark_failed(job_id, str(exc))
    except Exception as exc:
        await _mark_failed(job_id, f"unexpected error: {exc!r}")
        logger.exception("ocr_job %s crashed", job_id)


async def _transition_to_processing(job_id: UUID) -> bool:
    """`pending` → `processing` 状態遷移。

    Job が存在しない or すでに進行中の場合は False を返す。
    """

    async with SessionLocal() as db:
        job = await db.get(OcrJob, job_id)
        if job is None:
            logger.warning("ocr_job %s not found", job_id)
            return False
        if job.status != OcrJobStatus.PENDING:
            logger.info("ocr_job %s already %s, skipping", job_id, job.status)
            return False
        job.status = OcrJobStatus.PROCESSING
        await db.commit()
        return True


async def _load_image_path(job_id: UUID) -> str | None:
    """ocr_jobs 行から image_path を取得する。存在しない場合は None を返す。"""

    async with SessionLocal() as db:
        job = await db.get(OcrJob, job_id)
        return job.image_path if job else None


async def _mark_succeeded(job_id: UUID, *, result: dict) -> None:
    """`succeeded` 状態に遷移し、result_json を保存する。"""

    async with SessionLocal() as db:
        job = await db.get(OcrJob, job_id)
        if job is None:
            return
        job.result_json = result
        job.status = OcrJobStatus.SUCCEEDED
        job.completed_at = datetime.now(UTC)
        await db.commit()


async def _mark_failed(job_id: UUID, message: str) -> None:
    """`failed` 状態に遷移し、error_message を保存する。"""

    async with SessionLocal() as db:
        job = await db.get(OcrJob, job_id)
        if job is None:
            return
        job.status = OcrJobStatus.FAILED
        job.error_message = message[:_ERROR_MESSAGE_MAX]
        job.completed_at = datetime.now(UTC)
        await db.commit()
