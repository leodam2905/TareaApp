# Tarea — Agent Guide

Context for AI coding agents (Codex / ChatGPT / Claude) working on this repo.

## What this is
A two-sided handyman marketplace. **Monorepo** with npm workspaces:

- `apps/mobile` — Expo / React Native app (TypeScript, `expo-router`). One codebase builds **two** apps via `APP_VARIANT`:
  - `APP_VARIANT=customer` → **Tarea** (Home, for customers) — bundle `com.taptarea.customer`
  - `APP_VARIANT=handyman` → **Tarea Pro** (for handymen) — bundle `com.taptarea.handyman`
- `apps/web` — Next.js 14 (App Router) — the **backend API** + marketing/admin site. Deployed at **https://taptarea.com** (Google Cloud Run). Prisma + PostgreSQL.

The mobile app talks to the web API (`EXPO_PUBLIC_API_URL` → `https://taptarea.com/api`).

## Roles / dual-role model
One account = one `User` with a single `role` (CUSTOMER / HANDYMAN / ADMIN). The **app you open decides the mode** (Home = hire, Pro = work). Anyone signed in can hire; working requires a `HandymanProfile` (role HANDYMAN). See `apps/mobile/app/index.tsx` and `login.tsx` for routing.

## Mobile app layout (`apps/mobile`)
- Routing is **file-based** (`expo-router`) under `app/`:
  - `app/(auth)/` — landing, login, register, forgot-password, verify-otp (shared by both variants)
  - `app/(handyman)/` — Tarea Pro screens (tabs: dashboard, find-jobs, jobs, earnings, notifications, profile; plus onboarding, settings, support, etc.)
  - `app/(customer)/` — Tarea Home screens
- **Theme:** the Pro app is a **light/white theme**. Use the semantic tokens in `constants/colors.ts`: `C.bg` (white), `C.surface` (light gray card), `C.text` (dark), `C.textMuted`, `C.line` (border). Primary accents: `C.sky` (cyan) or `#2563EB` (blue, used on the redesigned auth/dashboard). **Do not reintroduce dark backgrounds** (`C.ink`, `#0F172A`, `#1E293B`) on Pro screens.
- **Icons:** `@expo/vector-icons` → `Ionicons` (outline style). Avoid emoji as UI icons.
- **Typeface:** system default (no custom fonts). Keep it that way.

## Commands
- Install: `npm install` (root, workspaces)
- Typecheck (do this before committing mobile changes): `cd apps/mobile && npx tsc --noEmit`
- Run mobile dev server: `cd apps/mobile && npx expo start` (SDK 54; needs a **dev build** or the preview APK — **Expo Go will NOT run this app**, it has native modules)
- Web dev: `cd apps/web && npm run dev`
- Web build: `cd apps/web && npm run build`

## Ship / build workflow (needs local credentials — usually done by the machine-connected agent, not web ChatGPT)
- **OTA (JS-only changes):** `cd apps/mobile && npx eas update --branch production -m "msg"` — reaches installed builds via the in-app "Check for Updates" button (Pro Profile tab). Preferred for most changes; does not use EAS build quota.
- **Native changes** (icons, splash, native config, new native deps) require a rebuild: `npx eas build -p android --profile preview-handyman` (direct-install APK for testing) or `--profile production-handyman` (store bundle).
- Web deploy: `cd apps/web && gcloud builds submit --config cloudbuild.yaml` (Cloud Run).

## Backend = REST API, NOT Firebase
This app does **not** use Firebase/Firestore. All data goes through the Next.js API in `apps/web/app/api/**` (Prisma + Postgres), called from mobile via `@/lib/api` against `https://taptarea.com/api`. Examples: a handyman applies to a job with `POST /job-requests/{id}/apply`; reviews at `GET /reviews/received`; earnings at `GET /handyman/earnings`. Do not add Firebase.

## Guardrails (important)
- **Never commit secrets.** Env/keys (Stripe, DB, gcloud, JWT) live in local `.env` files and cloud secrets — they are **not** in the repo and must stay out. `EXPO_PUBLIC_*` keys in `apps/mobile/.env` are publishable-only.
- **Do NOT submit to the App Store / Play Store** without explicit owner approval. Store submission is a deliberate, separate step (bump version → build production profile → `eas submit` → promote/submit for review).
- Always **typecheck** before committing. Pre-existing type errors exist in `app/(customer)/book.tsx` and some Stripe SDK typings (web build has `typescript.ignoreBuildErrors: true`).
- Prefer small, reviewable commits. If multiple agents work here, use **branches / pull requests** to avoid collisions.

## Where key things live
- Mobile colors/theme: `apps/mobile/constants/colors.ts`
- App config (variants, icons, splash, updates): `apps/mobile/app.config.js`, `eas.json`
- API routes: `apps/web/app/api/**`
- DB schema: `apps/web/prisma/schema.prisma`
