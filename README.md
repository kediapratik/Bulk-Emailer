# Bulk Email Sender

A full-stack web app for sending personalized bulk emails via Gmail. Upload a recipient list from Excel, compose a message with `{name}` placeholders, attach files, and send — with a live progress bar as emails go out. Includes Google Sign-In, an admin panel for managing user access, and saved email lists per user.

**Tech stack:** React · Node/Express · MongoDB Atlas · Firebase Auth · Nodemailer (Gmail SMTP)

---

## Origin & Changes

This project is a refactored and extended version of [bulk-email-sender](https://github.com/Jatin-dudhani/bulk-email-sender) by [Jatin Dudhani](https://github.com/Jatin-dudhani). The following changes have been made on top of the original codebase:

- **Server-side Firebase token verification** — all protected routes now verify a Firebase ID token from the `Authorization` header instead of trusting the email sent in the request body
- **Axios interceptor** — a shared axios instance automatically attaches the Firebase ID token to every request
- **Route guards restored** — `/home` requires the `authorized` Firebase custom claim; `/admin` requires both `authorized` and `admin`
- **EmailList model fixed** — removed a `required` constraint on `senderEmail` that was silently breaking list creation
- **Hardcoded values moved to env** — main admin email, admin UID, and feedback email are now configurable via environment variables instead of being hardcoded

Additional endpoint/ownership hardening, input validation, dead-code removal,
dependency fixes, and Render + Vercel deployment changes have also been made.
See **[CHANGES.md](CHANGES.md)** for the full list.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [MongoDB Atlas](https://cloud.mongodb.com) account
- [Firebase](https://console.firebase.google.com) project
- Gmail address with an [App Password](https://myaccount.google.com/apppasswords)

---

## One-time setup

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Firebase setup

#### Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** and follow the steps

#### Enable Google Sign-In
1. In the sidebar go to **Build** → **Authentication** → **Get started**
2. Click **Google** under Sign-in providers → enable it
3. Set a public-facing name and support email → **Save**

#### Get the web app config (for frontend)
1. Go to **Project Settings** (gear icon top left)
2. Scroll to **Your apps** → click the **</>** web icon → register the app
3. Copy the config values shown — these go into `frontend/.env`

#### Get the service account key (for backend)
1. Go to **Project Settings** → **Service accounts** tab
2. Click **Generate new private key** → **Generate key**
3. Move the downloaded JSON file into `backend/config/`
4. Update `.gitignore` with the exact filename so it is never committed

### 3. MongoDB Atlas setup

1. Create a cluster at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Go to **Database Access** → **Add New Database User** → set a username and password
3. Go to **Network Access** → **Add IP Address** → add your IP (or `0.0.0.0/0` for dev)
4. Go to your cluster → **Connect** → **Drivers** → copy the connection string
5. Replace `<password>` and add your database name before the `?`:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/bulk-emailer?retryWrites=true&w=majority&appName=Cluster0
   ```

### 4. Gmail App Password

1. Enable **2-Step Verification** on your Google account
2. Go to [myaccount.google.com](https://myaccount.google.com) and search **App Passwords**
3. Create one with any name → copy the 16-character password immediately

---

## Environment variables

### `backend/.env`

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB Atlas connection string (with database name) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Relative path to the service account JSON, e.g. `./config/your-file.json` |
| `EMAIL_USER` | Your Gmail address |
| `EMAIL_PASS` | Gmail App Password (16-character, not your account password) |
| `PORT` | Server port — `5000` |
| `MAIN_ADMIN_EMAIL` | Email address of the root admin account |
| `MAIN_ADMIN_UID` | Firebase UID of the root admin (see below) |

### `frontend/.env`

Copy `frontend/.env.example` to `frontend/.env` and fill in:

| Variable | Where to get it |
|----------|-----------------|
| `REACT_APP_API_URL` | `http://localhost:5000` for local dev |
| `REACT_APP_FIREBASE_API_KEY` | Firebase → Project Settings → Your apps → Web app config |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Same |
| `REACT_APP_FIREBASE_PROJECT_ID` | Same |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Same |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Same |
| `REACT_APP_FIREBASE_APP_ID` | Same |
| `REACT_APP_FIREBASE_MEASUREMENT_ID` | Same (optional — only if Analytics enabled) |
| `REACT_APP_MAIN_ADMIN_EMAIL` | Same email as `MAIN_ADMIN_EMAIL` in backend |

---

## Run locally

```bash
npm run dev
```

- **Frontend:** http://localhost:3000
- **Backend:** http://localhost:5000

Run only one side:

```bash
npm run dev:backend
npm run dev:frontend
```

---

## First-time admin setup

1. Run the app and sign in with Google once
2. Go to Firebase Console → **Authentication** → **Users**
3. Copy your UID and paste it into `backend/.env` as `MAIN_ADMIN_UID`
4. Run from the `backend/` folder:

```bash
npm run setup-admin
```

This grants your account the `admin` and `authorized` Firebase custom claims via a local CLI script — no HTTP endpoint is exposed for this.

---

## Deployment (Render + Vercel)

Backend (Express) runs on **Render** — it needs a long-lived process for the SSE
progress stream. Frontend (React) runs on **Vercel**.

### Backend → Render (Web Service)

- **Root Directory:** `backend` · **Build:** `npm install` · **Start:** `npm start` · Free instance
- Set the same variables as `backend/.env`. Add the Firebase service-account JSON as a **Secret File** and point `FIREBASE_SERVICE_ACCOUNT_PATH` at it (e.g. `/etc/secrets/serviceAccount.json`). Do **not** set `PORT` — Render injects it.
- Pin a stable Node major in `engines` (e.g. `"24.x"`); an open-ended range can pull a Node version too new for some dependencies.

### Frontend → Vercel

- **Root Directory:** `frontend` (auto-detects Create React App)
- Set the `REACT_APP_*` variables; `REACT_APP_API_URL` must point at the Render backend URL.

### Wire them together

1. On Render, set `CORS_ORIGINS` to your Vercel URL — **no trailing slash**.
2. In **MongoDB Atlas → Network Access**, allow `0.0.0.0/0` (Render's free tier has no static outbound IP).
3. In **Firebase → Authentication → Settings → Authorized domains**, **add your deployed frontend domain** — otherwise Google Sign-In fails with `auth/unauthorized-domain`.
4. *(Optional)* Keep the free Render instance warm by pinging `GET /health` every ~14 min with a free cron service.
