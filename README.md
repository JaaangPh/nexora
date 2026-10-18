# Stepora Movement — Web & Mobile Application

A responsive web and Android fitness app for **Stepora Movement** members. It combines outdoor activity tracking, virtual runners, server-verified workout rewards, a member wallet, and cooperative team Marathons.

## What Stepora is for

Stepora gives members one place to record outdoor movement, understand how their selected runners affect reward calculations, manage their account balance, and join shared distance challenges. This guide starts with the member experience; developer setup and implementation notes follow.

## How it works for a member

1. **Create an account or sign in.** Register with a valid invite code, phone number, and password. Use the same account on the web app or Android app.
2. **Choose a runner.** Browse the Market, purchase a runner using the displayed price, and equip an owned runner. Each runner has a reward rate and a maximum eligible distance.
3. **Track a workout.** Open Track, select one or more available runners, allow location access, and start an outdoor workout. The app displays active time, steps, distance, calories, and an estimated reward.
4. **Pause, resume, or finish.** Pause when taking a break. Choose **End & Earn** when finished to submit the workout for server verification; the displayed estimate is not a confirmed reward.
5. **Use the wallet or join a challenge.** Verified workout rewards and eligible Marathon payouts are reflected in the member balance. Members can request withdrawals or join a Marathon if they meet its eligibility and balance requirements.

## How workout earnings work

The app estimates earnings during a workout. The server calculates any final reward from eligible distance and the selected runners, and checks saved workout timing, runner ownership, and movement evidence (GPS route or plausible step-sensor data). The client-reported estimate alone does not determine the final credit.

For each selected runner, the calculation is **eligible distance × reward rate**, capped at that runner's maximum eligible distance. Multiple selected runners are calculated separately and added together.

| Runner | Listed price | Reward rate | Maximum eligible distance |
| --- | ---: | ---: | ---: |
| Cyber Aero Walker | ₱500 | ₱8.40/km | 6 km |
| Bio Surge Trainer | ₱1,000 | ₱10.20/km | 10 km |
| Cobalt Aero Jogger | ₱2,000 | ₱20.10/km | 20 km |
| Vortex Blaze Sprint | ₱3,500 | ₱40.00/km | 35 km |

These are the values currently configured in the app and may change. They are not guaranteed earnings: a workout must pass verification, distance is capped per runner, and cooldowns or account rules may limit use. Each runner used in a completed workout receives a 12-hour cooldown. Rewards are credited once after a successful **End & Earn** verification.

## Pausing and using another device

Workout progress is stored on the device and synced to the account when a connection is available. If a member signs in to the same account on another device, the account's active workout is automatically paused, and the new device restores the saved workout progress. The previous device cannot overwrite the account snapshot after its session is replaced.

Changing between Wi-Fi and mobile data does not itself reset a workout. An offline device cannot sync new progress until it reconnects; progress that exists only on that offline device is not available to another device until it has synced.

## Wallet, withdrawals, and Marathons

Members can request withdrawals of at least **₱100** to a saved GCash, Maya, or GoTyme account. A withdrawal requires a connected Google Authenticator and a current six-digit code. The app applies a **2% fee**, deducted in addition to the requested payout amount. A request is recorded for review; submitting it does not mean the payout is complete. Members can check the request status in the app.

Marathons are optional seven-day team challenges for 5–10 accepted members. Teams select a 250 km or 500 km target and fund the corresponding bounty pool from member balances. Members must meet the runner ownership requirements before a team can start. Verified workout distance can contribute to an active team's progress. If the team reaches its target before the deadline, the pool is distributed to eligible members still on the roster. If it misses the target, contributions are refunded and no bounty is paid. Check the in-app rules before joining because participation can lock balance and apply cooldowns.

---

## 📸 Design & Brand Identity

* **Brand Name:** Stepora Movement
* **Tagline:** Move With Purpose. Earn with every step.
* **Design Philosophy:** Inspired by high-security enterprise defense & technology portals.
* **Palette:**
  * **Primary Deep Navy:** `#142B5B`
  * **Royal Blue:** `#2459C4`
  * **Cyan Accent:** `#18B7D5`
  * **Page Background:** `#F4F7FB`
  * **Form Card:** `#FFFFFF`
  * **Main Text:** `#17233B`
  * **Secondary Slate:** `#64748B`
  * **Input Borders:** `#DCE4EF`
  * **Success Green:** `#15966A`
  * **Error Red:** `#DC3545`

