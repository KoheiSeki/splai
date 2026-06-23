from __future__ import annotations

from typing import Literal
from uuid import UUID

from app.schemas.base import CamelModel


class OcrUploadResponse(CamelModel):
    job_id: UUID


class OcrResultDTO(CamelModel):
    merchant_name: str | None = None
    total_amount: int | None = None
    raw_text: str


class OcrJobResponse(CamelModel):
    id: UUID
    group_id: UUID
    status: Literal["pending", "processing", "succeeded", "failed"]
    result: OcrResultDTO | None = None
    error_message: str | None = None
    # OCR 確定後に payment と link されると埋まる(Frontend が「既に登録済み」検出に使う)。
    payment_id: UUID | None = None
