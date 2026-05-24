from fastapi import FastAPI

app = FastAPI(title="SPLAI Backend", version="0.1.0")

@app.get("/")
def root() -> dict[str, str]:
    return {"app": "splai", "phase": "0" }
