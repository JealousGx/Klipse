import json
import logging
import re
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, ValidationError

from .callbacks import report_key_failure
from .retry import NonRetriableError

logger = logging.getLogger("processor")

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)
DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash"


class ScriptJson(BaseModel):
    """Single-prompt schema — replaces the old {voiceover, imagePrompts[3]} shape.
    The video model generates narration/dialogue/audio itself from `video_prompt`,
    so there's no separate spoken-text field.
    """

    video_prompt: str
    title: str | None = None
    description: str | None = None
    tags: list[str] | None = None


@dataclass
class ProviderKey:
    id: str
    secret: str
    model_id: str | None


# ---------------------------------------------------------------------------
# Defensive JSON extraction — ported from the old script.ts's parseScriptJson /
# repairTruncatedJson / stripMarkdown. LLMs sometimes wrap JSON in markdown fences,
# add prose around it, or get truncated at max_tokens — this recovers from all three.
# ---------------------------------------------------------------------------


def _repair_truncated_json(s: str) -> str:
    out = s.rstrip()

    in_string = False
    escaped = False
    for ch in out:
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
    if in_string:
        out += '"'

    out = re.sub(r",\s*$", "", out)

    stack: list[str] = []
    in_string = False
    escaped = False
    for ch in out:
        if escaped:
            escaped = False
            continue
        if ch == "\\":
            escaped = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            stack.append("}")
        elif ch == "[":
            stack.append("]")
        elif ch in ("}", "]"):
            if stack:
                stack.pop()

    while stack:
        out += stack.pop()
    return out


def parse_script_json(raw: str) -> ScriptJson | None:
    """Handles: bare JSON object, markdown-fenced JSON, JSON embedded in prose,
    and truncated JSON (repaired before parsing).
    """
    candidates: list[str] = [raw]

    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if fenced:
        candidates.append(fenced.group(1).strip())

    first_brace = raw.find("{")
    last_brace = raw.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidates.append(raw[first_brace : last_brace + 1])

    if first_brace != -1:
        candidates.append(_repair_truncated_json(raw[first_brace:]))

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        try:
            if isinstance(parsed, list) and parsed:
                return ScriptJson.model_validate(parsed[0])
            return ScriptJson.model_validate(parsed)
        except ValidationError:
            continue
    return None


# ---------------------------------------------------------------------------
# Provider calls
# ---------------------------------------------------------------------------


async def _call_openrouter(
    model: str, key: ProviderKey, system_prompt: str, user_prompt: str
) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {key.secret}",
                "Content-Type": "application/json",
            },
            json={
                "model": key.model_id or model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
            },
        )
        if res.status_code >= 400:
            raise RuntimeError(f"openrouter_error:{res.status_code}:{res.text[:200]}")
        data = res.json()
        return data["choices"][0]["message"]["content"]


async def _call_gemini(model: str, key: ProviderKey, system_prompt: str, user_prompt: str) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        res = await client.post(
            GEMINI_URL_TEMPLATE.format(model=key.model_id or model),
            params={"key": key.secret},
            json={
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "generationConfig": {"responseMimeType": "application/json"},
            },
        )
        if res.status_code >= 400:
            raise RuntimeError(f"gemini_error:{res.status_code}:{res.text[:200]}")
        data = res.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


async def generate_script(
    *,
    job_id: str,
    callback_base_url: str,
    callback_secret: str,
    system_prompt: str,
    user_prompt: str,
    model_chain: list[str],
    openrouter_keys: list[ProviderKey],
    gemini_keys: list[ProviderKey],
) -> ScriptJson:
    """Tries each model in the OpenRouter chain against each available key, falling back
    to Gemini keys if OpenRouter is fully exhausted. Reports key failures back to the main
    app so it can apply cooldown, matching the previous provider-key-rotation pattern.
    """
    last_error: Exception | None = None

    for model in model_chain:
        for key in openrouter_keys:
            try:
                raw = await _call_openrouter(model, key, system_prompt, user_prompt)
                parsed = parse_script_json(raw)
                if parsed:
                    return parsed
                last_error = ValueError("openrouter_unparseable_response")
            except Exception as e:  # noqa: BLE001
                last_error = e
                status = 0
                msg = str(e)
                if msg.startswith("openrouter_error:"):
                    try:
                        status = int(msg.split(":")[1])
                    except (IndexError, ValueError):
                        status = 0
                await report_key_failure(
                    callback_base_url,
                    callback_secret,
                    job_id,
                    "openrouter",
                    key.id,
                    status,
                    msg,
                    None,
                )

    for key in gemini_keys:
        try:
            raw = await _call_gemini(
                DEFAULT_GEMINI_FALLBACK_MODEL, key, system_prompt, user_prompt
            )
            parsed = parse_script_json(raw)
            if parsed:
                return parsed
            last_error = ValueError("gemini_unparseable_response")
        except Exception as e:  # noqa: BLE001
            last_error = e
            status = 0
            msg = str(e)
            if msg.startswith("gemini_error:"):
                try:
                    status = int(msg.split(":")[1])
                except (IndexError, ValueError):
                    status = 0
            await report_key_failure(
                callback_base_url, callback_secret, job_id, "gemini", key.id, status, msg, None
            )

    raise NonRetriableError(f"script_generation_exhausted:{last_error}")
