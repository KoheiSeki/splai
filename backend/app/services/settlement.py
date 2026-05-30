from dataclasses import dataclass
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
