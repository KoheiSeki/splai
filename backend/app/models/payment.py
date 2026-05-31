import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PaymentSource(str, enum.Enum):
    """
    支払い情報入力経路の列挙型
    """

    MANUAL = "manual"
    OCR = "ocr"
    CHAT = "chat"


class Payment(Base):
    """
    Paymentテーブルのモデル
    """

    __tablename__ = "payments"
    # 設計書 §5 の `payments(group_id, deleted_at)` 複合インデックス。
    # group_id 単独の検索も左プレフィックスとしてカバーするので、
    # group_id カラム単独の index=True は付けない(冗長になるため)。
    __table_args__ = (Index("ix_payments_group_id_deleted_at", "group_id", "deleted_at"),)

    # 支払いID
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # グループID
    group_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("groups.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 支払者ID
    payer_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("members.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # 金額
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # 説明
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 支払い日時
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # 入力経路
    source: Mapped[PaymentSource] = mapped_column(
        Enum(PaymentSource, name="payment_source"), nullable=False, default=PaymentSource.MANUAL
    )
    # OCR画像パス
    ocr_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # 作成日時
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # 削除日時
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
