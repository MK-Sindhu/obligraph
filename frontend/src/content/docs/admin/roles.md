---
title: Roles
description: What owners, admins, members and viewers can do in an organisation, and how platform admins differ from organisation roles.
order: 1
---

Each person has one role in each organisation they belong to. Roles are ordered viewer, member, admin, owner, and each role can do everything the roles before it can. The API checks your role on every request.

## Organisation roles

| Role | What it adds |
|---|---|
| Viewer | See everything in the organisation: dashboard, regulations, graph, obligations, tasks, approvals, filings, evidence (including downloads), readiness, board pack and activity log. Use the Copilot. Mark alerts as read |
| Member | Change an obligation's status and owner. **Re-assess** a single obligation. Create, edit, move and delete tasks. **Submit for approval** and withdraw your own requests. Upload evidence. **Mark as filed**. Download CSV exports |
| Admin | Upload and delete policies. **Re-assess all**. Edit the organisation profile and workflow controls. Add, change and remove members other than owners. Approve or reject at levels 0 and 1. Escalate or withdraw any request. Delete evidence. Download the **Audit pack (.zip)**. Add and edit custom returns. **Waive** and **Reopen** filings |
| Owner | Add owners and change owners' roles. Approve or reject at level 2 |

Some rules apply whatever your role:

- Nobody can approve or reject a request they submitted.
- An organisation must always have at least one owner.
- An owner can't be removed directly. Another owner must first change them to a different role.
- Removing someone from an organisation doesn't delete their Obligraph account.

The person who creates an organisation becomes its owner. Admins add people from **Settings → Team**.

## Several organisations

One account can belong to several organisations, with a different role in each. Switch organisation from the top bar. Everything you see is scoped to the organisation you're in, and the API confirms you're a member of it on every request.

## Platform admins

Platform admin is a separate, instance-wide flag, not an organisation role. Platform admins see **Admin** in the sidebar, which opens the **Platform admin** page. There they can see platform-wide counts, demo requests, background jobs and model usage, manage regulator sources, and **Ingest a regulation** into the corpus shared by every organisation.

Platform admin status is set when an account registers:

- If `ADMIN_EMAIL` is set, only that address becomes platform admin.
- If it isn't set, the first account registered on the instance does.

The demo account created by the demo seed is also a platform admin. Being a platform admin doesn't make you a member of other organisations.
