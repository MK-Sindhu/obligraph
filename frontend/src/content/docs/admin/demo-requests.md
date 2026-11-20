---
title: Demo requests
description: The public Request a demo form, its spam protection and rate limits, and how platform admins review, update and erase requests.
order: 4
---

The website's **Request a demo** page (`/contact`) lets visitors ask for a demo without an account.

## Form fields

| Field | Required | Limit |
|---|---|---|
| Name | Yes | 200 characters |
| Work email | Yes | A valid email address |
| Company | Yes | 200 characters |
| Role | No | 200 characters |
| Entity type | No | One of Obligraph's entity types, or Other |
| Message | No | 4,000 characters |

## Spam protection

- **Honeypot**: the form has a hidden `website` field that people never see. If it's filled in, the API replies as if the request succeeded but stores nothing.
- **Duplicates**: another request from the same email within 24 hours is accepted but not stored again.
- **Rate limits**: each IP address can send 5 requests per hour, and the form accepts 200 requests per hour in total. Over either limit, the API returns `429 Too Many Requests` with a `Retry-After` header, and the form shows "Too many requests, try again later."
- **IP addresses** are stored only as a salted SHA-256 hash, for abuse control.

The rate limits are kept in memory by each API process, so they apply per instance. For strict limits across several instances, add a limit at the edge, such as your proxy or firewall.

## Reviewing requests

Platform admins find requests on the **Platform admin** page (**Admin** in the sidebar), in the **Demo requests** panel. The panel shows the 500 most recent requests with when each was received, who sent it, the company, the message and its status.

Filter by status (the panel opens on **New**) and change a request's status at any time:

- **New**
- **Contacted**
- **Closed**

Moving a request to **Contacted** or **Closed** records when it was handled. Moving it back to **New** clears that time.

## Erasing a request

To remove a request entirely, for example when the person asks for their data to be deleted, a platform admin calls the API:

```
DELETE /api/admin/demo-requests/{id}
```

There's no delete button in the app.
