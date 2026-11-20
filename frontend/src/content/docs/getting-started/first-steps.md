---
title: First steps
description: What to do after creating your organisation - set entity types and SBR layer, upload policies, load regulations, add your team.
order: 2
---

When you create an organisation on the **Create an organisation** page, you choose at least one entity type and become the organisation's owner. Obligraph straight away creates obligations from any in-force requirements in the corpus that match those entity types.

## 1. Check your entity types

Go to **Settings → Organisation** and select **Edit profile**. Entity types decide which requirements apply to you, and your regulators follow from them. Changing them adds obligations for newly applicable requirements and retires ones that no longer apply.

## 2. Set your SBR layer (NBFCs)

If you're an NBFC, NBFC-MFI or housing finance company, set **Scale-based regulation layer** under **Settings → Organisation → Workflow and controls**. Until it's set, Obligraph treats you as bound by every layer-specific requirement. See [SBR layers](/docs/concepts/sbr-layers).

## 3. Upload your policies

On **Policies**, use **Upload a policy** to add your board-approved policies. Only admins and owners can upload. Each upload queues a re-assessment of all your obligations. Until at least one policy exists, obligations stay **Unassessed**. See [Policies and gap analysis](/docs/using/policies-and-gap-analysis).

## 4. Load regulations (platform admins)

Regulator feeds start disabled. A platform admin opens **Admin**, switches feeds on under **Regulator sources** and selects **Run now**, or adds documents under **Ingest a regulation**. See [Regulator feeds](/docs/admin/regulator-feeds).

If the corpus is empty and you aren't a platform admin, ask whoever runs your Obligraph instance.

## 5. Add your team

On **Settings → Team**, select **Add member** and enter a name, email and role. Someone without an Obligraph account also needs an **Initial password**; existing users keep the password they have. If SSO is set up, people whose email matches your **Single sign-on domain** can join by signing in. See [Roles](/docs/admin/roles) and [SSO](/docs/admin/sso).

## 6. What to look at first

- **Dashboard**: policy coverage, open gaps, the risk heatmap and what's due in the next 30 days.
- **Obligations**: set **Coverage** to Missing or Partial and **Severity** to Critical or High. Open an obligation to read the rationale, the quotes from your policies and the suggested remediation.
- **Tasks**: remediation work, including tasks tagged **Suggested** that the assessment proposed.
- **Calendar** and **Filings**: upcoming deadlines and statutory returns.
