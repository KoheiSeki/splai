import httpx
import pytest
import respx

from app.services.storage import upload_receipt_image


@pytest.fixture
def storage_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")


@respx.mock
async def test_upload_receipt_image_posts_to_storage(storage_env):
    group_id = "00000000-0000-0000-0000-000000000001"
    job_id = "00000000-0000-0000-0000-000000000002"
    object_path = f"receipts/{group_id}/{job_id}.jpg"
    expected_url = f"https://example.supabase.co/storage/v1/object/{object_path}"

    route = respx.post(expected_url).mock(
        return_value=httpx.Response(200, json={"Key": object_path})
    )

    path = await upload_receipt_image(
        group_id=group_id,
        job_id=job_id,
        content_type="image/jpeg",
        data=b"fake",
    )

    assert route.called
    assert path == object_path
