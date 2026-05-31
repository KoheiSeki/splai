from dataclasses import dataclass
from typing import Protocol
from uuid import UUID


@dataclass(frozen=True)
class Transfer:
    """1 件の送金。amount は常に正の整数(JPY)。"""

    from_id: UUID
    to_id: UUID
    amount: int


def settle(net_balances: dict[UUID, int]) -> list[Transfer]:
    """正味収支(プラス=受け取る、マイナス=払う)から送金リストを生成する。

    Args:
        net_balances: {member_id: net_amount}。プラス=受け取る、マイナス=払う。
            合計は 0 を前提とするが、丸め誤差 1 円程度なら許容(清算は近似値で十分)。

    Returns:
        Transfer のリスト。要素数は最少。アルゴリズム的最適性は保証しないが
        N-1 件以下に抑える。
    """
    # 受け取る人(プラス)を大きい順にソート
    creditors = sorted([m, b] for m, b in net_balances.items() if b > 0)

    # 支払う人(マイナス)を小さい順にソート
    debtors = sorted([m, b] for m, b in net_balances.items() if b < 0)

    transfers: list[Transfer] = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        debtor_id, debt = debtors[i]
        creditor_id, credit = creditors[j]
        amount = min(-debt, credit)
        if amount > 0:
            transfers.append(Transfer(from_id=debtor_id, to_id=creditor_id, amount=amount))

        debtors[i] = (debtor_id, debt + amount)
        creditors[j] = (creditor_id, credit - amount)

        if debtors[i][1] == 0:
            i += 1
        if creditors[j][1] == 0:
            j += 1

    return transfers


class _ShareLike(Protocol):
    """payment_share の最小限のインタフェース(utils が ORM に依存しないため)。"""

    member_id: UUID
    share_type: str  # "equal" | "ratio" | "amount"
    share_value: float


def compute_share_amounts(payment_amount: int, shares: list[_ShareLike]) -> dict[UUID, int]:
    """1 件の payment 内での各 member の負担額を計算する純粋関数。

    - equal: payment_amount を均等割(端数は最初の share に寄せる)
    - amount: share_value を直接負担額として使う
    - ratio: share_value を比率として配分(MVP は未対応、equal にフォールバック)
    """
    if not shares:
        return {}

    if all(s.share_type == "amount" for s in shares):
        return {s.member_id: int(s.share_value) for s in shares}

    if all(s.share_type == "equal" for s in shares):
        n = len(shares)
        base = payment_amount // n
        remainder = payment_amount - base * n
        result = {s.member_id: base for s in shares}
        # 端数を先頭に寄せる
        result[shares[0].member_id] += remainder

        return result

    # ratio やミックスは MVP では equal にフォールバック
    n = len(shares)
    base = payment_amount // n

    return {s.member_id: base for s in shares}
