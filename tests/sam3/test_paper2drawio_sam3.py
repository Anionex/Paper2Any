"""
Test script for paper2drawio_sam3 workflow.

This script runs the workflow directly (no CLI). It expects:
- SAM3 HTTP service running on http://127.0.0.1:8001
- Input image: tests/sam3/ori.png
- VLM OCR API configured via environment variables

Required env vars:
- CHAT_API_URL: Comfly API endpoint (e.g., https://api.comfly.ai/v1/chat/completions)
- CHAT_API_KEY: Comfly API key

Optional env vars:
- VLM_OCR_TIMEOUT: Timeout for VLM OCR requests (default 120 seconds)
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from urllib.request import urlopen
from urllib.error import URLError

from dataflow_agent.toolkits.drawio_tools import export_drawio_png


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


def main() -> int:
    repo_root = _ensure_repo_on_path()
    img_path = repo_root / "tests" / "sam3" / "ori.png"

    if not img_path.exists():
        print(f"[ERROR] Input image not found: {img_path}")
        return 1

    # Check required VLM OCR configuration
    # chat_api_url = "https://ai.comfly.chat/v1"
    # chat_api_key = "sk-8gRMzkV93cuqeM5rFQh4fqFINjIpcHcipL0WuEmE99WgpWFD"
    chat_api_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    chat_api_key="sk-a82b5555d635416a95f4c2d7d0394174"

    if not chat_api_url or not chat_api_key:
        print("[ERROR] VLM OCR not configured. Please set environment variables:")
        print("        CHAT_API_URL: Comfly API endpoint")
        print("        CHAT_API_KEY: Comfly API key")
        return 1

    if not _check_sam3_health("http://127.0.0.1:8001/health"):
        print("[ERROR] SAM3 service not ready at http://127.0.0.1:8001/health")
        print("        Please start the service before running this script.")
        return 2

    # Preload workflow registry without importing workflow/__init__
    _ensure_workflow_registry(repo_root)

    # Import the target workflow module via file path to avoid triggering
    # dataflow_agent.workflow.__init__ (which imports all wf_*.py).
    from dataflow_agent.state import Paper2DrawioState
    import importlib.util

    wf_path = repo_root / "dataflow_agent" / "workflow" / "wf_paper2drawio_sam3.py"
    mod_name = "dataflow_agent.workflow.wf_paper2drawio_sam3"
    spec = importlib.util.spec_from_file_location(mod_name, wf_path)
    if spec is None or spec.loader is None:
        print(f"[ERROR] Failed to load workflow module: {wf_path}")
        return 4
    wf_mod = importlib.util.module_from_spec(spec)
    # Ensure module is registered for dataclass type resolution during exec
    sys.modules[mod_name] = wf_mod
    spec.loader.exec_module(wf_mod)
    create_paper2drawio_sam3_graph = getattr(wf_mod, "create_paper2drawio_sam3_graph")

    # Create a mock request object with VLM OCR configuration
    class MockRequest:
        def __init__(self, chat_api_url: str, api_key: str):
            self.chat_api_url = chat_api_url
            self.api_key = api_key
            self.chat_api_key = api_key
            self.language = "zh"  # Default language
            self.user_id = "test_user"  # Optional user ID

    state = Paper2DrawioState(
        paper_file=str(img_path),
        request=MockRequest(chat_api_url, chat_api_key)
    )
    graph = create_paper2drawio_sam3_graph().build()
    out = asyncio.run(graph.ainvoke(state))

    # LangGraph may return a dict state; handle both dataclass and dict.
    output_xml = None
    if isinstance(out, dict):
        output_xml = out.get("output_xml_path") or out.get("output_xml")
    else:
        output_xml = getattr(out, "output_xml_path", None) or getattr(out, "output_xml", None)

    print("output_xml:", output_xml)
    if output_xml and Path(output_xml).exists():
        # Export draw.io screenshot PNG into the same output directory.
        xml_path = Path(output_xml)
        png_path = xml_path.with_suffix(".png")
        try:
            xml_content = xml_path.read_text(encoding="utf-8")
            ok, msg = export_drawio_png(xml_content, str(png_path))
            if ok:
                print("output_png:", str(png_path))
            else:
                print("[WARN] draw.io PNG export skipped:", msg)
        except Exception as e:
            print("[WARN] draw.io PNG export failed:", e)

        print("[OK] draw.io XML generated.")
        return 0

    print("[ERROR] draw.io XML not generated.")
    return 3


if __name__ == "__main__":
    raise SystemExit(main())
