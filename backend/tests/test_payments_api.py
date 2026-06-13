"""POST /api/groups/{group_id}/payments の integration test。

共通 `client` fixture(conftest.py)は AsyncClient + NullPool + dependency override で
event loop の競合を回避している。
"""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.models.ocr_job import OcrJob, OcrJobStatus, OcrProvider


async def _create_group_with_members(
    client: AsyncClient, member_names: list[str]
) -> tuple[str, str, list[dict]]:
    """テスト用ヘルパ: グループを作って (group_id, creator_member_id, members) を返す。"""
    res = await client.post("/api/groups", json={"name": "g", "memberNames": member_names})
    body = res.json()
    return body["id"], body["creatorMemberId"], body["members"]


async def test_create_payment_with_equal_shares(client: AsyncClient):
    gid, creator_mid, members = await _create_group_with_members(client, ["A", "B", "C"])

    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 12000,
            "description": "居酒屋A",
            "shares": [
                {"memberId": m["id"], "shareType": "equal", "shareValue": 1.0} for m in members
            ],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["amount"] == 12000
    assert len(body["shares"]) == 3


async def test_create_payment_rejects_share_for_non_member(client: AsyncClient):
    gid, creator_mid, _ = await _create_group_with_members(client, ["A"])

    bogus = "00000000-0000-0000-0000-000000000000"
    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "x",
            "shares": [{"memberId": bogus, "shareType": "equal", "shareValue": 1.0}],
        },
    )
    assert res.status_code == 400
    assert res.json()["type"].endswith("/invalid-payment-shares")


async def test_patch_payment_updates_amount_and_description(client: AsyncClient):
    gid, creator_mid, members = await _create_group_with_members(client, ["A", "B"])
    create_res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "old",
            "shares": [
                {"memberId": m["id"], "shareType": "equal", "shareValue": 1.0} for m in members
            ],
        },
    )
    pid = create_res.json()["id"]

    res = await client.patch(
        f"/api/groups/{gid}/payments/{pid}",
        headers={"X-Member-Id": creator_mid},
        json={"amount": 5000, "description": "new"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["amount"] == 5000
    assert body["description"] == "new"


async def test_delete_payment_soft_deletes(client: AsyncClient):
    gid, creator_mid, members = await _create_group_with_members(client, ["A"])
    create_res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 100,
            "description": "x",
            "shares": [{"memberId": members[0]["id"], "shareType": "equal", "shareValue": 1.0}],
        },
    )
    pid = create_res.json()["id"]

    res = await client.delete(
        f"/api/groups/{gid}/payments/{pid}",
        headers={"X-Member-Id": creator_mid},
    )
    assert res.status_code == 204

    # 一覧から消える
    list_res = await client.get(f"/api/groups/{gid}", headers={"X-Member-Id": creator_mid})
    assert list_res.json()["payments"] == []


async def test_create_payment_rejects_amount_shares_not_matching_total(client: AsyncClient):
    gid, creator_mid, members = await _create_group_with_members(client, ["A", "B"])
    a, b = members[0]["id"], members[1]["id"]
    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "x",
            "shares": [
                {"memberId": a, "shareType": "amount", "shareValue": 600},
                {"memberId": b, "shareType": "amount", "shareValue": 300},
            ],
        },
    )
    assert res.status_code == 400
    assert res.json()["type"].endswith("/invalid-payment-shares")


async def test_create_payment_accepts_amount_shares_matching_total(client: AsyncClient):
    gid, creator_mid, members = await _create_group_with_members(client, ["A", "B"])
    a, b = members[0]["id"], members[1]["id"]
    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "split",
            "shares": [
                {"memberId": a, "shareType": "amount", "shareValue": 600},
                {"memberId": b, "shareType": "amount", "shareValue": 400},
            ],
        },
    )
    assert res.status_code == 201
    assert len(res.json()["shares"]) == 2


async def _insert_succeeded_ocr_job(group_id: str, *, payment_id: UUID | None = None) -> UUID:
    """テスト用に直接 ocr_jobs 行を作る(API 経由だと background OCR を待つことになる)。

    `client` fixture と同じ NullPool engine 戦略で書き込み、commit 後は他 connection から見える。
    """
    settings = get_settings()
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with SessionLocal() as session:
            job = OcrJob(
                group_id=UUID(group_id),
                image_path=f"receipts/{group_id}/{uuid4()}.jpg",
                provider=OcrProvider.GCP_VISION,
                status=OcrJobStatus.SUCCEEDED,
                result_json={
                    "merchant_name": "居酒屋A",
                    "total_amount": 12000,
                    "raw_text": "...",
                },
                completed_at=datetime.now(UTC),
                payment_id=payment_id,
            )
            session.add(job)
            await session.commit()
            return job.id
    finally:
        await engine.dispose()


