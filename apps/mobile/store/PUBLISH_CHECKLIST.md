# Tarea — Play Console final checklist (web-UI only items)

Do this for BOTH apps unless noted. Customer = `com.taptarea.customer` ("Tarea").
Handyman = `com.taptarea.handyman` ("Tarea Pro"). Differences flagged with ⚑.

> ✅ Already done via API: store listing text, icon, feature graphic, screenshots, contact details, and the .aab is on the internal track. The items below have NO API.

---

## 0. Delete orphan `com.taptarea.app`
Open it → confirm package name at top → **Setup → Advanced settings** (or app Settings) → **Delete app** → confirm.
If greyed out: a release was activated → instead leave it as a reserved name, or "Unpublish" and ignore.

---

## 1. App content (left nav: **Policy → App content**)
Fill each card:

### Privacy policy
- URL: `https://taptarea.com/privacy`

### App access
- The app requires login for most screens, so choose:
  **"All or some functionality is restricted"** → Add new instructions.
- Both accounts bypass OTP (hardcoded TEST_EMAILS in login route), so reviewers log in with just email+password.

  **Customer app (`com.taptarea.customer`):**
  - Name: `Customer login`
  - Username: `reviewer@taptarea.com`
  - Password: `Review123!`
  - Any other instructions: "Tap Login on the first screen, enter the credentials. No OTP/2FA required for this account."

  ⚑ **Handyman app (`com.taptarea.handyman`):**
  - Name: `Handyman login`
  - Username: `test@taptarea.com`
  - Password: `TareaTest2026!`
  - Any other instructions: "Tap Login on the first screen, enter the credentials. No OTP/2FA required for this account."

### Ads
- **No, my app does not contain ads** (no ad SDKs in the app)

### Content rating  → see section 2

### Target audience and content
- Target age group: **18 and over** (marketplace + payments)
- "Do you want children included in your target audience?" → **No**
- Appeals to children? → **No**

### Data safety  → see section 3

### Government apps → **No**
### Financial features → **No** (you facilitate payments via Stripe but aren't a financial product) — if it asks about payments, you can note Stripe is the processor
### Health → **No**

---

## 2. Content rating questionnaire (IARC)
- Email: your dev email
- Category: **Utility, Productivity, Communication, or Other**
- Violence / Sexual content / Profanity / Controlled substances / Crude humor / Gambling → **No** to all
- **Does the app share the user's current location with other users?** → **Yes** (matching needs location)
- **Do users interact or exchange content / communicate?** → **Yes** (messaging, reviews, photos)
- **Can users purchase digital goods?**
  - Customer: **No** (booking real-world services, not digital goods)
  - ⚑ Handyman: **Yes** (Premium subscription is a digital purchase)
- Submit → expect an "Everyone / PEGI 3"-ish rating (may be Teen due to user communication)

---

## 3. Data safety  (the important one — declare accurately)

### Q: Does your app collect or share any required user data types? → **Yes**
### Q: Is all data encrypted in transit? → **Yes** (HTTPS)
### Q: Do you provide a way to request data deletion? → **Yes**
   - Provide deletion method/URL — e.g. email `support@taptarea.com` or an in-app "delete account" + your privacy page.

### Data types — mark COLLECTED (and SHARED where noted). For every item:
Collected = Yes, Processed ephemerally = No (you store it), Required = Yes (unless noted),
Purpose = **App functionality** (+ Account management where relevant).

| Data type | Collected | Shared* | Notes / purpose |
|---|---|---|---|
| **Name** | Yes | Yes | Shown to the other party in a booking |
| **Email address** | Yes | No | Account management |
| **Phone number** | Yes | Yes | Coordinating the job |
| **Address** | Yes | No | Service address / App functionality |
| **Precise location** | Yes | Yes | Matching customers ↔ handymen |
| **User payment info** | Yes | Yes (Stripe) | Payments processed by Stripe |
| **Purchase history** | Yes | No | Booking history |
| **Photos** | Yes | Yes | Job/portfolio/verification photos |
| **In-app messages** ("Other in-app messages") | Yes | Yes | Chat between users |
| **User IDs** | Yes | No | Account identity |
| **Device or other IDs** | Yes | No | Push token (notifications) |
| **App interactions** (App activity) | Yes | No | Core functionality |

*"Shared" = sent to another company/user beyond processing on your behalf. Stripe processing payments counts as shared.

⚑ Handyman extra: **verification documents** (ID/background) → declare under **Files and docs** OR **Photos** as Collected, NOT shared, purpose: Fraud prevention / safety. Required: Yes.

> Skip these unless you actually use them: Crash logs / Diagnostics (only if you have Sentry/analytics — Tarea has none noted, so leave **No**). Contacts, Calendar, Audio, Health, Web browsing → **No**.

---

## 4. Release to testers (Testing → Internal testing)
- Your v1 `.aab` is already uploaded. Open **Internal testing → Testers** tab.
- Create/select an email list → add tester Gmail addresses → Save.
- Go to the release → **Review release** → **Start rollout to Internal testing**.
- Copy the **"Join on web"** opt-in link and send to testers.

---

## 5. (Later) Go to Production
Once internal testing looks good: **Production → Create new release** → add the same `.aab`
(or `eas submit -p android --profile production-customer --id <buildId>`), add release notes,
**Review → Send for review**. First production review can take a few days.

---

### Order to minimize back-and-forth
0 (delete orphan) → 1 (App content cards) → 2 (rating) → 3 (data safety) → "Publishing overview" will then show all green → 4 (roll out to testers).
