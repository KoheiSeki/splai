"""モデル定義の最低限の正常系テスト。
スキーマ詳細(FK、デフォルト値)は alembic migration 適用後の
integration テスト(test_groups_api 等)で確認する。"""

from datetime import date
from uuid import uuid4

from app.models.ai_usage_log import AiUsageLog
from app.models.group import Group
from app.models.member import Member
from app.models.payment import Payment, PaymentSource
from app.models.payment_share import PaymentShare, ShareType


def test_group_instantiation():
    g = Group(name="渋谷飲み会", event_date=date(2026, 6, 1))
    assert g.name == "渋谷飲み会"
    assert g.event_date == date(2026, 6, 1)


def test_member_requires_group_id():
    gid = uuid4()
    m = Member(group_id=gid, name="Alice")
    assert m.name == "Alice"
    assert m.group_id == gid


def test_payment_amount_is_int():
    pid = uuid4()
    mid = uuid4()
    p = Payment(
        group_id=pid,
        payer_id=mid,
        amount=12000,
        description="居酒屋A",
        source=PaymentSource.MANUAL,
    )
    assert isinstance(p.amount, int)
    assert p.source == PaymentSource.MANUAL


def test_payment_share_types():
    sid = uuid4()
    mid = uuid4()
    s = PaymentShare(
        payment_id=sid,
        member_id=mid,
        share_type=ShareType.EQUAL,
        share_value=1.0,
    )
    assert s.share_type == ShareType.EQUAL


def test_ai_usage_log_instantiation():
    log = AiUsageLog(
        endpoint="chat-payment",
        model="claude-sonnet-4-6",
        input_tokens=120,
        output_tokens=45,
    )
    assert log.endpoint == "chat-payment"
    assert log.input_tokens == 120
    assert log.output_tokens == 45
