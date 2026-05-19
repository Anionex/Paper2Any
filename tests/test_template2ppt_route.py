from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from fastapi_app.routers import template2ppt
from fastapi_app.schemas import Template2PPTGenerateResponse


class FakeTemplate2PPTService:
    async def generate(self, req, request=None):
        return Template2PPTGenerateResponse(
            success=True,
            ppt_pptx_path="/outputs/default/template2ppt/demo/template2ppt-output.pptx",
            result_path="/tmp/outputs/default/template2ppt/demo",
            all_output_files=["/outputs/default/template2ppt/demo/template2ppt-output.pptx"],
        )


def test_template2ppt_generate_route():
    app = FastAPI()
    app.include_router(template2ppt.router, prefix="/api/v1")
    app.dependency_overrides[template2ppt.get_service] = lambda: FakeTemplate2PPTService()

    client = TestClient(app)
    response = client.post(
        "/api/v1/template2ppt/generate",
        json={
            "mode": "layout_spec",
            "template": "shangye_jihua",
            "content_spec": {
                "language": "zh",
                "slides": [
                    {
                        "slide_description": "背景介绍",
                        "slide_content": "用三点说明研究背景",
                        "images": [],
                    }
                ],
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["ppt_pptx_path"].endswith("template2ppt-output.pptx")
