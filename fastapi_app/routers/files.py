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

from fastapi_app.dependencies import get_current_user, get_optional_user, AuthUser
from dataflow_agent.utils import get_project_root
from fastapi_app.utils import _from_outputs_url


router = APIRouter(prefix="/files", tags=["files"])
PROJECT_ROOT = get_project_root()
OUTPUTS_ROOT = (PROJECT_ROOT / "outputs").resolve()


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
        # Determine user directory: JWT user > email parameter > "default"
        if user:
            user_dir = user.email or user.id
        elif email:
            user_dir = email
        else:
            user_dir = "default"
        
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
        # Determine user directory: JWT user > email parameter > "default"
        if user:
            user_dir = user.email or user.id
        elif email:
            user_dir = email
        else:
            user_dir = "default"
        
        base_dir = PROJECT_ROOT / "outputs" / user_dir
        
        if not base_dir.exists():
            return {
                "success": True,
                "files": [],
            }
        
        files_data: List[Dict[str, Any]] = []
        
        # Recursively scan all files
        for p in base_dir.rglob("*"):
            if not p.is_file():
                continue
            
            # Exclude input directory files
            if "input" in p.parts:
                continue
            
            # Only include specific file types
            suffix = p.suffix.lower()
            filename = p.name

            # Infer workflow_type from path: outputs/{user_dir}/{workflow_type}/...
            try:
                rel = p.relative_to(base_dir)
                wf_type = rel.parts[0] if len(rel.parts) > 0 else "unknown"
                file_id = str(rel)  # Use relative path as unique ID
            except Exception:
                wf_type = "unknown"
                file_id = str(p.name) + "_" + str(p.stat().st_mtime)

            allowed_suffixes = {".pptx", ".pdf", ".png", ".svg"}
            if wf_type == "paper2rebuttal":
                allowed_suffixes = allowed_suffixes | {".md", ".txt", ".json", ".zip"}

            if suffix in allowed_suffixes:
                should_show = False
                if wf_type == "paper2rebuttal":
                    should_show = True
                elif suffix == ".pptx":
                    should_show = True
                elif filename.startswith("paper2ppt"):
                    should_show = True
                elif filename.startswith("fig_") and suffix in {".png", ".svg"}:
                    should_show = True

                if should_show:
                    stat = p.stat()
                    url = _to_outputs_url(str(p), request)
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
