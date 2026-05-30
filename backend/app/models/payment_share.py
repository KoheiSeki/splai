import enum
import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ShareType(str, enum.Enum):
    EQUAL = "equal"
    RATIO = "ratio"
    AMOUNT = "amount"


class PaymentShare(Base):
    """
    PaymentShareテーブルのモデル
    """

    __tablename__ = "payment_shares"

    # 支払い共有ID
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # 支払いID
    payment_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # メンバーID
    member_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("members.id", ondelete="RESTRICT"), nullable=False
    )
    # 共有タイプ
    share_type: Mapped[ShareType] = mapped_column(
        Enum(ShareType, name="share_type"), nullable=False
    )
    # 共有値
    share_value: Mapped[Decimal] = mapped_column(Numeric(precision=12, scale=4), nullable=False)
