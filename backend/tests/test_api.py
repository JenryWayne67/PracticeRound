import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def test_full_flow():
    with TestClient(app) as client:
        assert client.get("/api/health").json()["status"] == "ok"
        assert client.get("/api/items").status_code == 401

        creds = {"email": "Test@Example.com", "password": "secret123", "name": "Test"}
        r = client.post("/api/auth/register", json=creds)
        assert r.status_code == 201, r.text
        assert client.post("/api/auth/register", json=creds).status_code == 409

        r = client.post("/api/auth/login", data={"username": "test@example.com", "password": "secret123"})
        assert r.status_code == 200, r.text
        headers = {"Authorization": f"Bearer {r.json()['access_token']}"}
        assert client.get("/api/auth/me", headers=headers).json()["email"] == "test@example.com"
        bad = client.post("/api/auth/login", data={"username": "test@example.com", "password": "wrong"})
        assert bad.status_code == 401

        r = client.post("/api/items", json={"title": "First"}, headers=headers)
        assert r.status_code == 201, r.text
        item_id = r.json()["id"]
        r = client.patch(f"/api/items/{item_id}", json={"done": True}, headers=headers)
        assert r.json()["done"] is True and r.json()["title"] == "First"
        assert len(client.get("/api/items", headers=headers).json()) == 1
        assert client.delete(f"/api/items/{item_id}", headers=headers).status_code == 204
        assert client.get(f"/api/items/{item_id}", headers=headers).status_code == 404

        assert client.get("/api/notes").json() == []
        note = {"title": "Mulching sesame", "body": "Straw mulch kept seedlings alive through a dry week.", "category": "drought", "place": "Magway"}
        assert client.post("/api/notes", json=note).status_code == 401
        r = client.post("/api/notes", json=note, headers=headers)
        assert r.status_code == 201 and r.json()["author_name"] == "Test", r.text
        assert len(client.get("/api/notes?category=drought").json()) == 1
        assert client.get("/api/notes?category=heat").json() == []
        assert client.delete(f"/api/notes/{r.json()['id']}", headers=headers).status_code == 204

        with client.websocket_connect("/api/ws/room1") as ws:
            ws.send_json({"hello": "world"})
            assert ws.receive_json() == {"hello": "world"}
