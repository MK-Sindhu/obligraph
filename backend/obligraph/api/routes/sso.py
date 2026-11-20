"""SSO endpoints. The browser reaches these through the web app's /api proxy, so the
state cookie and the redirect URI share the app's origin."""

from __future__ import annotations

import logging
from urllib.parse import quote

from fastapi import APIRouter, Cookie, HTTPException, status
from fastapi.responses import RedirectResponse

from obligraph import sso
from obligraph.api.deps import SessionDep
from obligraph.security import issue_token
from obligraph.settings import get_settings

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth/sso", tags=["auth"])


def _app_url(fragment: str) -> str:
    return f"{get_settings().public_url.rstrip('/')}/sso#{fragment}"


@router.get("")
async def sso_config() -> dict:
    return {"enabled": sso.enabled(), "name": get_settings().oidc_provider_name}


@router.get("/start")
async def sso_start() -> RedirectResponse:
    if not sso.enabled():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "SSO is not configured")
    flow = sso.new_flow()
    resp = RedirectResponse(await sso.authorize_url(flow), status_code=302)
    resp.set_cookie(
        sso.COOKIE,
        sso.seal(flow),
        max_age=sso.STATE_TTL,
        httponly=True,
        samesite="lax",
        path=sso.COOKIE_PATH,
        secure=get_settings().public_url.startswith("https://"),
    )
    return resp


@router.get("/callback")
async def sso_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    obligraph_sso: str | None = Cookie(default=None),
    session=SessionDep,
) -> RedirectResponse:
    try:
        if error:
            raise sso.SSOError(f"the identity provider reported: {error}")
        flow = sso.unseal(obligraph_sso)
        if not code or state != flow["state"]:
            raise sso.SSOError("sign-in state mismatch; start again")
        claims = await sso.exchange_and_verify(code, flow)
        user = await sso.provision(session, claims)
        target = _app_url(f"token={issue_token(user.id)}")
    except sso.SSOError as exc:
        log.info("SSO sign-in failed: %s", exc)
        target = _app_url(f"error={quote(str(exc))}")
    resp = RedirectResponse(target, status_code=302)
    resp.delete_cookie(sso.COOKIE, path=sso.COOKIE_PATH)
    return resp
