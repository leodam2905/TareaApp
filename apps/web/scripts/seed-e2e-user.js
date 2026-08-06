/**
 * Seeds the customer account the Playwright "authed" project logs in as.
 *
 * The REVIEW_ACCOUNTS allowlist in app/api/auth/login/route.ts skips OTP for
 * this email, which is the only way a test can get past the login step. The
 * account exists in production but not in a fresh local database, so this
 * script creates it on demand.
 *
 * Idempotent — safe to re-run. Never point it at production.
 *
 *   node scripts/seed-e2e-user.js
 */
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const email = process.env.E2E_CUSTOMER_EMAIL;
  const password = process.env.E2E_CUSTOMER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_CUSTOMER_EMAIL and E2E_CUSTOMER_PASSWORD must be set in .env.local"
    );
  }

  const url = process.env.DATABASE_URL ?? "";
  if (!/localhost|127\.0\.0\.1/.test(url)) {
    throw new Error(
      `Refusing to seed: DATABASE_URL is not local (${url.replace(/:[^:@]*@/, ":***@")}). ` +
        "This script creates a known-password account and must never touch production."
    );
  }

  // Match the cost factor used by hashPassword() in lib/auth.ts.
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: {
      email,
      passwordHash,
      name: "E2E Test Customer",
      role: "CUSTOMER",
      isActive: true,
      isVerified: true,
      city: "Pasadena",
      state: "CA",
      zipCode: "91101",
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`Seeded ${user.role} ${user.email} (${user.id})`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
