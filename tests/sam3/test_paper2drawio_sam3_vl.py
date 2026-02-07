"""
Test script for paper2drawio_sam3_vl workflow.

This script runs the workflow directly (no CLI). It expects:
- SAM3 HTTP service running (default http://127.0.0.1:8001)
- VLM OCR service (qwen-vl-ocr-latest) reachable via --api-url and --api-key
- Input image: tests/sam3/ori.png

Example:
  python tests/sam3/test_paper2drawio_sam3_vl.py \
    --api-url http://127.0.0.1:3000/v1 \
    --api-key sk-xxx
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError


def _ensure_repo_on_path() -> Path:
    here = Path(__file__).resolve()
    repo_root = here.parents[2]  # /data/users/pzw/Paper2Any
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    return repo_root


def _ensure_workflow_registry(repo_root: Path) -> None:
    """
    Preload dataflow_agent.workflow.registry without importing dataflow_agent.workflow.__init__.
    This avoids auto-import of all wf_*.py (which pulls optional deps).
    """
    import types
    import importlib.util

    wf_pkg_name = "dataflow_agent.workflow"
    if wf_pkg_name not in sys.modules:
        wf_pkg = types.ModuleType(wf_pkg_name)
        wf_pkg.__path__ = [str(repo_root / "dataflow_agent" / "workflow")]
        wf_pkg.__package__ = "dataflow_agent"
        sys.modules[wf_pkg_name] = wf_pkg

    reg_name = "dataflow_agent.workflow.registry"
    if reg_name not in sys.modules:
        reg_path = repo_root / "dataflow_agent" / "workflow" / "registry.py"
        spec = importlib.util.spec_from_file_location(reg_name, reg_path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"Failed to load registry module: {reg_path}")
        mod = importlib.util.module_from_spec(spec)
        sys.modules[reg_name] = mod
        spec.loader.exec_module(mod)


def _check_sam3_health(url: str) -> bool:
    try:
        with urlopen(url, timeout=3) as resp:
            return resp.status == 200
    except URLError:
        return False


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Test paper2drawio_sam3_vl workflow")
    parser.add_argument(
        "--image",
        default="",
        help="Input image path (default: tests/sam3/ori.png)",
    )
    parser.add_argument(
        "--api-url",
        # default="https://api.apiyi.com/v1/",
        default="https://ai.comfly.chat/v1",
        help="VLM OCR API URL (e.g., http://127.0.0.1:3000/v1)",
    )
    parser.add_argument(
        "--api-key",
        # default="sk-c0AvwQkevAkrUFJxA1C4822f26614b9a8c6161Fa062c0631",  #Yi
        default="sk-8gRMzkV93cuqeM5rFQh4fqFINjIpcHcipL0WuEmE99WgpWFD",
        help="VLM OCR API key",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=900,
        help="VLM OCR timeout seconds (exported to VLM_OCR_TIMEOUT)",
    )
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    repo_root = _ensure_repo_on_path()

    img_path = repo_root / "tests" / "sam3" / "ori.png"

    if not img_path.exists():
        print(f"[ERROR] Input image not found: {img_path}")
        return 1

    # Default envs (can be overridden by user env)
    os.environ.setdefault("AZURE_OCR_ENDPOINT", "http://localhost:5000")
    os.environ.setdefault("TEXT_FORMULA_ENGINE", "none")

    if not _check_sam3_health("http://127.0.0.1:8001/health"):
        print("[ERROR] SAM3 service not ready at http://127.0.0.1:8001/health")
        return 2

    if not args.api_url or not args.api_key:
        print("[ERROR] VLM OCR not configured. Provide --api-url and --api-key.")
        return 4

    os.environ["VLM_OCR_TIMEOUT"] = str(args.timeout)

    # Preload workflow registry without importing workflow/__init__
    _ensure_workflow_registry(repo_root)

    # Import the target workflow module via file path to avoid triggering
    # dataflow_agent.workflow.__init__ (which imports all wf_*.py).
    from dataflow_agent.state import Paper2DrawioState
    import importlib.util

    wf_path = repo_root / "dataflow_agent" / "workflow" / "wf_paper2drawio_sam3_vl.py"
    mod_name = "dataflow_agent.workflow.wf_paper2drawio_sam3_vl"
    spec = importlib.util.spec_from_file_location(mod_name, wf_path)
    if spec is None or spec.loader is None:
        print(f"[ERROR] Failed to load workflow module: {wf_path}")
        return 5
    wf_mod = importlib.util.module_from_spec(spec)
    sys.modules[mod_name] = wf_mod
    spec.loader.exec_module(wf_mod)
    create_graph = getattr(wf_mod, "create_paper2drawio_sam3_graph")

    state = Paper2DrawioState(paper_file=str(img_path))
    state.request.chat_api_url = args.api_url
    state.request.api_key = args.api_key
    state.request.chat_api_key = args.api_key

    graph = create_graph().build()
    out = asyncio.run(graph.ainvoke(state))

    # LangGraph may return a dict state; handle both dataclass and dict.
    output_xml = None
    temp_data = {}
    if isinstance(out, dict):
        output_xml = out.get("output_xml_path") or out.get("output_xml")
        temp_data = out.get("temp_data", {}) or {}
    else:
        output_xml = getattr(out, "output_xml_path", None) or getattr(out, "output_xml", None)
        temp_data = getattr(out, "temp_data", {}) or {}

    print("output_xml:", output_xml)
    text_blocks = temp_data.get("text_blocks", []) or []
    print("text_blocks:", len(text_blocks))
    for i, blk in enumerate(text_blocks[:5]):
        geo = blk.get("geometry", {})
        print(f"text[{i}]: {blk.get('text', '')} @ {geo}")

    if output_xml and Path(output_xml).exists():
        if not text_blocks:
            print("[WARN] draw.io XML generated, but no OCR text blocks found.")
        else:
            print("[OK] draw.io XML generated with OCR text blocks.")
        return 0

    print("[ERROR] draw.io XML not generated.")
    return 6


if __name__ == "__main__":
    raise SystemExit(main())

# CUDA_VISIBLE_DEVICES=0 python -m sam3_service.server --port 8001 --device cuda
