import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function starRating(rating: number): string {
  return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
}

export const SERVICE_CATEGORY_LABELS: Record<string, string> = {
  PLUMBING: "Plumbing",
  ELECTRICAL: "Electrical",
  CARPENTRY: "Carpentry",
  PAINTING: "Painting",
  CLEANING: "Cleaning",
  HVAC: "HVAC",
  ROOFING: "Roofing",
  LANDSCAPING: "Landscaping",
  MOVING: "Moving",
  APPLIANCE_REPAIR: "Appliance Repair",
  GENERAL: "General",
};

export const SERVICE_CATEGORY_ICONS: Record<string, string> = {
  PLUMBING: "🔧",
  ELECTRICAL: "⚡",
  CARPENTRY: "🪚",
  PAINTING: "🎨",
  CLEANING: "🧹",
  HVAC: "❄️",
  ROOFING: "🏠",
  LANDSCAPING: "🌿",
  MOVING: "📦",
  APPLIANCE_REPAIR: "🔌",
  GENERAL: "🛠️",
};
