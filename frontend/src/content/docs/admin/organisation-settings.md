---
title: Organisation settings
description: The organisation name, entity types, SBR layer, approval SLA, maker-checker and SSO domain, and what happens when you change them.
order: 2
---

Open **Settings**. The **Organisation** tab holds the profile and workflow controls, **Team** manages members (see [Roles](/docs/admin/roles)), and **Activity log** shows recent changes. Only admins and owners can change settings; everyone else sees them read-only.

## Organisation profile

Select **Edit profile** to change:

- **Organisation name**: 2 to 200 characters.
- **Entity types**: choose at least one. Your regulators are updated to match.

The profile also shows your **Workspace ID**, a short identifier made from the name when the organisation was created, and your regulators.

## Workflow and controls

| Setting | Stored as | Values | Default |
|---|---|---|---|
| Scale-based regulation layer | `sbr_layer` | Not set, Base, Middle, Upper or Top | Not set |
| Approval SLA | `approval_sla_days` | 1 to 60 days | 2 |
| Maker-checker approvals | `maker_checker` | On or off | On |
| Single sign-on domain | `sso_domain` | A domain such as `company.in` | None |

- **Scale-based regulation layer** only affects NBFCs, NBFC-MFIs and housing finance companies. See [SBR layers](/docs/concepts/sbr-layers).
- **Approval SLA** is how long checkers have to decide before a pending request escalates. See [Tasks and approvals](/docs/using/tasks-and-approvals).
- **Maker-checker approvals**, when on, requires sign-off for tasks linked to high or critical obligations. When off, those tasks can be closed directly.
- **Single sign-on domain** lets people who sign in with SSO, and who don't belong to any organisation yet, join yours as members when their verified email is on this domain. See [SSO](/docs/admin/sso).

Select **Save controls** to apply your changes.

## When you change entity types or layer

Obligraph works out again which requirements apply to you:

- obligations are added for requirements that now apply;
- obligations that no longer apply are retired (status **Not applicable**), with a note saying why;
- obligations retired earlier for the same reason reopen if they apply again;
- if you have policies, the added and reopened obligations are queued for assessment.

Coverage, tasks and evidence on retired obligations are kept. Each change is recorded in the activity log with the number of obligations added and retired.
