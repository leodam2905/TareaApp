import type { PromoCode } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// A customer's "first order" = they have no prior paid booking. Used to gate
// first-order-only promo codes.
export async function hasPriorPaidOrder(userId: string): Promise<boolean> {
  const count = await prisma.booking.count({ where: { customerId: userId, isPaid: true } });
  return count > 0;
}

export interface PromoCheckResult {
  ok: boolean;
  error?: string;
  discountAmount: number;
}

/**
 * Single source of truth for whether a promo code may be redeemed by a given
 * user for a given price, and how much it discounts.
 *
 * Enforces: active, not expired, under maxUses, and ownership — a code with a
 * non-null ownerId may only be redeemed by that user (null = public/global).
 * Used at validate, booking-create, and checkout time so a code can't be
 * applied through one path while bypassing checks on another.
 */
export function assertPromoUsable(
  promo: Pick<PromoCode, "isActive" | "expiresAt" | "maxUses" | "usesCount" | "discountType" | "discountValue" | "ownerId" | "firstOrderOnly">,
  userId: string,
  totalPrice: number,
  // Pass the caller's knowledge of whether this user already has a paid order,
  // so a first-order-only code can be rejected for returning customers.
  hasPriorPaidOrder = false
): PromoCheckResult {
  if (!promo.isActive) {
    return { ok: false, error: "This promo code is no longer active", discountAmount: 0 };
  }
  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return { ok: false, error: "This promo code has expired", discountAmount: 0 };
  }
  if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
    return { ok: false, error: "This promo code has reached its usage limit", discountAmount: 0 };
  }
  if (promo.firstOrderOnly && hasPriorPaidOrder) {
    return { ok: false, error: "This code is only valid on your first order", discountAmount: 0 };
  }
  if (promo.ownerId && promo.ownerId !== userId) {
    // Don't reveal that the code exists for someone else — generic message.
    return { ok: false, error: "Invalid promo code", discountAmount: 0 };
  }

  const discountAmount =
    promo.discountType === "PERCENT"
      ? totalPrice * (promo.discountValue / 100)
      : Math.min(promo.discountValue, totalPrice);

  return { ok: true, discountAmount };
}
