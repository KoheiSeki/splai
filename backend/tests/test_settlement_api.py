"""GET /api/groups/{group_id}/settlement の integration test。

共通 `client` fixture(conftest.py)は AsyncClient + NullPool + dependency override で
event loop の競合を回避している。
"""

from httpx import AsyncClient


async def test_settlement_for_three_party_equal_split(client: AsyncClient):
    create_res = await client.post(
        "/api/groups", json={"name": "g", "memberNames": ["A", "B", "C"]}
    )
    body = create_res.json()
    gid = body["id"]
    creator_mid = body["creatorMemberId"]
    members = body["members"]

    # A が 12000 円立替、3 等分
    await client.post(
        f"/api/groups/{gid}/payments",
        headers={"X-Member-Id": creator_mid},
        json={
            "payerId": members[0]["id"],
            "amount": 12000,
            "description": "x",
            "shares": [
                {"memberId": m["id"], "shareType": "equal", "shareValue": 1.0}
                for m in members
            ],
        },
    )

    res = await client.get(
        f"/api/groups/{gid}/settlement", headers={"X-Member-Id": creator_mid}
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["transfers"]) == 2
    # A は受け取り 8000(自分の 4000 を引いた残り)
    a_id = members[0]["id"]
    received = sum(t["amount"] for t in body["transfers"] if t["toId"] == a_id)
    assert received == 8000
