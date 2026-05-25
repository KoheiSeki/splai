import json
import logging
import structlog
from app.logging_config import configure_logging


def test_logging_emits_json(capsys):
    configure_logging(log_level="INFO")
    log = structlog.get_logger("test")
    log.info("hello", foo="bar")
    out = capsys.readouterr().out.strip()
    parsed = json.loads(out)
    assert parsed["event"] == "hello"
    assert parsed["foo"] == "bar"
    assert parsed["level"] == "info"
