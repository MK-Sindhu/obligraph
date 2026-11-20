---
title: Tasks and approvals
description: Suggested and manual tasks, the task board, maker-checker approvals, escalation and the approval SLA, and the alerts they raise.
order: 2
---

## Tasks

Tasks track remediation and compliance work. They come from two places:

- **Suggested tasks.** Each assessment proposes up to three tasks for a gap, with a priority and due date, tagged **Suggested**. If you edit one it becomes **Suggested · edited** and is kept when the obligation is re-assessed. Untouched suggestions still in **To do** are replaced with fresh ones.
- **Your own tasks.** Create one with **New task** on the board, or **Add task** on an obligation.

The **Tasks** board has four columns: **To do**, **Doing**, **In review** and **Done**. Drag a card, or use its arrows, to move it, and filter by **Assignee**. Members, admins and owners can create, edit, move and delete tasks. Viewers have view-only access.

## When maker-checker applies

A task needs a second person's sign-off when maker-checker is on (the default) and the task is linked to an obligation whose requirement is **high** or **critical** severity. These cards show **Needs sign-off**. Moving one to **In review** or **Done** opens **Submit for approval** instead.

## Submitting

In **Submit for approval**, add an optional **Note for the checker** and select or upload evidence. Submitting moves the task to **In review** and raises an approval alert. A task can have only one pending request, and a task that's already done can't be submitted.

While the request is pending, the task's status is locked and the card shows **Awaiting approval**.

## Deciding

Open the request from **Approvals**. The **Inbox** tab lists requests you can decide; **All requests** shows everything.

| Level | Who can approve or reject |
|---|---|
| 0 | Admins and owners |
| 1 | Admins and owners |
| 2 | Owners only |

- The maker can't approve or reject their own request.
- **Reject** needs a **Checker's note** saying why.
- **Approve** moves the task to **Done**. **Reject** sends it back to **Doing**.
- **Withdraw** cancels the request and returns the task to **Doing**. The maker, or any admin or owner, can withdraw.
- **Escalate** moves a request up a level by hand. Admins and owners only.

## Escalation and the SLA

Each request has a decision deadline set by the organisation's **Approval SLA** (`approval_sla_days`, 1 to 60 days, default 2). The housekeeping job escalates pending requests that pass their deadline: from level 0 to level 1 (all admins), then to level 2 (owners). Each escalation sets a new deadline. Level 2 is the highest.

Housekeeping runs every 15 minutes in the background worker. On Vercel it runs with the daily cron.

## Alerts

| Alert | Raised when |
|---|---|
| `approval_requested` | A task is submitted |
| `approval_escalated` | A request moves up a level |
| `approval_approved` | A checker approves |
| `approval_rejected` | A checker rejects |
| `task_overdue` | A task is past its due date (at most once a day per task) |

Submissions and decisions are recorded in the activity log and in the approvals CSV export.
