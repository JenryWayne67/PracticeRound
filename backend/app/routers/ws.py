"""Realtime rooms: every JSON message sent to /api/ws/{room} is broadcast to that room.

Good enough for live chat, cursors, multiplayer state, live dashboards. In-memory, single process.
"""

from collections import defaultdict

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["realtime"])


class ConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, room: str, ws: WebSocket) -> None:
        await ws.accept()
        self.rooms[room].add(ws)

    def disconnect(self, room: str, ws: WebSocket) -> None:
        self.rooms[room].discard(ws)
        if not self.rooms[room]:
            del self.rooms[room]

    async def broadcast(self, room: str, message: dict) -> None:
        for ws in list(self.rooms.get(room, ())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(room, ws)


# Import `manager` elsewhere to push server events: await manager.broadcast("room", {...})
manager = ConnectionManager()


@router.websocket("/ws/{room}")
async def websocket_room(ws: WebSocket, room: str):
    await manager.connect(room, ws)
    try:
        while True:
            await manager.broadcast(room, await ws.receive_json())
    except WebSocketDisconnect:
        manager.disconnect(room, ws)
