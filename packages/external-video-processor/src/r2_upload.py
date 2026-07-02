import httpx

from .logger import logger
from .retry import with_retries


async def upload_bytes_to_presigned_url(
    presigned_url: str, data: bytes, content_type: str = "video/mp4"
) -> None:
    """PUTs a buffer to a presigned R2 URL. No R2 credentials needed here — the
    presigned URL itself carries the auth. Mirrors the old uploadBufferToPresignedUrl.
    """

    async def attempt(_: int) -> None:
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.put(
                presigned_url,
                content=data,
                headers={"Content-Type": content_type},
            )
            res.raise_for_status()

    await with_retries("r2_upload", 3, attempt)
    logger.info("r2_upload_complete", sizeBytes=len(data))
