"""require_member の integration test。

実 DB(.env.local の DATABASE_URL = Supabase Pooler)に接続して動作確認する。

conftest.py は test 用に DATABASE_URL=localhost/test を default 設定し、
app.db.session.SessionLocal は import 時にその URL で engine を構築する。
本テストはその default を bypass するために、`real_session` fixture が
.env.local を直接読み込み、毎回新しい engine + Session を生成する。
テストデータは rollback で消えるので、dev DB に永続化されない。
"""

from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.deps import require_member
from app.exceptions.domain import MemberMismatch
from app.models import Group, Member


@pytest.fixture
async def real_session():
    """実 dev DB への AsyncSession。テスト終了時に rollback で巻き戻し。"""
    env_file = Path(__file__).parent.parent / ".env.local"
    config = dotenv_values(env_file)
    real_url = config.get("DATABASE_URL")
    if not real_url:
        pytest.skip(".env.local に DATABASE_URL が無いため skip")

    engine = create_async_engine(real_url, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.rollback()
    await engine.dispose()


@pytest.mark.asyncio
async def test_require_member_returns_member_when_belongs_to_group(real_session):
    """member が指定 group に属していれば Member を返す。"""
    group = Group(name="test")
    real_session.add(group)
    await real_session.flush()

    member = Member(group_id=group.id, name="Alice")
    real_session.add(member)
    await real_session.flush()

    result = await require_member(
        group_id=group.id,
        x_member_id=member.id,
        db=real_session,
    )
    assert result.id == member.id
    assert result.group_id == group.id


@pytest.mark.asyncio
async def test_require_member_raises_when_member_in_different_group(real_session):
    """member が指定 group に属していなければ MemberMismatch を投げる。"""
    g1 = Group(name="group1")
    g2 = Group(name="group2")
    real_session.add_all([g1, g2])
    await real_session.flush()

    m_in_g1 = Member(group_id=g1.id, name="Alice")
    real_session.add(m_in_g1)
    await real_session.flush()

    with pytest.raises(MemberMismatch):
        await require_member(
            group_id=g2.id,
            x_member_id=m_in_g1.id,
            db=real_session,
        )
