import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildTaxReport, taxReportCsv } from "@/lib/tax-report";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = parseInt(searchParams.get("year") || "", 10);
  const thisYear = new Date().getFullYear();
  // A junk or absurd year would silently report zero earnings, which reads as
  // "you earned nothing" rather than "that year does not exist".
  const year = Number.isFinite(parsed) && parsed >= 2020 && parsed <= thisYear ? parsed : thisYear;
  const format = searchParams.get("format") || "json"; // "json" | "csv"

  const report = await buildTaxReport(user.id, user.name, year);

  if (format === "csv") {
    return new NextResponse(taxReportCsv(report), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="tarea-earnings-${year}.csv"`,
      },
    });
  }

  return NextResponse.json(report);
}
