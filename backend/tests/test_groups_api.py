"""POST /api/groups の integration test。

実 dev DB(`.env.local` の DATABASE_URL = Supabase Pooler)に接続して動作確認する。
共通 `client` fixture(conftest.py)は AsyncClient + NullPool + dependency override で
event loop の競合を回避している。
"""

from httpx import AsyncClient


async def test_create_group_returns_201_with_creator_member_id(client: AsyncClient):
    res = await client.post(
        "/api/groups",
        json={"name": "渋谷飲み会", "memberNames": ["Alice", "Bob"]},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "渋谷飲み会"
    assert body["id"]
    assert body["creatorMemberId"]
    # creator_member_id は memberNames の先頭("Alice")の id
    assert len(body["members"]) == 2
    assert body["members"][0]["name"] == "Alice"


async def test_create_group_with_no_members_creates_empty_group(client: AsyncClient):
    res = await client.post(
        "/api/groups", json={"name": "未確定", "memberNames": []}
    )
    assert res.status_code == 201
    body = res.json()
    assert body["members"] == []
    assert body["creatorMemberId"] is None


async def test_create_group_validates_name_required(client: AsyncClient):
    res = await client.post("/api/groups", json={"memberNames": []})
    assert res.status_code == 422
