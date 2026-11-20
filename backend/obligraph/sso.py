"""Single sign-on with any OpenID Connect provider (Okta, Entra ID, Google, Keycloak...).

Authorization-code flow with PKCE. The state, nonce and PKCE verifier travel in a
short-lived signed cookie, so no server-side session store is needed. The ID token is
verified against the provider's published keys (signature, issuer, audience, expiry,
nonce). Users are matched by verified email; a new user joins the org whose profile
``sso_domain`` matches their email domain.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
import time
import uuid
from collections.abc import Callable
from urllib.parse import urlencode

import httpx
import jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from obligraph.audit import record
from obligraph.models import Membership, Org, User
from obligraph.security import hash_password
from obligraph.settings import get_settings

COOKIE = "obligraph_sso"
COOKIE_PATH = "/api/auth/sso"
STATE_TTL = 600


class SSOError(Exception):
    pass


_http_factory: Callable[[], httpx.AsyncClient] = lambda: httpx.AsyncClient(timeout=15)  # noqa: E731
_discovery_cache: dict[str, tuple[float, dict]] = {}


def set_http_factory(factory: Callable[[], httpx.AsyncClient]) -> None:
    """Test hook: route provider calls through a stand-in transport."""
    global _http_factory
    _http_factory = factory
    _discovery_cache.clear()


def enabled() -> bool:
    s = get_settings()
    return bool(s.oidc_issuer and s.oidc_client_id)


def redirect_uri() -> str:
    return get_settings().public_url.rstrip("/") + "/api/auth/sso/callback"


async def discovery() -> dict:
    issuer = get_settings().oidc_issuer.rstrip("/")
    cached = _discovery_cache.get(issuer)
    if cached and cached[0] > time.time():
        return cached[1]
    async with _http_factory() as client:
        resp = await client.get(f"{issuer}/.well-known/openid-configuration")
        resp.raise_for_status()
        doc = resp.json()
    _discovery_cache[issuer] = (time.time() + 3600, doc)
    return doc


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def new_flow() -> dict:
    verifier = secrets.token_urlsafe(48)
    return {
        "state": secrets.token_urlsafe(24),
        "nonce": secrets.token_urlsafe(24),
        "verifier": verifier,
        "challenge": _b64url(hashlib.sha256(verifier.encode("ascii")).digest()),
    }


def seal(flow: dict) -> str:
    claims = {k: flow[k] for k in ("state", "nonce", "verifier")}
    claims.update({"aud": "obligraph-sso", "exp": int(time.time()) + STATE_TTL})
    return jwt.encode(claims, get_settings().jwt_secret, algorithm="HS256")


def unseal(cookie: str | None) -> dict:
    if not cookie:
        raise SSOError("sign-in session expired; start again")
    try:
        return jwt.decode(
            cookie, get_settings().jwt_secret, algorithms=["HS256"], audience="obligraph-sso"
        )
    except jwt.PyJWTError as exc:
        raise SSOError("sign-in session expired; start again") from exc


async def authorize_url(flow: dict) -> str:
    s = get_settings()
    doc = await discovery()
    params = {
        "response_type": "code",
        "client_id": s.oidc_client_id,
        "redirect_uri": redirect_uri(),
        "scope": s.oidc_scopes,
        "state": flow["state"],
        "nonce": flow["nonce"],
        "code_challenge": flow["challenge"],
        "code_challenge_method": "S256",
    }
    return f"{doc['authorization_endpoint']}?{urlencode(params)}"


async def exchange_and_verify(code: str, flow: dict) -> dict:
    s = get_settings()
    doc = await discovery()
    async with _http_factory() as client:
        resp = await client.post(
            doc["token_endpoint"],
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri(),
                "client_id": s.oidc_client_id,
                "client_secret": s.oidc_client_secret,
                "code_verifier": flow["verifier"],
            },
            headers={"Accept": "application/json"},
        )
        if resp.status_code != 200:
            raise SSOError("the identity provider rejected the sign-in")
        id_token = resp.json().get("id_token")
        if not id_token:
            raise SSOError("the identity provider returned no ID token")
        jwks = (await client.get(doc["jwks_uri"])).json()
    try:
        header = jwt.get_unverified_header(id_token)
        keyset = jwt.PyJWKSet.from_dict(jwks)
        key = next((k for k in keyset.keys if k.key_id == header.get("kid")), None)
        if key is None:
            raise SSOError("ID token signed with an unknown key")
        claims = jwt.decode(
            id_token,
            key.key,
            algorithms=[header.get("alg", "RS256")],
            audience=s.oidc_client_id,
            issuer=doc.get("issuer", s.oidc_issuer),
            leeway=60,
        )
    except jwt.PyJWTError as exc:
        raise SSOError(f"ID token failed verification: {exc}") from exc
    if claims.get("nonce") != flow["nonce"]:
        raise SSOError("ID token nonce mismatch")
    if not claims.get("email") or claims.get("email_verified") is False:
        raise SSOError("the identity provider did not return a verified email")
    return claims


async def provision(session: AsyncSession, claims: dict) -> User:
    email = claims["email"].lower()
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=email,
            name=claims.get("name") or email.split("@")[0],
            password_hash=hash_password(secrets.token_urlsafe(32)),
        )
        session.add(user)
        await session.flush()
    has_org = (
        await session.execute(select(Membership.org_id).where(Membership.user_id == user.id))
    ).first()
    if not has_org:
        domain = email.rsplit("@", 1)[-1]
        org = (
            (
                await session.execute(
                    select(Org).where(func.lower(Org.profile["sso_domain"].astext) == domain)
                )
            )
            .scalars()
            .first()
        )
        if org is None:
            raise SSOError(f"no organisation is set up for {domain}; ask an admin to invite you")
        session.add(Membership(user_id=user.id, org_id=org.id, role="member"))
        await record(
            session,
            org_id=org.id,
            actor_id=user.id,
            action="member.joined_via_sso",
            target_type="user",
            target_id=user.id,
            data={"email": email},
        )
        await session.flush()
    return user
