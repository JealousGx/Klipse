import asyncio
import logging
from typing import Awaitable, Callable, TypeVar

logger = logging.getLogger("processor")

T = TypeVar("T")

BASE_MS = 500


class NonRetriableError(Exception):
    """Raised by callers to signal a failure that should not be retried (e.g. 4xx response)."""


async def with_retries(label: str, attempts: int, fn: Callable[[int], Awaitable[T]]) -> T:
    """Same semantics as the previous Node `withRetries` helper: exponential backoff
    (500ms * 2^(attempt-1)), NonRetriableError breaks immediately, final-attempt failure
    is logged and re-raised.
    """
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return await fn(attempt)
        except NonRetriableError as e:
            logger.warning("retry_non_retriable", extra={"label": label, "error": str(e)})
            raise
        except Exception as e:  # noqa: BLE001 - intentionally broad, mirrors prior behavior
            last_error = e
            if attempt < attempts:
                delay_ms = BASE_MS * (2 ** (attempt - 1))
                logger.warning(
                    "retry_attempt_failed",
                    extra={
                        "label": label,
                        "attempt": attempt,
                        "attempts": attempts,
                        "delayMs": delay_ms,
                        "error": str(e),
                    },
                )
                await asyncio.sleep(delay_ms / 1000)
            else:
                logger.warning(
                    "retry_exhausted",
                    extra={"label": label, "attempts": attempts, "error": str(e)},
                )
    assert last_error is not None
    raise last_error
