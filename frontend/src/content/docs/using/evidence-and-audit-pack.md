---
title: Evidence and audit pack
description: Uploading and linking evidence, SHA-256 hashing and the download check, deletion rules, CSV exports and the audit pack.
order: 4
---

## Uploading evidence

Attach a file from a task, an obligation or a filing with **Attach evidence**, or add one from the **Evidence** page with **Upload unlinked file**. Members, admins and owners can upload. A file can be linked to a task, an obligation and a filing, and can carry a note.

Any file type is accepted. The size limit is the API's upload limit: 25 MB by default, 4 MB on serverless hosts such as Vercel, or `MAX_UPLOAD_MB` if it's set. Empty files are refused.

## Hashing and integrity

At upload, Obligraph records the file's SHA-256 hash, size, type, uploader and time. Files are never changed after upload. The **Evidence register** lists every file with its SHA-256 fingerprint, and you can search by file name, uploader or hash prefix.

On every download, the API recomputes the SHA-256 of the stored bytes and compares it with the hash recorded at upload. If they differ, the download is refused (HTTP `410`). A successful download carries the recorded hash in the `X-Content-SHA256` response header, and the app shows it once the file is saved.

Files are stored on disk under `STORAGE_DIR`, or in Postgres on serverless hosts. The original file name is kept only in the database, never in a file path.

## Deleting evidence

Only admins and owners can delete evidence. A file that backs an approved maker-checker decision can't be deleted: the API returns `409 Conflict`. Each deletion is recorded in the activity log with the file's name and hash.

## CSV exports

On **Reports**, the **Exports** panel offers these CSV downloads to members, admins and owners:

| Export | Contents |
|---|---|
| Obligations | Coverage, status, owner, gap, remediation and policy quotes |
| Tasks | Remediation work, assignees and due dates |
| Approvals | Maker, checker, notes, decision and history |
| Evidence | Files with SHA-256, size and links |
| Filings | Periods, due and filed dates, references |
| Activity log | Who changed what |
| Policies | Uploaded documents |

## Audit pack

**Audit pack (.zip)** is for admins and owners. The zip, named `obligraph-audit-<workspace id>-<yyyymmdd>.zip`, contains:

- every export above as a CSV file;
- every evidence file, under `evidence/`, named `<evidence id>_<original name>`;
- `manifest.json`, listing each file's size and, for evidence, the SHA-256 recorded at upload;
- `README.txt`, explaining the layout.

If an evidence file fails its integrity check while the pack is built, it's left out and the manifest records the error. Each audit pack download is recorded in the activity log.
