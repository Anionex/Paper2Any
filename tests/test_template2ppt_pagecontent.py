from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi_app.routers import paper2ppt
from fastapi_app.schemas import Template2PPTGenerateResponse
from fastapi_app.services.template2ppt_service import Template2PPTService


def test_build_layout_spec_from_paper2ppt_pagecontent():
    service = Template2PPTService()

    spec = service.build_layout_spec_from_pagecontent(
        [
            {
                "title": "Method Overview",
                "layout_description": "Explain the pipeline in three stages.",
                "key_points": ["Parse paper", "Select template", "Render deck"],
            }
        ],
        language="en",
        metadata={"topic": "Template2PPT"},
    )

    assert spec["language"] == "en"
    assert spec["metadata"] == {"topic": "Template2PPT"}
    assert spec["outline"] == ["Method Overview"]
    assert spec["slides"] == [
        {
            "slide_description": "Method Overview\nExplain the pipeline in three stages.",
            "slide_content": (
                "# Method Overview\n\n"
                "Explain the pipeline in three stages.\n\n"
                "- Parse paper\n"
                "- Select template\n"
                "- Render deck"
            ),
            "images": [],
        }
    ]


class FakeTemplate2PPTService:
    async def generate_from_pagecontent(self, req, request=None):
        assert req.template == "shangye_jihua"
        assert req.language == "en"
        parsed = json.loads(req.pagecontent)
        assert parsed[0]["title"] == "Slide 1"
        return Template2PPTGenerateResponse(
            success=True,
            ppt_pptx_path="/outputs/default/template2ppt/demo/template2ppt-output.pptx",
            result_path="/tmp/outputs/default/template2ppt/demo",
            all_output_files=["/outputs/default/template2ppt/demo/template2ppt-output.pptx"],
        )


def test_paper2ppt_template2ppt_route_accepts_pagecontent_form():
    app = FastAPI()
    app.include_router(paper2ppt.router, prefix="/api/v1")
    app.dependency_overrides[paper2ppt.get_template2ppt_service] = lambda: FakeTemplate2PPTService()

    client = TestClient(app)
    response = client.post(
        "/api/v1/paper2ppt/template2ppt/generate",
        data={
            "template": "shangye_jihua",
            "pagecontent": json.dumps([
                {
                    "title": "Slide 1",
                    "layout_description": "A concise summary slide.",
                    "key_points": ["One", "Two"],
                }
            ]),
            "language": "en",
            "metadata": json.dumps({"topic": "demo"}),
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["success"] is True
    assert response.json()["ppt_pptx_path"].endswith("template2ppt-output.pptx")
