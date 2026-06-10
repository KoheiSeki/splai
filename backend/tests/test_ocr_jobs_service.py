from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.exceptions.domain import OCRFailed
from app.models.group import Group
from app.models.member import Member
from app.models.ocr_job import OcrJobStatus, OcrProvider
from app.services import ocr_gateway, ocr_jobs, storage
from app.services.ocr_gateway import OcrParseResult


@pytest.fixture
async def db_session(monkeypatch):
    """Service-level test 用の self-managed session。

    `app.db.session.engine` は import 時に default pool で構築されるため、
    pytest-asyncio の per-test event-loop と衝突しやすい(client fixture も
    同じ理由で NullPool engine を毎回作っている)。

    `ocr_jobs.run_job` は `app.services.ocr_jobs.SessionLocal` を直接呼ぶので、
    その module-level 参照を NullPool 版に **monkeypatch で差し替え**、
    test session と同一エンジンに統一する。これにより:
      - test → ocr_jobs(別 session)で commit/read が同じ DB に届く
      - asyncpg の loop binding がテストごとに閉じる
    """
    settings = get_settings()
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr("app.services.ocr_jobs.SessionLocal", SessionLocal)
    try:
        async with SessionLocal() as session:
            yield session
    finally:
        await engine.dispose()


@pytest.fixture
async def group(db_session):
    """ユニーク名で test 用 group + member 1 を作成(SPLAI 規約: 名前で衝突回避)。"""
    g = Group(name=f"ocr-jobs-test-{uuid4().hex[:8]}")
    db_session.add(g)
    await db_session.flush()
    db_session.add(Member(group_id=g.id, name="A"))
    await db_session.commit()
    return g


@pytest.mark.asyncio
async def test_run_job_succeeds(db_session, monkeypatch, group):
    """OCR 成功 → status=succeeded、result_json は snake_case。"""
    job = await ocr_jobs.create_job(
        db_session,
        group_id=group.id,
        image_path=f"receipts/{group.id}/dummy.jpg",
        provider=OcrProvider.GCP_VISION,
    )
    await db_session.commit()
    job_id = job.id

    monkeypatch.setattr(storage, "download_receipt_image", AsyncMock(return_value=b"fake-bytes"))
    monkeypatch.setattr(
        ocr_gateway,
        "run_gcp_vision_ocr",
        lambda data: OcrParseResult(
            merchant_name="居酒屋A",
            total_amount=12000,
            raw_text="居酒屋A\n合計 ¥12,000",
        ),
    )

    await ocr_jobs.run_job(job_id)

    await db_session.refresh(job)
    assert job.status == OcrJobStatus.SUCCEEDED
    assert job.result_json == {
        "merchant_name": "居酒屋A",
        "total_amount": 12000,
        "raw_text": "居酒屋A\n合計 ¥12,000",
    }
    assert job.completed_at is not None
    assert job.error_message is None


@pytest.mark.asyncio
async def test_run_job_marks_failed_on_ocr_failed(db_session, monkeypatch, group):
    """`OCRFailed` を投げると status=failed + error_message に文字列保存。"""
    job = await ocr_jobs.create_job(
        db_session,
        group_id=group.id,
        image_path=f"receipts/{group.id}/dummy.jpg",
        provider=OcrProvider.GCP_VISION,
    )
    await db_session.commit()
    job_id = job.id

    monkeypatch.setattr(storage, "download_receipt_image", AsyncMock(return_value=b"fake"))

    def boom(_data: bytes) -> OcrParseResult:
        raise OCRFailed("no text detected in receipt image")

    monkeypatch.setattr(ocr_gateway, "run_gcp_vision_ocr", boom)

    await ocr_jobs.run_job(job_id)

    await db_session.refresh(job)
    assert job.status == OcrJobStatus.FAILED
    assert "no text" in (job.error_message or "")
    assert job.completed_at is not None
    assert job.result_json is None


@pytest.mark.asyncio
async def test_run_job_swallows_unexpected_exception(db_session, monkeypatch, group):
    """想定外の例外も sink せず failed に倒す(`asyncio.create_task` 経由でも記録)。"""
    job = await ocr_jobs.create_job(
        db_session,
        group_id=group.id,
        image_path=f"receipts/{group.id}/dummy.jpg",
        provider=OcrProvider.GCP_VISION,
    )
    await db_session.commit()
    job_id = job.id

    monkeypatch.setattr(
        storage,
        "download_receipt_image",
        AsyncMock(side_effect=RuntimeError("network exploded")),
    )

    await ocr_jobs.run_job(job_id)

    await db_session.refresh(job)
    assert job.status == OcrJobStatus.FAILED
    assert "network exploded" in (job.error_message or "")
