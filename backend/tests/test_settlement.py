from uuid import uuid4

from app.services.settlement import Transfer, settle


def test_empty_returns_no_transfers():
    assert settle({}) == []


def test_balanced_zero_returns_no_transfers():
    a, b = uuid4(), uuid4()
    assert settle({a: 0, b: 0}) == []


def test_two_party_simple_case():
    a, b = uuid4(), uuid4()
    # b が a に 1000 払う
    transfers = settle({a: 1000, b: -1000})
    assert transfers == [Transfer(from_id=b, to_id=a, amount=1000)]


def test_three_party_minimization():
    """A=+3000, B=-1000, C=-2000 → 送金 2 回(B→A 1000, C→A 2000)"""
    a, b, c = uuid4(), uuid4(), uuid4()
    transfers = settle({a: 3000, b: -1000, c: -2000})

    # 送金回数の最小化(=N-1 以下に抑える)
    assert len(transfers) == 2

    # 全 transfer の合計が a への流入と一致
    in_to_a = sum(t.amount for t in transfers if t.to_id == a)
    assert in_to_a == 3000


def test_returns_immutable_result():
    """元の dict を破壊しないこと(関数の冪等性)"""
    a, b = uuid4(), uuid4()
    balances = {a: 1000, b: -1000}
    settle(balances)
    assert balances == {a: 1000, b: -1000}
