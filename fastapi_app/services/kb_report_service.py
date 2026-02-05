from __future__ import annotations

from fastapi_app.schemas import KBReportRequest, KBReportResponse
from fastapi_app.workflow_adapters.wa_kb_report import run_kb_report_wf_api


class KBReportService:
    async def run(self, req: KBReportRequest) -> KBReportResponse:
        return await run_kb_report_wf_api(req)
