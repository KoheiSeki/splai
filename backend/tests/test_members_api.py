"""POST /api/groups/{group_id}/members の integration test。

共通 `client` fixture(conftest.py)は AsyncClient + NullPool + dependency override で
event loop の競合を回避している。
"""

from httpx import AsyncClient


async def test_add_member_returns_201(client: AsyncClient):
    create_res = await client.post(
        "/api/groups", json={"name": "g1", "memberNames": ["Alice"]}
    )
    gid = create_res.json()["id"]
    creator_mid = create_res.json()["creatorMemberId"]

    res = await client.post(
        f"/api/groups/{gid}/members",
        json={"name": "Bob"},
        headers={"X-Member-Id": creator_mid},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Bob"
    assert body["groupId"] == gid


async def test_add_member_requires_x_member_id(client: AsyncClient):
    create_res = await client.post(
        "/api/groups", json={"name": "g1", "memberNames": ["A"]}
    )
    gid = create_res.json()["id"]

    res = await client.post(f"/api/groups/{gid}/members", json={"name": "Bob"})
    assert res.status_code == 422  # X-Member-Id header 不足は FastAPI が 422 を返す
