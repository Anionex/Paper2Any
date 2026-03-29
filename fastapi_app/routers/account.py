from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, Header

from fastapi_app.dependencies import AuthUser, get_current_user, get_optional_user
from fastapi_app.services.billing_service import BillingService

router = APIRouter(prefix="/account", tags=["account"])


def get_service() -> BillingService:
    return BillingService()


@router.get("/runtime-config")
async def get_runtime_config(service: BillingService = Depends(get_service)) -> Dict[str, Any]:
    return service.get_runtime_config()


@router.get("/quota")
async def get_quota(
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
    user: Optional[AuthUser] = Depends(get_optional_user),
    service: BillingService = Depends(get_service),
) -> Dict[str, Any]:
    return service.get_quota(user=user, guest_id=x_guest_id)


@router.post("/quota/consume")
async def consume_quota(
    workflow_type: str = Body(..., embed=True),
    amount: Optional[int] = Body(None, embed=True),
    x_guest_id: Optional[str] = Header(None, alias="X-Guest-Id"),
    user: Optional[AuthUser] = Depends(get_optional_user),
    service: BillingService = Depends(get_service),
) -> Dict[str, Any]:
    return service.consume_workflow(
        workflow_type=workflow_type,
        amount=amount,
        user=user,
        guest_id=x_guest_id,
    )


@router.get("/profile")
async def get_profile(
    user: AuthUser = Depends(get_current_user),
    service: BillingService = Depends(get_service),
) -> Dict[str, Any]:
    return service.get_account_profile(user)


@router.post("/invite/claim")
async def claim_invite_code(
    invite_code: str = Body(..., embed=True),
    user: AuthUser = Depends(get_current_user),
    service: BillingService = Depends(get_service),
) -> Dict[str, Any]:
    return service.claim_invite_code(user=user, invite_code=invite_code)
