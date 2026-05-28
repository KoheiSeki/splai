from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """全 Request / Response スキーマの基底クラス。

    Backend 内部は snake_case のまま、JSON ワイヤフォーマットは camelCase に
    変換する(規約 §8.4)。`populate_by_name=True` により snake / camel どちらの
    入力もパース可能とし、後方互換を保つ。

    使用例:
        class GroupResponse(CamelModel):
            id: UUID
            event_date: date | None
            # → JSON: {"id": "...", "eventDate": "..."}
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
