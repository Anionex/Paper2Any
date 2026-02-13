from __future__ import annotations

from fastapi_app.schemas import DeepResearchRequest, DeepResearchResponse
from fastapi_app.workflow_adapters.wa_kb_deepresearch import run_kb_deepresearch_wf_api


class KBDeepResearchService:
    async def run(self, req: DeepResearchRequest) -> DeepResearchResponse:
        return await run_kb_deepresearch_wf_api(req)