async def _insert_pending_ocr_job(group_id: str) -> UUID:
    """status=pending な job(まだ OCR 進行中)。"""
    settings = get_settings()
    engine = create_async_engine(settings.database_url, poolclass=NullPool)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with SessionLocal() as session:
            job = OcrJob(
                group_id=UUID(group_id),
                image_path=f"receipts/{group_id}/{uuid4()}.jpg",
                provider=OcrProvider.GCP_VISION,
                status=OcrJobStatus.PENDING,
            )
            session.add(job)
            await session.commit()
            return job.id
    finally:
        await engine.dispose()


async def test_create_payment_with_ocr_job_id_sets_source_and_links(client: AsyncClient):
    """成功:source=ocr、ocr_image_path コピー、ocr_job.payment_id link。"""
    gid, creator_mid, members = await _create_group_with_members(client, ["A", "B"])
    job_id = await _insert_succeeded_ocr_job(gid)

    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 12000,
            "description": "居酒屋A",
            "ocrJobId": str(job_id),
            "shares": [
                {"memberId": members[0]["id"], "shareType": "amount", "shareValue": 6000},
                {"memberId": members[1]["id"], "shareType": "amount", "shareValue": 6000},
            ],
        },
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["source"] == "ocr"
    assert body["ocrImagePath"].startswith("receipts/")
    # 続けて GET /api/ocr-jobs/{id} で payment_id が link されているか確認
    job_res = await client.get(f"/api/ocr-jobs/{job_id}")
    assert job_res.json().get("paymentId") == body["id"]


async def test_create_payment_rejects_pending_ocr_job(client: AsyncClient):
    """失敗:status != succeeded の job は 400(OcrJobNotReady)。"""
    gid, creator_mid, _members = await _create_group_with_members(client, ["A"])
    job_id = await _insert_pending_ocr_job(gid)

    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "x",
            "ocrJobId": str(job_id),
            "shares": [{"memberId": creator_mid, "shareType": "amount", "shareValue": 1000}],
        },
    )
    assert res.status_code == 400
    assert res.json()["type"].endswith("/ocr-job-not-ready")


async def test_create_payment_rejects_other_group_ocr_job(client: AsyncClient):
    """失敗:他 group の job を link しようとしたら 400(OcrJobMismatch)。"""
    gid1, creator1, _ = await _create_group_with_members(client, ["A"])
    gid2, _creator2, _ = await _create_group_with_members(client, ["B"])
    job_id = await _insert_succeeded_ocr_job(gid2)

    res = await client.post(
        f"/api/groups/{gid1}/payments",
        headers={"X-Member-Id": creator1},
        json={
            "payerId": creator1,
            "amount": 1000,
            "description": "x",
            "ocrJobId": str(job_id),  # ← gid2 の job
            "shares": [
                {"memberId": creator1, "shareType": "amount", "shareValue": 1000},
            ],
        },
    )
    assert res.status_code == 400
    assert res.json()["type"].endswith("/ocr-job-mismatch")


async def test_create_payment_rejects_already_linked_ocr_job(client: AsyncClient):
    """失敗:既に payment と link 済みの job は 409(OcrJobAlreadyLinked)。

    `ocr_jobs.payment_id` には FK があるため、ダミー UUID を埋めると
    ForeignKeyViolation になる。実 payment を 1 つ作って、その id で link 済み状態を作る。
    """
    gid, creator_mid, _ = await _create_group_with_members(client, ["A"])

    # ① 実 payment を 1 つ作る(これが OcrJob と link されたことにする payment)
    first_res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "first",
            "shares": [{"memberId": creator_mid, "shareType": "amount", "shareValue": 1000}],
        },
    )
    assert first_res.status_code == 201
    real_payment_id = UUID(first_res.json()["id"])

    # ② 上記 payment と link 済み状態の OcrJob を作る
    job_id = await _insert_succeeded_ocr_job(gid, payment_id=real_payment_id)

    # ③ 同じ job_id で **2 度目の** 登録 → 409
    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 12000,
            "description": "再送信",
            "ocrJobId": str(job_id),
            "shares": [{"memberId": creator_mid, "shareType": "amount", "shareValue": 12000}],
        },
    )
    assert res.status_code == 409
    assert res.json()["type"].endswith("/ocr-job-already-linked")


async def test_create_payment_without_ocr_job_id_keeps_manual_source(client: AsyncClient):
    """既存挙動の維持:ocrJobId 不在時は source=manual、ocr_image_path は null。"""
    gid, creator_mid, _ = await _create_group_with_members(client, ["A"])

    res = await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": creator_mid,
            "amount": 1000,
            "description": "manual",
            "shares": [{"memberId": creator_mid, "shareType": "amount", "shareValue": 1000}],
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["source"] == "manual"
    assert body.get("ocrImagePath") is None
