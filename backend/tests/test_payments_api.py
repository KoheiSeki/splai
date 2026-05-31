"""POST /api/groups/{group_id}/payments の integration test。

共通 `client` fixture(conftest.py)は AsyncClient + NullPool + dependency override で
event loop の競合を回避している。
"""

from httpx import AsyncClient


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
