"""
File management endpoints.

Handles file uploads and history retrieval with JWT authentication.
"""
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Iterator
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, Form, Request, HTTPException
from fastapi.responses import FileResponse, StreamingResponse, Response
import mimetypes

from fastapi_app.dependencies import get_optional_user, AuthUser
from dataflow_agent.utils import get_project_root
from fastapi_app.utils import _from_outputs_url


router = APIRouter(prefix="/files", tags=["files"])
PROJECT_ROOT = get_project_root()
OUTPUTS_ROOT = (PROJECT_ROOT / "outputs").resolve()
FINAL_PAPER2VIDEO_DIRS = {"talking_video", "merge"}
FIGURE_WORKFLOW_TYPES = {"paper2figure", "paper2fig", "paper2tec", "paper2exp"}
PDF_WORKFLOW_TYPES = {"paper2ppt", "pdf2ppt", "image2ppt", "ppt2polish", "paper2beamer"}
DRAWIO_WORKFLOW_TYPES = {"paper2drawio", "paper2drawio_export", "image2drawio"}
POSTER_WORKFLOW_TYPES = {"paper2poster"}
REBUTTAL_SUFFIXES = {".md", ".txt", ".json", ".zip"}
FIGURE_PREFIXES = ("fig_", "technical_route", "exp_")


def _to_outputs_url(abs_path: str, request: Request) -> str:
    """Convert absolute file path to /outputs URL."""
    try:
        rel = Path(abs_path).relative_to(PROJECT_ROOT)
        return f"{request.url.scheme}://{request.url.netloc}/{rel.as_posix()}"
    except ValueError:
        return abs_path


