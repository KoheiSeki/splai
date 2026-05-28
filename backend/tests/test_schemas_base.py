from app.schemas.base import CamelModel


class _Sample(CamelModel):
    user_id: str
    event_date: str | None = None


def test_serializes_to_camel_case():
    obj = _Sample(user_id="abc", event_date="2026-05-24")
    dumped = obj.model_dump(by_alias=True)
    assert dumped == {"userId": "abc", "eventDate": "2026-05-24"}


def test_parses_camel_case_input():
    obj = _Sample.model_validate({"userId": "abc", "eventDate": "2026-05-24"})
    assert obj.user_id == "abc"
    assert obj.event_date == "2026-05-24"


def test_parses_snake_case_input_for_backward_compat():
    obj = _Sample.model_validate({"user_id": "abc"})
    assert obj.user_id == "abc"
