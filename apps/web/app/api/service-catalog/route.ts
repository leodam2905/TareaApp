import { NextResponse } from "next/server";
import { SERVICE_CATEGORIES, SERVICE_TASKS } from "@/lib/service-catalog";

// The guided question set, so both front ends ask the same things.
//
// Static data, so it is cached hard: it changes when someone edits the module
// and redeploys, never per request.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(
    { categories: SERVICE_CATEGORIES, tasks: SERVICE_TASKS },
    { headers: { "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400" } },
  );
}
