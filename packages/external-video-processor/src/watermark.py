import asyncio
import os
import tempfile

FONT_PATH = "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"


async def apply_watermark_with_audio(input_path: str, output_path: str, label: str) -> None:
    """Ports the old applyWatermarkWithAudio ffmpeg pass: burns a centered drawtext
    watermark onto the video (deterministic, pixel-exact every frame — unlike prompt-baking
    text into the generation itself, which diffusion models render unreliably) and
    passes through the first audio stream as AAC 192k.
    """
    fd, label_path = tempfile.mkstemp(suffix=".txt")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(label)

        vf = (
            f"drawtext=textfile={label_path}:fontfile={FONT_PATH}:"
            "fontsize=28:fontcolor=white:x=(w-text_w)/2:y=h-th-40:"
            "box=1:boxcolor=black@0.5:boxborderw=10"
        )

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-y",
            "-i",
            input_path,
            "-map",
            "0:v:0",
            "-map",
            "0:a:0",
            "-vf",
            vf,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-movflags",
            "+faststart",
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffmpeg_watermark_failed:{stderr.decode(errors='replace')[:500]}")
    finally:
        if os.path.exists(label_path):
            os.remove(label_path)
