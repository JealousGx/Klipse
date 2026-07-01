import os

from fastapi import Header, HTTPException

_CLIENT_SECRET = os.environ.get("VIDEO_PROCESSOR_CLIENT_SECRET", "").strip()


async def require_bearer_auth(authorization: str = Header(default="")) -> None:
    """Rejects requests that don't carry the shared VIDEO_PROCESSOR_CLIENT_SECRET bearer token.

    Same secret/header contract as the previous Node implementation's isAuthorized() —
    main app and processor deploys don't need to change how they authenticate.
    """
    if not _CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="processor_missing_client_secret")

    expected = f"Bearer {_CLIENT_SECRET}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="unauthorized")
