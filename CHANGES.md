# Changes from the Original Repo

This document lists all changes made on top of the original codebase ([bulk-email-sender](https://github.com/Jatin-dudhani/bulk-email-sender) by Jatin Dudhani), grouped by topic.

## 1. Authentication & Authorization

- Added server-side Firebase ID token verification on all protected routes (`backend/middleware/auth.js`) — the backend no longer trusts identity claims sent in the request body
- Added a shared axios instance (`frontend/src/utils/api.js`) with a request interceptor that auto-attaches the Firebase ID token to every API call
- Restored route guards: `/home` requires the `authorized` custom claim, `/admin` requires both `authorized` and `admin`
- Admin identity is now derived from the verified token (`req.user.uid`), never from request body fields

## 2. Endpoint Hardening

- Removed the exposed `/setup-admin` and `/test-admin` HTTP endpoints — admin bootstrap is now a local CLI script (`npm run setup-admin` in `backend/`), so nothing is callable over HTTP
- Enforced list ownership on all `/api/lists` routes — every query, update, and delete is filtered by the authenticated user's UID, so users cannot read or modify each other's lists
- Scoped SSE progress events to the initiating client via a per-send `sendId` — previously all connected clients received every user's send progress

## 3. Secrets & Configuration

- Moved hardcoded admin emails and the Firebase admin UID into environment variables (`MAIN_ADMIN_EMAIL`, `MAIN_ADMIN_UID`, `REACT_APP_MAIN_ADMIN_EMAIL`)
- Hardened `.gitignore`: wildcard pattern for config JSONs so no secret filenames are revealed in the repo, added root `node_modules`
- Firebase service account key is never committed — GitHub push protection plus gitignore wildcard guard against it
- Replaced real Firebase project identifiers (old project ID and service-account filename) in `backend/.env.example` with placeholders
- Made CORS configurable via `CORS_ORIGINS` and removed the original author's hardcoded Render URL from the defaults (localhost-only by default)
- Replaced the original author's hardcoded contact email and phone number on the "Access Denied" page with the configured admin email (`REACT_APP_MAIN_ADMIN_EMAIL`)

## 4. Input Validation & Error Handling

- Recipient list JSON is validated before parsing — malformed input returns a 400 instead of crashing the route, and every recipient must have a valid email string
- Subject and body are required fields on `/send-emails`
- Capped attachments at 10 MB per file and 5 files, with a multer error handler returning a clear 400
- Error responses are sanitized — clients receive generic messages while full error details go only to server logs
- Removed sensitive logging (email body, sender email, and credentials are no longer printed to the console)
- Added try/catch around all MongoDB operations

## 5. Dependencies & Supply Chain

- Patched a critical `shell-quote` vulnerability via an npm `overrides` entry (a transitive dependency pinned a vulnerable version); root `npm audit` is clean
- Removed the `axos` typosquat package (an unused, near-empty look-alike of `axios`) from the frontend
- Removed an accidental `firebase` dependency from the root `package.json`

## 6. Dead Code & Cleanup

- Removed the dead `verify-sender` feature end-to-end — the settings page, its route, the header nav link, the related constant, and the `senderEmail` model field (the backend endpoint never existed)
- Removed commented-out blocks and unused variables, deleted the broken default CRA test, and removed a dead `check-setup` npm script

## 7. Deployment

- Added a `GET /health` endpoint for uptime checks / keep-warm pinging
- Pinned the Node engine to `24.x` in `backend/package.json` (an open-ended range pulled a Node version too new for some dependencies on the host)
- Deployed the backend to Render (Web Service) and the frontend to Vercel, both from GitHub `main`
- Documented the full Render + Vercel deployment flow in the README
- Set up an UptimeRobot monitor pinging `/health` every 5 minutes to keep the free Render instance warm (avoids ~50s cold starts)

## 8. Other Fixes (non-security)

- Fixed the `EmailList` schema — removed a broken `required` constraint on `senderEmail` that silently failed every list creation
- Rewrote the README with a full setup guide (Firebase, MongoDB Atlas, Gmail App Password, environment variables) and attribution to the original repo
- Removed a redundant config README that referenced the original project's Firebase details

## Known Limitations & Planned Rework

- **Sender authentication (Gmail App Password).** The send form collects each sender's Gmail address + App Password for SMTP. An App Password is *not* send-only — it grants full mailbox access (IMAP read + SMTP send) and bypasses 2FA, so collecting it from users is a security anti-pattern. Planned rework: drop the fields and use the server-configured account, switch to a transactional provider (Resend/SendGrid) with a scoped API key, or use Gmail OAuth with the `gmail.send` scope.
