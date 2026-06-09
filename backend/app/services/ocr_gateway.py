from __future__ import annotations

import json
import re
from dataclasses import dataclass

from google.cloud import vision

from app.config import get_settings
from app.exceptions.domain import OCRFailed


@dataclass(frozen=True)
class OcrParseResult:
    """レシート読み取り結果"""

    # 店名
    merchant_name: str | None
    # 合計額
    total_amount: int | None
    # レシート内容
    raw_text: str


def parse_receipt_text(raw_text: str) -> OcrParseResult:
    """GCP Vision の full_text から店名・合計額をヒューリスティック抽出(MVP)。

    Phase 4 は regex ベース。精度不足は Phase 5 で改善。
    """

    lines = [ln.strip() for ln in raw_text.splitlines() if ln.strip()]
    merchant_name = lines[0] if lines else None

    total_amount: int | None = None
    for line in reversed(lines):
        m = re.search(r"(?:合計|総計|total|￥|¥)\s*([0-9,]+)", line, re.I)
        if m:
            total_amount = int(m.group(1).replace(",", ""))
            break

    return OcrParseResult(
        merchant_name=merchant_name,
        total_amount=total_amount,
        raw_text=raw_text,
    )


def run_gcp_vision_ocr(image_bytes: bytes) -> OcrParseResult:
    """GCP Vision を使ってレシート画像からテキストを抽出し、OcrParseResult を返す。"""

    settings = get_settings()
    if not settings.gcp_vision_credentials_json:
        raise OCRFailed("GCP_VISION_CREDENTIALS_JSON is not configured")

    client = vision.ImageAnnotatorClient.from_service_account_info(
        json.loads(settings.gcp_vision_credentials_json)
    )

    request = vision.AnnotateImageRequest(
        image=vision.Image(content=image_bytes),
        features=[vision.Feature(type_=vision.Feature.Type.DOCUMENT_TEXT_DETECTION)],
    )
    # 文字データ取得
    batch = client.batch_annotate_images(requests=[request])
    response = batch.responses[0]

    if response.error.message:
        raise OCRFailed(response.error.message)

    raw = response.full_text_annotation.text if response.full_text_annotation else ""
    if not raw.strip():
        raise OCRFailed("no text detected in receipt image")

    return parse_receipt_text(raw)
