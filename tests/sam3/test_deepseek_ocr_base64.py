"""
Test deepseek-ocr with base64 image payload (OpenAI-compatible).

Example:
  python tests/sam3/test_deepseek_ocr_base64.py \
    --api-url https://api.apiyi.com/v1 \
    --api-key sk-xxx \
    --image /path/to/image.png
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import httpx


def _ensure_repo_on_path() -> Path:
    here = Path(__file__).resolve()
    repo_root = here.parents[2]  # /data/users/pzw/Paper2Any
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    return repo_root


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test deepseek-ocr with base64 image input")
    parser.add_argument("--api-url", default="https://api.apiyi.com/v1", help="API base URL, e.g. https://api.apiyi.com/v1")
    parser.add_argument("--api-key", default="sk-c0AvwQkevAkrUFJxA1C4822f26614b9a8c6161Fa062c0631", help="API key")
    parser.add_argument("--image", default="", help="Image path (default: tests/sam3/ori.png)")
    parser.add_argument("--model", default="deepseek-ocr", help="Model name (default: deepseek-ocr)")
    parser.add_argument(
        "--grounding",
        action="store_true",
        help="Use <|grounding|> prompt and parse <|ref|>/<|det|> tags",
    )
    parser.add_argument("--timeout", type=int, default=120, help="Request timeout seconds")
    parser.add_argument("--max-tokens", type=int, default=4096, help="max_tokens")
    parser.add_argument("--temperature", type=float, default=0.0, help="temperature")
    return parser.parse_args()


def _build_messages(image_b64: str, fmt: str, use_grounding: bool) -> list[dict]:
    if use_grounding:
        prompt = "<|grounding|>Extract all text with bounding boxes. Return tags only."
    else:
        prompt = "Extract all text with bounding boxes. Return JSON only."
    return [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": {"url": f"data:image/{fmt};base64,{image_b64}"}},
            ],
        }
    ]


def main() -> int:
    args = _parse_args()
    repo_root = _ensure_repo_on_path()

    image_path = Path(args.image) if args.image else (repo_root / "tests" / "sam3" / "ori.png")
    if not image_path.exists():
        print(f"[ERROR] Image not found: {image_path}")
        return 1

    from dataflow_agent.toolkits.multimodaltool.utils import encode_image_to_base64

    image_b64, fmt = encode_image_to_base64(str(image_path))
    messages = _build_messages(image_b64, fmt, args.grounding)

    url = f"{args.api_url.rstrip('/')}/chat/completions"
    payload = {
        "model": args.model,
        "messages": messages,
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
    }
    headers = {
        "Authorization": f"Bearer {args.api_key}",
        "Content-Type": "application/json",
    }

    print(f"POST {url}")
    try:
        with httpx.Client(timeout=args.timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        print(f"[ERROR] HTTP {e.response.status_code}: {e.response.text}")
        return 2
    except Exception as e:
        print(f"[ERROR] Request failed: {e}")
        return 3

    print(json.dumps(data, ensure_ascii=False, indent=2))

    content = ""
    if isinstance(data, dict):
        choices = data.get("choices") or []
        if choices:
            msg = choices[0].get("message") or {}
            content = msg.get("content") or ""

    if args.grounding and content:
        try:
            from PIL import Image
            with Image.open(image_path) as img:
                w, h = img.size
        except Exception:
            w, h = 0, 0

        print("\n--- Parsed Grounding ---")
        pattern = re.compile(
            r"<\\|ref\\|>(.*?)<\\|/ref\\|>\\s*<\\|det\\|>(\\[\\[.*?\\]\\])<\\|/det\\|>",
            re.DOTALL,
        )
        matches = pattern.findall(content)
        if not matches:
            print("[WARN] No grounding tags found in content.")
        for text, det in matches:
            try:
                boxes = json.loads(det)
            except Exception:
                boxes = []
            for box in boxes:
                if len(box) != 4:
                    continue
                x1, y1, x2, y2 = [float(v) for v in box]
                # DeepSeek-OCR grounding uses 0-999 normalized coords
                if w > 0 and h > 0:
                    px = [
                        int(x1 / 1000.0 * w),
                        int(y1 / 1000.0 * h),
                        int(x2 / 1000.0 * w),
                        int(y2 / 1000.0 * h),
                    ]
                else:
                    px = None
                print({"text": text.strip(), "bbox_norm_0_999": box, "bbox_px": px})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
