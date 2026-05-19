from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, Request

from fastapi_app.schemas import Template2PPTGenerateRequest, Template2PPTGenerateResponse
from fastapi_app.utils import _to_outputs_url, get_outputs_root, resolve_outputs_path

try:
    from dataflow_agent.logger import get_logger
except Exception:  # pragma: no cover - fallback for isolated imports
    import logging

    def get_logger(name: str):
        return logging.getLogger(name)


log = get_logger(__name__)


class Template2PPTService:
    """Adapter for the external template2ppt runtime.

    Paper2Any keeps this integration thin: it owns request validation, output
    folders, and URL conversion, while the template2ppt package owns template
    induction and PPTX generation.
    """

    def _create_run_dir(self, email: Optional[str]) -> Path:
        code = (email or "default").strip() or "default"
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        run_dir = get_outputs_root() / code / "template2ppt" / timestamp
        (run_dir / "input").mkdir(parents=True, exist_ok=True)
        (run_dir / "work").mkdir(parents=True, exist_ok=True)
        return run_dir

    def _ensure_template2ppt_importable(self) -> None:
        repo_root = (os.getenv("TEMPLATE2PPT_REPO_ROOT") or "").strip()
        if repo_root:
            root_path = Path(repo_root).expanduser().resolve()
            if str(root_path) not in sys.path:
                sys.path.insert(0, str(root_path))

        try:
            import template2ppt.workflow  # noqa: F401
        except ModuleNotFoundError as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "template2ppt runtime is not importable. Install the template2ppt "
                    "package in the backend environment or set TEMPLATE2PPT_REPO_ROOT."
                ),
            ) from exc

    def _resolve_template(self, template: str) -> str:
        raw = str(template or "").strip()
        if not raw:
            raise HTTPException(status_code=400, detail="template is required")

        candidate = Path(raw).expanduser()
        if candidate.is_absolute() or raw.startswith("outputs/") or raw.startswith("/outputs/"):
            resolved = resolve_outputs_path(raw, must_exist=True, allow_files=False, allow_dirs=True)
            return str(resolved)
        return raw

    @staticmethod
    def _dump_input(run_dir: Path, req: Template2PPTGenerateRequest) -> Path:
        spec_path = run_dir / "input" / "template2ppt_request.json"
        spec_path.write_text(
            json.dumps(req.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return spec_path

    async def generate(
        self,
        req: Template2PPTGenerateRequest,
        request: Request | None = None,
    ) -> Template2PPTGenerateResponse:
        self._ensure_template2ppt_importable()

        from template2ppt.workflow import (
            EditorPresentationSpec,
            LayoutPresentationSpec,
            generate_from_editor_spec,
            generate_from_layout_spec,
        )

        run_dir = self._create_run_dir(req.email)
        spec_path = self._dump_input(run_dir, req)
        output_name = Path(req.output_filename or "template2ppt-output.pptx").name
        output_pptx = run_dir / output_name
        if output_pptx.suffix.lower() != ".pptx":
            output_pptx = output_pptx.with_suffix(".pptx")

        template = self._resolve_template(req.template)
        workdir = run_dir / "work"
        try:
            if req.mode == "editor_spec":
                spec = EditorPresentationSpec(**req.content_spec)
                result = await generate_from_editor_spec(
                    spec=spec,
                    output_pptx=output_pptx,
                    template=template,
                    workdir=workdir,
                    save_history=req.save_history,
                )
            elif req.mode == "layout_spec":
                spec = LayoutPresentationSpec(**req.content_spec)
                result = await generate_from_layout_spec(
                    spec=spec,
                    output_pptx=output_pptx,
                    template=template,
                    workdir=workdir,
                    save_history=req.save_history,
                )
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported template2ppt mode: {req.mode}")
        except HTTPException:
            raise
        except Exception as exc:
            log.exception("[template2ppt] generation failed")
            raise HTTPException(status_code=502, detail=f"template2ppt generation failed: {exc}") from exc

        output_path = Path(result.get("output_pptx") or output_pptx).resolve()
        if not output_path.exists():
            raise HTTPException(status_code=502, detail="template2ppt did not produce a PPTX file")

        all_files = [output_path]
        history = result.get("history_json")
        if history and Path(history).exists():
            all_files.append(Path(history).resolve())

        return Template2PPTGenerateResponse(
            success=True,
            ppt_pptx_path=_to_outputs_url(str(output_path), request),
            result_path=str(run_dir),
            all_output_files=[_to_outputs_url(str(path), request) for path in all_files],
            workdir=str(workdir),
            template_dir=str(result.get("template_dir", "")),
            history_json=str(result.get("history_json", "")),
            html_dir=str(result.get("html_dir", "")),
            trace_dir=str(result.get("trace_dir", "")),
            input_spec_path=str(spec_path),
        )
