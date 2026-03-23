from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "AI Smart Reader API is running"}

def test_translate_validation():
    # Test missing required field
    response = client.post("/translate", json={"target_lang": "ka"})
    assert response.status_code == 422 # Unprocessable Entity (missing text)
