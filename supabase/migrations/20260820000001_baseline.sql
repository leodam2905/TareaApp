-- 20260820000001 · Supabase baseline
--
-- The whole schema as one migration. The project has no `prisma/migrations`
-- history (it has always used `prisma db push`), so there is nothing to replay:
-- this is a fresh baseline generated from `apps/web/prisma/schema.prisma` with
--
--   npx prisma migrate diff --from-empty \
--     --to-schema-datamodel prisma/schema.prisma --script
--
-- and then corrected for three things Prisma's generator cannot know about.
-- Those corrections are marked [ADDED] below; everything else is generated
-- output and should be regenerated rather than hand-edited.
--
--   [ADDED 1] CREATE EXTENSION postgis. schema.prisma maps service_point as
--             Unsupported("geography(Point,4326)"), so the generated DDL uses
--             the type without ever creating the extension. Applying the
--             generated file to an empty database fails on the first
--             geography column.
--
--   [ADDED 2] The GiST spatial indexes and the draft-sweep index from
--             migrations/001_postgis_service_point.sql. Prisma does not model
--             them, so they are absent from generated output. Without them
--             ST_DWithin is a sequential scan and the matcher's index scan --
--             the entire point of 001 -- silently does not happen.
--
--   [ADDED 3] updated_at triggers. Prisma's @updatedAt is maintained by the
--             *client*, not the database: 9 tables carry an updated_at that is
--             NOT NULL with no default and no trigger. The moment writes stop
--             going through the Prisma client, every one of those columns
--             either goes stale or rejects the insert outright. The triggers
--             move that guarantee into the database, where it belongs.
--
-- RLS: every table is switched on at the end with NO policies attached, which
-- denies everything to anon and authenticated while leaving service_role (which
-- bypasses RLS) working. That is deliberate: an unprotected table in `public` is
-- readable by anyone holding the anon key, and the anon key ships in the app.
-- Fail closed now, add policies per table as each route is ported.

BEGIN;

-- [ADDED 1] -----------------------------------------------------------------
-- Supabase convention: extensions live in `extensions`, not `public`, so that
-- `supabase db diff` does not try to manage PostGIS's own objects. The
-- search_path below lets the bare `geography(Point, 4326)` in the generated
-- DDL resolve without editing the generated lines.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

