"""各 schema が CamelModel を継承して JSON は camelCase になることを spot-check。
詳細な型検証は API テスト(test_groups_api 等)で確認する。"""

from datetime import date
from uuid import uuid4

from app.schemas.group import CreateGroupRequest, GroupResponse
from app.schemas.payment import CreatePaymentRequest


def test_create_group_request_accepts_camel_case():
    data = {
        "name": "渋谷飲み会",
        "eventDate": "2026-06-01",
        "memberNames": ["Alice", "Bob"],
    }
    req = CreateGroupRequest.model_validate(data)
    assert req.name == "渋谷飲み会"
    assert req.event_date == date(2026, 6, 1)
    assert req.member_names == ["Alice", "Bob"]


def test_group_response_dumps_camel_case():
    g = GroupResponse(
        id=uuid4(),
        name="x",
        event_date=None,
        currency="JPY",
        creator_member_id=uuid4(),
    )
    dumped = g.model_dump(by_alias=True)
    assert "creatorMemberId" in dumped
    assert "eventDate" in dumped


def test_create_payment_request_share_input():
    pid = uuid4()
    req = CreatePaymentRequest.model_validate(
        {
            "payerId": str(pid),
            "amount": 12000,
            "description": "居酒屋A",
            "shares": [
                {"memberId": str(pid), "shareType": "equal", "shareValue": 1.0},
            ],
        }
    )
    assert req.payer_id == pid
    assert req.amount == 12000
    assert req.shares[0].share_type == "equal"
