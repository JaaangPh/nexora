# Nexora Technologies — Web & Mobile Application

A modern, responsive, high-security authentication platform for **Nexora Technologies**, engineered as both a responsive web application and an installable native Android application via Capacitor.

---

## 📸 Design & Brand Identity

* **Brand Name:** Nexora Technologies
* **Tagline:** Secure Access to Your Account
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

## 🚀 Key Features

1. **Pixel-Perfect Authentication UI:**
   * Full-width dark-to-bright blue gradient header with geometric circuits and orbital radar arcs.
   * Original Nexora Technologies emblem in a rounded white squircle badge.
   * `SECURE MEMBER ACCESS` pill badge with glassmorphism styling.
   * Overlapping white rounded card with dual-tab switcher: **Login** and **Create Account**.
   * Accessible input fields with left icons, focus rings, and eye toggles for password visibility.
   * Enterprise **Security Notice** card with shield badge.
   * Footer branding: `Nexora Technologies • Secure Member Portal`.

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
   * **Referral Registration in Firestore:** Member referral codes are registered in the `invite_codes` collection, creating a self-sustaining referral network.

5. **Member Dashboard:**
   * Displays member tier, verification badge, phone number, invite code used, member ID, and personal referral pass.
   * Security overview highlights (Bcrypt encryption, JWT session, brute-force defense).
   * Secure Sign Out action that safely terminates the session.

6. **Testing & QA Helper:**
   * Built-in floating `Demo Keys & Logins` panel for 1-click test autofills.
   * Built-in `Mobile API Host Settings` dialog for configuring emulator (`10.0.2.2:5000`) or physical device LAN IPs.

---

## 🔑 Pre-Seeded Credentials & Invite Codes

| Type | Details | Purpose |
| :--- | :--- | :--- |
| **Admin Account** | Phone: `+18005550199`<br>Password: `AdminPassword2025!` | Pre-seeded Administrator |
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

* `TURBOPAY_ENABLED` — keep `false` until TurboPay confirms the key, whitelisting, callback, and testing process; set to `true` only when ready to create live payment requests.
* `TURBOPAY_API_URL` — official HTTPS API origin (`https://merchant.turbopay.ph`).
* `TURBOPAY_MERCHANT_ID`
* `TURBOPAY_MERCHANT_KEY` — use the rotated TurboPay signing key; never use a `VITE_` prefix or commit the value.
* `TURBOPAY_CALLBACK_URL` — public HTTPS URL ending in `/api/payments/turbopay/callback`.
* `TURBOPAY_RETURN_URL` — public HTTPS URL for the user redirect after payment.

The minimum deposit is ₱100 for GCash, Maya, GoTyme, and QRPh; successful callbacks credit the exact PHP amount in the order (for example, a ₱150 payment credits ₱150). TurboPay's documentation requires a minimum of ₱800 for USDT-TRC20. The QRPh UI choice is sent using `bank_code=gcash` per the merchant's instructions; confirm this with TurboPay because its bank-code directory lists `qrph` separately. The hosting provider must expose the callback route publicly and allow the backend's static outbound IP to be registered with TurboPay if their account requires IP whitelisting. `34.143.182.198` is identified in TurboPay's documentation as TurboPay's API IP; it is not Nexora's outbound IP. Withdrawals are manual and are not submitted to TurboPay; workout reward credits remain paused.

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
│   ├── services/turbopay.ts   # Server-side request signing and TurboPay API client
│   └── server.ts              # Server startup file (Port 5000)
├── src/                       # Frontend Web & Mobile Application
│   ├── components/
│   │   ├── AuthTabs.tsx       # Tab switch between Login and Create Account
│   │   ├── BrandLogo.tsx      # Nexora Technologies original emblem
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
