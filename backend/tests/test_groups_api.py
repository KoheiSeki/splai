"""POST /api/groups の integration test。

実 dev DB(`.env.local` の DATABASE_URL = Supabase Pooler)に接続して動作確認する。
共通 `client` fixture(conftest.py)は AsyncClient + NullPool + dependency override で
event loop の競合を回避している。
"""

import uuid

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
    res = await client.post("/api/groups", json={"name": "未確定", "memberNames": []})
    assert res.status_code == 201
    body = res.json()
    assert body["members"] == []
    assert body["creatorMemberId"] is None


async def test_create_group_validates_name_required(client: AsyncClient):
    res = await client.post("/api/groups", json={"memberNames": []})
    assert res.status_code == 422


async def test_get_group_returns_full_payload(client: AsyncClient):
    create_res = await client.post(
        "/api/groups", json={"name": "g1", "memberNames": ["Alice", "Bob"]}
    )
    gid = create_res.json()["id"]
    creator_mid = create_res.json()["creatorMemberId"]

    res = await client.get(f"/api/groups/{gid}", headers={"X-Member-Id": creator_mid})
    assert res.status_code == 200
    body = res.json()
    assert body["id"] == gid
    assert len(body["members"]) == 2
    assert body["payments"] == []


async def test_get_group_returns_422_when_member_id_header_missing(client: AsyncClient):
    """X-Member-Id header が無い場合、FastAPI が 422(認可前のバリデーション)を返す。"""
    res = await client.get(f"/api/groups/{uuid.UUID(int=0)}")
    assert res.status_code == 422


async def test_get_group_returns_401_when_member_not_in_group(client: AsyncClient):
    create_res = await client.post("/api/groups", json={"name": "g1", "memberNames": ["A"]})
    gid = create_res.json()["id"]

    # 存在しない member_id で叩く
    bogus = "00000000-0000-0000-0000-000000000000"
    res = await client.get(f"/api/groups/{gid}", headers={"X-Member-Id": bogus})
    assert res.status_code == 401


async def test_get_group_returns_200_without_x_member_id(client: AsyncClient):
    """X-Member-Id を渡さなくても GET できる(public read)。
    設計上 URL = 招待リンクなので、read は誰でも可能にする。"""
    create_res = await client.post("/api/groups", json={"name": "public", "memberNames": ["Alice"]})
    gid = create_res.json()["id"]

    res = await client.get(f"/api/groups/{gid}")  # ← header なし
    assert res.status_code == 200
    body = res.json()
    assert body["name"] == "public"
    assert len(body["members"]) == 1


async def test_get_group_returns_same_data_with_or_without_x_member_id(client: AsyncClient):
    create_res = await client.post("/api/groups", json={"name": "compat", "memberNames": ["A"]})
    gid = create_res.json()["id"]
    creator_mid = create_res.json()["creatorMemberId"]

    with_auth = await client.get(f"/api/groups/{gid}", headers={"X-Member-Id": creator_mid})
    without_auth = await client.get(f"/api/groups/{gid}")

    assert with_auth.status_code == 200
    assert without_auth.status_code == 200
    assert with_auth.json() == without_auth.json()
