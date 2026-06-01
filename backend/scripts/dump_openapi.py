"""FastAPI app の OpenAPI スキーマを openapi.json にダンプする。

Frontend の codegen(openapi-zod-client)が読み込む元ファイル。
モジュール load 時に Settings() が必要なので、test 用 env を default に。"""

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost/test")

# プロジェクトルート(backend/)を sys.path に追加
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402


def main() -> None:
    out = ROOT / "openapi.json"
    out.write_text(
        json.dumps(app.openapi(), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
