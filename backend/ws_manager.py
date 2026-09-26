import asyncio
import json
import logging

from fastapi import WebSocket

logger = logging.getLogger(__name__)

_SEND_TIMEOUT = 5  # sn — yavaş istemci yayını bloklamasın


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)
        logger.info(f"WS bağlandı. Aktif: {len(self.active)}")

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)
        logger.info(f"WS ayrıldı. Aktif: {len(self.active)}")

    async def broadcast(self, data: dict):
        if not self.active:
            return
        msg = json.dumps(data, ensure_ascii=False)
        targets = list(self.active)
        results = await asyncio.gather(
            *(asyncio.wait_for(ws.send_text(msg), _SEND_TIMEOUT) for ws in targets),
            return_exceptions=True,
        )
        for ws, res in zip(targets, results):
            if isinstance(res, BaseException):
                self.disconnect(ws)


manager = ConnectionManager()
