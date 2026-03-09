from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, Form, UploadFile, HTTPException
from fastapi.responses import FileResponse

from dataflow_agent.logger import get_logger
from dataflow_agent.state import Paper2PosterState, Paper2PosterRequest
from dataflow_agent.workflow import run_workflow
from dataflow_agent.utils import get_project_root

log = get_logger(__name__)

router = APIRouter()


@router.post("/paper2poster/generate")
async def generate_paper2poster(
    paper_file: UploadFile = File(...),
    # API configuration
    chat_api_url: str = Form(...),
    api_key: str = Form(...),
    # Model configuration
    model: str = Form("gpt-4o-2024-08-06"),
    vision_model: str = Form("gpt-4o-2024-08-06"),
    # Poster dimensions
    poster_width: float = Form(54.0),
    poster_height: float = Form(36.0),
    # Optional assets
    logo_file: Optional[UploadFile] = File(None),
    aff_logo_file: Optional[UploadFile] = File(None),
    url: str = Form(""),
    # Optional metadata
    email: Optional[str] = Form(None),
):
    """
    Paper2Poster API endpoint: Convert academic paper to aesthetic conference poster

    Args:
        paper_file: PDF paper file
        chat_api_url: LLM API URL
        api_key: LLM API key
        model: Text model name
        vision_model: Vision model name
        poster_width: Poster width in inches (default: 54.0)
        poster_height: Poster height in inches (default: 36.0)
        logo_file: Conference/journal logo (optional)
        aff_logo_file: Affiliation logo for color extraction (optional)
        url: URL for QR code (optional)
        email: User email (optional)

    Returns:
        FileResponse: Generated PPTX file
    """

    try:
        # Validate poster dimensions
        ratio = poster_width / poster_height
        if ratio > 2.0 or ratio < 1.4:
            raise HTTPException(
                status_code=400,
                detail=f"Poster aspect ratio {ratio:.2f} is out of range. Please use a ratio between 1.4 and 2.0"
            )

        # Create temporary directory for this request
        project_root = get_project_root()
        timestamp = int(time.time())
        temp_dir = project_root / "outputs" / "api" / "paper2poster" / str(timestamp)
        temp_dir.mkdir(parents=True, exist_ok=True)

        # Save uploaded paper file
        paper_path = temp_dir / paper_file.filename
        with open(paper_path, "wb") as f:
            content = await paper_file.read()
            f.write(content)

        log.info(f"Saved paper file: {paper_path}")

        # Save logo files if provided
        logo_path = ""
        if logo_file:
            logo_path = str(temp_dir / logo_file.filename)
            with open(logo_path, "wb") as f:
                content = await logo_file.read()
                f.write(content)
            log.info(f"Saved logo file: {logo_path}")

        aff_logo_path = ""
        if aff_logo_file:
            aff_logo_path = str(temp_dir / aff_logo_file.filename)
            with open(aff_logo_path, "wb") as f:
                content = await aff_logo_file.read()
                f.write(content)
            log.info(f"Saved affiliation logo file: {aff_logo_path}")

        # Build request
        req = Paper2PosterRequest(
            chat_api_url=chat_api_url,
            api_key=api_key,
            chat_api_key=api_key,
            model=model,
            vision_model=vision_model,
            poster_width=poster_width,
            poster_height=poster_height,
            logo_path=logo_path,
            aff_logo_path=aff_logo_path,
            url=url,
        )

        # Build state
        state = Paper2PosterState(
            request=req,
            messages=[],
            agent_results={},
            result_path=str(temp_dir),
            paper_file=str(paper_path),
            poster_width=poster_width,
            poster_height=poster_height,
            logo_path=logo_path,
            aff_logo_path=aff_logo_path,
            url=url,
        )

        log.info(f"Starting Paper2Poster workflow for {paper_file.filename}")
        log.info(f"Dimensions: {poster_width}x{poster_height} inches")
        log.info(f"Models: text={model}, vision={vision_model}")

        # Run workflow
        final_state = await run_workflow("paper2poster", state)

        # Get output PPTX path (workflow returns a dict, not an object)
        if isinstance(final_state, dict):
            pptx_path = final_state.get("output_pptx_path")
            errors = final_state.get("errors", [])
        else:
            pptx_path = getattr(final_state, "output_pptx_path", None)
            errors = getattr(final_state, "errors", [])

        if not pptx_path or not os.path.exists(pptx_path):
            # Check for errors
            error_msg = "; ".join(errors) if errors else "Unknown error"
            log.error(f"Paper2Poster workflow failed: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate poster: {error_msg}"
            )

        log.info(f"✓ Paper2Poster workflow completed: {pptx_path}")

        # Get PNG path
        png_path = str(pptx_path).replace('.pptx', '.png')

        # Generate relative URLs for frontend
        pptx_url = f"/outputs/api/paper2poster/{temp_dir.name}/{Path(pptx_path).name}"
        png_url = f"/outputs/api/paper2poster/{temp_dir.name}/{Path(png_path).name}" if os.path.exists(png_path) else None

        # Return JSON with file URLs
        return {
            "success": True,
            "pptx_url": pptx_url,
            "png_url": png_url,
            "message": "Poster generated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Paper2Poster API error: {str(e)}")
        import traceback
        log.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
