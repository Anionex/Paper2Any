from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from fastapi_app.schemas import (
    Template2PPTGenerateRequest,
    Template2PPTGenerateResponse,
    Template2PPTPageContentRequest,
)

router = APIRouter(tags=["template2ppt"])


def get_service() -> Template2PPTService:
    from fastapi_app.services.template2ppt_service import Template2PPTService

    return Template2PPTService()


@router.post("/template2ppt/generate", response_model=Template2PPTGenerateResponse)
async def generate_template2ppt(
    req: Template2PPTGenerateRequest,
    request: Request,
    service: Template2PPTService = Depends(get_service),
) -> Template2PPTGenerateResponse:
    """Generate a PPTX using the external template2ppt runtime."""
    return await service.generate(req=req, request=request)

@router.post("/template2ppt/generate-from-pagecontent", response_model=Template2PPTGenerateResponse)
async def generate_template2ppt_from_pagecontent(
    req: Template2PPTPageContentRequest,
    request: Request,
    service: Template2PPTService = Depends(get_service),
) -> Template2PPTGenerateResponse:
    """Generate a template2ppt deck from Paper2PPT pagecontent."""
    return await service.generate_from_pagecontent(req=req, request=request)

@router.post("/template2ppt/upload-template")
async def upload_template2ppt_template(
    request: Request,
    template_file: UploadFile = File(...),
    template_name: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    induct: bool = Form(False),
    service: Template2PPTService = Depends(get_service),
) -> dict:
    """Upload a PPTX template folder for later template2ppt generation."""
    return await service.save_uploaded_template(
        template_file=template_file,
        email=email,
        template_name=template_name,
        induct=induct,
        request=request,
    )

