from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from fastapi_app.schemas import Template2PPTGenerateRequest, Template2PPTGenerateResponse

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
