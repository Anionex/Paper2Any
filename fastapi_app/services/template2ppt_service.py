from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from fastapi import HTTPException, Request

from fastapi_app.schemas import (
    Template2PPTGenerateRequest,
    Template2PPTGenerateResponse,
    Template2PPTPageContentRequest,
)
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

    Paper2Any owns request validation, pagecontent-to-spec mapping, output
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


    def _create_template_dir(self, email: Optional[str], template_name: str | None = None) -> Path:
        code = (email or "default").strip() or "default"
        raw_name = (template_name or "uploaded-template").strip() or "uploaded-template"
        safe_name = "".join(ch if ch.isalnum() or ch in {"-", "_"} else "-" for ch in raw_name).strip("-")
        safe_name = safe_name or "uploaded-template"
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        template_dir = get_outputs_root() / code / "template2ppt_templates" / f"{timestamp}-{safe_name}"
        template_dir.mkdir(parents=True, exist_ok=True)
        return template_dir

    async def save_uploaded_template(
        self,
        *,
        template_file: Any,
        email: Optional[str] = None,
        template_name: str | None = None,
        induct: bool = False,
        request: Request | None = None,
    ) -> dict[str, Any]:
        filename = Path(getattr(template_file, "filename", "") or "template.pptx").name
        if not filename.lower().endswith(".pptx"):
            raise HTTPException(status_code=400, detail="template_file must be a .pptx file")

        template_dir = self._create_template_dir(email, template_name or Path(filename).stem)
        source_pptx = template_dir / "source.pptx"
        content = await template_file.read()
        if not content:
            raise HTTPException(status_code=400, detail="template_file is empty")
        source_pptx.write_bytes(content)

        induction_status = "skipped"
        induction_error = ""
        if induct:
            self._ensure_template2ppt_importable()
            try:
                from template2ppt.workflow import induct_template

                await induct_template(str(template_dir))
                induction_status = "success"
            except Exception as exc:
                log.exception("[template2ppt] template induction failed")
                induction_status = "failed"
                induction_error = str(exc)

        return {
            "success": True,
            "template": str(template_dir),
            "template_dir": str(template_dir),
            "template_url": _to_outputs_url(str(source_pptx), request),
            "source_pptx": str(source_pptx),
            "induction_status": induction_status,
            "induction_error": induction_error,
            "ready": (template_dir / "slide_induction.json").exists(),
        }

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
    def _loads_pagecontent(raw: Any) -> list[dict[str, Any]]:
        if isinstance(raw, str):
            text = raw.strip()
            if not text:
                raise HTTPException(status_code=400, detail="pagecontent is required")
            try:
                raw = json.loads(text)
            except json.JSONDecodeError as exc:
                raise HTTPException(status_code=400, detail="pagecontent must be valid JSON") from exc
        if not isinstance(raw, list):
            raise HTTPException(status_code=400, detail="pagecontent must be a JSON array")

        pages: list[dict[str, Any]] = []
        for index, item in enumerate(raw):
            if not isinstance(item, dict):
                raise HTTPException(status_code=400, detail=f"pagecontent[{index}] must be an object")
            pages.append(item)
        if not pages:
            raise HTTPException(status_code=400, detail="pagecontent must contain at least one page")
        return pages

    @staticmethod
    def _string_list(value: Any) -> list[str]:
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            text = value.strip()
            if not text:
                return []
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                return [line.strip(" -\t") for line in text.splitlines() if line.strip(" -\t")]
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
            return [text]
        return [str(value).strip()] if str(value).strip() else []

    @staticmethod
    def _first_text(page: dict[str, Any], keys: tuple[str, ...]) -> str:
        for key in keys:
            value = page.get(key)
            if value is None:
                continue
            if isinstance(value, (dict, list)):
                text = json.dumps(value, ensure_ascii=False)
            else:
                text = str(value)
            text = text.strip()
            if text:
                return text
        return ""

    @staticmethod
    def _resolve_page_image(value: Any, result_path: str | None = None) -> str | None:
        raw = str(value or "").strip()
        if not raw:
            return None
        if raw.startswith(("http://", "https://")) and "/outputs/" not in raw:
            return None
        try:
            if raw.startswith(("/outputs/", "outputs/", "http://", "https://")):
                path = resolve_outputs_path(raw, must_exist=True, allow_files=True, allow_dirs=False)
                return str(path)
        except HTTPException:
            return None

        candidate = Path(raw).expanduser()
        if candidate.is_file():
            return str(candidate.resolve())

        if result_path:
            try:
                base_dir = resolve_outputs_path(result_path, must_exist=True, allow_files=False, allow_dirs=True)
            except HTTPException:
                base_dir = None
            if base_dir is not None:
                for rel in (candidate, Path(candidate.name)):
                    nested = (base_dir / rel).resolve()
                    try:
                        nested.relative_to(base_dir)
                    except ValueError:
                        continue
                    if nested.is_file():
                        return str(nested)
        return None

    def _page_to_layout_slide(
        self,
        page: dict[str, Any],
        *,
        index: int,
        result_path: str | None,
    ) -> dict[str, Any]:
        title = self._first_text(page, ("title", "page_title", "slide_title", "heading"))
        if not title:
            title = f"Slide {index + 1}"
        layout_description = self._first_text(
            page,
            ("layout_description", "layout", "description", "summary", "content_summary"),
        )
        key_points = self._string_list(
            page.get("key_points")
            or page.get("points")
            or page.get("bullets")
            or page.get("outline")
        )
        speaker_notes = self._first_text(page, ("speaker_notes", "notes", "narration"))

        content_lines = [f"# {title}"]
        if layout_description:
            content_lines.extend(["", layout_description])
        if key_points:
            content_lines.append("")
            content_lines.extend(f"- {point}" for point in key_points)
        if speaker_notes:
            content_lines.extend(["", "Notes:", speaker_notes])

        image_candidates = [
            page.get("asset_ref"),
            page.get("asset_path"),
            page.get("image_path"),
            page.get("figure_path"),
        ]
        images_payload = page.get("images")
        if isinstance(images_payload, list):
            image_candidates.extend(images_payload)
        resolved_images = []
        for candidate in image_candidates:
            image_path = self._resolve_page_image(candidate, result_path=result_path)
            if image_path and image_path not in resolved_images:
                resolved_images.append(image_path)

        return {
            "slide_description": "\n".join(part for part in (title, layout_description) if part),
            "slide_content": "\n".join(content_lines),
            "images": resolved_images,
        }

    def build_layout_spec_from_pagecontent(
        self,
        pagecontent: Any,
        *,
        language: str = "zh",
        result_path: str | None = None,
        metadata: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        pages = self._loads_pagecontent(pagecontent)
        slides = [
            self._page_to_layout_slide(page, index=index, result_path=result_path)
            for index, page in enumerate(pages)
        ]
        outline = [slide["slide_description"].split("\n", 1)[0] for slide in slides]
        return {
            "outline": outline,
            "metadata": metadata or {},
            "language": language or "zh",
            "slides": slides,
        }

    @staticmethod
    def _dump_input(run_dir: Path, req: Template2PPTGenerateRequest) -> Path:
        spec_path = run_dir / "input" / "template2ppt_request.json"
        spec_path.write_text(
            json.dumps(req.model_dump(mode="json"), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return spec_path


    async def generate_from_pagecontent(
        self,
        req: Template2PPTPageContentRequest,
        request: Request | None = None,
    ) -> Template2PPTGenerateResponse:
        content_spec = self.build_layout_spec_from_pagecontent(
            req.pagecontent,
            language=req.language,
            result_path=req.result_path,
            metadata=req.metadata,
        )
        return await self.generate(
            Template2PPTGenerateRequest(
                mode="layout_spec",
                template=req.template,
                content_spec=content_spec,
                email=req.email,
                output_filename=req.output_filename,
                save_history=req.save_history,
            ),
            request=request,
        )

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
        template_path = Path(template)
        if template_path.is_dir() and not (template_path / "slide_induction.json").exists():
            raise HTTPException(
                status_code=400,
                detail=(
                    "template directory is missing slide_induction.json. "
                    "Run template induction first or upload with induct=true."
                ),
            )
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