---

## 🧩 Platform capabilities

1. **Pixel-Perfect Authentication UI:**
   * Full-width dark-to-bright blue gradient header with geometric circuits and orbital radar arcs.
   * Original Stepora Movement emblem in a rounded white squircle badge.
   * `SECURE MEMBER ACCESS` pill badge with glassmorphism styling.
   * Overlapping white rounded card with dual-tab switcher: **Login** and **Create Account**.
   * Accessible input fields with left icons, focus rings, and eye toggles for password visibility.
   * Enterprise **Security Notice** card with shield badge.
   * Footer branding: `Stepora Movement • Secure Member Portal`.

2. **Complete Full-Stack Authentication:**
   * **International Phone Number + Password Authentication** with searchable country flags and calling codes, rate limiting, and generic error responses to prevent user enumeration.
   * **Real-time Invite Code Verification** via backend API (`POST /api/auth/validate-invite`).
   * Password mismatch validation and format verification.
   * Duplicate phone number detection (HTTP 409 Conflict).
   * Password hashing using **bcrypt** with salt rounds.
   * Dual session token strategy: JWT Bearer tokens for mobile apps and secure HttpOnly cookies for browsers.

3. **Persistent Cloud Database Engine:**
   * **Active Engine:** **Google Cloud Firestore** (Project: `nexora-d0290`) via `firebase-admin`.
   * **Security:** Service account credentials stored exclusively in `.env` (git-ignored for maximum protection).
   * **Collections:**
     * `users`: Member profiles, roles, encrypted password hashes, timestamps.
     * `invite_codes`: Access keys with quota and validation states (`NEXORA-2025`, `VIP-ACCESS`, etc.).
     * `auth_logs`: Real-time audit trails of all registrations and sign-in activities.
     * `payment_deposits`: Pending/settled TurboPay order records; successful callbacks credit the associated user once.
   * **Local Fallback:** SQLite & PostgreSQL schemas remain available in `server/database/`.

4. **Member Referral Program & Dynamic Invitation Links:**
   * **Automatic NT(6-digit) Code Generation:** Every created account is assigned a unique referral code format `NT######` (e.g., `NT723906`, `NT374624`).
   * **Automatic Invitation Links:** Every user receives an invitation URL: `http://localhost:3000/register/NT723906` (or production domain).
   * **URL Pre-filling & Auto-Validation:** Visiting an invitation link automatically selects the "Create Account" tab, fills the referral code, and triggers real-time verification.
   * **Dashboard Sharing Hub:** Authenticated dashboard features a dedicated Referral Pass card with 1-click **Copy Code** and **Copy Link** buttons.
   * **First-Runner Rewards:** When a referred member buys their first Runner, the direct referrer receives ₱100 and the next two ancestors each receive ₱50. Rewards are calculated per referred member; repeat Runner purchases do not pay again.
   * **Referral Registration in Firestore:** New accounts are linked to the referring member, and earned rewards are recorded in wallet transactions.

5. **Member Dashboard:**
   * Displays member tier, verification badge, phone number, invite code used, member ID, and personal referral pass.
   * Security overview highlights (Bcrypt encryption, JWT session, brute-force defense).
   * Secure Sign Out action that safely terminates the session.

6. **Testing & QA Helper:**
   * Built-in `Mobile API Host Settings` dialog for configuring emulator (`10.0.2.2:5000`) or physical device LAN IPs.

---

## 🔑 Invite Codes

| Type | Details | Purpose |
| :--- | :--- | :--- |
| **Invite Key 1** | `NEXORA-2025` | General Member Onboarding Pass (Unlimited) |
| **Invite Key 2** | `VIP-ACCESS` | Executive VIP Access Pass (25 uses) |
| **Invite Key 3** | `SECURITY-PASS` | Nexora Security Protocol Pass (10 uses) |
| **Invite Key 4** | `ALPHA-TESTER` | QA Mobile Verification Key (10 uses) |

---

