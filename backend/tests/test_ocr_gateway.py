from app.services.ocr_gateway import parse_receipt_text


def test_parse_receipt_text_extracts_total_and_merchant():
    raw = "居酒屋A\n2026/06/07\n合計 ¥12,000\n(税込)"
    result = parse_receipt_text(raw)
    assert result.merchant_name == "居酒屋A"
    assert result.total_amount == 12000
    assert "居酒屋A" in result.raw_text
