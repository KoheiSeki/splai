import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Group(Base):
    """
    Groupテーブルのモデル
    """

    __tablename__ = "groups"

    # グループID
    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # グループ名
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    # イベント日
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # 通貨
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="JPY")
    # 作成日時
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # 削除日時
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
