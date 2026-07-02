import asyncio
import json
import os
import sys
import time
from typing import Any

import httpx

SERVICE_NAME = "klipse-processor"

AXIOM_API_TOKEN = os.environ.get("AXIOM_API_TOKEN", "").strip()
AXIOM_DATASET = os.environ.get("AXIOM_DATASET", "klipse").strip()
AXIOM_INGEST_URL = f"https://api.axiom.co/v1/ingest/{AXIOM_DATASET}"

ENVIRONMENT = os.environ.get("ENVIRONMENT", "production").strip()
KLIPSE_PERF_LOG = os.environ.get("KLIPSE_PERF_LOG", "").strip() == "1"

# Same level gating as the main app's logger (src/lib/logger.ts): error/warn always
# emitted, info only when KLIPSE_PERF_LOG=1 or non-production, debug dev-only.
_INFO_ENABLED = KLIPSE_PERF_LOG or ENVIRONMENT != "production"
_DEBUG_ENABLED = ENVIRONMENT in ("local", "development")

# Held so fire-and-forget Axiom POST tasks aren't garbage-collected mid-flight.
_pending_tasks: set[asyncio.Task] = set()


def _emit(level: str, message: str, fields: dict[str, Any]) -> None:
    record = {
        "time": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime()),
        "level": level,
        "message": message,
        "service": SERVICE_NAME,
        **fields,
    }
    print(json.dumps(record, default=str), file=sys.stdout, flush=True)

    if not AXIOM_API_TOKEN:
        return

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running event loop (e.g. called from sync code before the app starts) —
        # local/stdout log above still happened, just skip the Axiom drain here.
        return

    task = loop.create_task(_send_to_axiom(record))
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)


async def _send_to_axiom(record: dict) -> None:
    """Fire-and-forget — errors here must never affect the caller, and are not
    themselves logged (to avoid recursive failure loops if Axiom itself is down).
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                AXIOM_INGEST_URL,
                headers={
                    "Authorization": f"Bearer {AXIOM_API_TOKEN}",
                    "Content-Type": "application/json",
                },
                json=[record],
            )
    except Exception:  # noqa: BLE001
        pass


class Logger:
    def info(self, message: str, **fields: Any) -> None:
        if _INFO_ENABLED:
            _emit("info", message, fields)

    def warning(self, message: str, **fields: Any) -> None:
        _emit("warn", message, fields)

    def warn(self, message: str, **fields: Any) -> None:
        self.warning(message, **fields)

    def error(self, message: str, **fields: Any) -> None:
        _emit("error", message, fields)

    def debug(self, message: str, **fields: Any) -> None:
        if _DEBUG_ENABLED:
            _emit("debug", message, fields)


logger = Logger()
