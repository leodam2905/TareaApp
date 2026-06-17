import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// TEMP: hardcoded for screenshots — replace with DB query after Prisma client is regenerated
const MOCK_HANDYMEN = [
  {
    id: "cmqfma1ah0000pi2x0ku12kre",
    name: "John Martinez",
    avatarUrl: null,
    city: "Los Angeles",
    state: "CA",
    latitude: 34.0522,
    longitude: -118.2437,
    isVerified: true,
    handymanProfile: {
      bio: "Professional handyman with 10 years experience. Specializing in plumbing, electrical, and general repairs.",
      hourlyRate: 75,
      rating: 4.8,
      totalJobs: 47,
      isPremium: false,
    },
    services: [
      { title: "Plumbing Repair", category: "PLUMBING" },
      { title: "Electrical", category: "ELECTRICAL" },
      { title: "General Repairs", category: "GENERAL" },
    ],
  },
];

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(MOCK_HANDYMEN);
}