## 🛠️ Technology Stack

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide React.
* **Backend:** Node.js, Express 5, TypeScript / TSX, CORS, Cookie-Parser, BcryptJS, JSONWebToken, Express-Rate-Limit.
* **Database:** SQLite (`better-sqlite3`) & PostgreSQL (`server/database/schema.sql`).
* **Mobile Packaging:** Capacitor 8 (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`).

## 💳 TurboPay Deposit Setup

Deposits are created by the Express backend and stored as pending Firestore transactions. The app does not credit balances from the payment-creation response: the callback at `POST /api/payments/turbopay/callback` must pass TurboPay's MD5 signature, merchant, order, status, and exact amount checks before Firestore credits the account. Repeated success callbacks are idempotent.

Configure these backend-only environment variables in the deployment hosting the Express API:

* `TURBOPAY_ENABLED` — keep `false` until TurboPay confirms the key, whitelisting, callbacks, and testing process; set to `true` only when ready to create live deposit or payout requests.
* `TURBOPAY_API_URL` — official HTTPS API origin (`https://merchant.turbopay.ph`).
* `TURBOPAY_MERCHANT_ID`
* `TURBOPAY_MERCHANT_KEY` — use the rotated TurboPay signing key; never use a `VITE_` prefix or commit the value.
* `TURBOPAY_CALLBACK_URL` — public HTTPS URL ending in `/api/payments/turbopay/callback`.
* `TURBOPAY_WITHDRAWAL_CALLBACK_URL` — public HTTPS URL ending in `/api/payments/turbopay/withdrawal-callback`.
* `TURBOPAY_RETURN_URL` — public HTTPS URL for the user redirect after payment.

The minimum deposit is ₱100 for GCash, Maya, GoTyme, and QRPH; successful callbacks credit the exact PHP amount in the order (for example, a ₱150 payment credits ₱150). TurboPay's documentation requires a minimum of ₱800 for USDT-TRC20. The QRPH UI choice is sent using `bank_code=gcash` per the merchant's instructions; confirm this with TurboPay because its bank-code directory lists `qrph` separately. The hosting provider must expose the callback routes publicly and allow the backend's static outbound IP to be registered with TurboPay if their account requires IP whitelisting. `34.143.182.198` is identified in TurboPay's documentation as TurboPay's API IP; it is not Nexora's outbound IP. Members can save bank and wallet destinations from TurboPay's payout directory in Bank Account and select a saved destination when requesting a withdrawal. Withdrawals are recorded in `payment_withdrawals` for review. Admin acceptance submits the saved bank code and account details to TurboPay; the member record remains processing until the signed withdrawal callback reports status `5`, and status `3` marks it failed and refunds the deducted amount. TurboPay states payout channel availability can vary per merchant, so a directory entry may still be rejected if it is not enabled for the account. The server includes TurboPay's HTTP status and rejection message in the admin response; use its support reference, if present, when contacting TurboPay. Workout rewards are credited after successful server verification.

## 🤖 Telegram Signup Notifications

After a member account is created, the backend can post a welcome message to a specific Telegram group topic. The post includes the phone number masked to its last four digits, the account creation time in Asia/Manila, and the new member's referral code. Telegram delivery is best-effort: an unavailable or unconfigured bot does not prevent signup.

Create a bot with Telegram's `@BotFather`, add it to the target group, and allow it to send messages. Configure these backend-only environment variables in the Express API deployment and local `.env` when testing:

* `TELEGRAM_BOT_TOKEN` — the secret token issued by `@BotFather`; do not commit or expose it in client-side `VITE_` variables.
* `TELEGRAM_GROUP_CHAT_ID` — the target group's chat ID (supergroup IDs commonly start with `-100`).
* `TELEGRAM_SIGNUP_TOPIC_ID` — the numeric `message_thread_id` for the group's **Signup** topic. To find it, send `/start@YourBotUsername` inside that topic, call Telegram's `getUpdates`, and read `message.message_thread_id` from that topic's update. Do not use the group's `chat.id` as the topic ID.

All three variables must be set for notifications to be sent; if the topic ID is missing or invalid, notifications are not sent to the general chat.

### Marketplace purchase notifications

A separate Telegram bot can post runner purchase receipts with the matching runner image to the Marketplace forum topic. Configure `TELEGRAM_MARKETPLACE_BOT_TOKEN`, `TELEGRAM_MARKETPLACE_CHAT_ID`, and `TELEGRAM_MARKETPLACE_TOPIC_ID` in the backend environment. Create the separate bot with `@BotFather`, add it to the group, and allow it to send photos and messages. To get the Marketplace topic ID, send a message such as `/start@YourMarketplaceBot` in that topic and read `message.message_thread_id` from the update; use the group's `chat.id` for `TELEGRAM_MARKETPLACE_CHAT_ID`. Notifications are best-effort and do not undo a completed purchase if Telegram is unavailable.

## 🔐 Administrator Portal

Open `/admin` to use the separate administrator dashboard. Configure `ADMIN_EMAIL=admin@stepora.xyz`, set `ADMIN_PASSWORD` to the chosen backend-only password, and set `ADMIN_AUTH_SECRET` to a unique random value at least 32 characters long before signing in. Keep the auth secret stable so the stored authenticator key remains decryptable. Do not put administrator credentials in client-side `VITE_` variables or source code. After password verification, the first sign-in displays a QR code for Google Authenticator; the setup is only complete after submitting a valid six-digit code. The TOTP secret is encrypted before it is stored in Firestore, and admin sessions expire after eight hours. Admins can change their password and create admin or read-only staff accounts from **Security & accounts**. The admin-only **Staff team** view lists registered account emails, roles, and statuses. Password changes and account creation require the current admin's fresh authenticator code. New accounts are prompted to enroll Google Authenticator and scan their own QR code at first sign-in. Staff accounts can view deposits and withdrawals but cannot change account security, create accounts, or view the staff team.

The dashboard reads deposits from `payment_deposits` and a member's withdrawal history from `payment_withdrawals`. Members can submit withdrawal requests in the app; requests debit the balance and are recorded with a pending status for administrator review. The app currently has no separate fee ledger.

## 🏃 Marathon

The Marathon tab is a Firestore-backed team challenge. Teams have 5–10 accepted members, choose exactly one of **250 KM / ₱1,000** or **500 KM / ₱2,500**, and have exactly seven days from the server start time to reach the target. Users need at least one qualifying runner to participate, and every joined member must own both canonical runners (`snk-3` Cobalt Aero Jogger and `snk-4` Vortex Blaze Sprint) before the leader can start.

The persisted lifecycle is `Lobby` → `Active` → `Completed` or `Failed`. A leader cancelling a Lobby permanently deletes the team document, cancels its pending invitations, notifies members and invitees, and releases current member claims; a member leaving only removes that member from the roster and preserves the Lobby. Backend transactions enforce these actions. Completed and failed marathon records remain immutable historical records with the original leader, roster, contributions, target, bounty, outcome, and timestamps.

Starting a race atomically rechecks team membership, ownership of both runners, cooldowns, workout state (including paused and pending End & Earn), and each member's database balance. The start transaction reads and debits each member's user document, the same document updated transactionally by workout snapshot saves; Firestore therefore retries the start if a workout state changes before commit. The pool is debited in equal cent-based shares from member balances. When the target is reached strictly before the deadline, the pool is paid once, equally among members still on the active roster at completion; if the deadline is reached below target, the original contributions are refunded and no bounty is paid. A failed marathon's cooldown begins at the authoritative deadline timestamp; a completed marathon's cooldown begins when its target is finalized. Started-race participants, including members who leave early, receive a three-day cooldown. A Firestore membership claim keyed by user ID is read and written within transactions, preventing concurrent team creation or invitation acceptance from creating multiple current memberships.

Marathon records, membership claims, invitations, notifications, verified workout records, cooldowns, and wallet transactions are stored in Firestore collections (`marathons`, `marathon_memberships`, `marathon_invitations`, `marathon_notifications`, `completed_workouts`, `marathon_cooldowns`, and `wallet_transactions`). Only an End & Earn completion can create a workout record. The backend derives eligible distance from the stored GPS route and checks the member's actual owned runner instances; it does not credit the client-reported summary distance. Marathon reads and workout completion lazily finalize races whose server deadline has passed; deployments requiring a status transition at the exact deadline must also invoke expiration settlement through a durable scheduler.

Run `npm run test:marathon` to verify canonical runner eligibility, deterministic cent allocation, and server-side route-distance calculation.

---

## 📦 Project Structure

```text
nexora/
├── android/                   # Native Android Capacitor Project
│   ├── app/
│   │   ├── build.gradle       # App Gradle configuration (com.nexora.technologies)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── res/           # Launcher icons, colors, themes, splash screens
│   └── gradlew.bat            # Gradle wrapper for building Android APKs
├── server/                    # Backend API
│   ├── config/config.ts       # Server environment configurations
│   ├── controllers/authController.ts # Register, Login, Logout, Invite verification
│   ├── controllers/paymentController.ts # TurboPay deposit creation, status, verified callback
│   ├── database/
│   │   ├── db.ts              # SQLite connection & auto-seeding
│   │   ├── schema.sql         # Database schema for PostgreSQL & SQLite
│   │   └── nexora.sqlite      # Persistent database file
│   ├── middleware/
│   │   ├── auth.ts            # JWT Bearer & cookie verification middleware
│   │   └── rateLimiter.ts     # Brute force rate limiting
│   ├── routes/authRoutes.ts   # Authentication route definitions
│   ├── routes/paymentRoutes.ts # TurboPay deposit routes
│   ├── routes/marathonRoutes.ts # Authenticated Marathon API
│   ├── controllers/marathonController.ts # Marathon API request handling
│   ├── services/marathonService.ts # Firestore-backed Marathon lifecycle and rewards
│   ├── services/marathonRules.ts # Canonical eligibility and payout rules
│   ├── services/turbopay.ts   # Server-side request signing and TurboPay API client
│   └── server.ts              # Server startup file (Port 5000)
├── src/                       # Frontend Web & Mobile Application
│   ├── components/
│   │   ├── AuthTabs.tsx       # Tab switch between Login and Create Account
│   │   ├── BrandLogo.tsx      # Stepora Movement emblem
│   │   ├── Dashboard.tsx      # Authenticated Member Dashboard
│   │   ├── Header.tsx         # Gradient banner with geometric grid & badge
│   │   ├── InviteCodeHelper.tsx # Testing modal for invite codes & mobile host
│   │   ├── LoginForm.tsx      # Login form with phone, password, eye toggle
│   │   ├── RegisterForm.tsx   # Register form with real-time invite check
│   │   ├── PhoneNumberInput.tsx # Searchable international phone input with country flags
│   │   └── SecurityNotice.tsx # Shield security advisory card
│   ├── services/api.ts        # API client for Web and Capacitor Mobile
│   ├── styles/index.css       # Global styles & Tailwind directives
│   ├── types/auth.ts          # TypeScript auth models
│   ├── App.tsx                # Main application component
│   └── main.tsx               # React entrypoint
├── capacitor.config.json      # Capacitor project configuration
├── tailwind.config.js         # Nexora brand theme definitions
├── vite.config.ts             # Vite build configuration with /api proxy
├── package.json
└── README.md
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Both Frontend and Backend Concurrently
```bash
npm run dev
```
* **Frontend Application:** `http://localhost:3000`
* **Backend Authentication API:** `http://localhost:5000/api/auth`
* **Health Check Endpoint:** `http://localhost:5000/api/health`

### Or Run Individually
```bash
# Start backend only (Port 5000)
npm run server

# Start frontend only (Port 3000)
npm run client
```

---

## 📱 Building the Android APK

### 1. Build the Web Application & Sync Capacitor
```bash
npm run cap:sync
```
*(This builds the Vite production distribution into `dist/` and synchronizes native Android assets in `android/`).*

### 2. Build Debug APK via Command Line
```powershell
# Set Android SDK path and run Gradle
$env:ANDROID_HOME="C:\Users\Owner\AppData\Local\Android\Sdk"
cd android
.\gradlew.bat assembleDebug
```
The output APK is generated at:
```text
android/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Open in Android Studio (Optional)
```bash
npm run cap:open
```

### 4. Install onto Connected Android Device or Emulator
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 🌐 Mobile API Configuration
When testing the Android APK:
* If running on an **Android Emulator**, the API host is `http://10.0.2.2:5000`.
* If running on a **Physical Device** connected to local Wi-Fi, set the API host to `http://<YOUR_LAN_IP>:5000`.
* Click the **Settings (gear icon)** at the bottom-right corner of the mobile app to set or reset this URL on the fly.
* In production, point to your deployed HTTPS server (e.g., `https://api.nexora.com`).

---

## 🛡️ Security Features
* **Password Hashing:** Passwords hashed with `bcryptjs` (salt factor 10).
* **Brute-Force Protection:** Rate-limited to 30 authentication requests per 15-minute window per IP.
* **Enumeration Defense:** Generic login error messages prevent attackers from discovering valid phone numbers.
* **Server-Side Validation:** All inputs and invite codes validated by the backend.
* **Dual Authentication:** Accepts either `Authorization: Bearer <token>` or `HttpOnly` session cookies.
