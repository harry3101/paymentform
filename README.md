# Student Participation Form

A clean, mobile-friendly registration page built with **Next.js**, **React**, and **Tailwind CSS**. Students fill in their details, pay the participation fee via a **UPI deep link**, then submit the form only after payment is confirmed.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Edit payment settings in [`lib/config.ts`](lib/config.ts):

| Setting | Current value | Purpose |
| --- | --- | --- |
| `UPI_ID` | `9599566502@ptsbi` | VPA that receives student payments |
| `AMOUNT` | `499` | Fee in INR |
| `PAYEE_NAME` | `Student Participation` | Name shown in UPI apps |
| `TRANSACTION_NOTE` | `Student Participation Fee` | UPI transaction note |

## Payment flow (how to test)

### On a phone (real UPI)

1. Fill the required fields (Indian 10-digit mobile validated).
2. Tap **Pay ₹499 with UPI** — the device opens GPay / PhonePe / Paytm / etc.
3. Complete (or cancel) payment in the UPI app, then return to the browser.
4. Tap **I have completed the payment** to unlock **Submit Form**.
5. Submit and see the thank-you screen.

> Plain `upi://` links do **not** send a verified callback to the browser. The “I have paid” step (or a real payment gateway webhook) is required for a reliable confirmation.

### Demo / desktop testing

Use either:

- **Simulate Successful Payment** (shown after you click Pay), or
- Open with a URL callback simulation:

```
http://localhost:3000/?payment=success&ref=DEMO123
```

Cancelled simulation:

```
http://localhost:3000/?payment=cancelled
```

### What gets stored

- **sessionStorage** — in-progress / completed payment status for the current session
- **localStorage** (`student_participation_submissions`) — submitted form + payment status
- **`POST /api/submit`** — optional demo API that logs submissions on the server

## UPI deep link format

```
upi://pay?pa=<VPA>&pn=<PayeeName>&am=<Amount>&cu=INR&tn=<Note>&tr=<TxnRef>
```

Built in [`lib/upi.ts`](lib/upi.ts) via `buildUpiDeepLink()`.

## Integrating a real payment gateway later

Replace the client-only UPI + “I have paid” flow with a gateway that verifies payments server-side:

1. Create an order on your backend (Razorpay / PhonePe / Cashfree / PayU).
2. Open their UPI Intent / Checkout on the device.
3. Confirm success via **webhook** or server payment-status API.
4. Redirect back with something like `?payment=success&ref=<order_id>` only after verification.
5. Unlock **Submit Form** only when your API says the order is paid.

Never trust the browser alone for money confirmation in production.

## Deploy on Render

This repo includes a Blueprint file: [`render.yaml`](render.yaml).

### Option A — Blueprint (recommended)

1. Push your code to GitHub (this repo: `harry3101/paymentform`).
2. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign in.
3. Click **New +** → **Blueprint**.
4. Connect the GitHub account / select the `paymentform` repository.
5. Render reads `render.yaml` and shows the **student-participation-form** web service.
6. Click **Apply** / **Create**.
7. Wait for the first build to finish, then open the public URL  
   (something like `https://student-participation-form.onrender.com`).

### Option B — Manual Web Service

1. **New +** → **Web Service** → select this repo.
2. Use these settings:

| Field | Value |
| --- | --- |
| Runtime | Node |
| Branch | `main` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Plan | Free (or Starter) |
| Region | Singapore (or closest to you) |

3. Add env var `NODE_ENV=production` (optional but recommended).
4. Click **Create Web Service** and wait for deploy.

### After deploy

- Free tier services **spin down** after idle time; the first request may take ~30–60s.
- Auto-deploys run on every push to `main` (set in `render.yaml`).
- UPI Pay works best when students open the live site **on their phones**.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm start` | Run production build |

## Project structure

```
app/
  page.tsx              # Landing + form shell
  layout.tsx            # Fonts & metadata
  globals.css           # Theme + utilities
  api/submit/route.ts   # Demo submit endpoint
components/
  StudentParticipationForm.tsx
lib/
  config.ts             # ← edit UPI ID & amount here
  upi.ts                # Deep link + phone validation
  storage.ts            # localStorage helpers
```