def _iter_file_range(path: Path, start: int, end: int, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        while remaining > 0:
            data = f.read(min(chunk_size, remaining))
            if not data:
                break
            remaining -= len(data)
            yield data


def _normalize_user_identifier(value: Optional[str]) -> str:
    return (value or "").strip()


def _resolve_user_dir_candidates(user: Optional[AuthUser], email: Optional[str]) -> List[str]:
    """
    Build candidate output directories for one user.

    Historical data in this project is inconsistent:
    - some workflows write to outputs/{user.id}/...
    - some uploads/history logic used outputs/{user.email}/...
    To avoid losing files in history, scan both when available.
    """
    seen: set[str] = set()
    ordered: List[str] = []
    raw_candidates = [
        user.id if user else None,
        user.email if user else None,
        user.phone if user else None,
        email,
    ]
    for raw in raw_candidates:
        candidate = _normalize_user_identifier(raw)
        if not candidate or candidate in seen:
            continue
        seen.add(candidate)
        ordered.append(candidate)
    if not ordered:
        ordered.append("default")
    return ordered


def _resolve_primary_user_dir(user: Optional[AuthUser], email: Optional[str]) -> str:
    candidates = _resolve_user_dir_candidates(user, email)
    return candidates[0] if candidates else "default"


def _infer_workflow_type(base_dir: Path, path: Path) -> tuple[str, tuple[str, ...]]:
    try:
        rel = path.relative_to(base_dir)
        parts = rel.parts
        return (parts[0] if parts else "unknown"), parts
    except Exception:
        return "unknown", ()


def _should_include_history_file(path: Path, workflow_type: str, rel_parts: tuple[str, ...]) -> bool:
    suffix = path.suffix.lower()
    filename = path.name

    if ".worker" in rel_parts or "__pycache__" in rel_parts:
        return False

    if workflow_type == "paper2video":
        # paper2video final outputs are currently written under .../input/input/video.mp4,
        # so we cannot blanket-filter anything under "input".
        if suffix != ".mp4" or any(part in FINAL_PAPER2VIDEO_DIRS for part in rel_parts):
            return False
        preferred = path.with_name("video.mp4")
        fallback = path.with_name("2_merge.mp4")
        legacy = path.with_name("1_merge.mp4")
        if preferred.exists():
            return filename == "video.mp4"
        if fallback.exists():
            return filename == "2_merge.mp4"
        if legacy.exists():
            return filename == "1_merge.mp4"
        return True

    if workflow_type == "paper2rebuttal":
        return suffix in REBUTTAL_SUFFIXES and "input" not in rel_parts

    if "input" in rel_parts:
        return False

    if suffix == ".pptx":
        return True

    if workflow_type in POSTER_WORKFLOW_TYPES:
        # Only keep the root-level poster outputs, not mined page PNGs or intermediate JSON.
        return suffix in {".pptx", ".png"} and len(rel_parts) == 3

    if workflow_type in DRAWIO_WORKFLOW_TYPES:
        return suffix == ".drawio" or (suffix in {".png", ".svg"} and len(rel_parts) == 3)

    if suffix == ".pdf":
        return filename.startswith("paper2ppt") or workflow_type in PDF_WORKFLOW_TYPES

    if suffix in {".png", ".svg"}:
        if workflow_type in FIGURE_WORKFLOW_TYPES:
            return filename.startswith(FIGURE_PREFIXES)
        return False

    return False


@router.get("/stream")
async def stream_file(url: str, request: Request):
    """
    Stream a file with HTTP Range support (for large audio/video playback).
    """
    abs_path = Path(_from_outputs_url(url)).resolve()
    try:
        abs_path.relative_to(OUTPUTS_ROOT)
    except Exception:
        raise HTTPException(status_code=403, detail="Invalid file path")

    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = abs_path.stat().st_size
    range_header = request.headers.get("range")
    media_type, _ = mimetypes.guess_type(str(abs_path))
    if not media_type:
        media_type = "application/octet-stream"

    if range_header:
        # Format: "bytes=start-end"
        try:
            range_value = range_header.strip().lower()
            if not range_value.startswith("bytes="):
                raise ValueError("Invalid range header")
            range_value = range_value.replace("bytes=", "")
            start_str, end_str = range_value.split("-", 1)
            start = int(start_str) if start_str else 0
            end = int(end_str) if end_str else file_size - 1
        except Exception:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        if start >= file_size:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        end = min(end, file_size - 1)
        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(end - start + 1),
        }
        return StreamingResponse(
            _iter_file_range(abs_path, start, end),
            status_code=206,
            headers=headers,
            media_type=media_type,
        )

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
    }
    return StreamingResponse(
        _iter_file_range(abs_path, 0, file_size - 1),
        headers=headers,
        media_type=media_type,
    )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    workflow_type: str = Form(...),
    email: Optional[str] = Form(None),
    user: Optional[AuthUser] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Upload a file to local storage.
    
    Args:
        file: File to upload
        workflow_type: Type of workflow (e.g., 'paper2ppt', 'ppt2polish')
        email: User email (fallback when JWT not available)
        user: Authenticated user (from JWT token, optional)
        
    Returns:
        File metadata including download URL
    """
    try:
        # Prefer user.id as the canonical output directory.
        # Older runs may still exist under email, and history scans both.
        user_dir = _resolve_primary_user_dir(user, email)
        
        timestamp = int(datetime.now().timestamp() * 1000)
        
        # Create directory structure: outputs/{user_dir}/{workflow_type}/{timestamp}/
        save_dir = PROJECT_ROOT / "outputs" / user_dir / workflow_type / str(timestamp)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Save file
        file_path = save_dir / file.filename
        content = await file.read()
        file_path.write_bytes(content)
        
        return {
            "success": True,
            "file_name": file.filename,
            "file_size": len(content),
            "workflow_type": workflow_type,
            "file_path": str(file_path),
            "created_at": datetime.now().isoformat(),
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload file: {str(e)}"
        )


@router.get("/history")
async def get_file_history(
    request: Request,
    email: Optional[str] = None,
    user: Optional[AuthUser] = Depends(get_optional_user),
) -> Dict[str, Any]:
    """
    Get file history for authenticated user.
    
    Args:
        request: FastAPI request object (for URL generation)
        email: User email (fallback when JWT not available)
        user: Authenticated user (from JWT token, optional)
        
    Returns:
        List of file records
    """
    try:
        base_dirs = [
            PROJECT_ROOT / "outputs" / user_dir
            for user_dir in _resolve_user_dir_candidates(user, email)
        ]
        existing_base_dirs = [p for p in base_dirs if p.exists()]

        if not existing_base_dirs:
            return {
                "success": True,
                "files": [],
            }
        
        files_data: List[Dict[str, Any]] = []
        
        # Recursively scan all files from all candidate user roots.
        for base_dir in existing_base_dirs:
            user_root = base_dir.name
            for p in base_dir.rglob("*"):
                if not p.is_file():
                    continue

                wf_type, rel_parts = _infer_workflow_type(base_dir, p)
                if not _should_include_history_file(p, wf_type, rel_parts):
                    continue

                stat = p.stat()
                url = _to_outputs_url(str(p), request)
                rel = Path(*rel_parts) if rel_parts else Path(p.name)
                file_id = f"{user_root}/{rel.as_posix()}"
                files_data.append({
                    "id": file_id,
                    "file_name": p.name,
                    "file_size": stat.st_size,
                    "workflow_type": wf_type,
                    "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "download_url": url
                })
        
        # Sort by modification time descending
        files_data.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {
            "success": True,
            "files": files_data,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get file history: {str(e)}"
        )
