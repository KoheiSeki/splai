from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_usage_log import AiUsageLog


async def record_ai_usage(
    db: AsyncSession,
    *,
    endpoint: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    group_id: UUID | None = None,
) -> None:
    """
    AI 呼び出しのトークン使用量を記録する関数
    """

    db.add(
        AiUsageLog(
            endpoint=endpoint,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            group_id=group_id,
        )
    )
    await db.commit()