-- === generated output begins ================================================

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'HANDYMAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "BackgroundCheckStatus" AS ENUM ('PENDING', 'DEFERRED', 'PAID', 'IN_PROGRESS', 'PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'PAINTING', 'CLEANING', 'HVAC', 'ROOFING', 'LANDSCAPING', 'MOVING', 'APPLIANCE_REPAIR', 'LAUNDRY', 'GENERAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "expoPushToken" TEXT,
    "fcmToken" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordChangedAt" TIMESTAMP(3),
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "avatarUrl" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accountType" "AccountType" NOT NULL DEFAULT 'INDIVIDUAL',
    "companyName" TEXT,
    "companyLogoUrl" TEXT,
    "ein" TEXT,
    "website" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripeAccountId" TEXT,
    "stripeAccountStatus" TEXT,
    "stripeCustomerId" TEXT,
    "defaultPaymentMethodId" TEXT,
    "notifBookingUpdates" BOOLEAN NOT NULL DEFAULT true,
    "notifReminders" BOOLEAN NOT NULL DEFAULT true,
    "notifMessages" BOOLEAN NOT NULL DEFAULT true,
    "notifSms" BOOLEAN NOT NULL DEFAULT true,
    "referralCode" TEXT,
    "referredBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fcm_outbox" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "device_token_id" TEXT,
    "token_hash" TEXT NOT NULL,
    "platform" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "next_attempt_at" TIMESTAMP(3),
    "fcm_message_name" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fcm_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handyman_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "hourlyRate" DOUBLE PRECISION NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalJobs" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "responseTime" INTEGER NOT NULL DEFAULT 60,
    "serviceRadius" INTEGER NOT NULL DEFAULT 50,
    "service_point" geography(Point, 4326),
    "geocode_confidence" DOUBLE PRECISION,
    "geocode_source" TEXT,
    "geocoded_at" TIMESTAMP(3),
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "stripeSubId" TEXT,
    "stripeSubStatus" TEXT,
    "verificationDocUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'none',
    "backgroundCheckStatus" "BackgroundCheckStatus" NOT NULL DEFAULT 'PENDING',
    "backgroundCheckPaidAt" TIMESTAMP(3),
    "backgroundCheckRef" TEXT,
    "icaSignedAt" TIMESTAMP(3),
    "icaSignedIp" TEXT,
    "idFrontUrl" TEXT,
    "idBackUrl" TEXT,
    "licenseNumber" TEXT,
    "licenseDocUrl" TEXT,
    "insuranceDocUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handyman_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handyman_availability" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startHour" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,

    CONSTRAINT "handyman_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "handymanId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "minPrice" DOUBLE PRECISION NOT NULL,
    "maxPrice" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "handymanId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "promoCodeId" TEXT,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "notes" TEXT,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "authorizedAmount" DOUBLE PRECISION,
    "authorizedAt" TIMESTAMP(3),
    "authExpiresAt" TIMESTAMP(3),
    "capturedAmount" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "responseDeadline" TIMESTAMP(3),
    "isOnMyWay" BOOLEAN NOT NULL DEFAULT false,
    "handymanLat" DOUBLE PRECISION,
    "handymanLng" DOUBLE PRECISION,
    "disputeReason" TEXT,
    "disputedBy" TEXT,
    "disputedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "materialsEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "jobStartedAt" TIMESTAMP(3),
    "workDoneAt" TIMESTAMP(3),
    "receiptUrl" TEXT,
    "receiptUploadedAt" TIMESTAMP(3),
    "handymanPaidOut" BOOLEAN NOT NULL DEFAULT false,
    "paidOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_extensions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "additionalMinutes" INTEGER NOT NULL,
    "extraAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "booking_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tips" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "stripeSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_phases" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "booking_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "handymanReply" TEXT,
    "handymanRepliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "budgetMin" DOUBLE PRECISION NOT NULL,
    "budgetMax" DOUBLE PRECISION NOT NULL,
    "materialsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "urgency" TEXT NOT NULL DEFAULT 'STANDARD',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "service_point" geography(Point, 4326),
    "geocode_confidence" DOUBLE PRECISION,
    "geocode_source" TEXT,
    "geocode_error" TEXT,
    "geocoded_at" TIMESTAMP(3),
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_applications" (
    "id" TEXT NOT NULL,
    "jobRequestId" TEXT NOT NULL,
    "handymanId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "proposedPrice" DOUBLE PRECISION,
    "materialsEstimate" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_photos" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "handymanId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "maxUses" INTEGER,
    "usesCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processed',
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "active_states" (
    "state" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "active_states_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "proxy_sessions" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "proxyNumber" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "handymanPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastCallSid" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "proxy_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens"("token");

-- CreateIndex
CREATE INDEX "device_tokens_userId_idx" ON "device_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "fcm_outbox_dedupe_uidx" ON "fcm_outbox"("dedupe_key");

-- CreateIndex
CREATE INDEX "fcm_outbox_retry_idx" ON "fcm_outbox"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "fcm_outbox_notification_idx" ON "fcm_outbox"("notification_id");

-- CreateIndex
CREATE INDEX "fcm_outbox_user_created_idx" ON "fcm_outbox"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "handyman_profiles_userId_key" ON "handyman_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "handyman_availability_profileId_dayOfWeek_key" ON "handyman_availability"("profileId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_bookingId_key" ON "reviews"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_jobRequestId_handymanId_key" ON "job_applications"("jobRequestId", "handymanId");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_customerId_handymanId_key" ON "favorites"("customerId", "handymanId");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE INDEX "promo_codes_ownerId_idx" ON "promo_codes"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_settings_key_key" ON "admin_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_eventId_key" ON "stripe_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX "proxy_sessions_proxyNumber_status_idx" ON "proxy_sessions"("proxyNumber", "status");

-- CreateIndex
CREATE INDEX "proxy_sessions_bookingId_idx" ON "proxy_sessions"("bookingId");

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_codes" ADD CONSTRAINT "otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handyman_profiles" ADD CONSTRAINT "handyman_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handyman_availability" ADD CONSTRAINT "handyman_availability_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "handyman_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_handymanId_fkey" FOREIGN KEY ("handymanId") REFERENCES "handyman_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_handymanId_fkey" FOREIGN KEY ("handymanId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_extensions" ADD CONSTRAINT "booking_extensions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tips" ADD CONSTRAINT "tips_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_phases" ADD CONSTRAINT "booking_phases_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requests" ADD CONSTRAINT "job_requests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_jobRequestId_fkey" FOREIGN KEY ("jobRequestId") REFERENCES "job_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_handymanId_fkey" FOREIGN KEY ("handymanId") REFERENCES "handyman_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_photos" ADD CONSTRAINT "portfolio_photos_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "handyman_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_handymanId_fkey" FOREIGN KEY ("handymanId") REFERENCES "handyman_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_sessions" ADD CONSTRAINT "proxy_sessions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- === generated output ends ==================================================

-- [ADDED 2] Spatial indexes from migrations/001_postgis_service_point.sql -----
-- Prisma models the geography columns as Unsupported(), which means it emits
-- the columns but knows nothing about how they are queried. These three indexes
-- are what make the geographic matcher an index scan.
CREATE INDEX IF NOT EXISTS job_requests_service_point_gix
  ON job_requests USING GIST (service_point);

CREATE INDEX IF NOT EXISTS handyman_profiles_service_point_gix
  ON handyman_profiles USING GIST (service_point);

-- Supports the "jobs awaiting geocode / stuck in draft" operational query.
CREATE INDEX IF NOT EXISTS job_requests_status_geocoded_idx
  ON job_requests (status, geocoded_at);

-- [ADDED 3] updated_at triggers ----------------------------------------------
-- @updatedAt is a Prisma *client* feature. The generated DDL therefore declares
-- these columns NOT NULL with no default and no trigger: correct only for as
-- long as every write goes through Prisma. Since the point of this migration is
-- that writes stop going through Prisma, the guarantee has to move server-side
-- or the columns break the moment PostgREST or an Edge Function inserts a row.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at_snake()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- camelCase updatedAt (Prisma default mapping)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','handyman_profiles','services','bookings',
    'job_requests','admin_settings','active_states'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN "updatedAt" SET DEFAULT now()', t);
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I', t || '_set_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t || '_set_updated_at', t);
  END LOOP;
END $$;

-- snake_case updated_at (device_tokens and fcm_outbox use @map)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['device_tokens','fcm_outbox'] LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN updated_at SET DEFAULT now()', t);
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON %I', t || '_set_updated_at', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at_snake()',
      t || '_set_updated_at', t);
  END LOOP;
END $$;

-- RLS: deny-all baseline ------------------------------------------------------
-- Enabled with no policies. anon and authenticated get nothing; service_role
-- bypasses RLS and keeps working, so server-side routes are unaffected. Each
-- table gets real policies as its routes are ported -- never by turning this
-- off.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

COMMIT;
