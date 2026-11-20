---
title: SSO
description: Setting up OpenID Connect single sign-on, how the sign-in flow works, how people are matched to organisations, and what happens when sign-in fails.
order: 5
---

Obligraph supports single sign-on with any OpenID Connect provider, using the authorisation code flow with PKCE.

## Configuration

Set these on the API:

| Variable | Default | Purpose |
|---|---|---|
| `OIDC_ISSUER` | empty | Your provider's issuer URL. Obligraph reads `<issuer>/.well-known/openid-configuration` |
| `OIDC_CLIENT_ID` | empty | The client ID registered with your provider |
| `OIDC_CLIENT_SECRET` | empty | The client secret |
| `OIDC_SCOPES` | `openid email profile` | The scopes requested |
| `OIDC_PROVIDER_NAME` | `Single sign-on` | The name on the sign-in button: "Continue with …" |
| `PUBLIC_URL` | `http://localhost:3000` | Where people reach the web app |

SSO is on when both `OIDC_ISSUER` and `OIDC_CLIENT_ID` are set. Register this redirect URI with your provider:

```
<PUBLIC_URL>/api/auth/sso/callback
```

If you move to a new domain, update `PUBLIC_URL` and the registered redirect URI.

## Sign-in flow

1. On the sign-in page, the person selects **Continue with** and your provider's name. The browser goes to `/api/auth/sso/start`.
2. Obligraph creates a state value, a nonce and a PKCE verifier, keeps them in a signed, HTTP-only cookie that lasts 10 minutes, and redirects to your provider.
3. The provider sends the person back to `/api/auth/sso/callback`. Obligraph checks the state, exchanges the code using the PKCE verifier and client secret, and verifies the ID token against the provider's published keys: signature, issuer, audience, expiry and nonce.
4. The ID token must include an email address that isn't marked as unverified.
5. Obligraph redirects to `/sso#token=…`. The app confirms the session, removes the token from the address bar and opens the dashboard.

The token travels in the URL fragment, which browsers don't send to servers.

## Matching people to organisations

- People are matched to Obligraph accounts by email. If there's no account, one is created with a random password, so that person signs in with SSO.
- If the account doesn't belong to any organisation yet, it joins the organisation whose **Single sign-on domain** matches the email's domain, as a **member**. The join is recorded in that organisation's activity log, and admins can change the role afterwards.
- People who already belong to an organisation just sign in. SSO doesn't add them to other organisations.

Set the domain in **Settings → Organisation → Workflow and controls → Single sign-on domain**.

## When sign-in fails

Obligraph redirects to `/sso#error=…`, and the app shows **Single sign-on didn't work** with the reason and a **Back to sign in** link. Common reasons:

- the provider reported an error or rejected the code exchange;
- more than 10 minutes passed, or the state didn't match, so the person has to start again;
- the ID token failed verification or had no verified email;
- no organisation has a matching SSO domain, so the person needs an admin to add them.
