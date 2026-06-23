import asyncio
import io
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from app.services import ocr_jobs, storage


async def _make_group(client, *, members=("A",)):
    """ユニーク名で group + member を作成し response JSON を返す。"""
    res = await client.post(
        "/api/groups",
        json={
            "name": f"ocr-api-{uuid4().hex[:8]}",
            "memberNames": list(members),
        },
    )
    assert res.status_code == 201
    return res.json()


@pytest.mark.asyncio
async def test_upload_creates_job_and_starts_run_job(client, monkeypatch):
    """201 + jobId を返し、run_job が background で起動される。"""
    g = await _make_group(client)
    member_id = g["members"][0]["id"]

    monkeypatch.setattr(
        storage,
        "upload_receipt_image",
        AsyncMock(return_value=f"receipts/{g['id']}/dummy.jpg"),
    )
    started: list[UUID] = []

    async def fake_run(job_id: UUID) -> None:
        started.append(job_id)

    monkeypatch.setattr(ocr_jobs, "run_job", fake_run)

    res = await client.post(
        f"/api/groups/{g['id']}/ocr/upload",
        headers={"X-Member-Id": member_id},
        files={"file": ("r.jpg", io.BytesIO(b"fake-bytes"), "image/jpeg")},
    )
    assert res.status_code == 201, res.text
    job_id = UUID(res.json()["jobId"])

    # asyncio.create_task は次のループ tick で走る → sleep(0) で yield
    await asyncio.sleep(0)
    assert started == [job_id]


@pytest.mark.asyncio
async def test_upload_rejects_unsupported_content_type(client):
    g = await _make_group(client)
    res = await client.post(
        f"/api/groups/{g['id']}/ocr/upload",
        headers={"X-Member-Id": g["members"][0]["id"]},
        files={"file": ("r.gif", io.BytesIO(b"x"), "image/gif")},
    )
    assert res.status_code == 400


@pytest.mark.asyncio
async def test_upload_rejects_other_group_member(client, monkeypatch):
    """別 group のメンバーが他 group の path に upload しようとしたら認可エラー。

    require_member が path の group_id と X-Member-Id の不整合を検出して
    MemberMismatch (HTTP 401) を投げる。
    """
    g1 = await _make_group(client)
    g2 = await _make_group(client)

    monkeypatch.setattr(storage, "upload_receipt_image", AsyncMock(return_value="x"))
    monkeypatch.setattr(ocr_jobs, "run_job", AsyncMock())

    res = await client.post(
        f"/api/groups/{g1['id']}/ocr/upload",
        headers={"X-Member-Id": g2["members"][0]["id"]},  # 別 group の member
        files={"file": ("r.jpg", io.BytesIO(b"x"), "image/jpeg")},
    )
    # MemberMismatch は app.auth.deps の docstring 通り 401
    assert res.status_code in {401, 403}


@pytest.mark.asyncio
async def test_get_ocr_job_returns_pending_after_upload(client, monkeypatch):
    g = await _make_group(client)
    monkeypatch.setattr(
        storage,
        "upload_receipt_image",
        AsyncMock(return_value=f"receipts/{g['id']}/x.jpg"),
    )
    monkeypatch.setattr(ocr_jobs, "run_job", AsyncMock())

    upload = await client.post(
        f"/api/groups/{g['id']}/ocr/upload",
        headers={"X-Member-Id": g["members"][0]["id"]},
        files={"file": ("r.jpg", io.BytesIO(b"x"), "image/jpeg")},
    )
    assert upload.status_code == 201, upload.text
    job_id = upload.json()["jobId"]

    res = await client.get(f"/api/ocr-jobs/{job_id}")
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == job_id
    assert body["groupId"] == g["id"]
    assert body["status"] == "pending"
    assert body["result"] is None
    assert body["errorMessage"] is None


@pytest.mark.asyncio
async def test_get_ocr_job_404_for_missing(client):
    res = await client.get(f"/api/ocr-jobs/{uuid4()}")
    assert res.status_code == 404
