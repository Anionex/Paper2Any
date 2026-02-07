"""
Standalone test for VLM OCR (qwen-vl-ocr-*).

Usage:
  python tests/sam3/test_vlm_ocr.py \
    --image tests/sam3/ori.png \
    --api-url http://127.0.0.1:3000/v1 \
    --api-key sk-xxx \
    --model qwen-vl-ocr-2025-11-20 \
    --timeout 120

Env fallbacks:
  DF_API_URL, DF_API_KEY, DF_OCR_MODEL
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path


def _ensure_repo_on_path() -> Path:
    here = Path(__file__).resolve()
    repo_root = here.parents[2]  # /data/users/pzw/Paper2Any
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    return repo_root


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test VLM OCR endpoint")
    parser.add_argument(
        "--image",
        default="/data/users/pzw/Paper2Any/tests/sam3/test4.png",
        help="Input image path (default: tests/sam3/ori.png)",
    )
    parser.add_argument(
        "--api-url",
        # default="https://api.apiyi.com/v1/",
        default="https://ai.comfly.chat/v1",
        help="VLM OCR API URL (default: $DF_API_URL)",
    )
    parser.add_argument(
        "--api-key",
        # default="sk-c0AvwQkevAkrUFJxA1C4822f26614b9a8c6161Fa062c0631",
        default="sk-8gRMzkV93cuqeM5rFQh4fqFINjIpcHcipL0WuEmE99WgpWFD",
        help="VLM OCR API key (default: $DF_API_KEY)",
    )
    parser.add_argument(
        "--model",
        default="qwen-vl-ocr-2025-11-20",
        help="VLM OCR model (default: $DF_OCR_MODEL or qwen-vl-ocr-2025-11-20)",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Request timeout seconds (default: 120)",
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=4096,
        help="Max tokens (default: 4096)",
    )
    parser.add_argument(
        "--prompt",
        default="Extract all text with bounding boxes as JSON.",
        help="User prompt to send with the image",
    )
    return parser.parse_args()


async def _run(args: argparse.Namespace) -> int:
    repo_root = _ensure_repo_on_path()

    img_path = Path(args.image) if args.image else (repo_root / "tests" / "sam3" / "ori.png")
    img_path = img_path.resolve()
    if not img_path.exists():
        print(f"[ERROR] Input image not found: {img_path}")
        return 1

    api_url = args.api_url or os.getenv("DF_API_URL", "").strip()
    api_key = args.api_key or os.getenv("DF_API_KEY", "").strip()
    model = args.model or os.getenv("DF_OCR_MODEL", "").strip() or "qwen-vl-ocr-2025-11-20"

    if not api_url or not api_key:
        print("[ERROR] Missing api_url/api_key. Provide --api-url/--api-key or set DF_API_URL/DF_API_KEY.")
        return 2

    from dataflow_agent.toolkits.multimodaltool.req_ocr import call_ocr_async

    messages = [{"role": "user", "content": args.prompt}]

    print("[INFO] VLM OCR request")
    print(f"  image:   {img_path}")
    print(f"  api_url: {api_url}")
    print(f"  model:   {model}")
    print(f"  timeout: {args.timeout}s")

    start = time.time()
    try:
        result = await call_ocr_async(
            model=model,
            messages=messages,
            api_url=api_url,
            api_key=api_key,
            image_path=str(img_path),
            max_tokens=args.max_tokens,
            temperature=0.01,
            timeout=args.timeout,
        )
    except Exception as e:
        elapsed = time.time() - start
        print(f"[ERROR] OCR failed after {elapsed:.1f}s: {e}")
        print(f"[ERROR] Exception type: {type(e).__name__}")
        print(f"[ERROR] Exception repr: {repr(e)}")
        return 3

    elapsed = time.time() - start
    print(f"[OK] OCR succeeded in {elapsed:.1f}s")
    print("----- OCR RAW OUTPUT -----")
    print(result)
    print("--------------------------")
    return 0


def main() -> int:
    args = _parse_args()
    return asyncio.run(_run(args))


if __name__ == "__main__":
    raise SystemExit(main())
